/* ============================================================
   MASCODATA — Agenda / Calendario
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vista de calendario, creación
   manual de eventos y navegación entre meses. */

// Texto de un evento: las estadías se leen según quién mira ("Estadía contigo" / "Estadía con Pedro"),
// porque se guardan con un rol ('owner' / 'guest') y no con un nombre.
function eventLabel(e) {
  if (e.type !== STAY_TYPE) return e.title;
  const pet = state.pets.find(p => p.id === e.petId);
  const who = stayWho(pet, e.holder);
  return who.mine ? 'Estadía contigo' : `Estadía con ${who.label}`;
}

// Versión corta para las celdas del calendario: solo con quién está.
function eventChipLabel(e) {
  if (e.type !== STAY_TYPE) return e.title;
  const who = stayWho(state.pets.find(p => p.id === e.petId), e.holder);
  return who.mine ? 'Contigo' : `Con ${who.label}`;
}

// Fechas de un evento: un día o un rango.
function eventDates(e) {
  return e.endDate && e.endDate !== e.date ? `${formatDate(e.date)} → ${formatDate(e.endDate)}` : formatDate(e.date);
}

// ¿Puede esta persona modificar o borrar el evento? Los suyos, o los de una mascota que puede editar.
function canModifyEvent(e) {
  if (e.source && e.source !== 'manual') return false;
  if (!e.userId || e.userId === state.user?.id) return true;
  const pet = state.pets.find(p => p.id === e.petId);
  return !!pet && canEditPet(pet);
}

const SHARED_NOTICE_KEY = 'mascodata-shared-events-notice';
const sharedNoticeSeen = () => { try { return localStorage.getItem(SHARED_NOTICE_KEY) === '1'; } catch (e) { return true; } };
export function dismissSharedEventsNotice() {
  try { localStorage.setItem(SHARED_NOTICE_KEY, '1'); } catch (e) {}
  render();
}

