/* ============================================================
   MASCODATA — Vacunas y desparasitaciones
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Pestañas de la ficha, modales de
   creación y edición, y guardado/borrado de vacunas y desparasitaciones. */

export function tabVaccines(pet) {
  const allVs = [...(pet.vaccines||[])].sort((a,b) => b.date > a.date ? 1 : -1);
  const { items: vs, total, pages, page } = paginate(allVs, `vac_${pet.id}`);
  return `
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold text-gray-800">Vacunas</h3>
          ${total > 0 ? `<p class="text-xs text-gray-400 mt-0.5">${total} registro${total!==1?'s':''}</p>` : ''}
        </div>
        <button onclick="openVaccineModal('${pet.id}')" class="btn-primary text-sm">+ Agregar</button>
      </div>
      ${total === 0
        ? emptyState('flask','Sin vacunas registradas','Agrega el historial de vacunación')
        : `<div class="space-y-3">
             ${vs.map(v => { const st = careAlertStatus(v.nextDate, v.alertType, v.alertDays); return `
               <div class="border border-gray-100 rounded-xl p-4 flex items-start justify-between">
                 <div class="flex items-start gap-3">
                   <div class="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">${icon('flask','w-4.5 h-4.5')}</div>
                   <div>
                     <div class="font-medium text-gray-900 text-sm">${esc(v.name)}</div>
                     <div class="text-xs text-gray-400">${v.code ? `Código: ${esc(v.code)} · ` : ''}Aplicada: ${formatDate(v.date)}</div>
                     ${v.nextDate ? `<div class="text-xs mt-1 ${st.color}">Próxima: ${formatDate(v.nextDate)}${st.label ? ` · <span class="badge ${st.badge}">${st.label}</span>` : ''}</div>` : ''}
                     ${v.alertType ? `<div class="text-xs text-brand-500 flex items-center gap-1">${icon('bell','w-3 h-3')} Alerta configurada: ${{same:'El mismo día',week:'1 semana antes',custom:`${esc(v.alertDays)} días antes`}[v.alertType]||v.alertType}</div>` : ''}
                     ${v.cost ? `<div class="text-xs text-gray-400">Costo: ${fmtCLP(v.cost)}</div>` : ''}
                   </div>
                 </div>
                 <div class="flex items-center gap-1 flex-shrink-0">
                   <button onclick="openEditVaccineModal('${pet.id}','${v.id}')" title="Editar"
                     class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors">
                     <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                   </button>
                   <button onclick="deleteVaccine('${pet.id}','${v.id}')" title="Eliminar"
                     class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                     <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                   </button>
                 </div>
               </div>`; }).join('')}
           </div>
           ${pagerHTML(`vac_${pet.id}`, pages, page)}`}
    </div>`;
}

export function tabDeworming(pet) {
  const allDs = [...(pet.deworming||[])].sort((a,b) => b.date > a.date ? 1 : -1);
  const { items: ds, total, pages, page } = paginate(allDs, `dew_${pet.id}`);
  return `
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold text-gray-800">Desparasitaciones</h3>
          ${total > 0 ? `<p class="text-xs text-gray-400 mt-0.5">${total} registro${total!==1?'s':''}</p>` : ''}
        </div>
        <button onclick="openDewormModal('${pet.id}')" class="btn-primary text-sm">+ Agregar</button>
      </div>
      ${total === 0
        ? emptyState('bug','Sin desparasitaciones','Registra los tratamientos antiparasitarios')
        : `<div class="space-y-2">
             ${ds.map(d => { const st = careAlertStatus(d.nextDate, d.alertType, d.alertDays); return `
               <div class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors group">
                 <div class="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 flex-shrink-0">${icon('bug','w-4.5 h-4.5')}</div>
                 <div class="flex-1 min-w-0">
                   <div class="flex items-center gap-2 flex-wrap">
                     <span class="font-medium text-gray-900 text-sm">${esc(d.product)}</span>
                     <span class="badge bg-teal-50 text-teal-700 text-xs">${esc(d.type)}</span>
                   </div>
                   <div class="text-xs text-gray-400">${esc(d.format)} · Dosis: ${esc(d.dose)} ${esc(d.unit)} · ${formatDate(d.date)}</div>
                   ${d.nextDate ? `<div class="text-xs ${st.color} font-medium">Próxima: ${formatDate(d.nextDate)}${st.label ? ` · <span class="badge ${st.badge}">${st.label}</span>` : ''}</div>` : ''}
                 </div>
                 <div class="flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                   <button onclick="openEditDewormModal('${pet.id}','${d.id}')" title="Editar"
                     class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors">
                     <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                   </button>
                   <button onclick="deleteDeworming('${pet.id}','${d.id}')" title="Eliminar"
                     class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                     <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                   </button>
                 </div>
               </div>`; }).join('')}
           </div>
           ${pagerHTML(`dew_${pet.id}`, pages, page)}`}
    </div>`;
}

