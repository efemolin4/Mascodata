/* ============================================================
   MASCODATA — Tratamientos e historial clínico
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Pestañas de la ficha, modales de
   creación y edición, y guardado/borrado de medicamentos e historial
   clínico, incluyendo el registro de dosis tomadas. */

export function tabMedications(pet) {
  const allMs = [...(pet.medications||[])].sort((a,b) => b.startDate > a.startDate ? 1 : -1);
  const { items: ms, total, pages, page } = paginate(allMs, `med_${pet.id}`);
  const today = todayStr();
  const reminderLabels = { exact:'Horario exacto', '15':'15 min antes', '30':'30 min antes', '60':'60 min antes' };
  const hasActive = (pet.medications||[]).some(m => m.active);
  const doseGivenToday = (pet.doseLog||[]).some(dl => dl.date === today && dl.given);
  return `
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold text-gray-800">Tratamiento</h3>
          ${total > 0 ? `<p class="text-xs text-gray-400 mt-0.5">${total} registro${total!==1?'s':''}</p>` : ''}
        </div>
        <div class="flex items-center gap-2">
          ${hasActive ? (doseGivenToday
            ? `<span class="badge bg-green-100 text-green-700">✓ Dosis de hoy registrada</span>`
            : `<button onclick="markDoseTaken('${pet.id}')" class="btn-secondary text-sm flex items-center gap-1.5">${icon('fire','w-4 h-4')} Marcar dosis de hoy</button>`) : ''}
          <button onclick="openMedModal('${pet.id}')" class="btn-primary text-sm">+ Agregar</button>
        </div>
      </div>
      ${total === 0
        ? emptyState('pill','Sin tratamientos','Registra tratamientos activos e historial')
        : `<div class="space-y-3">
             ${ms.map(m => {
               const isExpired  = m.expiry && m.expiry < today;
               const expiringSoon = m.expiry && !isExpired && m.expiry <= daysFromNowStr(30);
               const reminderLabel = reminderLabels[m.reminder] || m.reminder;
               return `
               <div class="border border-gray-100 rounded-2xl p-4 hover:border-brand-200 transition-colors">
                 <div class="flex items-start justify-between gap-3">
                   <div class="flex items-start gap-3 flex-1 min-w-0">
                     <div class="w-10 h-10 rounded-xl ${m.active?'bg-brand-50 text-brand-600':'bg-gray-50 text-gray-400'} flex items-center justify-center flex-shrink-0">${icon('pill','w-5 h-5')}</div>
                     <div class="flex-1 min-w-0">
                       <div class="flex items-center gap-2 flex-wrap">
                         <span class="font-semibold text-gray-900">${esc(m.name)}</span>
                         ${m.active ? '<span class="badge bg-green-100 text-green-700">Activo</span>' : '<span class="badge bg-gray-100 text-gray-500">Finalizado</span>'}
                         ${isExpired ? '<span class="badge bg-red-100 text-red-600">Vencido</span>' : ''}
                         ${expiringSoon ? '<span class="badge bg-amber-100 text-amber-600">Por vencer</span>' : ''}
                       </div>
                       <div class="text-xs text-gray-400 mt-0.5">
                         ${esc(m.dose || `${m.doseVal||''} ${m.doseUnit||''}`)} · ${esc(m.frequency)}
                       </div>
                       <div class="text-xs text-gray-400">
                         ${icon('calendar','w-3 h-3 inline align-text-bottom')} ${formatDate(m.startDate)}${m.endDate ? ` → ${formatDate(m.endDate)}` : ''}
                         ${m.startTime ? ` · ⏰ ${esc(m.startTime)}` : ''}
                       </div>
                       ${m.reminder ? `<div class="text-xs text-brand-500 mt-0.5 flex items-center gap-1">${icon('bell','w-3 h-3')} ${esc(reminderLabel)}</div>` : ''}
                       ${(() => { const ms = medStockStatus(m); if (!ms) return ''; const barColor = { critico:'bg-red-400', bajo:'bg-amber-400', ok:'bg-green-400' }[ms.level]; return `
                         <div class="mt-2">
                           <div class="flex justify-between text-xs text-gray-500 mb-1">
                             <span>Stock: ${m.stockTotal} ${esc(m.stockUnit||'')} · ${esc(ms.label)}</span>
                             ${m.expiry ? `<span class="${isExpired?'text-red-500':expiringSoon?'text-amber-500':'text-gray-400'}">Cad: ${formatDate(m.expiry)}</span>` : ''}
                           </div>
                           <div class="w-full bg-gray-100 rounded-full h-1.5">
                             <div class="h-1.5 rounded-full ${barColor}" style="width:${ms.pct}%"></div>
                           </div>
                         </div>`; })()}
                     </div>
                   </div>
                   <div class="flex items-center gap-1 flex-shrink-0">
                     <button onclick="openEditMedModal('${pet.id}','${m.id}')" title="Editar"
                       class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors">
                       <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                     </button>
                     <button onclick="deleteMedication('${pet.id}','${m.id}')" title="Eliminar"
                       class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                       <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                     </button>
                   </div>
                 </div>
               </div>`;
             }).join('')}
           </div>
           ${pagerHTML(`med_${pet.id}`, pages, page)}`}
    </div>`;
}