export function viewCalendar() {
  if (state.pets.length === 0) {
    return noPetsOnboarding('calendar', 'Tu agenda está esperando', 'Registra una mascota primero para poder agendar vacunas, controles y otros eventos.');
  }
  const now = new Date();
  const year = state.calYear || now.getFullYear();
  const month = state.calMonth !== undefined ? state.calMonth : now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const today = todayStr();
  const events = getAgendaEvents();
  const monthName = firstDay.toLocaleDateString('es-CL', { month:'long', year:'numeric' });
  const days = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);

  const calView = state.calViewMode || 'calendario';

  const eventsListPanel = (() => {
    const upcoming = events.filter(e => (e.endDate || e.date) >= today).sort((a,b)=>a.date>b.date?1:-1);
    const { items: evPage, total, pages, page } = paginate(upcoming, 'events');
    return `
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="font-semibold text-gray-800">Próximos eventos</h3>
          ${total > 0 ? `<p class="text-xs text-gray-400 mt-0.5">${total} evento${total!==1?'s':''}</p>` : ''}
        </div>
      </div>
      ${total === 0
        ? emptyState('calendar','Sin eventos próximos','Crea tu primer evento para verlo aquí','+ Crear evento','openEventModal()')
        : `<div class="space-y-1">
             ${evPage.map(e => `
               <div class="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition-colors group">
                 <div class="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 flex-shrink-0">${icon(eventIcon(e.type),'w-4.5 h-4.5')}</div>
                 <div class="flex-1 min-w-0">
                   <div class="text-sm font-medium text-gray-900 truncate">${esc(eventLabel(e))}</div>
                   <div class="text-xs text-gray-400">${eventDates(e)}${e.pet ? ` · ${esc(e.pet)}` : ''}${e.source && e.source !== 'manual' ? ` · <span class="text-gray-300">automático</span>` : ''}</div>
                 </div>
                 ${canModifyEvent(e) ? `
                 <button onclick="deleteEvent('${safeId(e.id)}')"
                   class="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors md:opacity-0 md:group-hover:opacity-100">
                   ${icon('trash','w-3.5 h-3.5')}
                 </button>` : ''}
               </div>`).join('')}
           </div>
           ${pagerHTML('events', pages, page)}`}
    </div>`;
  })();

  const calendarGridPanel = `
    <div class="bg-white rounded-2xl shadow-sm p-3 md:p-4 mb-6">
      <div class="flex items-center justify-between mb-3">
        <button onclick="prevMonth()" class="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 font-medium">‹</button>
        <span class="font-semibold text-gray-800 capitalize text-sm md:text-base">${monthName}</span>
        <button onclick="nextMonth()" class="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 font-medium">›</button>
      </div>
      <div class="grid grid-cols-7 gap-0.5 mb-1">
        ${['D','L','M','X','J','V','S'].map((d,i) => `<div class="text-center text-[10px] md:text-xs font-medium text-gray-500 py-1">${d}</div>`).join('')}
      </div>
      <div class="grid grid-cols-7 gap-0.5">
        ${days.map((d, i) => {
          if (!d) return `<div class="calendar-day other-month"></div>`;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const dayEvents = events.filter(e => eventCoversDate(e, dateStr));
          const isToday = dateStr === today;
          const fullDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
          const ariaLabel = `${fullDate}${isToday ? ' · hoy' : ''}${dayEvents.length ? ` · ${dayEvents.length} evento${dayEvents.length!==1?'s':''}` : ' · sin eventos'}`;
          return `
            <button type="button" onclick="openEventModal('${dateStr}')" class="calendar-day ${isToday?'today':''} relative w-full text-left" aria-label="${ariaLabel}" aria-current="${isToday ? 'date' : 'false'}">
              <div class="text-[10px] md:text-xs font-semibold ${isToday?'text-brand-600':'text-gray-700'}">${d}</div>
              ${dayEvents.slice(0,2).map(e => `
                <div class="hidden md:block text-xs mt-0.5 px-1 py-0.5 rounded ${e.type === STAY_TYPE ? 'bg-teal-100 text-teal-700' : 'bg-brand-100 text-brand-700'} truncate flex items-center gap-1">${icon(eventIcon(e.type),'w-3 h-3 flex-shrink-0')} ${esc(eventChipLabel(e))}</div>
                <div class="md:hidden mt-0.5 w-1.5 h-1.5 rounded-full ${e.type === STAY_TYPE ? 'bg-teal-400' : 'bg-brand-400'} mx-auto"></div>
              `).join('')}
            </button>`;
        }).join('')}
      </div>
    </div>

    ${eventsListPanel}`;

  return appShell(`
    ${pageHeader('Agenda', monthName,
      `<div class="flex items-center gap-2 flex-wrap justify-end">
         <div class="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-medium">
           ${[['calendario','calendar','Calendario'],['lista','menu','Lista']].map(([v,ic,label])=>`
             <button onclick="state.calViewMode='${v}';render()"
               class="px-3 py-1.5 flex items-center gap-1.5 transition-colors ${calView===v?'bg-brand-600 text-white':'text-gray-500 hover:bg-gray-50'}">
               ${icon(ic,'w-3.5 h-3.5')} ${label}
             </button>`).join('')}
         </div>
         <button onclick="openEventModal()" class="btn-primary flex items-center gap-1.5">
           ${icon('plus','w-4 h-4')}
           <span>Crear evento</span>
         </button>
       </div>`)}

    ${(() => {
      const links = state.pets.filter(p => canEditPet(p) && state.events.some(x => x.type === STAY_TYPE && x.petId === p.id && (x.endDate || x.date) >= today));
      return links.length ? `<div class="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-gray-500">${links.map(p => `<button onclick="deleteFutureStays('${safeId(p.id)}')" class="hover:text-red-600 hover:underline">Quitar las estadías futuras de ${esc(p.name)}</button>`).join('')}</div>` : '';
    })()}

    ${state.pets.some(hasOtherTutor) && !sharedNoticeSeen() ? `
    <div class="flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-2xl p-3.5 mb-4 text-sm text-gray-700">
      <div class="flex-1">Los eventos con mascota ahora los ven todos sus tutores. Los que no tienen mascota siguen siendo solo tuyos.</div>
      <button onclick="dismissSharedEventsNotice()" class="text-brand-600 font-semibold hover:underline flex-shrink-0">Entendido</button>
    </div>` : ''}

    ${calView === 'calendario' ? calendarGridPanel : eventsListPanel}
  `);
}

