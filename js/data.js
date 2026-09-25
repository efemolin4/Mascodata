/* ============================================================
   MASCODATA — Carga de datos (Supabase → estado local)
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Carga de mascotas/admin desde
   Supabase, y las dos funciones que combinan eventos/gastos "reales"
   (ya ocurridos) con los creados a mano. */

async function loadDataFromSupabase() {
  if (!state.user?.id) return;
  try {
    // Fetch profile first (is_admin, plan, datos de contacto) — always, regardless of pets
    // reminders_opt_out la agrega supabase/schema/pet_reminders.sql; si esa migración
    // aún no se corrió, la columna no existe y la consulta falla — se reintenta sin ella
    // para no romper el inicio de sesión de nadie.
    let { data: profile, error: profileError } = await sb.from('profiles').select('is_admin, plan, phone, city, marketing_opt_in, reminders_opt_out').eq('id', state.user.id).single();
    if (profileError) ({ data: profile } = await sb.from('profiles').select('is_admin, plan, phone, city, marketing_opt_in').eq('id', state.user.id).single());
    if (profile) {
      state.user.isAdmin = profile.is_admin || false;
      state.user.plan = profile.plan || 'free';
      state.user.phone = profile.phone || '';
      state.user.city = profile.city || '';
      state.user.marketingOptIn = profile.marketing_opt_in || false;
      if ('reminders_opt_out' in profile) state.user.remindersOptOut = !!profile.reminders_opt_out;
      saveState();
      // Solo id y plan: nada de nombre, email ni teléfono en la analítica.
      try { window.posthog?.identify(state.user.id, { plan: state.user.plan }); } catch (e) {}
    }

    const { data: accessRows } = await sb.from('pet_access')
      .select('pet_id, role, pets(*)')
      .eq('user_id', state.user.id);

    if (!accessRows || accessRows.length === 0) { state.pets = []; state.events = []; state.expenses = []; return; }

    const petIds = accessRows.map(r => r.pet_id);

    const [vaccRes, dewRes, medRes, histRes, wRes, moodRes, symRes, foodRes, actRes, doseRes, evRes, expRes, botRes, invRes, purRes, setRes] = await Promise.all([
      sb.from('vaccines').select('*').in('pet_id', petIds),
      sb.from('dewormings').select('*').in('pet_id', petIds),
      sb.from('medications').select('*').in('pet_id', petIds),
      sb.from('history_records').select('*').in('pet_id', petIds),
      sb.from('weight_history').select('*').in('pet_id', petIds).order('date'),
      sb.from('mood_logs').select('*').in('pet_id', petIds),
      sb.from('symptoms_logs').select('*').in('pet_id', petIds),
      sb.from('food_items').select('*').in('pet_id', petIds),
      sb.from('activities').select('*').in('pet_id', petIds),
      sb.from('dose_logs').select('*').in('pet_id', petIds),
      // Los eventos con mascota son de todos sus tutores; los que no tienen mascota, solo míos.
      sb.from('events').select('*').or(`user_id.eq.${state.user.id},pet_id.in.(${petIds.join(',')})`),
      // Mis gastos, y los de las mascotas que reparten gastos con otro tutor (la base solo entrega estos últimos si corresponde).
      sb.from('expenses').select('*').or(`user_id.eq.${state.user.id},pet_id.in.(${petIds.join(',')})`),
      sb.from('botiquin_items').select('*').eq('user_id', state.user.id),
      sb.from('invitations').select('*').in('pet_id', petIds).order('created_at', { ascending: false }),
      // Historial de compras de alimento: tabla opcional (supabase/schema/food_purchases.sql).
      // No entra en allResults: si aún no se creó, la app sigue sin historial y sin avisos de error.
      sb.from('food_purchases').select('*').in('pet_id', petIds),
      // Pagos entre tutores (supabase/schema/shared_expenses.sql): opcional, igual que las compras de alimento.
      sb.from('expense_settlements').select('*').in('pet_id', petIds),
    ]);

    // Ninguna de estas 14 queries revisaba `.error` — un fallo puntual
    // (ej. un hiccup de RLS en una sola tabla) hacía que esa tabla
    // simplemente quedara en `[]` sin ningún aviso, como si la mascota no
    // tuviera esos registros, en vez de mostrar que algo falló al cargar.
    const allResults = [vaccRes, dewRes, medRes, histRes, wRes, moodRes, symRes, foodRes, actRes, doseRes, evRes, expRes, botRes, invRes];
    const failedQueries = allResults.filter(r => r.error);
    if (failedQueries.length) {
      console.error('Error cargando datos de Supabase:', failedQueries.map(r => r.error));
      showToast('Algunos datos no se pudieron cargar, intenta recargar la página', 'error');
    }

    const vacc = vaccRes.data || [], dew = dewRes.data || [], med = medRes.data || [];
    const hist = histRes.data || [], wh = wRes.data || [], mood = moodRes.data || [];
    const sym = symRes.data || [], food = foodRes.data || [], act = actRes.data || [];
    const dose = doseRes.data || [];
    const invites = invRes.data || [];
    const purchases = purRes?.error ? [] : (purRes?.data || []);

    state.pets = accessRows.map(row => {
      const pet = row.pets;
      const pid = pet.id;
      return {
        id: pid, myRole: row.role || 'owner',
        name: pet.name, species: pet.species, breed: pet.breed,
        dateOfBirth: pet.date_of_birth, sex: pet.sex, color: pet.color,
        reproductiveStatus: pet.reproductive_status, chipNumber: pet.microchip,
        personalityTags: pet.personality_tags || [],
        avatar: pet.avatar_emoji || '', photo: pet.photo || null,
        vet: { name: pet.vet_name||'', clinic: pet.vet_clinic||'', phone: pet.vet_phone||'', email: pet.vet_email||'' },
        weightKg: pet.weight_kg ?? '', weightGr: pet.weight_gr ?? '',
        createdAt: pet.created_at || null,
        careMode: pet.care_mode || 'together',
        expenseSplit: pet.expense_split || 'none',
        sizeRange: pet.size_range || '', activityLevel: pet.activity_level || 2,
        allergies: pet.allergies || [], chronicConditions: pet.chronic_conditions || [],
        bcs: pet.bcs ?? null,
        tutor2: (() => {
          const inv = invites.find(i => i.pet_id === pid);
          return inv ? { name: inv.invited_name, email: inv.invited_email, role: inv.role, pending: !inv.used } : null;
        })(),
        vaccines: vacc.filter(v => v.pet_id === pid).map(v => ({
          id: v.id, name: v.name, code: v.code, date: v.date, periodicity: v.periodicity,
          nextDate: v.next_date, alertType: v.alert_type, alertDays: v.alert_days, cost: v.cost,
          createdBy: v.created_by || null, createdByName: v.created_by_name || null })),
        deworming: dew.filter(d => d.pet_id === pid).map(d => ({
          id: d.id, product: d.product, type: d.type, format: d.format, dose: d.dose, unit: d.unit,
          date: d.date, periodicity: d.periodicity,
          nextDate: d.next_date, alertType: d.alert_type, alertDays: d.alert_days, cost: d.cost,
          createdBy: d.created_by || null, createdByName: d.created_by_name || null })),
        medications: med.filter(m => m.pet_id === pid).map(m => ({
          id: m.id, name: m.name, doseVal: m.dose_val, doseUnit: m.dose_unit,
          dose: m.dose_val != null ? `${m.dose_val} ${m.dose_unit||''}`.trim() : '',
          freqN: m.freq_n, freqUnit: m.freq_unit,
          frequency: m.freq_n ? `Cada ${m.freq_n} ${m.freq_unit === 'horas' ? 'horas' : 'días'}` : '',
          startDate: m.start_date, startTime: m.start_time,
          treatmentDays: m.treatment_days, endDate: m.end_date, active: m.active,
          reminder: m.reminder, stockTotal: m.stock_qty, stockUnit: m.stock_unit,
          expiry: m.expiry_date, cost: m.cost,
          createdBy: m.created_by || null, createdByName: m.created_by_name || null })),
        clinicalHistory: hist.filter(h => h.pet_id === pid).map(h => ({
          id: h.id, title: h.title, type: h.type, date: h.date,
          doctor: h.vet, clinic: h.clinic, cost: h.cost, notes: h.notes,
          files: (h.files || []).map(f => { try { return JSON.parse(f); } catch(e) { return null; } }).filter(Boolean),
          createdBy: h.created_by || null, createdByName: h.created_by_name || null })),
        weightHistory: wh.filter(w => w.pet_id === pid).map(w => ({
          id: w.id, date: w.date, kg: w.kg, gr: w.gr, notes: w.notes,
          createdBy: w.created_by || null, createdByName: w.created_by_name || null })),
        moodLog: mood.filter(m => m.pet_id === pid).map(m => ({
          id: m.id, date: m.date, mood: m.mood, energy: m.energy, notes: m.notes })),
        symptomsLog: sym.filter(s => s.pet_id === pid).map(s => ({
          id: s.id, date: s.date, symptoms: s.symptoms, severity: s.severity, notes: s.notes })),
        foodItems: food.filter(f => f.pet_id === pid).map(f => ({
          id: f.id, product: f.product, type: f.type, category: f.category, packageSize: f.package_size,
          packageUnit: f.package_unit, dailyAmount: f.daily_amount, price: f.price,
          purchaseDate: f.purchase_date, notes: f.notes,
          purchases: purchases.filter(x => x.food_item_id === f.id).map(x => ({
            id: x.id, date: x.purchase_date, price: x.price, packageSize: x.package_size, packageUnit: x.package_unit,
            createdBy: x.created_by || null, createdByName: x.created_by_name || null })) })),
        activities: act.filter(a => a.pet_id === pid).map(a => ({
          id: a.id, date: a.date, type: a.type, duration: a.duration, distance: a.distance, notes: a.notes })),
        doseLog: dose.filter(d => d.pet_id === pid).map(d => ({
          id: d.id, medicationId: d.med_id, date: d.date, given: d.confirmed, loggedAt: d.logged_at || null,
          createdBy: d.created_by || null, createdByName: d.created_by_name || null })),
      };
    });

    state.events = (evRes.data || []).map(e => ({
      id: e.id, title: e.title, date: e.date, time: e.time, userId: e.user_id,
      endDate: e.end_date || null, holder: e.holder || null, createdBy: e.created_by || e.user_id || null, createdByName: e.created_by_name || null,
      type: e.type, petId: e.pet_id, pet: state.pets.find(p => p.id === e.pet_id)?.name || null, notes: e.notes }));

    state.expenses = (expRes.data || []).map(e => ({
      id: e.id, petId: e.pet_id, pet: state.pets.find(p => p.id === e.pet_id)?.name || null,
      date: e.date, category: e.category, amount: e.amount, description: e.description,
      userId: e.user_id, createdByName: e.created_by_name || null }));
    state.settlements = (setRes?.error ? [] : (setRes?.data || [])).map(x => ({
      id: x.id, petId: x.pet_id, amount: Number(x.amount), date: x.date, note: x.note || '', direction: x.direction || 'paid',
      createdBy: x.created_by || null, createdByName: x.created_by_name || null }));

    state.lastDataLoadAt = Date.now();

    // store botiquin separately (not inside pet objects)
    state.botiquin = (botRes.data || []).map(b => ({
      id: b.id, petId: b.pet_id, name: b.name, category: b.type,
      quantity: b.quantity, unit: b.unit, doseVal: b.dose_val, doseUnit: b.dose_unit,
      cost: b.cost, purchaseDate: b.purchase_date, expiryDate: b.expiry_date,
      notes: b.notes }));

  } catch(err) {
    console.error('Error loading from Supabase:', err);
    showToast('Error al cargar datos', 'error');
  }
}