export function tabHistory(pet) {
  const allHs = [...(pet.clinicalHistory||[])].sort((a,b) => b.date > a.date ? 1 : -1);
  const { items: hs, total, pages, page } = paginate(allHs, `hist_${pet.id}`);
  const typeColors = { Cirugía:'bg-red-50 text-red-700', Esterilización:'bg-amber-50 text-amber-700', Procedimiento:'bg-blue-50 text-blue-700', Diagnóstico:'bg-teal-50 text-teal-700', Otro:'bg-gray-50 text-gray-600' };
  return `
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold text-gray-800">Historial clínico</h3>
          ${total > 0 ? `<p class="text-xs text-gray-400 mt-0.5">${total} evento${total!==1?'s':''}</p>` : ''}
        </div>
        <button onclick="openHistoryModal('${pet.id}')" class="btn-primary text-sm">+ Agregar</button>
      </div>
      ${total === 0
        ? emptyState('clipboard','Sin historial clínico','Registra eventos, procedimientos y adjunta documentos')
        : `<div class="relative pl-6">
             <div class="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200"></div>
             ${hs.map(h => `
               <div class="relative mb-4">
                 <div class="absolute -left-4 top-1 w-3 h-3 rounded-full bg-brand-500 border-2 border-white"></div>
                 <div class="border border-gray-100 rounded-xl p-4">
                   <div class="flex items-start justify-between gap-2">
                     <div class="flex-1 min-w-0">
                       <div class="flex items-center gap-2 flex-wrap">
                         <span class="font-medium text-gray-900 text-sm">${esc(h.title)}</span>
                         <span class="badge ${typeColors[h.type]||'bg-gray-50 text-gray-600'}">${esc(h.type)}</span>
                       </div>
                       <div class="text-xs text-gray-400 mt-0.5">${formatDate(h.date)}${h.doctor ? ` · ${esc(h.doctor)}` : ''}${h.clinic ? ` · ${esc(h.clinic)}` : ''}</div>
                       ${h.notes ? `<p class="text-sm text-gray-600 mt-1">${esc(h.notes)}</p>` : ''}
                       ${h.cost ? `<div class="text-xs text-gray-400 mt-1">Costo: ${fmtCLP(h.cost)}</div>` : ''}
                       ${(h.files||[]).length > 0 ? `
                         <div class="flex flex-wrap gap-2 mt-2">
                           ${h.files.map((f,fi) => {
                             const url = safeDataUrl(f.data);
                             if (!url) return `<span class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">${esc(f.name)} (archivo no válido)</span>`;
                             return url.startsWith('data:image') ? `
                             <a href="${url}" target="_blank" rel="noopener" title="${esc(f.name)}">
                               <img src="${url}" class="h-16 w-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                             </a>` : `
                             <a href="${url}" download="${esc(f.name)}"
                               class="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs text-gray-700 transition-colors">
                               ${icon('paperclip','w-3 h-3 inline align-text-bottom')} ${esc(f.name)}
                             </a>`; }).join('')}
                         </div>` : ''}
                     </div>
                     <div class="flex items-center gap-1 flex-shrink-0">
                       <button onclick="openEditHistoryModal('${pet.id}','${h.id}')" title="Editar"
                         class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors">
                         <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                       </button>
                       <button onclick="deleteHistory('${pet.id}','${h.id}')" title="Eliminar"
                         class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                         <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                       </button>
                     </div>
                   </div>
                 </div>
               </div>`).join('')}
           </div>
           ${pagerHTML(`hist_${pet.id}`, pages, page)}`}
    </div>`;
}