// Mascotas donde se puede crear una estadía: con otro tutor y en modalidad "tutores separados".
const stayPets = () => state.pets.filter(p => canEditPet(p) && hasOtherTutor(p) && p.careMode === 'separated');

export function openEventModal(dateStr = '') {
  const pets = state.pets.filter(p => canEditPet(p));
  const stayEnabled = stayPets().length > 0;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Nuevo evento</h3>
      <form onsubmit="saveEvent(event)" class="space-y-3">
        <div id="ev-title-wrap"><label class="form-label">Título *</label><input id="ev-title" required placeholder="Ej: Consulta anual" class="input-field" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Tipo</label>
            <select id="ev-type" class="input-field" onchange="onEventTypeChange()">
              <option>Consulta</option><option>Examen</option><option>Peluquería</option>
              <option>Hotel</option><option>Vacuna</option><option>Otro</option>
              ${stayEnabled ? `<option>${STAY_TYPE}</option>` : ''}
            </select>
          </div>
          <div><label class="form-label">Fecha *</label><input id="ev-date" type="date" required value="${dateStr}" class="input-field" /></div>
        </div>
        <div id="ev-stay" class="hidden space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div id="ev-end-wrap"><label class="form-label">Hasta *</label><input id="ev-end" type="date" class="input-field" /></div>
            <div><label id="ev-holder-label" class="form-label">¿Con quién está?</label><select id="ev-holder" class="input-field"></select></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Repetir</label>
              <select id="ev-repeat" class="input-field" onchange="onRepeatChange()">
                <option value="none">No repetir</option>
                <option value="alternate">Alternar turnos</option>
                <option value="weekends">Todos los fines de semana</option>
              </select>
            </div>
            <div id="ev-every-wrap" class="hidden"><label class="form-label">Cada turno dura</label>
              <select id="ev-every" class="input-field">${[2, 3, 4, 5, 7, 10, 14].map(n => `<option value="${n}" ${n === 7 ? 'selected' : ''}>${n} días</option>`).join('')}</select>
            </div>
          </div>
          <div id="ev-until-wrap" class="hidden"><label class="form-label">Repetir hasta *</label><input id="ev-until" type="date" class="input-field" />
            <p id="ev-repeat-hint" class="text-xs text-gray-400 mt-1"></p>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div id="ev-time-wrap"><label class="form-label">Hora</label><input id="ev-time" type="time" class="input-field" /></div>
          <div><label class="form-label">Mascota</label>
            <select id="ev-pet" class="input-field" onchange="onEventPetChange()">
              <option value="">Sin mascota</option>
              ${pets.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div><label class="form-label">Notas</label><textarea id="ev-notes" rows="2" class="input-field resize-none" placeholder="Detalles del evento..."></textarea></div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

// Opciones de "¿Con quién está?" según la mascota elegida: yo o el otro tutor (con su nombre si lo conozco).
export function onEventPetChange() {
  const sel = document.getElementById('ev-holder');
  if (!sel) return;
  const pet = state.pets.find(p => p.id === document.getElementById('ev-pet')?.value);
  const myGroup = !pet?.myRole || pet.myRole === 'owner' ? 'owner' : 'guest';
  const otherName = stayWho(pet, myGroup === 'owner' ? 'guest' : 'owner').label;
  sel.innerHTML = `<option value="me">Conmigo</option><option value="other">Con ${esc(otherName)}</option>`;
}

// Al elegir cómo se repite una estadía: sin repetir se pide el fin; con turnos alternados, cuánto dura
// cada turno; y en ambos casos hasta cuándo se repite.
export function onRepeatChange() {
  const mode = document.getElementById('ev-repeat')?.value || 'none';
  document.getElementById('ev-end-wrap')?.classList.toggle('hidden', mode !== 'none');
  document.getElementById('ev-every-wrap')?.classList.toggle('hidden', mode !== 'alternate');
  document.getElementById('ev-until-wrap')?.classList.toggle('hidden', mode === 'none');
  const label = document.getElementById('ev-holder-label');
  if (label) label.textContent = mode === 'alternate' ? 'Empieza con' : mode === 'weekends' ? 'Los fines de semana con' : '¿Con quién está?';
  const hint = document.getElementById('ev-repeat-hint');
  if (hint) hint.textContent = mode === 'alternate' ? 'Los turnos se alternan entre los dos tutores, sin días libres.'
    : mode === 'weekends' ? 'De viernes a domingo, desde el primer viernes de la fecha de inicio.' : '';
}

// Al elegir "Estadía": el título se genera solo, aparecen "Hasta" y "¿Con quién?", la mascota se limita a
// las que tienen otro tutor en modalidad "separados" y desaparece la hora.
export function onEventTypeChange() {
  const isStay = document.getElementById('ev-type')?.value === STAY_TYPE;
  document.getElementById('ev-stay')?.classList.toggle('hidden', !isStay);
  document.getElementById('ev-time-wrap')?.classList.toggle('hidden', isStay);
  document.getElementById('ev-title-wrap')?.classList.toggle('hidden', isStay);
  const title = document.getElementById('ev-title');
  if (title) title.required = !isStay;
  const petSel = document.getElementById('ev-pet');
  if (petSel) {
    const list = isStay ? stayPets() : state.pets.filter(p => canEditPet(p));
    const current = petSel.value;
    petSel.innerHTML = (isStay ? '' : '<option value="">Sin mascota</option>') + list.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (list.some(p => p.id === current)) petSel.value = current;
  }
  if (isStay) { onEventPetChange(); onRepeatChange(); }
}

export async function saveEvent(e) {
  e.preventDefault();
  const g = id => document.getElementById(id)?.value;
  const type = g('ev-type');
  const isStay = type === STAY_TYPE;
  const petId = g('ev-pet') || null;
  const row = {
    user_id: state.user.id, pet_id: petId,
    title: isStay ? STAY_TYPE : g('ev-title'), date: g('ev-date'), time: isStay ? null : g('ev-time'),
    type, notes: g('ev-notes'),
  };
  let rows = [row], skipped = 0;
  if (isStay) {
    const pet = state.pets.find(p => p.id === petId);
    if (!pet) { showToast('Elige la mascota de la estadía', 'error'); return; }
    const myGroup = !pet.myRole || pet.myRole === 'owner' ? 'owner' : 'guest';
    const toRole = rel => (rel === 'me' ? myGroup : (myGroup === 'owner' ? 'guest' : 'owner'));
    const firstHolder = g('ev-holder') === 'other' ? 'other' : 'me';
    const repeat = g('ev-repeat') || 'none';
    if (repeat === 'none') {
      const end = g('ev-end');
      if (!end || end < row.date) { showToast('La fecha de fin debe ser igual o posterior al inicio', 'error'); return; }
      row.end_date = end;
      row.holder = toRole(firstHolder);
    } else {
      const until = g('ev-until');
      if (!until || until < row.date) { showToast('Indica hasta cuándo se repite (igual o posterior al inicio)', 'error'); return; }
      if (daysBetween(row.date, until) > 366) { showToast('Los turnos pueden repetirse hasta por un año', 'error'); return; }
      const turns = stayTurns({ start: row.date, until, pattern: repeat, every: g('ev-every'), firstHolder });
      // Las estadías que ya existen en esas fechas no se duplican ni se pisan.
      const existing = state.events.filter(x => x.type === STAY_TYPE && x.petId === petId);
      const fresh = turns.filter(t => !existing.some(x => rangesOverlap(t.date, t.endDate, x.date, x.endDate)));
      skipped = turns.length - fresh.length;
      if (!fresh.length) { showToast('Ya hay estadías registradas en todas esas fechas', 'error'); return; }
      rows = fresh.map(t => ({ ...row, date: t.date, end_date: t.endDate, holder: toRole(t.holder) }));
    }
  }
  let saved;
  if (isDemoUser()) {
    saved = rows.map(r => ({ id: genId(), ...r }));
  } else {
    const res = await sb.from('events').insert(rows.length === 1 ? rows[0] : rows).select();
    if (res.error) {
      const missingColumn = isStay && /end_date|holder/i.test(res.error.message || '');
      showToast(missingColumn ? 'Falta actualizar la base de datos para usar estadías' : 'Error al guardar evento', 'error');
      if (missingColumn) console.warn('Ejecuta supabase/schema/shared_events_care_mode.sql', res.error);
      return;
    }
    saved = Array.isArray(res.data) ? res.data : [res.data];
  }
  saved.forEach(data => state.events.push({ id: data.id, title: data.title, date: data.date, time: data.time, userId: data.user_id,
    endDate: data.end_date || null, holder: data.holder || null,
    type: data.type, petId: data.pet_id, pet: state.pets.find(p => p.id === data.pet_id)?.name || null, notes: data.notes }));
  closeModal(); render();
  showToast(!isStay ? 'Evento guardado'
    : saved.length === 1 ? 'Estadía guardada'
    : `Se crearon ${saved.length} estadías${skipped ? ` (${skipped} ya existían y se omitieron)` : ''}`, 'success');
}

// Quita las estadías de una mascota que todavía no terminaron (para rehacer un calendario de turnos).
export async function deleteFutureStays(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet || !canEditPet(pet)) return;
  const today = todayStr();
  const future = state.events.filter(x => x.type === STAY_TYPE && x.petId === petId && (x.endDate || x.date) >= today);
  if (!future.length) return;
  if (!confirm(`¿Quitar las ${future.length} estadía${future.length !== 1 ? 's' : ''} de ${pet.name} que aún no terminan? Las ya cumplidas se conservan.`)) return;
  if (!isDemoUser()) {
    const { error } = await sb.from('events').delete().eq('pet_id', petId).eq('type', STAY_TYPE).gte('end_date', today);
    if (error) { showToast('Error al eliminar las estadías', 'error'); console.error(error); return; }
  }
  const ids = new Set(future.map(x => x.id));
  state.events = state.events.filter(x => !ids.has(x.id));
  render();
  showToast('Estadías eliminadas', 'success');
}

export async function deleteEvent(id) {
  const ev = state.events.find(x => x.id === id);
  if (ev && !canModifyEvent(ev)) { showToast('No tienes permiso para eliminar este evento', 'error'); return; }
  if (!isDemoUser()) {
    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  }
  state.events = state.events.filter(e => e.id !== id); render();
}

export function prevMonth() {
  let m = state.calMonth !== undefined ? state.calMonth : new Date().getMonth();
  let y = state.calYear || new Date().getFullYear();
  if (m === 0) { m = 11; y--; } else m--;
  state.calMonth = m; state.calYear = y; render();
}

export function nextMonth() {
  let m = state.calMonth !== undefined ? state.calMonth : new Date().getMonth();
  let y = state.calYear || new Date().getFullYear();
  if (m === 11) { m = 0; y++; } else m++;
  state.calMonth = m; state.calYear = y; render();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    viewCalendar, openEventModal, onEventTypeChange, onEventPetChange, onRepeatChange, saveEvent, deleteEvent, deleteFutureStays, dismissSharedEventsNotice, prevMonth, nextMonth,
  });
}
