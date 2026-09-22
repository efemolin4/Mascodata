/* ============================================================
   MASCODATA — Dashboard
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vista principal tras iniciar sesión:
   alertas, próximos eventos, medicamentos activos, recomendaciones. */

// ---- VISTA: DASHBOARD ----
export function viewDashboard() {
  const pets = state.pets;
  const today = todayStr();
  const dateStr0 = new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  if (pets.length === 0) {
    return appShell(`
      <div class="mb-5">
        <h1 class="text-xl md:text-2xl font-bold text-gray-900">Hola, ${esc(state.user?.name?.split(' ')[0] || 'Tutor')}</h1>
        <p class="text-sm text-gray-400 mt-0.5 capitalize">${dateStr0}</p>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-6 md:p-10 text-center max-w-2xl mx-auto mt-4 md:mt-8">
        <div class="mb-4 flex justify-center text-brand-400">${icon('paw','w-14 h-14')}</div>
        <h2 class="text-lg md:text-xl font-bold text-gray-900 mb-2">Empecemos con tu primera mascota</h2>
        <p class="text-sm text-gray-500 mb-8 max-w-md mx-auto">Regístrala para llevar su ficha de salud, agenda y gastos en un solo lugar. Solo toma un par de minutos.</p>
        <div class="grid sm:grid-cols-3 gap-3 mb-8 text-left">
          <div class="bg-brand-50 border border-brand-100 rounded-xl p-4">
            <div class="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs mb-2">1</div>
            <div class="text-sm font-semibold text-gray-800">Registra tu mascota</div>
            <div class="text-xs text-gray-500 mt-1">Nombre, especie y datos básicos</div>
          </div>
          <div class="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <div class="w-7 h-7 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold text-xs mb-2">2</div>
            <div class="text-sm font-semibold text-gray-800">Añade su primer evento</div>
            <div class="text-xs text-gray-500 mt-1">Una vacuna, control o consulta</div>
          </div>
          <div class="bg-gray-50 border border-gray-100 rounded-xl p-4">
            <div class="w-7 h-7 rounded-full bg-gray-300 text-white flex items-center justify-center font-bold text-xs mb-2">3</div>
            <div class="text-sm font-semibold text-gray-800">Configura recordatorios</div>
            <div class="text-xs text-gray-500 mt-1">Nunca más te olvides de una dosis</div>
          </div>
        </div>
        <button onclick="navigate('addPet')" class="btn-primary px-6 py-3 text-base">+ Registrar mi primera mascota</button>
      </div>
    `);
  }

  // Solo cuenta el registro MÁS RECIENTE de cada vacuna / producto: una dosis
  // vieja cuyo "próximo" ya pasó no es una alerta si después se aplicó otra
  // (antes, cada renovación dejaba una alerta vencida eterna del registro anterior).
  const latestBy = (records, keyFn) => {
    const latest = {};
    records.forEach(r => { const k = keyFn(r); if (!latest[k] || (r.date || '') > (latest[k].date || '')) latest[k] = r; });
    return Object.values(latest);
  };
  const dueLabel = (st, nextDate) => st.status === 'vencido' ? `Venció el ${formatDate(nextDate)}` : st.label;

  // Lista única de "qué necesita atención": alertas de fechas (nivel 0 vencido,
  // 1 por vencer) + recomendaciones (nivel 2), en vez de dos listas separadas
  // que podían contradecirse (0 alertas pero "lleva un año sin vacunas").
  const attention = [];
  pets.forEach(p => {
    const name = esc(p.name);
    let hasVaccineAlert = false;
    latestBy(p.vaccines || [], v => v.name).filter(v => v.nextDate).forEach(v => {
      const st = careAlertStatus(v.nextDate, v.alertType, v.alertDays);
      if (st.status === 'al_dia') return;
      hasVaccineAlert = true;
      attention.push({ petId: p.id, level: st.status === 'vencido' ? 0 : 1, date: v.nextDate, title: esc(v.name), sub: `${name} · ${dueLabel(st, v.nextDate)}`, actionLabel: 'Registrar vacuna', action: `openVaccineModal('${p.id}')` });
    });
    latestBy(p.deworming || [], d => d.product).filter(d => d.nextDate).forEach(d => {
      const st = careAlertStatus(d.nextDate, d.alertType, d.alertDays);
      if (st.status === 'al_dia') return;
      attention.push({ petId: p.id, level: st.status === 'vencido' ? 0 : 1, date: d.nextDate, title: `Desparasitación · ${esc(d.product)}`, sub: `${name} · ${dueLabel(st, d.nextDate)}`, actionLabel: 'Registrar dosis', action: `openDewormModal('${p.id}')` });
    });
    (p.medications || []).filter(m => m.active && m.endDate && m.endDate <= today).forEach(m => {
      attention.push({ petId: p.id, level: 1, date: m.endDate, title: `Tratamiento terminado · ${esc(m.name)}`, sub: `${name} · Terminó el ${formatDate(m.endDate)} y sigue marcado como activo`, actionLabel: 'Revisar', action: `navigate('petProfile',{currentPetId:'${p.id}',currentTab:'medicamentos'})` });
    });

    const ageYears = p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25*86400000)) : 0;
    const lastVaccDate = (p.vaccines || []).reduce((max, v) => v.date > max ? v.date : max, '');
    const vaccineAge = lastVaccDate ? Math.floor((Date.now() - new Date(lastVaccDate).getTime()) / (30.44*86400000)) : 999;
    const rec = (title, actionLabel, action) => attention.push({ petId: p.id, level: 2, date: '', title, sub: '', actionLabel, action });
    // Si ya hay una vacuna vencida/por vencer para esta mascota, esa alerta ya dice lo mismo.
    if (vaccineAge >= 12 && !hasVaccineAlert) rec(`${name} lleva más de un año sin registrar vacunas`, 'Registrar vacuna', `openVaccineModal('${p.id}')`);
    if (!p.vet?.name) rec(`${name} no tiene veterinario registrado. Agrégalo para tenerlo a mano en emergencias`, 'Agregar', `openEditPetModal('${p.id}')`);
    if (p.species === 'Perro' && ageYears >= 7) rec(`${name} tiene ${ageYears} años. Considera análisis de sangre anual para detección temprana`, 'Ver ficha', `openPet('${p.id}')`);
    if (p.species === 'Perro' && (p.breed || '').match(/Golden Retriever|Labrador/i)) rec(`Los ${esc(p.breed)}s son propensos a displasia de cadera. Consulta con tu vet sobre control radiológico`, 'Ver ficha', `openPet('${p.id}')`);
    if (p.species === 'Gato' && ageYears >= 10) rec(`${name} es un gato senior (${ageYears} años). Necesita revisiones veterinarias cada 6 meses`, 'Ver ficha', `openPet('${p.id}')`);
  });
  attention.sort((a, b) => a.level - b.level || (a.date || '9999').localeCompare(b.date || '9999'));
  const overdueCount = attention.filter(a => a.level === 0).length;
  const soonCount = attention.filter(a => a.level === 1).length;
  const ATTN_LIMIT = 4;
  const shownAttention = state.dashAttnAll ? attention : attention.slice(0, ATTN_LIMIT);
  const levelDot = ['bg-red-500', 'bg-amber-500', 'bg-brand-400'];
  const petStatus = (petId) => {
    const mine = attention.filter(a => a.petId === petId);
    const overdue = mine.filter(a => a.level === 0).length;
    const soon = mine.filter(a => a.level === 1).length;
    if (overdue) return `<span class="badge bg-red-100 text-red-600 text-xs flex-shrink-0">${overdue} vencida${overdue !== 1 ? 's' : ''}</span>`;
    if (soon) return `<span class="badge bg-amber-100 text-amber-600 text-xs flex-shrink-0">${soon} por vencer</span>`;
    const tips = mine.length;
    if (tips) return `<span class="badge bg-brand-100 text-brand-700 text-xs flex-shrink-0">${tips} sugerencia${tips !== 1 ? 's' : ''}</span>`;
    return `<span class="badge bg-green-100 text-green-700 text-xs flex-shrink-0">Al día</span>`;
  };

  const upcoming = (state.events || []).filter(e => e.date >= today).slice(0, 3);
  const todayMeds = pets.flatMap(p => (p.medications || []).filter(m => m.active));
  const thisMonth = today.slice(0, 7);
  const monthSpend = getFinanceExpenses().filter(e => e.date?.startsWith(thisMonth)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dateStr = new Date().toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  // Rachas y cumpleaños: extras de bienestar, debajo de lo accionable.
  const now = new Date();
  const streakCards = pets.map(p => {
    const activeMeds = (p.medications || []).filter(m => m.active);
    if (!activeMeds.length) return null;
    const doseLog = p.doseLog || [];
    let streak = 0;
    let checkDate = new Date(today + 'T12:00:00');
    for (let i = 0; i < 365; i++) {
      const d = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (doseLog.some(dl => dl.date === d && dl.given)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break;
    }
    return { name: p.name, streak };
  }).filter(Boolean);
  const birthdayPets = pets.map(p => {
    if (!p.dateOfBirth) return null;
    const dob = new Date(p.dateOfBirth + 'T12:00:00');
    const thisYear = now.getFullYear();
    let next = new Date(thisYear, dob.getMonth(), dob.getDate());
    if (next < now) next = new Date(thisYear + 1, dob.getMonth(), dob.getDate());
    const diffDays = Math.round((next - now) / 86400000);
    if (diffDays > 30) return null;
    return { name: p.name, days: diffDays, age: next.getFullYear() - dob.getFullYear() };
  }).filter(Boolean);
  const extraCards = [
    streakCards.length ? `
      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
        <h2 class="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">${icon('fire','w-4 h-4 text-orange-500')} Rachas de medicamentos</h2>
        <div class="space-y-2">
          ${streakCards.map(s => s.streak > 0
            ? `<div class="flex items-center gap-2 p-2.5 bg-orange-50 rounded-xl">
                 <span class="text-orange-500">${icon('fire','w-5 h-5')}</span>
                 <div><div class="text-sm font-semibold text-gray-800">${esc(s.name)}</div>
                 <div class="text-xs text-orange-600">${s.streak} día${s.streak!==1?'s':''} seguido${s.streak!==1?'s':''} sin saltarse una dosis</div></div>
               </div>`
            : `<div class="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                 <span class="text-gray-400">${icon('fire','w-5 h-5')}</span>
                 <div class="text-sm text-gray-600">¡Empieza hoy tu racha con ${esc(s.name)}!</div>
               </div>`).join('')}
        </div>
      </div>` : '',
    birthdayPets.length ? `
      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
        <h2 class="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">${icon('party','w-4 h-4 text-pink-500')} Próximos cumpleaños</h2>
        <div class="space-y-2">
          ${birthdayPets.map(b => `
            <div class="flex items-center gap-2 p-2.5 bg-pink-50 rounded-xl">
              <span class="text-pink-500 flex-shrink-0">${icon('party','w-5 h-5')}</span>
              <div>
                <div class="text-sm font-semibold text-gray-800">${esc(b.name)} cumple ${b.age} año${b.age!==1?'s':''}</div>
                <div class="text-xs text-pink-600">${b.days === 0 ? '¡Hoy es su cumpleaños!' : `En ${b.days} día${b.days!==1?'s':''}`}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>` : '',
  ].filter(Boolean);

  return appShell(`
    <div class="flex items-start justify-between gap-3 mb-5">
      <div class="min-w-0">
        <h1 class="text-xl md:text-2xl font-bold text-gray-900">Hola, ${esc(state.user?.name?.split(' ')[0] || 'Tutor')}</h1>
        <p class="text-sm text-gray-400 mt-0.5 capitalize">${dateStr}</p>
      </div>
      <button onclick="openEventModal()" class="btn-primary flex-shrink-0 flex items-center gap-1.5">${icon('plus','w-4 h-4')}<span class="hidden sm:inline">Agendar evento</span><span class="sm:hidden">Evento</span></button>
    </div>

    <!-- Pendientes -->
    <div id="dashboard-attention" class="bg-white rounded-2xl shadow-sm p-4 md:p-5 mb-4">
      ${attention.length === 0 ? `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">${icon('check','w-5 h-5')}</div>
          <div>
            <div class="font-semibold text-gray-900 text-sm">Todo al día</div>
            <div class="text-xs text-gray-500">No hay vacunas, desparasitaciones ni tratamientos pendientes.</div>
          </div>
        </div>` : `
        <h2 class="font-semibold text-gray-900 flex items-center gap-2 mb-1">
          ${icon('warning', `w-4 h-4 ${overdueCount ? 'text-red-500' : soonCount ? 'text-amber-500' : 'text-brand-400'}`)} Necesita atención
          <span class="badge ${overdueCount ? 'bg-red-100 text-red-600' : soonCount ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'} text-xs">${attention.length}</span>
        </h2>
        <div>
          ${shownAttention.map(a => `
            <div class="flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0">
              <span class="w-2 h-2 rounded-full flex-shrink-0 ${levelDot[a.level]}"></span>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-gray-900 leading-snug">${a.title}</div>
                ${a.sub ? `<div class="text-xs text-gray-500 mt-0.5">${a.sub}</div>` : ''}
              </div>
              <button onclick="${a.action}" class="btn-secondary text-xs !py-1.5 !px-3 flex-shrink-0">${a.actionLabel}</button>
            </div>`).join('')}
        </div>
        ${attention.length > ATTN_LIMIT ? `
        <button onclick="state.dashAttnAll=${!state.dashAttnAll};render()" class="w-full pt-3 mt-1 border-t border-gray-100 text-sm text-brand-600 hover:underline font-medium">
          ${state.dashAttnAll ? 'Ver menos' : `Ver los ${attention.length - ATTN_LIMIT} restantes`}
        </button>` : ''}`}
    </div>

    <!-- Franja de hoy -->
    <div class="grid grid-cols-3 gap-2 md:gap-4 bg-white rounded-2xl shadow-sm p-3 md:p-4 mb-6">
      <button onclick="navigate('pets')" class="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left p-1 rounded-xl hover:bg-gray-50 transition-colors">
        <span class="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">${icon('pill','w-4.5 h-4.5')}</span>
        <span class="min-w-0"><span class="block text-sm md:text-base font-bold text-gray-900 leading-tight">${todayMeds.length}</span><span class="block text-xs text-gray-500 leading-tight">Medicamentos hoy</span></span>
      </button>
      <button onclick="navigate('calendar')" class="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left p-1 rounded-xl hover:bg-gray-50 transition-colors">
        <span class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">${icon('calendar','w-4.5 h-4.5')}</span>
        <span class="min-w-0"><span class="block text-sm md:text-base font-bold text-gray-900 leading-tight">${upcoming.length}</span><span class="block text-xs text-gray-500 leading-tight">Eventos próximos</span></span>
      </button>
      <button onclick="navigate('finance')" class="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left p-1 rounded-xl hover:bg-gray-50 transition-colors">
        <span class="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">${icon('money','w-4.5 h-4.5')}</span>
        <span class="min-w-0"><span class="block text-sm md:text-base font-bold text-gray-900 leading-tight tabular-nums">${fmtCLP(monthSpend)}</span><span class="block text-xs text-gray-500 leading-tight">Gasto del mes</span></span>
      </button>
    </div>

    <div class="grid md:grid-cols-2 gap-4 md:gap-6">
      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-gray-900">Mis Mascotas</h2>
          <button onclick="navigate('pets')" class="text-sm text-brand-600 hover:underline font-medium">Ver todas →</button>
        </div>
        <div class="space-y-1">
          ${pets.slice(0, 4).map(p => `
            <div onclick="openPet('${p.id}')" class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
              ${petAvatar(p)}
              <div class="flex-1 min-w-0">
                <div class="font-medium text-gray-900 text-sm">${esc(p.name)}</div>
                <div class="text-xs text-gray-400">${p.species} · ${getAge(p.dateOfBirth)}</div>
              </div>
              ${petStatus(p.id)}
              <span class="text-gray-300 text-lg">›</span>
            </div>`).join('')}
          <button onclick="navigate('addPet')" class="w-full mt-1 py-2 text-sm text-brand-600 hover:bg-brand-50 rounded-xl transition-colors font-medium">+ Agregar mascota</button>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold text-gray-900">Próximos eventos</h2>
          <button onclick="navigate('calendar')" class="text-sm text-brand-600 hover:underline font-medium">Ver agenda →</button>
        </div>
        ${upcoming.length === 0
          ? `<div class="text-center py-8">
               <div class="mb-2 flex justify-center text-gray-300">${icon('calendar','w-10 h-10')}</div>
               <p class="text-sm text-gray-400 mb-3">Sin eventos próximos</p>
               <button onclick="navigate('calendar')" class="btn-secondary text-sm">Ver agenda</button>
             </div>`
          : upcoming.map(e => `
              <div class="flex items-start gap-3 p-3 rounded-xl border border-gray-100 mb-2">
                <div class="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">${icon(eventIcon(e.type),'w-5 h-5')}</div>
                <div>
                  <div class="text-sm font-medium text-gray-900">${esc(e.title)}</div>
                  <div class="text-xs text-gray-400">${formatDate(e.date)} · ${esc(e.pet || 'Sin mascota')}</div>
                </div>
              </div>`).join('')}
      </div>
    </div>

    ${extraCards.length ? `<div class="grid ${extraCards.length > 1 ? 'md:grid-cols-2' : ''} gap-4 mt-4">${extraCards.join('')}</div>` : ''}
  `);
}

if (typeof window !== 'undefined') {
  Object.assign(window, { viewDashboard });
}
