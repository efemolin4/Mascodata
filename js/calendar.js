/* ============================================================
   MASCODATA — Agenda / Calendario
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vista de calendario, creación
   manual de eventos y navegación entre meses. */

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
    const upcoming = events.filter(e=>e.date>=today).sort((a,b)=>a.date>b.date?1:-1);
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
                   <div class="text-sm font-medium text-gray-900 truncate">${esc(e.title)}</div>
                   <div class="text-xs text-gray-400">${formatDate(e.date)}${e.pet ? ` · ${esc(e.pet)}` : ''}${e.source && e.source !== 'manual' ? ` · <span class="text-gray-300">automático</span>` : ''}</div>
                 </div>
                 ${(!e.source || e.source === 'manual') ? `
                 <button onclick="deleteEvent('${e.id}')"
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
          const dayEvents = events.filter(e => e.date === dateStr);
          const isToday = dateStr === today;
          const fullDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
          const ariaLabel = `${fullDate}${isToday ? ' · hoy' : ''}${dayEvents.length ? ` · ${dayEvents.length} evento${dayEvents.length!==1?'s':''}` : ' · sin eventos'}`;
          return `
            <button type="button" onclick="openEventModal('${dateStr}')" class="calendar-day ${isToday?'today':''} relative w-full text-left" aria-label="${ariaLabel}" aria-current="${isToday ? 'date' : 'false'}">
              <div class="text-[10px] md:text-xs font-semibold ${isToday?'text-brand-600':'text-gray-700'}">${d}</div>
              ${dayEvents.slice(0,2).map(e => `
                <div class="hidden md:block text-xs mt-0.5 px-1 py-0.5 rounded bg-brand-100 text-brand-700 truncate flex items-center gap-1">${icon(eventIcon(e.type),'w-3 h-3 flex-shrink-0')} ${esc(e.title)}</div>
                <div class="md:hidden mt-0.5 w-1.5 h-1.5 rounded-full bg-brand-400 mx-auto"></div>
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

    ${calView === 'calendario' ? calendarGridPanel : eventsListPanel}
  `);
}

export function openEventModal(dateStr = '') {
  const pets = state.pets;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Nuevo evento</h3>
      <form onsubmit="saveEvent(event)" class="space-y-3">
        <div><label class="form-label">Título *</label><input id="ev-title" required placeholder="Ej: Consulta anual" class="input-field" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Tipo</label>
            <select id="ev-type" class="input-field">
              <option>Consulta</option><option>Examen</option><option>Peluquería</option>
              <option>Hotel</option><option>Vacuna</option><option>Otro</option>
            </select>
          </div>
          <div><label class="form-label">Fecha *</label><input id="ev-date" type="date" required value="${dateStr}" class="input-field" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Hora</label><input id="ev-time" type="time" class="input-field" /></div>
          <div><label class="form-label">Mascota</label>
            <select id="ev-pet" class="input-field">
              <option value="">Sin mascota</option>
              ${pets.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
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

export async function saveEvent(e) {
  e.preventDefault();
  const g = id => document.getElementById(id)?.value;
  const { data, error } = await sb.from('events').insert({
    user_id: state.user.id,
    pet_id: g('ev-pet') || null,
    title: g('ev-title'), date: g('ev-date'), time: g('ev-time'),
    type: g('ev-type'), notes: g('ev-notes')
  }).select().single();
  if (error) { showToast('Error al guardar evento', 'error'); return; }
  state.events.push({ id: data.id, title: data.title, date: data.date, time: data.time,
    type: data.type, petId: data.pet_id, pet: state.pets.find(p => p.id === data.pet_id)?.name || null, notes: data.notes });
  closeModal(); render();
  showToast('Evento guardado', 'success');
}

export async function deleteEvent(id) {
  const { error } = await sb.from('events').delete().eq('id', id);
  if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
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
    viewCalendar, openEventModal, saveEvent, deleteEvent, prevMonth, nextMonth,
  });
}