export function openVaccineModal(petId) {
  const pet = state.pets.find(p => p.id === petId);
  const species = pet?.species || 'Perro';
  const vaccineList = VACCINES_BY_SPECIES[species] || VACCINES_BY_SPECIES.Otro;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-1">Nueva vacuna</h3>
      <p class="text-xs text-gray-400 mb-4">Vacunas para ${species} · La alerta se enviará automáticamente en la fecha calculada</p>
      <form onsubmit="saveVaccine(event,'${petId}')" class="space-y-3">
        <div>
          <label class="form-label">Vacuna *</label>
          <select id="v-name" required class="input-field">
            <option value="">— Selecciona una vacuna —</option>
            ${vaccineList.map(v => `<option>${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Código / Lote</label>
          <input id="v-code" placeholder="Ej: RAB-001" class="input-field" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="form-label">Fecha de aplicación *</label>
            <input id="v-date" type="date" required class="input-field" onchange="updateNextDatePreview('v')" />
          </div>
          <div>
            <label class="form-label">Periodicidad</label>
            <select id="v-period" class="input-field" onchange="updateNextDatePreview('v')">
              ${PERIODICITY_OPTIONS.map(p => `<option value="${p.months}">${p.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="v-next-preview" class="hidden bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 text-sm">
          <span class="text-gray-500">Próxima aplicación:</span>
          <span id="v-next-date" class="font-semibold text-brand-700 ml-1"></span>
        </div>
        <div>
          <label class="form-label">¿Cuándo recibir la alerta?</label>
          <div class="grid grid-cols-3 gap-2 mt-1">
            ${[{v:'same',l:'El mismo día'},{v:'week',l:'1 sem antes'},{v:'custom',l:'Personalizado'}].map(o => `
              <button type="button" onclick="selectVaccineAlert('${o.v}')" id="va-${o.v}"
                class="py-2.5 px-1 rounded-xl border-2 text-xs font-medium transition-all border-gray-200 text-gray-500 hover:border-brand-300 text-center leading-tight">
                ${o.l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="v-alert" value="same" />
          <div id="va-custom-field" class="hidden mt-2">
            <label class="form-label">Días de anticipación</label>
            <input id="v-alert-days" type="number" min="1" max="365" placeholder="Ej: 15" class="input-field" />
          </div>
        </div>
        <div>
          <label class="form-label">Costo (CLP)</label>
          <input id="v-cost" type="text" inputmode="numeric" placeholder="0" class="input-field" />
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar vacuna</button>
        </div>
      </form>
    </div>`);
}

export function openDewormModal(petId) {
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-1">Nueva desparasitación</h3>
      <p class="text-xs text-gray-400 mb-4">La alerta se enviará automáticamente en la fecha calculada</p>
      <form onsubmit="saveDeworming(event,'${petId}')" class="space-y-3">
        <div>
          <label class="form-label">Producto *</label>
          <input id="d-product" required placeholder="Nombre del producto" class="input-field" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Tipo</label>
            <select id="d-type" class="input-field">
              <option>Interna</option><option>Externa</option><option>Ambas</option>
            </select>
          </div>
          <div>
            <label class="form-label">Formato *</label>
            <select id="d-format" onchange="updateDoseSection()" class="input-field">
              <option value="">— Selecciona formato —</option>
              <option>Comprimido</option><option>Pipeta</option><option>Collar</option>
              <option>Spray</option><option>Jarabe</option><option>Inyección</option>
            </select>
          </div>
        </div>

        <div id="d-dose-section" class="hidden space-y-2">
          <label class="form-label">Dosis</label>
          <div class="flex gap-2 items-center">
            <div id="d-dose-input-wrap" class="flex-1"></div>
            <div id="d-unit-badge" class="px-3 py-2 bg-teal-50 text-teal-700 rounded-xl text-sm font-semibold whitespace-nowrap"></div>
          </div>
          <div id="d-dose-preview" class="hidden bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700">
            ${icon('clipboard','w-3.5 h-3.5 inline align-text-bottom')} Se registrará: <span id="d-dose-preview-text" class="font-semibold text-teal-700"></span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="form-label">Fecha de aplicación *</label>
            <input id="d-date" type="date" required class="input-field" onchange="updateNextDatePreview('d')" />
          </div>
          <div>
            <label class="form-label">Periodicidad</label>
            <select id="d-period" class="input-field" onchange="updateNextDatePreview('d')">
              ${PERIODICITY_OPTIONS.map(p => `<option value="${p.months}">${p.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div id="d-next-preview" class="hidden bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-sm">
          <span class="text-gray-500">Próxima aplicación:</span>
          <span id="d-next-date" class="font-semibold text-teal-700 ml-1"></span>
        </div>

        <div>
          <label class="form-label">¿Cuándo recibir la alerta?</label>
          <div class="grid grid-cols-3 gap-2 mt-1">
            ${[{v:'same',l:'El mismo día'},{v:'week',l:'1 sem antes'},{v:'custom',l:'Personalizado'}].map(o => `
              <button type="button" onclick="selectDewormAlert('${o.v}')" id="da-${o.v}"
                class="py-2.5 px-1 rounded-xl border-2 text-xs font-medium transition-all border-gray-200 text-gray-500 hover:border-teal-300 text-center leading-tight">
                ${o.l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="d-alert" value="same" />
          <div id="da-custom-field" class="hidden mt-2">
            <label class="form-label">Días de anticipación</label>
            <input id="d-alert-days" type="number" min="1" max="365" placeholder="Ej: 15" class="input-field" />
          </div>
        </div>

        <div>
          <label class="form-label">Costo (CLP)</label>
          <input id="d-cost" type="text" inputmode="numeric" placeholder="0" class="input-field" />
        </div>

        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

export async function saveVaccine(e, petId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const date = g('v-date'), period = g('v-period');
  const nextDate = period ? addMonths(date, parseFloat(period)) : '';
  const vaccine = { name: g('v-name'), code: g('v-code'), date, periodicity: period,
    nextDate, alertType: g('v-alert'), alertDays: g('v-alert-days') || null, cost: parseCLP(g('v-cost')) };
  pet.vaccines = pet.vaccines || [];
  if (isDemoUser()) {
    pet.vaccines.push({ id: genId(), ...vaccine });
  } else {
    const { data, error } = await sb.from('vaccines').insert({
      pet_id: petId, name: vaccine.name, code: vaccine.code, date,
      periodicity: period, next_date: nextDate,
      alert_type: vaccine.alertType, alert_days: vaccine.alertDays, cost: vaccine.cost
    }).select().single();
    if (error) { showToast('Error al guardar vacuna', 'error'); console.error(error); return; }
    pet.vaccines.push({ id: data.id, name: data.name, code: data.code, date: data.date,
      periodicity: data.periodicity, nextDate: data.next_date,
      alertType: data.alert_type, alertDays: data.alert_days, cost: data.cost });
  }
  closeModal(); render();
  track('record_saved', { kind: 'vaccine' });
  showToast('Vacuna guardada', 'success');
}

export async function deleteVaccine(petId, vId) {
  const pet = state.pets.find(p => p.id === petId);
  if (blockIfReadOnly(pet)) return;
  const { error } = await sb.from('vaccines').delete().eq('id', vId);
  if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  if (pet) { pet.vaccines = pet.vaccines.filter(v => v.id !== vId); render(); }
}

export async function saveDeworming(e, petId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const date = g('d-date'), period = g('d-period'), format = g('d-format');
  const nextDate = period ? addMonths(date, parseFloat(period)) : '';
  const unitMap = { Comprimido:'Comprimido(s)', Pipeta:'ML', Collar:'Unidad(es)', Spray:'ML', Jarabe:'ML', Inyección:'ML' };
  const deworming = { product: g('d-product'), type: g('d-type'), format, dose: g('d-dose'),
    unit: unitMap[format] || '', date, periodicity: period,
    nextDate, alertType: g('d-alert'), alertDays: g('d-alert-days') || null, cost: parseCLP(g('d-cost')) };
  pet.deworming = pet.deworming || [];
  if (isDemoUser()) {
    pet.deworming.push({ id: genId(), ...deworming });
  } else {
    const { data, error } = await sb.from('dewormings').insert({
      pet_id: petId, product: deworming.product, type: deworming.type, format: deworming.format,
      dose: deworming.dose, unit: deworming.unit, date,
      periodicity: period, next_date: nextDate,
      alert_type: deworming.alertType, alert_days: deworming.alertDays, cost: deworming.cost
    }).select().single();
    if (error) { showToast('Error al guardar desparasitación', 'error'); console.error(error); return; }
    pet.deworming.push({ id: data.id, product: data.product, type: data.type, format: data.format,
      dose: data.dose, unit: data.unit, date: data.date,
      periodicity: data.periodicity, nextDate: data.next_date,
      alertType: data.alert_type, alertDays: data.alert_days, cost: data.cost });
  }
  closeModal(); render();
  track('record_saved', { kind: 'deworming' });
  showToast('Desparasitación guardada', 'success');
}

export async function deleteDeworming(petId, dId) {
  const pet = state.pets.find(p => p.id === petId);
  if (blockIfReadOnly(pet)) return;
  const { error } = await sb.from('dewormings').delete().eq('id', dId);
  if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  if (pet) { pet.deworming = pet.deworming.filter(d => d.id !== dId); render(); }
}

export function selectVaccineAlert(val) {
  document.getElementById('v-alert').value = val;
  ['same','week','custom'].forEach(o => {
    const btn = document.getElementById('va-'+o);
    if (btn) btn.className = `px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${o===val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`;
  });
  const cf = document.getElementById('va-custom-field');
  if (cf) cf.classList.toggle('hidden', val !== 'custom');
}

export function selectDewormAlert(val) {
  document.getElementById('d-alert').value = val;
  ['same','week','custom'].forEach(o => {
    const btn = document.getElementById('da-'+o);
    if (btn) btn.className = `px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${o===val ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`;
  });
  const cf = document.getElementById('da-custom-field');
  if (cf) cf.classList.toggle('hidden', val !== 'custom');
}

export function updateNextDatePreview(prefix) {
  const dateEl = document.getElementById(`${prefix}-date`);
  const periodEl = document.getElementById(`${prefix}-period`);
  const preview = document.getElementById(`${prefix}-next-preview`);
  const nextLabel = document.getElementById(`${prefix}-next-date`);
  if (!dateEl || !periodEl || !preview || !nextLabel) return;
  const months = parseFloat(periodEl.value);
  const date = dateEl.value;
  if (date && months > 0) {
    const next = addMonths(date, months);
    nextLabel.textContent = formatDate(next);
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
}

export function openEditVaccineModal(petId, vaccineId) {
  const pet = state.pets.find(p => p.id === petId);
  const v = pet?.vaccines?.find(x => x.id === vaccineId);
  if (!v) return;
  const vaccines = VACCINES_BY_SPECIES[pet.species] || VACCINES_BY_SPECIES['Otro'];
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('pencil','w-5 h-5')} Editar Vacuna</h3>
      <form onsubmit="saveEditVaccine(event,'${petId}','${vaccineId}')" class="space-y-3">
        <div>
          <label class="form-label">Vacuna *</label>
          <select id="ev-name" class="input-field">
            ${vaccines.map(vn => `<option ${vn===v.name?'selected':''}>${vn}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Código / Lote</label><input id="ev-code" value="${esc(v.code||'')}" class="input-field" /></div>
          <div><label class="form-label">Fecha aplicación *</label><input id="ev-date" type="date" required value="${esc(v.date||'')}" class="input-field" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Periodicidad (meses)</label>
            <select id="ev-period" class="input-field">
              ${PERIODICITY_OPTIONS.map(o => `<option value="${o.months}" ${String(o.months)===String(v.periodicity)?'selected':''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Costo (CLP)</label><input id="ev-cost" type="text" inputmode="numeric" value="${esc(v.cost||'')}" class="input-field" /></div>
        </div>
        <div>
          <label class="form-label">¿Cuándo recibir la alerta?</label>
          <div class="grid grid-cols-3 gap-2 mt-1">
            ${[{v:'same',l:'El mismo día'},{v:'week',l:'1 sem antes'},{v:'custom',l:'Personalizado'}].map(o => `
              <button type="button" onclick="selectEditVaccineAlert('${o.v}')" id="eva-${o.v}"
                class="py-2.5 px-1 rounded-xl border-2 text-xs font-medium transition-all text-center leading-tight
                ${(v.alertType||'same')===o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}">
                ${o.l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="ev-alert" value="${esc(v.alertType||'same')}" />
          <div id="eva-custom-field" class="${(v.alertType||'same')==='custom'?'':'hidden'} mt-2">
            <label class="form-label">Días de anticipación</label>
            <input id="ev-alert-days" type="number" min="1" max="365" value="${esc(v.alertDays||'')}" placeholder="Ej: 15" class="input-field" />
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar cambios</button>
        </div>
      </form>
    </div>`);
}

export function selectEditVaccineAlert(val) {
  document.getElementById('ev-alert').value = val;
  ['same','week','custom'].forEach(o => {
    const btn = document.getElementById('eva-'+o);
    if (btn) btn.className = `py-2.5 px-1 rounded-xl border-2 text-xs font-medium transition-all text-center leading-tight ${o===val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`;
  });
  const cf = document.getElementById('eva-custom-field');
  if (cf) cf.classList.toggle('hidden', val !== 'custom');
}

export async function saveEditVaccine(e, petId, vaccineId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  const v = pet?.vaccines?.find(x => x.id === vaccineId);
  if (!v) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const date = g('ev-date'), period = g('ev-period');
  const name = g('ev-name'), code = g('ev-code'), cost = parseCLP(g('ev-cost'));
  const alertType = g('ev-alert'), alertDays = g('ev-alert-days') || null;
  const nextDate = period ? addMonths(date, parseFloat(period)) : '';
  if (!isDemoUser()) {
    const { error } = await sb.from('vaccines').update({
      name, code, date, periodicity: period, next_date: nextDate, cost,
      alert_type: alertType, alert_days: alertDays
    }).eq('id', vaccineId);
    if (error) { showToast('Error al guardar cambios', 'error'); console.error(error); return; }
  }
  v.name = name; v.code = code; v.date = date;
  v.periodicity = period; v.nextDate = nextDate;
  v.cost = cost; v.alertType = alertType; v.alertDays = alertDays;
  closeModal(); render();
  showToast('Vacuna actualizada ✓', 'success');
}

export function openEditDewormModal(petId, dewormId) {
  const pet = state.pets.find(p => p.id === petId);
  const d = pet?.deworming?.find(x => x.id === dewormId);
  if (!d) return;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('pencil','w-5 h-5')} Editar Desparasitación</h3>
      <form onsubmit="saveEditDeworming(event,'${petId}','${dewormId}')" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Producto *</label><input id="edw-product" required value="${esc(d.product||'')}" class="input-field" /></div>
          <div><label class="form-label">Tipo</label>
            <select id="edw-type" class="input-field">
              ${['Interna','Externa','Ambas'].map(t => `<option ${t===d.type?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Formato</label>
            <select id="edw-format" class="input-field">
              ${['Comprimido','Pipeta','Collar','Spray','Jarabe','Inyección'].map(f => `<option ${f===d.format?'selected':''}>${f}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Dosis</label><input id="edw-dose" value="${esc(d.dose||'')}" class="input-field" /></div>
          <div><label class="form-label">Fecha *</label><input id="edw-date" type="date" required value="${esc(d.date||'')}" class="input-field" /></div>
          <div><label class="form-label">Periodicidad</label>
            <select id="edw-period" class="input-field">
              ${PERIODICITY_OPTIONS.map(o => `<option value="${o.months}" ${String(o.months)===String(d.periodicity)?'selected':''}>${o.label}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Costo (CLP)</label><input id="edw-cost" type="text" inputmode="numeric" value="${esc(d.cost||'')}" class="input-field" /></div>
        </div>
        <div>
          <label class="form-label">¿Cuándo recibir la alerta?</label>
          <div class="grid grid-cols-3 gap-2 mt-1">
            ${[{v:'same',l:'El mismo día'},{v:'week',l:'1 sem antes'},{v:'custom',l:'Personalizado'}].map(o => `
              <button type="button" onclick="selectEditDewormAlert('${o.v}')" id="eda-${o.v}"
                class="py-2.5 px-1 rounded-xl border-2 text-xs font-medium transition-all text-center leading-tight
                ${(d.alertType||'same')===o.v ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-teal-300'}">
                ${o.l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="edw-alert" value="${esc(d.alertType||'same')}" />
          <div id="eda-custom-field" class="${(d.alertType||'same')==='custom'?'':'hidden'} mt-2">
            <label class="form-label">Días de anticipación</label>
            <input id="edw-alert-days" type="number" min="1" max="365" value="${esc(d.alertDays||'')}" placeholder="Ej: 15" class="input-field" />
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar cambios</button>
        </div>
      </form>
    </div>`);
}

export function selectEditDewormAlert(val) {
  document.getElementById('edw-alert').value = val;
  ['same','week','custom'].forEach(o => {
    const btn = document.getElementById('eda-'+o);
    if (btn) btn.className = `py-2.5 px-1 rounded-xl border-2 text-xs font-medium transition-all text-center leading-tight ${o===val ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`;
  });
  const cf = document.getElementById('eda-custom-field');
  if (cf) cf.classList.toggle('hidden', val !== 'custom');
}

export async function saveEditDeworming(e, petId, dewormId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  const d = pet?.deworming?.find(x => x.id === dewormId);
  if (!d) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const product = g('edw-product'), type = g('edw-type'), format = g('edw-format');
  const dose = g('edw-dose'), date = g('edw-date'), cost = parseCLP(g('edw-cost'));
  const period = g('edw-period');
  const alertType = g('edw-alert'), alertDays = g('edw-alert-days') || null;
  const nextDate = period ? addMonths(date, parseFloat(period)) : '';
  // Igual que saveDeworming() (creación): la unidad se deriva del formato,
  // no es un campo que el usuario tipee — antes esta función no la
  // recalculaba al editar, así que cambiar el formato (ej. de Comprimido a
  // Pipeta) dejaba la unidad vieja ("Comprimido(s)") para siempre, tanto
  // local como en Supabase.
  const unitMap = { Comprimido:'Comprimido(s)', Pipeta:'ML', Collar:'Unidad(es)', Spray:'ML', Jarabe:'ML', Inyección:'ML' };
  const unit = unitMap[format] || '';
  if (!isDemoUser()) {
    const { error } = await sb.from('dewormings').update({
      product, type, format, dose, unit, date, cost, periodicity: period, next_date: nextDate,
      alert_type: alertType, alert_days: alertDays
    }).eq('id', dewormId);
    if (error) { showToast('Error al guardar cambios', 'error'); console.error(error); return; }
  }
  d.product = product; d.type = type;
  d.format = format; d.dose = dose; d.unit = unit;
  d.date = date; d.cost = cost; d.periodicity = period; d.nextDate = nextDate;
  d.alertType = alertType; d.alertDays = alertDays;
  closeModal(); render();
  showToast('Desparasitación actualizada ✓', 'success');
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    tabVaccines, tabDeworming, openVaccineModal, openDewormModal, saveVaccine,
    deleteVaccine, saveDeworming, deleteDeworming, selectVaccineAlert,
    selectDewormAlert, updateNextDatePreview, openEditVaccineModal,
    selectEditVaccineAlert, saveEditVaccine, openEditDewormModal,
    selectEditDewormAlert, saveEditDeworming,
  });
}