// ---- ADMIN: cargar todos los datos ----
async function loadAdminData() {
  if (!state.user?.isAdmin) return;
  try {
    const [profilesRes, petsRes, planChangesRes] = await Promise.all([
      sb.from('profiles').select('*').order('created_at', { ascending: false }),
      sb.from('pets').select('id, owner_id, species, created_at'),
      // Auditoría de cambios de plan (ver applyPlanChange() en js/admin.js) —
      // permite calcular churn (bajas Premium→Free) y mostrar el historial,
      // algo que antes no existía: applyPlanChange() sobrescribía el plan
      // sin dejar ningún rastro de quién lo cambió, ni de qué a qué, ni cuándo.
      sb.from('plan_changes').select('*').order('changed_at', { ascending: false }),
    ]);
    state.adminData = {
      profiles: profilesRes.data || [],
      pets: petsRes.data || [],
      planChanges: planChangesRes.data || [],
    };
  } catch(err) {
    console.error('Admin data error:', err);
  }
}

// Igual que getFinanceExpenses(): una vacuna aplicada, una desparasitación, el
// inicio de un tratamiento o un evento del historial clínico ya ocurrieron,
// pero vivían solo en sus propias tablas — la Agenda solo mostraba lo creado
// a mano con "Crear evento". Esto los junta para que quede registro real de
// lo que se hizo, no solo de lo agendado.
function getAgendaEvents() {
  const manual = (state.events || []).map(e => ({ ...e, source: 'manual' }));
  const synth = [];
  (state.pets || []).forEach(pet => {
    (pet.vaccines || []).forEach(v => { if (v.date) synth.push({
      id: 'vac-'+v.id, petId: pet.id, pet: pet.name, date: v.date, type: 'Vacuna',
      title: `Vacuna: ${v.name}`, source: 'vaccine' }); });
    (pet.deworming || []).forEach(d => { if (d.date) synth.push({
      id: 'dew-'+d.id, petId: pet.id, pet: pet.name, date: d.date, type: 'Desparasitación',
      title: `Desparasitación: ${d.product}`, source: 'deworming' }); });
    (pet.medications || []).forEach(m => { if (m.startDate) synth.push({
      id: 'med-'+m.id, petId: pet.id, pet: pet.name, date: m.startDate, type: 'Tratamiento',
      title: `Tratamiento: ${m.name}`, source: 'medication' }); });
    (pet.clinicalHistory || []).forEach(h => { if (h.date) synth.push({
      id: 'his-'+h.id, petId: pet.id, pet: pet.name, date: h.date, type: 'Historial',
      title: h.title, source: 'history' }); });
  });
  return [...manual, ...synth];
}