export function openMedModal(petId) {
  const today = todayStr();
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-brand-500">${icon('pill','w-6 h-6')}</span>
        <h3 class="text-lg font-bold text-gray-900">Registrar Tratamiento</h3>
      </div>
      <p class="text-xs text-gray-400 mb-4">Los horarios se calculan automáticamente según la frecuencia</p>
      <form onsubmit="saveMedication(event,'${petId}')" class="space-y-3">

        <div>
          <label class="form-label">Medicamento *</label>
          <input id="m-name" required placeholder="Nombre del medicamento" class="input-field" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Dosis *</label>
            <input id="m-dose-val" type="number" min="0" step="0.1" required placeholder="Ej: 500" class="input-field" oninput="updateMedPreview()" />
          </div>
          <div>
            <label class="form-label">Unidad</label>
            <select id="m-unit" class="input-field" onchange="updateMedPreview()">
              <option value="mg">mg</option>
              <option value="ml">ml</option>
              <option value="Comprimido(s)">Comprimido(s)</option>
              <option value="Gotas">Gotas</option>
            </select>
          </div>
        </div>

        <div>
          <label class="form-label">Frecuencia *</label>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400 font-medium whitespace-nowrap flex-shrink-0">Cada</span>
            <input id="m-freq-n" type="number" min="1" max="72" value="8" class="input-field !w-16 text-center flex-shrink-0" oninput="updateMedPreview()" />
            <select id="m-freq-unit" class="input-field flex-1" onchange="updateMedPreview()">
              <option value="horas">Horas</option>
              <option value="dias">Días</option>
            </select>
          </div>
          <div id="m-freq-preview" class="text-xs text-brand-600 mt-1 font-medium"></div>
        </div>

        <div id="m-schedules-box" class="hidden bg-brand-50 rounded-xl p-3">
          <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Horarios calculados</div>
          <div id="m-schedules" class="flex flex-wrap gap-2"></div>
        </div>

        <div class="overflow-hidden">
          <label class="form-label">Fecha inicio *</label>
          <input id="m-start" type="date" required value="${today}" class="input-field text-center" style="min-width:0;max-width:100%;width:100%;box-sizing:border-box;text-align:center" oninput="updateMedPreview()" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Hora inicio *</label>
            <select id="m-start-time" class="input-field text-center" onchange="updateMedPreview()">
              ${Array.from({length:24},(_,i)=>{const h=String(i).padStart(2,'0');return`<option value="${h}:00"${i===8?' selected':''}>${h}:00</option>`;}).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">N° días</label>
            <input id="m-days" type="number" min="1" placeholder="7" class="input-field" oninput="updateMedPreview()" />
          </div>
        </div>

        <div id="m-enddate-box" class="hidden">
          <div class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Fecha de término</div>
          <div id="m-enddate-text" class="text-base font-bold text-brand-600"></div>
        </div>

        <div>
          <label class="form-label">Costo (CLP)</label>
          <input id="m-cost" type="text" inputmode="numeric" placeholder="0" class="input-field" />
        </div>

        <div>
          <label class="form-label flex items-center gap-1">${icon('bell','w-3.5 h-3.5')} Recordatorio por dosis</label>
          <div class="grid grid-cols-2 gap-2 mt-1">
            ${[{v:'exact',l:'Horario exacto'},{v:'15',l:'15 min antes'},{v:'30',l:'30 min antes'},{v:'60',l:'60 min antes'}].map(o => `
              <button type="button" onclick="selectMedReminder('${o.v}')" id="mr-${o.v}"
                class="py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-all border-gray-200 text-gray-500 hover:border-brand-300 text-center">
                ${o.l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="m-reminder" value="exact" />
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" id="m-active" checked class="rounded text-brand-500" />
          <label for="m-active" class="text-sm text-gray-700 font-medium">Tratamiento activo</label>
        </div>

        <hr class="border-gray-100" />
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-semibold text-gray-700 flex items-center gap-1.5">${icon('box','w-4 h-4')} Stock del medicamento <span class="text-gray-400 font-normal">(opcional)</span></label>
          </div>
          <!-- Cantidad + Unidad en 2 cols, Caducidad en fila propia en mobile -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label">Cantidad total</label>
              <input id="m-stock-total" type="number" min="0" placeholder="0" class="input-field" />
            </div>
            <div>
              <label class="form-label">Unidad</label>
              <select id="m-stock-unit" class="input-field">
                <option>Comprimidos</option><option>ml</option><option>mg</option><option>Ampollas</option><option>Frascos</option>
              </select>
            </div>
          </div>
          <div class="mt-3">
            <label class="form-label">Fecha caducidad</label>
            <input id="m-expiry" type="date" class="input-field" />
          </div>
        </div>

        <div class="flex gap-3 pt-1">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar tratamiento</button>
        </div>
      </form>
    </div>`);
  setTimeout(() => updateMedPreview(), 50);
}

export function openHistoryModal(petId) {
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Nuevo evento clínico</h3>
      <form onsubmit="saveHistory(event,'${petId}')" class="space-y-3">
        <div>
          <label class="form-label">Título *</label>
          <input id="h-title" required placeholder="Ej: Esterilización" class="input-field" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Tipo</label>
            <select id="h-type" class="input-field">
              <option>Cirugía</option><option>Esterilización</option><option>Procedimiento</option>
              <option>Diagnóstico</option><option>Otro</option>
            </select>
          </div>
          <div><label class="form-label">Fecha *</label><input id="h-date" type="date" required class="input-field" /></div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="form-label">Médico</label><input id="h-doctor" placeholder="Dr. García" class="input-field" /></div>
          <div><label class="form-label">Clínica</label><input id="h-clinic" placeholder="Clínica Vet." class="input-field" /></div>
        </div>
        <div>
          <label class="form-label">Costo (CLP)</label>
          <input id="h-cost" type="text" inputmode="numeric" placeholder="0" class="input-field" />
        </div>
        <div>
          <label class="form-label">Notas</label>
          <textarea id="h-notes" rows="2" class="input-field resize-none" placeholder="Observaciones..."></textarea>
        </div>
        <div>
          <label class="form-label flex items-center gap-1">${icon('paperclip','w-3.5 h-3.5')} Adjuntar archivos <span class="text-gray-400 font-normal">(imágenes, PDFs, resultados)</span></label>
          <div onclick="document.getElementById('h-files').click()"
            class="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors">
            <div class="mb-1 flex justify-center">${icon('folder','w-6 h-6')}</div>
            <p class="text-xs text-gray-500">Haz clic para seleccionar archivos</p>
            <p class="text-xs text-gray-400">PNG, JPG, PDF (máx. 5MB c/u)${!isPremium() ? ' · Plan Free: 1 archivo por evento (Premium: ilimitados)' : ''}</p>
          </div>
          <input id="h-files" type="file" multiple accept="image/*,.pdf,.doc,.docx" class="hidden" onchange="previewHistoryFiles(this)" />
          <div id="h-files-preview" class="flex flex-wrap gap-2 mt-2"></div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

export async function saveMedication(e, petId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const name = g('m-name'), doseVal = g('m-dose-val'), doseUnit = g('m-unit');
  const freqN = g('m-freq-n'), freqUnit = g('m-freq-unit');
  const startDate = g('m-start'), startTime = g('m-start-time');
  const treatmentDays = g('m-days') ? parseInt(g('m-days')) : null;
  const active = document.getElementById('m-active')?.checked ?? true;
  const cost = parseCLP(g('m-cost'));
  const stockTotal = g('m-stock-total') || null, stockUnit = g('m-stock-unit');
  const expiry = g('m-expiry') || null;
  const reminder = g('m-reminder');
  const frequency = freqN ? `Cada ${freqN} ${freqUnit === 'horas' ? 'horas' : 'días'}` : '';
  let endDate = null;
  if (treatmentDays && startDate) {
    const d = new Date(startDate + 'T12:00:00'); d.setDate(d.getDate() + treatmentDays);
    endDate = d.toISOString().slice(0,10);
  }
  const med = { name, doseVal, doseUnit, dose: `${doseVal||''} ${doseUnit||''}`.trim(),
    freqN, freqUnit, frequency, startDate, startTime, treatmentDays, endDate,
    active, reminder, stockTotal, stockUnit, expiry, cost };
  pet.medications = pet.medications || [];
  if (isDemoUser()) {
    pet.medications.push({ id: genId(), ...med });
  } else {
    const { data, error } = await sb.from('medications').insert({
      pet_id: petId, name, dose_val: doseVal || null, dose_unit: doseUnit,
      freq_n: freqN || null, freq_unit: freqUnit,
      start_date: startDate, start_time: startTime, treatment_days: treatmentDays, end_date: endDate,
      active, reminder, stock_qty: stockTotal, stock_unit: stockUnit, expiry_date: expiry, cost
    }).select().single();
    if (error) { showToast('Error al guardar medicamento', 'error'); console.error(error); return; }
    pet.medications.push({ id: data.id, ...med });
  }
  closeModal(); render();
  track('record_saved', { kind: 'medication' });
  showToast('Medicamento guardado', 'success');
}

export async function deleteMedication(petId, mId) {
  const pet = state.pets.find(p => p.id === petId);
  if (blockIfReadOnly(pet)) return;
  if (!isDemoUser()) {
    const { error } = await sb.from('medications').delete().eq('id', mId);
    if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  }
  if (pet) { pet.medications = pet.medications.filter(m => m.id !== mId); render(); }
}

export async function markDoseTaken(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const today = todayStr();
  // El botón "Marcar dosis de hoy" es uno solo por mascota, no por
  // tratamiento — con un único medicamento activo no hay ambigüedad, pero
  // con dos o más no hay forma de saber a cuál corresponde. Antes se
  // asociaba siempre al primero del arreglo (dato incorrecto); mejor
  // dejarlo sin asociar a ninguno en particular que atribuirlo mal.
  const activeMeds = (pet.medications||[]).filter(m => m.active);
  const activeMed = activeMeds.length === 1 ? activeMeds[0] : null;
  pet.doseLog = pet.doseLog || [];
  if (pet.doseLog.some(dl => dl.date === today && dl.given)) return;
  if (isDemoUser()) {
    pet.doseLog.push({ id: genId(), medicationId: activeMed?.id || null, date: today, given: true });
  } else {
    const { data, error } = await sb.from('dose_logs').insert({
      pet_id: petId, med_id: activeMed?.id || null, date: today, confirmed: true
    }).select().single();
    if (error) { showToast('Error al registrar la dosis', 'error'); console.error(error); return; }
    pet.doseLog.push({ id: data.id, medicationId: data.med_id, date: data.date, given: data.confirmed });
  }
  render();
  showToast('¡Dosis de hoy registrada!', 'success');
}

export function previewHistoryFiles(input) {
  const preview = document.getElementById('h-files-preview');
  if (!preview) return;
  preview.innerHTML = '';
  Array.from(input.files).forEach(file => {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-1.5 px-2 py-1 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-700';
    el.textContent = `${file.name}`;
    preview.appendChild(el);
  });
}

export function readFilesAsBase64(fileInput) {
  const files = Array.from(fileInput?.files || []);
  return Promise.all(files.map(f => new Promise((res, rej) => {
    if (f.size > 5 * 1024 * 1024) { showToast(`${f.name} supera 5MB`, 'error'); res(null); return; }
    const reader = new FileReader();
    reader.onload = e => res({ name: f.name, data: e.target.result, type: f.type });
    reader.onerror = rej;
    reader.readAsDataURL(f);
  }))).then(results => results.filter(Boolean));
}

export async function saveHistory(e, petId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const filesInput = document.getElementById('h-files');
  let files = filesInput?.files?.length ? await readFilesAsBase64(filesInput) : [];
  // Plan Free: 1 adjunto por evento (avisado junto al input) — Premium sin límite.
  if (!isPremium()) files = files.slice(0, 1);
  const record = { title: g('h-title'), type: g('h-type'), date: g('h-date'),
    doctor: g('h-doctor'), clinic: g('h-clinic'), cost: parseCLP(g('h-cost')), notes: g('h-notes'), files };
  pet.clinicalHistory = pet.clinicalHistory || [];
  if (isDemoUser()) {
    pet.clinicalHistory.push({ id: genId(), ...record });
  } else {
    // `files` es text[] en la base — cada archivo se guarda como un string JSON
    const { data, error } = await sb.from('history_records').insert({
      pet_id: petId, title: record.title, type: record.type, date: record.date,
      vet: record.doctor, clinic: record.clinic, cost: record.cost, notes: record.notes,
      files: files.map(f => JSON.stringify(f))
    }).select().single();
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    pet.clinicalHistory.push({ id: data.id, ...record });
  }
  closeModal(); render();
  track('record_saved', { kind: 'history' });
  showToast('Registro guardado', 'success');
}

export async function deleteHistory(petId, hId) {
  const pet = state.pets.find(p => p.id === petId);
  if (blockIfReadOnly(pet)) return;
  if (!isDemoUser()) {
    const { error } = await sb.from('history_records').delete().eq('id', hId);
    if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  }
  if (pet) { pet.clinicalHistory = pet.clinicalHistory.filter(h => h.id !== hId); render(); }
}

export function updateMedPreview() {
  const freqN = parseInt(document.getElementById('m-freq-n')?.value || 0);
  const freqUnit = document.getElementById('m-freq-unit')?.value || 'horas';
  const startTime = document.getElementById('m-start-time')?.value || '08:00';
  const startDate = document.getElementById('m-start')?.value;
  const days = parseInt(document.getElementById('m-days')?.value || 0);
  const doseVal = document.getElementById('m-dose-val')?.value;
  const unit = document.getElementById('m-unit')?.value;

  // Frequency preview
  const freqPreview = document.getElementById('m-freq-preview');
  if (freqPreview && freqN > 0) {
    if (freqUnit === 'horas' && freqN < 48) {
      const dosesDay = Math.round(24 / freqN);
      freqPreview.textContent = `→ ${dosesDay} dosis al día · cada ${freqN} horas`;
    } else {
      freqPreview.textContent = `→ Cada ${freqN} ${freqUnit}`;
    }
  }

  // Schedule calculation
  const box = document.getElementById('m-schedules-box');
  const sched = document.getElementById('m-schedules');
  if (box && sched && freqN > 0 && freqUnit === 'horas' && freqN <= 24 && startTime) {
    const [h, m2] = startTime.split(':').map(Number);
    const times = [];
    let cur = h * 60 + m2;
    const steps = Math.round(24 / freqN);
    for (let i = 0; i < steps; i++) {
      const hh = String(Math.floor((cur % 1440) / 60)).padStart(2,'0');
      const mm = String((cur % 1440) % 60).padStart(2,'0');
      times.push(`${hh}:${mm}`);
      cur += freqN * 60;
    }
    sched.innerHTML = times.map(t => `<span class="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-lg text-sm font-semibold text-brand-700 shadow-sm">${icon('clock','w-3.5 h-3.5')} ${t}</span>`).join('');
    box.classList.remove('hidden');
  } else if (box) {
    box.classList.add('hidden');
  }

  // End date calculation
  const endBox = document.getElementById('m-enddate-box');
  const endText = document.getElementById('m-enddate-text');
  if (endBox && endText && days > 0 && startDate) {
    const d = new Date(startDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    endText.textContent = d.toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    endBox.classList.remove('hidden');
  } else if (endBox) {
    endBox.classList.add('hidden');
  }
}

export function selectMedReminder(val) {
  document.getElementById('m-reminder').value = val;
  ['exact','15','30','60'].forEach(o => {
    const btn = document.getElementById('mr-'+o);
    if (btn) btn.className = `px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${o===val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`;
  });
}

export function selectEditMedReminder(val) {
  document.getElementById('em-reminder').value = val;
  ['exact','15','30','60'].forEach(o => {
    const btn = document.getElementById('emr-'+o);
    if (btn) btn.className = `py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-all text-center ${o===val ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`;
  });
}

export function updateDoseSection() {
  const fmt = document.getElementById('d-format')?.value;
  const section = document.getElementById('d-dose-section');
  const wrap = document.getElementById('d-dose-input-wrap');
  const badge = document.getElementById('d-unit-badge');
  if (!fmt || !section) return;
  section.classList.remove('hidden');

  if (fmt === 'Comprimido') {
    badge.textContent = 'Comprimido(s)';
    wrap.innerHTML = `
      <select id="d-dose" class="input-field" onchange="updateDosePreview()">
        <option value="">— Selecciona dosis —</option>
        <option value="1/4">1/4</option>
        <option value="1/3">1/3</option>
        <option value="1/2">1/2</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>`;
  } else {
    const unitMap = { Pipeta:'ML', Collar:'Unidad', Spray:'ML', Jarabe:'ML', Inyección:'ML' };
    badge.textContent = unitMap[fmt] || 'Unidades';
    wrap.innerHTML = `<input id="d-dose" type="number" min="0" step="0.1" placeholder="0.0"
      class="input-field" oninput="updateDosePreview()" />`;
  }
  updateDosePreview();
}

export function updateDosePreview() {
  const fmt = document.getElementById('d-format')?.value;
  const dose = document.getElementById('d-dose')?.value;
  const preview = document.getElementById('d-dose-preview');
  const previewText = document.getElementById('d-dose-preview-text');
  if (!preview || !previewText) return;
  if (fmt && dose) {
    const unitMap = { Comprimido:'Comprimido(s)', Pipeta:'ML', Collar:'Unidad(es)', Spray:'ML', Jarabe:'ML', Inyección:'ML' };
    previewText.textContent = `${dose} ${unitMap[fmt] || ''}`;
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
}

export function updateDoseUnit() { updateDoseSection(); }

export function openEditMedModal(petId, medId) {
  const pet = state.pets.find(p => p.id === petId);
  const m = pet?.medications?.find(x => x.id === medId);
  if (!m) return;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('pencil','w-5 h-5')} Editar Tratamiento</h3>
      <form onsubmit="saveEditMedication(event,'${petId}','${medId}')" class="space-y-3">
        <div><label class="form-label">Medicamento *</label><input id="em-name" required value="${esc(m.name||'')}" class="input-field" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Dosis</label><input id="em-dose-val" type="number" step="0.1" value="${esc(m.doseVal||'')}" class="input-field" /></div>
          <div><label class="form-label">Unidad</label>
            <select id="em-unit" class="input-field">
              ${['mg','ml','Comprimido(s)','Gotas','UI'].map(u => `<option ${u===m.doseUnit?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <div>
          <label class="form-label">Frecuencia</label>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-400 font-medium whitespace-nowrap flex-shrink-0">Cada</span>
            <input id="em-freq-n" type="number" min="1" max="72" value="${esc(m.freqN||'')}" class="input-field !w-16 text-center flex-shrink-0" />
            <select id="em-freq-unit" class="input-field flex-1">
              <option value="horas" ${m.freqUnit==='horas'?'selected':''}>Horas</option>
              <option value="dias" ${m.freqUnit==='dias'?'selected':''}>Días</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Fecha inicio</label><input id="em-start" type="date" value="${esc(m.startDate||'')}" class="input-field" /></div>
          <div><label class="form-label">Hora inicio</label>
            <select id="em-start-time" class="input-field text-center">
              ${Array.from({length:24},(_,i)=>{const h=String(i).padStart(2,'0');return`<option value="${h}:00" ${m.startTime===`${h}:00`?'selected':''}>${h}:00</option>`;}).join('')}
            </select>
          </div>
          <div><label class="form-label">Días tratamiento</label><input id="em-days" type="number" min="1" value="${esc(m.treatmentDays||'')}" class="input-field" /></div>
          <div><label class="form-label">Fecha caducidad</label><input id="em-expiry" type="date" value="${esc(m.expiry||'')}" class="input-field" /></div>
          <div><label class="form-label">Costo (CLP)</label><input id="em-cost" type="text" inputmode="numeric" value="${esc(m.cost||'')}" class="input-field" /></div>
        </div>
        <div>
          <label class="form-label flex items-center gap-1">${icon('bell','w-3.5 h-3.5')} Recordatorio por dosis</label>
          <div class="grid grid-cols-2 gap-2 mt-1">
            ${[{v:'exact',l:'Horario exacto'},{v:'15',l:'15 min antes'},{v:'30',l:'30 min antes'},{v:'60',l:'60 min antes'}].map(o => `
              <button type="button" onclick="selectEditMedReminder('${o.v}')" id="emr-${o.v}"
                class="py-2.5 px-2 rounded-xl border-2 text-sm font-medium transition-all text-center
                ${(m.reminder||'exact')===o.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}">
                ${o.l}
              </button>`).join('')}
          </div>
          <input type="hidden" id="em-reminder" value="${esc(m.reminder||'exact')}" />
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" id="em-active" ${m.active?'checked':''} class="rounded text-brand-500" />
          <label for="em-active" class="text-sm text-gray-700">Tratamiento activo</label>
        </div>
        <hr class="border-gray-100" />
        <div>
          <label class="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">${icon('box','w-4 h-4')} Stock del medicamento <span class="text-gray-400 font-normal">(opcional)</span></label>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Cantidad total</label><input id="em-stock-total" type="number" min="0" value="${esc(m.stockTotal||'')}" class="input-field" /></div>
            <div><label class="form-label">Unidad</label>
              <select id="em-stock-unit" class="input-field">
                ${['Comprimidos','ml','mg','Ampollas','Frascos'].map(u => `<option ${u===m.stockUnit?'selected':''}>${u}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar cambios</button>
        </div>
      </form>
    </div>`);
}

export async function saveEditMedication(e, petId, medId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  const m = pet?.medications?.find(x => x.id === medId);
  if (!m) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const days = g('em-days') ? parseInt(g('em-days')) : null;
  const startDate = g('em-start'), startTime = g('em-start-time');
  const name = g('em-name'), doseVal = g('em-dose-val'), doseUnit = g('em-unit');
  const freqN = g('em-freq-n'), freqUnit = g('em-freq-unit');
  const frequency = freqN ? `Cada ${freqN} ${freqUnit === 'horas' ? 'horas' : 'días'}` : '';
  const expiry = g('em-expiry') || null, cost = parseCLP(g('em-cost'));
  const stockTotal = g('em-stock-total') || null, stockUnit = g('em-stock-unit');
  const reminder = g('em-reminder');
  const active = document.getElementById('em-active')?.checked;
  // Igual que saveMedication(): si se borra "N° días de tratamiento" el
  // tratamiento pasa a ser abierto (sin fecha de fin), no se deja la fecha
  // de fin vieja — antes `days` quedaba en 0 (no null) para un campo
  // vacío, así que este bloque nunca se recalculaba y la fecha de fin
  // obsoleta se guardaba tal cual, tanto localmente como en Supabase.
  let endDate = null;
  if (days && startDate) {
    const d = new Date(startDate + 'T12:00:00'); d.setDate(d.getDate() + days);
    endDate = d.toISOString().slice(0,10);
  }
  if (!isDemoUser()) {
    const { error } = await sb.from('medications').update({
      name, dose_val: doseVal || null, dose_unit: doseUnit,
      freq_n: freqN || null, freq_unit: freqUnit,
      start_date: startDate, start_time: startTime, treatment_days: days || null, end_date: endDate,
      expiry_date: expiry, cost, active, reminder, stock_qty: stockTotal, stock_unit: stockUnit
    }).eq('id', medId);
    if (error) { showToast('Error al guardar cambios', 'error'); console.error(error); return; }
  }
  m.name = name;
  m.doseVal = doseVal; m.doseUnit = doseUnit;
  m.dose = `${doseVal||''} ${doseUnit||''}`.trim();
  m.freqN = freqN; m.freqUnit = freqUnit; m.frequency = frequency;
  m.startDate = startDate; m.startTime = startTime; m.treatmentDays = days;
  m.endDate = endDate;
  m.expiry = expiry; m.cost = cost; m.reminder = reminder;
  m.active = active; m.stockTotal = stockTotal; m.stockUnit = stockUnit;
  closeModal(); render();
  showToast('Tratamiento actualizado ✓', 'success');
}

export function openEditHistoryModal(petId, histId) {
  const pet = state.pets.find(p => p.id === petId);
  const h = pet?.clinicalHistory?.find(x => x.id === histId);
  if (!h) return;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${icon('pencil','w-5 h-5')} Editar evento clínico</h3>
      <form onsubmit="saveEditHistory(event,'${petId}','${histId}')" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2"><label class="form-label">Título *</label><input id="eh-title" required value="${esc(h.title||'')}" class="input-field" /></div>
          <div><label class="form-label">Tipo</label>
            <select id="eh-type" class="input-field">
              ${['Cirugía','Esterilización','Procedimiento','Diagnóstico','Otro'].map(t => `<option ${t===h.type?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Fecha *</label><input id="eh-date" type="date" required value="${esc(h.date||'')}" class="input-field" /></div>
          <div><label class="form-label">Médico</label><input id="eh-doctor" value="${esc(h.doctor||'')}" placeholder="Dr. García" class="input-field" /></div>
          <div><label class="form-label">Clínica</label><input id="eh-clinic" value="${esc(h.clinic||'')}" placeholder="Clínica Vet." class="input-field" /></div>
          <div class="col-span-2"><label class="form-label">Costo (CLP)</label><input id="eh-cost" type="text" inputmode="numeric" value="${esc(h.cost||'')}" class="input-field" /></div>
          <div class="col-span-2"><label class="form-label">Notas</label><textarea id="eh-notes" rows="3" class="input-field resize-none">${esc(h.notes||'')}</textarea></div>
        </div>
        ${(h.files||[]).length > 0 ? `
        <div>
          <label class="form-label">Archivos adjuntos actuales</label>
          <div class="flex flex-wrap gap-2 mt-1">
            ${h.files.map((f,fi) => `
              <div class="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                ${icon('paperclip','w-3 h-3 inline align-text-bottom')} ${esc(f.name)}
                <button type="button" onclick="removeHistoryFile('${petId}','${histId}',${fi})" class="ml-1 text-red-400 hover:text-red-600">✕</button>
              </div>`).join('')}
          </div>
        </div>` : ''}
        <div>
          <label class="form-label flex items-center gap-1">${icon('paperclip','w-3.5 h-3.5')} Agregar más archivos</label>
          <div onclick="document.getElementById('eh-files').click()"
            class="mt-1 border-2 border-dashed border-gray-200 rounded-xl p-3 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50 transition-colors">
            <p class="text-xs text-gray-400">Haz clic para seleccionar archivos${!isPremium() ? ' · Plan Free: 1 archivo por evento (Premium: ilimitados)' : ''}</p>
          </div>
          <input id="eh-files" type="file" multiple accept="image/*,.pdf,.doc,.docx" class="hidden" onchange="previewHistoryFilesEdit(this)" />
          <div id="eh-files-preview" class="flex flex-wrap gap-2 mt-2"></div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar cambios</button>
        </div>
      </form>
    </div>`);
}

export function previewHistoryFilesEdit(input) {
  const preview = document.getElementById('eh-files-preview');
  if (!preview) return;
  preview.innerHTML = '';
  Array.from(input.files).forEach(file => {
    const el = document.createElement('div');
    el.className = 'flex items-center gap-1.5 px-2 py-1 bg-brand-50 border border-brand-100 rounded-lg text-xs text-brand-700';
    el.textContent = `${file.name}`;
    preview.appendChild(el);
  });
}

export async function removeHistoryFile(petId, histId, fileIndex) {
  const pet = state.pets.find(p => p.id === petId);
  const h = pet?.clinicalHistory?.find(x => x.id === histId);
  if (!h) return;
  if (blockIfReadOnly(pet)) return;
  const previousFiles = h.files || [];
  const newFiles = previousFiles.filter((_,i) => i !== fileIndex);
  // Se persiste de inmediato (no espera a "Guardar cambios" del resto del
  // formulario): antes solo mutaba el estado en memoria, así que si el
  // usuario cerraba el modal sin guardar el resto de los campos, el
  // archivo "eliminado" reaparecía en la próxima carga porque Supabase
  // nunca se actualizaba.
  if (!isDemoUser()) {
    const { error } = await sb.from('history_records').update({
      files: newFiles.map(f => JSON.stringify(f))
    }).eq('id', histId);
    if (error) { showToast('Error al eliminar el archivo', 'error'); console.error(error); return; }
  }
  h.files = newFiles;
  closeModal();
  openEditHistoryModal(petId, histId);
}

export async function saveEditHistory(e, petId, histId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  const h = pet?.clinicalHistory?.find(x => x.id === histId);
  if (!h) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const filesInput = document.getElementById('eh-files');
  const newFiles = filesInput?.files?.length ? await readFilesAsBase64(filesInput) : [];
  const title = g('eh-title'), type = g('eh-type'), date = g('eh-date');
  const doctor = g('eh-doctor'), clinic = g('eh-clinic'), cost = parseCLP(g('eh-cost')), notes = g('eh-notes');
  let files = [...(h.files||[]), ...newFiles];
  // Plan Free: 1 adjunto por evento en total (existentes + nuevos) — Premium sin límite.
  if (!isPremium()) files = files.slice(0, 1);
  if (!isDemoUser()) {
    const { error } = await sb.from('history_records').update({
      title, type, date, vet: doctor, clinic, cost, notes,
      files: files.map(f => JSON.stringify(f))
    }).eq('id', histId);
    if (error) { showToast('Error al guardar cambios', 'error'); console.error(error); return; }
  }
  h.title = title; h.type = type; h.date = date; h.doctor = doctor;
  h.clinic = clinic; h.cost = cost; h.notes = notes; h.files = files;
  closeModal(); render();
  showToast('Evento actualizado ✓', 'success');
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    tabMedications, tabHistory, openMedModal, openHistoryModal, saveMedication,
    deleteMedication, markDoseTaken, previewHistoryFiles, readFilesAsBase64,
    saveHistory, deleteHistory, updateMedPreview, selectMedReminder,
    selectEditMedReminder, updateDoseSection, updateDosePreview, updateDoseUnit,
    openEditMedModal, saveEditMedication, openEditHistoryModal,
    previewHistoryFilesEdit, removeHistoryFile, saveEditHistory,
  });
}
