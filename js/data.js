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

    const [vaccRes, dewRes, medRes, histRes, wRes, moodRes, symRes, foodRes, actRes, doseRes, evRes, expRes, botRes, invRes] = await Promise.all([
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
      sb.from('events').select('*').eq('user_id', state.user.id),
      sb.from('expenses').select('*').eq('user_id', state.user.id),
      sb.from('botiquin_items').select('*').eq('user_id', state.user.id),
      sb.from('invitations').select('*').in('pet_id', petIds).order('created_at', { ascending: false }),
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
        sizeRange: pet.size_range || '', activityLevel: pet.activity_level || 2,
        allergies: pet.allergies || [], chronicConditions: pet.chronic_conditions || [],
        bcs: pet.bcs ?? null,
        tutor2: (() => {
          const inv = invites.find(i => i.pet_id === pid);
          return inv ? { name: inv.invited_name, email: inv.invited_email, role: inv.role, pending: !inv.used } : null;
        })(),
        vaccines: vacc.filter(v => v.pet_id === pid).map(v => ({
          id: v.id, name: v.name, code: v.code, date: v.date, periodicity: v.periodicity,
          nextDate: v.next_date, alertType: v.alert_type, alertDays: v.alert_days, cost: v.cost })),
        deworming: dew.filter(d => d.pet_id === pid).map(d => ({
          id: d.id, product: d.product, type: d.type, format: d.format, dose: d.dose, unit: d.unit,
          date: d.date, periodicity: d.periodicity,
          nextDate: d.next_date, alertType: d.alert_type, alertDays: d.alert_days, cost: d.cost })),
        medications: med.filter(m => m.pet_id === pid).map(m => ({
          id: m.id, name: m.name, doseVal: m.dose_val, doseUnit: m.dose_unit,
          dose: m.dose_val != null ? `${m.dose_val} ${m.dose_unit||''}`.trim() : '',
          freqN: m.freq_n, freqUnit: m.freq_unit,
          frequency: m.freq_n ? `Cada ${m.freq_n} ${m.freq_unit === 'horas' ? 'horas' : 'días'}` : '',
          startDate: m.start_date, startTime: m.start_time,
          treatmentDays: m.treatment_days, endDate: m.end_date, active: m.active,
          reminder: m.reminder, stockTotal: m.stock_qty, stockUnit: m.stock_unit,
          expiry: m.expiry_date, cost: m.cost })),
        clinicalHistory: hist.filter(h => h.pet_id === pid).map(h => ({
          id: h.id, title: h.title, type: h.type, date: h.date,
          doctor: h.vet, clinic: h.clinic, cost: h.cost, notes: h.notes,
          files: (h.files || []).map(f => { try { return JSON.parse(f); } catch(e) { return null; } }).filter(Boolean) })),
        weightHistory: wh.filter(w => w.pet_id === pid).map(w => ({
          id: w.id, date: w.date, kg: w.kg, gr: w.gr, notes: w.notes })),
        moodLog: mood.filter(m => m.pet_id === pid).map(m => ({
          id: m.id, date: m.date, mood: m.mood, energy: m.energy, notes: m.notes })),
        symptomsLog: sym.filter(s => s.pet_id === pid).map(s => ({
          id: s.id, date: s.date, symptoms: s.symptoms, severity: s.severity, notes: s.notes })),
        foodItems: food.filter(f => f.pet_id === pid).map(f => ({
          id: f.id, product: f.product, type: f.type, packageSize: f.package_size,
          packageUnit: f.package_unit, dailyAmount: f.daily_amount, price: f.price,
          purchaseDate: f.purchase_date, notes: f.notes })),
        activities: act.filter(a => a.pet_id === pid).map(a => ({
          id: a.id, date: a.date, type: a.type, duration: a.duration, distance: a.distance, notes: a.notes })),
        doseLog: dose.filter(d => d.pet_id === pid).map(d => ({
          id: d.id, medicationId: d.med_id, date: d.date, given: d.confirmed })),
      };
    });

    state.events = (evRes.data || []).map(e => ({
      id: e.id, title: e.title, date: e.date, time: e.time,
      type: e.type, petId: e.pet_id, pet: state.pets.find(p => p.id === e.pet_id)?.name || null, notes: e.notes }));

    state.expenses = (expRes.data || []).map(e => ({
      id: e.id, petId: e.pet_id, pet: state.pets.find(p => p.id === e.pet_id)?.name || null,
      date: e.date, category: e.category, amount: e.amount, description: e.description }));

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
  const manual = (state.expenses || []).map(e => ({ ...e, source: 'manual' }));
  const synth = [];
  (state.pets || []).forEach(pet => {
    (pet.vaccines || []).forEach(v => { if (Number(v.cost) > 0) synth.push({
      id: 'vac-'+v.id, petId: pet.id, pet: pet.name, date: v.date, category: 'Veterinaria',
      amount: v.cost, description: `Vacuna: ${v.name}`, source: 'vaccine' }); });
    (pet.deworming || []).forEach(d => { if (Number(d.cost) > 0) synth.push({
      id: 'dew-'+d.id, petId: pet.id, pet: pet.name, date: d.date, category: 'Veterinaria',
      amount: d.cost, description: `Desparasitación: ${d.product}`, source: 'deworming' }); });
    (pet.medications || []).forEach(m => { if (Number(m.cost) > 0) synth.push({
      id: 'med-'+m.id, petId: pet.id, pet: pet.name, date: m.startDate, category: 'Medicamentos',
      amount: m.cost, description: `Tratamiento: ${m.name}`, source: 'medication' }); });
    (pet.clinicalHistory || []).forEach(h => { if (Number(h.cost) > 0) synth.push({
      id: 'his-'+h.id, petId: pet.id, pet: pet.name, date: h.date, category: 'Veterinaria',
      amount: h.cost, description: h.title, source: 'history' }); });
    (pet.foodItems || []).forEach(f => { if (Number(f.price) > 0) synth.push({
      id: 'food-'+f.id, petId: pet.id, pet: pet.name, date: f.purchaseDate || todayStr(), category: 'Alimentación',
      amount: f.price, description: `Alimento: ${f.product}`, source: 'food' }); });
  });
  (state.botiquin || []).forEach(item => { if (Number(item.cost) > 0) synth.push({
    id: 'bot-'+item.id, petId: item.petId, pet: (state.pets||[]).find(p => p.id === item.petId)?.name || null,
    date: item.purchaseDate || todayStr(), category: 'Medicamentos',
    amount: item.cost, description: `Botiquín: ${item.name}`, source: 'botiquin' }); });
  return [...manual, ...synth];
}

export { loadDataFromSupabase, loadAdminData, getAgendaEvents, getFinanceExpenses };

if (typeof window !== 'undefined') {
  Object.assign(window, { loadDataFromSupabase, loadAdminData, getAgendaEvents, getFinanceExpenses });
}