// El campo "Costo (CLP)" de vacunas, desparasitaciones, tratamientos, historial
// clínico, productos del botiquín y alimento (pestaña Nutrición) vive solo en
// esas tablas — nunca se refleja en Finanzas por sí solo, que hasta ahora solo
// mostraba lo cargado manualmente con "Registrar gasto". Esta función junta
// todas las fuentes para que un costo cargado desde la ficha de la mascota,
// el botiquín o el alimento también cuente en el total y aparezca en el
// listado.
function getFinanceExpenses() {
  const me = state.user?.id || null;
  const manual = (state.expenses || []).map(e => ({ ...e, source: 'manual', payerId: e.userId || null, payerName: e.createdByName || null }));
  const synth = [];
  // Quien registró el gasto es quien lo pagó (payerId); los registros anteriores a que se guardara el autor no lo tienen.
  const push = (pet, rec, row) => synth.push({ petId: pet.id, pet: pet.name, payerId: rec?.createdBy || null, payerName: rec?.createdByName || null, ...row });
  (state.pets || []).forEach(pet => {
    (pet.vaccines || []).forEach(v => { if (Number(v.cost) > 0) push(pet, v, {
      id: 'vac-'+v.id, date: v.date, category: 'Veterinaria',
      amount: v.cost, description: `Vacuna: ${v.name}`, source: 'vaccine' }); });
    (pet.deworming || []).forEach(d => { if (Number(d.cost) > 0) push(pet, d, {
      id: 'dew-'+d.id, date: d.date, category: 'Veterinaria',
      amount: d.cost, description: `Desparasitación: ${d.product}`, source: 'deworming' }); });
    (pet.medications || []).forEach(m => { if (Number(m.cost) > 0) push(pet, m, {
      id: 'med-'+m.id, date: m.startDate, category: 'Medicamentos',
      amount: m.cost, description: `Tratamiento: ${m.name}`, source: 'medication' }); });
    (pet.clinicalHistory || []).forEach(h => { if (Number(h.cost) > 0) push(pet, h, {
      id: 'his-'+h.id, date: h.date, category: 'Veterinaria',
      amount: h.cost, description: h.title, source: 'history' }); });
    // Cada compra registrada es un gasto; un alimento sin historial usa su propio precio.
    (pet.foodItems || []).forEach(f => {
      if (f.purchases?.length) {
        f.purchases.forEach(pu => { if (Number(pu.price) > 0) push(pet, pu, {
          id: 'food-'+pu.id, date: pu.date || todayStr(), category: 'Alimentación',
          amount: pu.price, description: `Alimento: ${f.product}`, source: 'food' }); });
      } else if (Number(f.price) > 0) push(pet, f, {
        id: 'food-'+f.id, date: f.purchaseDate || todayStr(), category: 'Alimentación',
        amount: f.price, description: `Alimento: ${f.product}`, source: 'food' });
    });
  });
  // El botiquín es personal (no se reparte): siempre lo pagó quien lo ve.
  (state.botiquin || []).forEach(item => { if (Number(item.cost) > 0) synth.push({
    id: 'bot-'+item.id, petId: item.petId, pet: (state.pets||[]).find(p => p.id === item.petId)?.name || null,
    date: item.purchaseDate || todayStr(), category: 'Medicamentos',
    amount: item.cost, description: `Botiquín: ${item.name}`, source: 'botiquin', payerId: me, payerName: state.user?.name || null }); });
  // En las mascotas que reparten gastos, lo que pagó el otro tutor no entra a mis totales: va al saldo.
  const split = new Set((state.pets || []).filter(p => p.expenseSplit === 'equal').map(p => p.id));
  return [...manual, ...synth].map(e => ({ ...e, paidByOther: !!(e.petId && split.has(e.petId) && e.payerId && me && e.payerId !== me) }));
}

// Con dos tutores, lo que uno registra no llega solo a la pantalla del otro. Al volver a la
// pestaña (o a la ventana) se recargan los datos, como máximo una vez por minuto, y solo si la
// persona comparte alguna mascota, no está en el modo demo, no hay un modal abierto ni está
// creando una mascota (para no borrarle lo que estaba escribiendo).
async function refreshSharedData() {
  if (!state.isLoggedIn || !state.user?.id || isDemoUser()) return;
  if (!(state.pets || []).some(p => p.tutor2)) return;
  if (state.currentView === 'addPet') return;
  if (document.querySelector('#modal-root .modal-overlay')) return;
  if (Date.now() - (state.lastDataLoadAt || 0) < 60000) return;
  await loadDataFromSupabase();
  render();
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshSharedData(); });
  window.addEventListener('focus', refreshSharedData);
}

export { loadDataFromSupabase, loadAdminData, getAgendaEvents, getFinanceExpenses, refreshSharedData };

if (typeof window !== 'undefined') {
  Object.assign(window, { loadDataFromSupabase, loadAdminData, getAgendaEvents, getFinanceExpenses, refreshSharedData });
}
