/* ============================================================
   MASCODATA — Seguimiento y Nutrición
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Pestaña de Seguimiento (peso,
   ánimo, síntomas) y Nutrición (stock de alimento, check-in de
   actividad con racha). */

export function tabSeguimiento(pet) {
  const today = todayStr();
  const history = pet.weightHistory || [];
  const moodLog = pet.moodLog || [];
  const symptomsLog = pet.symptomsLog || [];
  const canEdit = canEditPet(pet);

  // Mood for last 7 days
  const last7Days = [];
  for (let i = 6; i >= 0; i--) last7Days.push(addDays(today, -i));
  const moodColors = { great: 'bg-green-400', ok: 'bg-amber-400', low: 'bg-red-400' };
  const moodEmojis = { great: '😄', ok: '😐', low: '😟' };
  const moodLabels = { great: 'Excelente', ok: 'Normal', low: 'Bajo' };
  const todayMood = moodLog.find(m => m.date === today);

  // BCS description
  const bcs = pet.bcs || null;
  let bcsDesc = '', bcsColor = '';
  if (bcs) {
    if (bcs <= 3) { bcsDesc = 'Bajo peso'; bcsColor = 'text-red-600 bg-red-50'; }
    else if (bcs <= 5) { bcsDesc = 'Peso ideal'; bcsColor = 'text-green-600 bg-green-50'; }
    else if (bcs <= 7) { bcsDesc = 'Sobrepeso'; bcsColor = 'text-amber-600 bg-amber-50'; }
    else { bcsDesc = 'Obesidad'; bcsColor = 'text-red-700 bg-red-100'; }
  }

  const hasWeight = history.length > 0;

  setTimeout(() => { if (hasWeight) renderWeightChart(pet); }, 50);

  return `
  <div class="space-y-4">
    <!-- Gráfico de peso -->
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-800 flex items-center gap-1.5">${icon('chartBar','w-4 h-4')} Peso histórico</h3>
        ${canEdit ? `<button onclick="openWeightModal('${pet.id}')" class="btn-primary text-sm">+ Registrar peso</button>` : ''}
      </div>
      ${hasWeight ? `
        <canvas id="weight-chart-${pet.id}" height="180"></canvas>
        <div class="mt-2 text-xs text-gray-400 text-center">Últimas ${Math.min(history.length, 12)} mediciones</div>
      ` : pet.weightKg ? `
        <div class="text-center py-6">
          <div class="text-2xl font-bold text-gray-800">${pet.weightKg} kg${pet.weightGr ? ` ${pet.weightGr} gr` : ''}</div>
          <p class="text-sm text-gray-400 mt-1">Peso registrado en la ficha de ${esc(pet.name)} — aún no tiene historial de mediciones</p>
        </div>
      ` : `
        <div class="text-center py-6">
          <div class="mb-2 flex justify-center text-gray-300">${icon('weight','w-10 h-10')}</div>
          <p class="text-sm text-gray-400">Sin registros de peso. ¡Añade el primero!</p>
        </div>
      `}
    </div>

    <!-- BCS -->
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-800 flex items-center gap-1.5">${icon('weight','w-4 h-4')} Índice condición corporal (BCS)</h3>
      </div>
      <div class="flex gap-2 flex-wrap mb-3">
        ${[1,2,3,4,5,6,7,8,9].map(n => `
          <button ${canEdit ? `onclick="setBCS('${pet.id}',${n})"` : 'disabled'}
            class="w-9 h-9 rounded-xl border-2 text-sm font-bold transition-all ${bcs===n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500'} ${canEdit ? 'hover:border-brand-300' : 'opacity-60 cursor-default'}">
            ${n}
          </button>`).join('')}
      </div>
      ${bcs ? `
        <div class="flex items-center gap-2">
          <span class="font-bold text-2xl text-gray-800">BCS ${bcs}/9</span>
          <span class="px-3 py-1 rounded-xl text-sm font-semibold ${bcsColor}">${bcsDesc}</span>
        </div>
        <p class="text-xs text-gray-400 mt-1">Escala 1-3: Bajo peso · 4-5: Peso ideal · 6-7: Sobrepeso · 8-9: Obesidad</p>
      ` : `<p class="text-sm text-gray-400">Selecciona un valor del 1 al 9</p>`}
    </div>

    <!-- Mood tracker -->
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-800">😊 Estado de ánimo</h3>
        ${canEdit ? `<button onclick="openMoodModal('${pet.id}')" class="btn-primary text-sm">${todayMood ? 'Editar hoy' : '+ Registrar hoy'}</button>` : ''}
      </div>
      ${todayMood ? `
        <div class="flex items-center gap-2 mb-3 p-3 bg-gray-50 rounded-xl">
          <span class="text-2xl">${moodEmojis[todayMood.mood]}</span>
          <div>
            <div class="font-medium text-sm text-gray-800">Hoy: ${moodLabels[todayMood.mood]}</div>
            ${todayMood.notes ? `<div class="text-xs text-gray-500">${esc(todayMood.notes)}</div>` : ''}
          </div>
        </div>
      ` : `<p class="text-xs text-gray-400 mb-3">Aún no registraste el estado de hoy</p>`}
      <div class="flex gap-1.5 items-end">
        ${last7Days.map(d => {
          const entry = moodLog.find(m => m.date === d);
          const isToday = d === today;
          return `
          <div class="flex flex-col items-center gap-1 flex-1">
            <div title="${entry ? moodLabels[entry.mood] : 'Sin dato'}"
              class="w-full rounded-xl ${entry ? moodColors[entry.mood] : 'bg-gray-100'} transition-all"
              style="height:${entry ? (entry.mood==='great'?32:entry.mood==='ok'?24:16) : 10}px"></div>
            <div class="text-[9px] text-gray-400">${isToday ? 'Hoy' : new Date(d+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short'}).slice(0,3)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- Síntomas -->
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-800 flex items-center gap-1.5">${icon('heart','w-4 h-4')} Diario de síntomas</h3>
        ${canEdit ? `<button onclick="openSymptomsModal('${pet.id}')" class="btn-primary text-sm">+ Registrar</button>` : ''}
      </div>
      ${symptomsLog.length === 0
        ? `<div class="text-center py-4"><div class="mb-2 flex justify-center text-gray-300">${icon('heart','w-8 h-8')}</div><p class="text-sm text-gray-400">Sin registros de síntomas</p></div>`
        : `<div class="space-y-2">
             ${[...symptomsLog].sort((a,b)=>b.date>a.date?1:-1).slice(0,5).map(s => `
               <div class="p-3 bg-gray-50 rounded-xl">
                 <div class="flex items-center gap-2 flex-wrap mb-1">
                   <span class="text-xs text-gray-400">${formatDate(s.date)}</span>
                   ${(s.symptoms||[]).map(sym => `<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">${sym}</span>`).join('')}
                 </div>
                 ${s.notes ? `<p class="text-xs text-gray-600">${esc(s.notes)}</p>` : ''}
               </div>`).join('')}
           </div>`}
    </div>
  </div>`;
}

export function tabNutricion(pet) {
  const foodItems = pet.foodItems || [];
  const activities = pet.activities || [];
  const today = todayStr();
  const canEdit = canEditPet(pet);

  const last7Days = [];
  for (let i = 6; i >= 0; i--) last7Days.push(addDays(today, -i));
  const todayActivity = activities.find(a => a.date === today);
  const streak = activityStreak(activities);
  const activityColors = { Poco: 'bg-teal-200', Normal: 'bg-teal-400', Mucho: 'bg-teal-600' };
  const activityHeights = { Poco: 12, Normal: 22, Mucho: 32 };

  return `
  <div class="space-y-4">
    <!-- Alimentación: stock en vez de registro diario -->
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-800 flex items-center gap-1.5">${icon('food','w-4 h-4')} Alimentación</h3>
        ${canEdit ? `<button onclick="openFoodItemModal('${pet.id}')" class="btn-primary text-sm">+ Agregar alimento</button>` : ''}
      </div>
      ${foodItems.length === 0
        ? `<div class="text-center py-6"><div class="mb-2 flex justify-center text-gray-300">${icon('food','w-10 h-10')}</div><p class="text-sm text-gray-400">Sin alimentos registrados</p></div>`
        : `<div class="space-y-3">
             ${foodItems.map(f => {
               const status = foodStockStatus(f);
               const statusColor = { critico: 'text-red-600 bg-red-50', bajo: 'text-amber-600 bg-amber-50', ok: 'text-teal-600 bg-teal-50' };
               return `
               <div class="p-3 bg-gray-50 rounded-xl">
                 <div class="flex items-start justify-between gap-3">
                   <div class="min-w-0">
                     <div class="text-sm font-semibold text-gray-800 truncate">${esc(f.product)}</div>
                     <div class="text-xs text-gray-400">${esc(f.type || '')} · ${f.packageSize||0} ${esc(f.packageUnit||'')} · ${f.dailyAmount||0} ${esc(f.packageUnit||'')}/día${f.price ? ` · ${fmtCLP(f.price)}` : ''}</div>
                   </div>
                   ${canEdit ? `<div class="flex items-center gap-1 flex-shrink-0">
                     <button onclick="openFoodItemModal('${pet.id}','${f.id}')" class="w-7 h-7 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors">${icon('pencil','w-3.5 h-3.5')}</button>
                     <button onclick="deleteFoodItem('${pet.id}','${f.id}')" class="w-7 h-7 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">${icon('trash','w-3.5 h-3.5')}</button>
                   </div>` : ''}
                 </div>
                 ${status ? `
                   <div class="mt-2 flex items-center gap-2">
                     <span class="badge text-xs ${statusColor[status.level]}">${status.label}</span>
                     <span class="text-xs text-gray-400">Se estima que se acaba el ${formatDate(status.runOutDate)}</span>
                   </div>
                   <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                     <div class="h-1.5 rounded-full ${status.level==='critico'?'bg-red-500':status.level==='bajo'?'bg-amber-500':'bg-teal-500'}" style="width:${Math.max(4,Math.min(100, status.daysLeft/30*100))}%"></div>
                   </div>` : `<p class="text-xs text-gray-400 mt-2">Completa tamaño de paquete y consumo diario para estimar cuándo se acaba</p>`}
               </div>`;
             }).join('')}
           </div>`}
    </div>

    <!-- Actividad: check-in diario en vez de registro detallado -->
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-gray-800 flex items-center gap-1.5">${icon('activity','w-4 h-4')} Actividad</h3>
        ${streak > 0 ? `<span class="badge text-xs bg-teal-50 text-teal-600">🔥 ${streak} día${streak!==1?'s':''} seguidos</span>` : ''}
      </div>
      ${canEdit ? `
      <div class="grid grid-cols-3 gap-2 mb-4">
        ${ACTIVITY_LEVELS.map(l => `
          <button type="button" onclick="logActivity('${pet.id}','${l}')"
            class="py-2.5 rounded-xl border-2 text-sm font-medium transition-all
            ${todayActivity?.type===l ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-teal-300'}">
            ${l}
          </button>`).join('')}
      </div>
      ${!todayActivity ? `<p class="text-xs text-gray-400 mb-3">¿Cuánto se movió hoy?</p>` : ''}` : ''}
      <div class="flex gap-1.5 items-end">
        ${last7Days.map(d => {
          const entry = activities.find(a => a.date === d);
          const isToday = d === today;
          return `
          <div class="flex flex-col items-center gap-1 flex-1">
            <div title="${entry ? entry.type : 'Sin dato'}"
              class="w-full rounded-xl ${entry ? activityColors[entry.type] : 'bg-gray-100'} transition-all"
              style="height:${entry ? activityHeights[entry.type] : 10}px"></div>
            <div class="text-[9px] text-gray-400">${isToday ? 'Hoy' : new Date(d+'T12:00:00').toLocaleDateString('es-CL',{weekday:'short'}).slice(0,3)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

export function renderWeightChart(pet) {
  setTimeout(() => {
    const canvas = document.getElementById(`weight-chart-${pet.id}`);
    if (!canvas) return;
    if (window._weightCharts && window._weightCharts[pet.id]) {
      window._weightCharts[pet.id].destroy();
    }
    if (!window._weightCharts) window._weightCharts = {};
    const history = (pet.weightHistory || []).slice(-12);
    if (history.length === 0) return;
    window._weightCharts[pet.id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: history.map(h => formatDate(h.date)),
        datasets: [{
          label: 'Peso (kg)',
          data: history.map(h => parseFloat(h.kg) + (parseInt(h.gr||0)/1000)),
          borderColor: '#c2471f',
          backgroundColor: 'rgba(194,71,31,0.08)',
          tension: 0.4, fill: true,
          pointBackgroundColor: '#c2471f', pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false, grid: { color: '#f6ece0' } },
          x: { grid: { display: false } }
        }
      }
    });
  }, 100);
}

export async function setBCS(petId, score) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  // `pets.bcs` — antes esto solo mutaba el estado en memoria y llamaba a
  // saveState() (que solo persiste user/isLoggedIn en localStorage, no
  // las mascotas), así que el puntaje nunca llegaba a Supabase: se veía
  // guardado en la sesión actual pero desaparecía en la próxima carga.
  if (!isDemoUser()) {
    const { error } = await sb.from('pets').update({ bcs: score }).eq('id', petId);
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
  }
  pet.bcs = score;
  render();
}

export function openWeightModal(petId) {
  const pet = state.pets.find(p => p.id === petId);
  const today = todayStr();
  // Precarga con la última medición del historial o, si todavía no hay
  // ninguna, con el peso cargado en la ficha general — así "Registrar peso"
  // es actualizar un valor conocido en vez de partir de cero.
  const last = pet?.weightHistory?.length ? [...pet.weightHistory].sort((a,b)=>b.date>a.date?1:-1)[0] : null;
  const prevKg = last?.kg ?? pet?.weightKg ?? '';
  const prevGr = last?.gr ?? pet?.weightGr ?? '';
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('weight','w-5 h-5')} Registrar peso</h3>
      <form onsubmit="saveWeight(event,'${petId}')" class="space-y-3">
        <div>
          <label class="form-label">Fecha *</label>
          <input id="wt-date" type="date" required value="${today}" class="input-field" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Kg *</label>
            <input id="wt-kg" type="number" required min="0" step="0.1" value="${prevKg}" placeholder="Ej: 12" class="input-field" />
          </div>
          <div>
            <label class="form-label">Gramos (0-999)</label>
            <input id="wt-gr" type="number" min="0" max="999" step="1" value="${prevGr}" placeholder="Ej: 500" class="input-field" />
          </div>
        </div>
        ${!pet?.weightHistory?.length && pet?.weightKg ? `<p class="text-xs text-gray-400 -mt-1">Precargado con el peso de la ficha general — ajústalo si cambió</p>` : ''}
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

export async function saveWeight(e, petId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const kg = parseFloat(g('wt-kg') || 0);
  const gr = parseInt(g('wt-gr') || 0);
  const date = g('wt-date');
  pet.weightHistory = pet.weightHistory || [];
  if (isDemoUser()) {
    pet.weightHistory.push({ id: genId(), date, kg, gr, notes: '' });
  } else {
    // A diferencia de saveMood/saveSymptoms, esto nunca chequeaba
    // isDemoUser() — en modo demo intentaba escribir en Supabase real con
    // un pet_id que no existe ahí (ej. "pet-greta"), fallando siempre.
    const { data, error } = await sb.from('weight_history').insert({
      pet_id: petId, date, kg, gr
    }).select().single();
    if (error) { showToast('Error al guardar peso', 'error'); return; }
    pet.weightHistory.push({ id: data.id, date: data.date, kg: data.kg, gr: data.gr, notes: data.notes });
  }
  pet.weightHistory.sort((a, b) => a.date > b.date ? 1 : -1);
  closeModal(); render();
  track('record_saved', { kind: 'weight' });
  showToast('Peso registrado ✓', 'success');
}

export function openMoodModal(petId) {
  const today = todayStr();
  const pet = state.pets.find(p => p.id === petId);
  const existing = (pet?.moodLog || []).find(m => m.date === today);
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">😊 Estado de ánimo de hoy</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-3">
          ${[{v:'great',e:'😄',l:'Excelente'},{v:'ok',e:'😐',l:'Normal'},{v:'low',e:'😟',l:'Bajo'}].map(o => `
            <button type="button" onclick="selectMood('${o.v}')" id="mood-${o.v}"
              class="py-4 rounded-2xl border-2 text-center transition-all ${existing?.mood===o.v ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}">
              <div class="text-3xl mb-1">${o.e}</div>
              <div class="text-xs font-semibold text-gray-700">${o.l}</div>
            </button>`).join('')}
        </div>
        <input type="hidden" id="mood-val" value="${existing?.mood||''}" />
        <div>
          <label class="form-label">Notas (opcional)</label>
          <textarea id="mood-notes" rows="2" class="input-field resize-none" placeholder="¿Cómo se comportó hoy?">${esc(existing?.notes||'')}</textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="saveMood('${petId}')" class="btn-primary flex-1">Guardar</button>
        </div>
      </div>
    </div>`);
  // Highlight existing selection
  if (existing?.mood) {
    setTimeout(() => selectMood(existing.mood), 50);
  }
}

export function selectMood(val) {
  document.getElementById('mood-val').value = val;
  ['great','ok','low'].forEach(o => {
    const btn = document.getElementById('mood-'+o);
    if (btn) btn.className = `py-4 rounded-2xl border-2 text-center transition-all ${o===val ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'}`;
  });
}

export async function saveMood(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const mood = document.getElementById('mood-val')?.value;
  if (!mood) { showToast('Selecciona un estado de ánimo', 'error'); return; }
  const notes = document.getElementById('mood-notes')?.value || '';
  const today = todayStr();
  // Remove existing entry for today if any, then insert new one
  const existing = (pet.moodLog || []).find(m => m.date === today);
  pet.moodLog = (pet.moodLog || []).filter(m => m.date !== today);
  if (isDemoUser()) {
    pet.moodLog.push({ id: genId(), date: today, mood, notes });
  } else {
    if (existing?.id) {
      await sb.from('mood_logs').delete().eq('id', existing.id);
    }
    const { data, error } = await sb.from('mood_logs').insert({
      pet_id: petId, date: today, mood, notes
    }).select().single();
    if (error) { showToast('Error al guardar estado de ánimo', 'error'); return; }
    pet.moodLog.push({ id: data.id, date: data.date, mood: data.mood, energy: data.energy, notes: data.notes });
  }
  closeModal(); render();
  showToast('Estado de ánimo registrado ✓', 'success');
}

export function openSymptomsModal(petId) {
  const today = todayStr();
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('heart','w-5 h-5')} Registrar síntomas</h3>
      <div class="space-y-3">
        <div>
          <label class="form-label">Fecha *</label>
          <input id="sym-date" type="date" value="${today}" class="input-field" />
        </div>
        <div>
          <label class="form-label">Síntomas (selecciona uno o más)</label>
          <div class="flex flex-wrap gap-2 mt-1" id="sym-tags">
            ${SYMPTOM_TAGS.map(s => `
              <button type="button" onclick="toggleSymptomTag(this,'${s}')"
                data-tag="${s}"
                class="px-3 py-1.5 rounded-xl border-2 text-xs font-medium transition-all border-gray-200 text-gray-600 hover:border-brand-300">
                ${s}
              </button>`).join('')}
          </div>
        </div>
        <div>
          <label class="form-label">Notas (opcional)</label>
          <textarea id="sym-notes" rows="2" class="input-field resize-none" placeholder="Observaciones..."></textarea>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="saveSymptoms('${petId}')" class="btn-primary flex-1">Guardar</button>
        </div>
      </div>
    </div>`);
}

export function toggleSymptomTag(btn, tag) {
  btn.classList.toggle('border-brand-500');
  btn.classList.toggle('bg-brand-50');
  btn.classList.toggle('text-brand-700');
  btn.classList.toggle('border-gray-200');
}

export async function saveSymptoms(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const selected = [...document.querySelectorAll('#sym-tags button.border-brand-500')].map(b => b.dataset.tag);
  if (!selected.length) { showToast('Selecciona al menos un síntoma', 'error'); return; }
  const date = document.getElementById('sym-date')?.value;
  const notes = document.getElementById('sym-notes')?.value || '';
  pet.symptomsLog = pet.symptomsLog || [];
  if (isDemoUser()) {
    pet.symptomsLog.push({ id: genId(), date, symptoms: selected, notes });
  } else {
    const { data, error } = await sb.from('symptoms_logs').insert({
      pet_id: petId, date, symptoms: selected, notes
    }).select().single();
    if (error) { showToast('Error al guardar síntomas', 'error'); return; }
    pet.symptomsLog.push({ id: data.id, date: data.date, symptoms: data.symptoms, severity: data.severity, notes: data.notes });
  }
  closeModal(); render();
  showToast('Síntomas registrados ✓', 'success');
}

export function openFoodItemModal(petId, itemId) {
  const pet = state.pets.find(p => p.id === petId);
  const item = itemId ? pet?.foodItems?.find(f => f.id === itemId) : null;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('food','w-5 h-5')} ${item ? 'Editar alimento' : 'Agregar alimento'}</h3>
      <form onsubmit="saveFoodItem(event,'${petId}'${itemId ? `,'${itemId}'` : ''})" class="space-y-3">
        <div><label class="form-label">Producto *</label><input id="fi-product" required value="${esc(item?.product||'')}" placeholder="Ej: Royal Canin Adult" class="input-field" /></div>
        <div><label class="form-label">Tipo</label>
          <select id="fi-type" class="input-field">
            ${['Seco','Húmedo','BARF','Casero','Snack'].map(t => `<option ${item?.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Tamaño del paquete *</label><input id="fi-size" type="number" required min="0" step="0.1" value="${item?.packageSize||''}" placeholder="Ej: 15" class="input-field" /></div>
          <div><label class="form-label">Unidad</label>
            <select id="fi-unit" class="input-field">
              <option value="kg" ${item?.packageUnit==='kg'?'selected':''}>kg</option>
              <option value="g" ${item?.packageUnit==='g'?'selected':''}>g</option>
              <option value="unidades" ${item?.packageUnit==='unidades'?'selected':''}>unidades</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Consumo diario *</label><input id="fi-daily" type="number" required min="0" step="0.01" value="${item?.dailyAmount||''}" placeholder="Ej: 0.3" class="input-field" /></div>
          <div><label class="form-label">Precio (CLP)</label><input id="fi-price" type="text" inputmode="numeric" value="${item?.price||''}" placeholder="0" class="input-field" /></div>
        </div>
        <p class="text-xs text-gray-400 -mt-1">Usa la misma unidad en tamaño y consumo diario (ej: paquete de 15 kg, 0.3 kg diarios).</p>
        <div><label class="form-label">Fecha de compra</label><input id="fi-purchase" type="date" value="${item?.purchaseDate||todayStr()}" class="input-field" /></div>
        <div><label class="form-label">Notas (opcional)</label><input id="fi-notes" value="${esc(item?.notes||'')}" class="input-field" /></div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

export async function saveFoodItem(e, petId, itemId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const product = g('fi-product'), type = g('fi-type');
  const packageSize = parseFloat(g('fi-size') || 0), packageUnit = g('fi-unit');
  const dailyAmount = parseFloat(g('fi-daily') || 0), price = parseCLP(g('fi-price'));
  const purchaseDate = g('fi-purchase') || todayStr(), notes = g('fi-notes');
  pet.foodItems = pet.foodItems || [];
  if (isDemoUser()) {
    if (itemId) {
      const item = pet.foodItems.find(f => f.id === itemId);
      if (item) Object.assign(item, { product, type, packageSize, packageUnit, dailyAmount, price, purchaseDate, notes });
    } else {
      pet.foodItems.push({ id: genId(), product, type, packageSize, packageUnit, dailyAmount, price, purchaseDate, notes });
    }
  } else if (itemId) {
    const { error } = await sb.from('food_items').update({
      product, type, package_size: packageSize, package_unit: packageUnit,
      daily_amount: dailyAmount, price, purchase_date: purchaseDate, notes
    }).eq('id', itemId);
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    const item = pet.foodItems.find(f => f.id === itemId);
    if (item) Object.assign(item, { product, type, packageSize, packageUnit, dailyAmount, price, purchaseDate, notes });
  } else {
    const { data, error } = await sb.from('food_items').insert({
      pet_id: petId, product, type, package_size: packageSize, package_unit: packageUnit,
      daily_amount: dailyAmount, price, purchase_date: purchaseDate, notes
    }).select().single();
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    pet.foodItems.push({ id: data.id, product: data.product, type: data.type, packageSize: data.package_size,
      packageUnit: data.package_unit, dailyAmount: data.daily_amount, price: data.price,
      purchaseDate: data.purchase_date, notes: data.notes });
  }
  closeModal(); render();
  showToast('Alimento guardado', 'success');
}

export async function deleteFoodItem(petId, itemId) {
  const pet = state.pets.find(p => p.id === petId);
  if (blockIfReadOnly(pet)) return;
  if (!isDemoUser()) {
    const { error } = await sb.from('food_items').delete().eq('id', itemId);
    if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  }
  if (pet) { pet.foodItems = (pet.foodItems||[]).filter(f => f.id !== itemId); render(); }
}

export async function logActivity(petId, level) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const today = todayStr();
  const existing = (pet.activities || []).find(a => a.date === today);
  pet.activities = (pet.activities || []).filter(a => a.date !== today);
  if (isDemoUser()) {
    pet.activities.push({ id: genId(), date: today, type: level });
  } else {
    if (existing?.id) await sb.from('activities').delete().eq('id', existing.id);
    const { data, error } = await sb.from('activities').insert({ pet_id: petId, date: today, type: level }).select().single();
    if (error) { showToast('Error al registrar actividad', 'error'); console.error(error); return; }
    pet.activities.push({ id: data.id, date: data.date, type: data.type });
  }
  render();
  showToast('Actividad de hoy registrada ✓', 'success');
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    tabSeguimiento, tabNutricion, renderWeightChart, setBCS, openWeightModal,
    saveWeight, openMoodModal, selectMood, saveMood, openSymptomsModal,
    toggleSymptomTag, saveSymptoms, openFoodItemModal, saveFoodItem,
    deleteFoodItem, logActivity,
  });
}
