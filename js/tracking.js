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
          <div class="text-2xl font-bold text-gray-800">${esc(pet.weightKg)} kg${pet.weightGr ? ` ${esc(pet.weightGr)} gr` : ''}</div>
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
                   ${(s.symptoms||[]).map(sym => `<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium">${esc(sym)}</span>`).join('')}
                 </div>
                 ${s.notes ? `<p class="text-xs text-gray-600">${esc(s.notes)}</p>` : ''}
               </div>`).join('')}
           </div>`}
    </div>
  </div>`;
}

// Gráfico de torta en SVG (sin librerías). `segments`: [{label, value, color}].
const FOOD_COLORS = ['#4c5fd7', '#ff8a6b', '#9fadeb', '#303a88', '#ffc7b7', '#7686e2'];
function foodDonut(segments, centerTop, centerBottom) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  if (!(total > 0)) return '';
  let acc = 0;
  const arcs = segments.filter(s => s.value > 0).map(s => {
    const pct = s.value / total * 100;
    const arc = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${s.color}" stroke-width="6" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${(25 - acc).toFixed(2)}"></circle>`;
    acc += pct;
    return arc;
  }).join('');
  return `
    <svg viewBox="0 0 42 42" class="w-32 h-32 flex-shrink-0" role="img" aria-label="${esc(segments.map(s => `${s.label}: ${Math.round(s.value / total * 100)} %`).join(', '))}">
      <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f1f4ff" stroke-width="6"></circle>
      ${arcs}
      <text x="21" y="20.5" text-anchor="middle" font-size="6.2" font-weight="700" fill="#252a62">${esc(centerTop)}</text>
      <text x="21" y="26" text-anchor="middle" font-size="3.4" fill="#626a8a">${esc(centerBottom)}</text>
    </svg>`;
}

const fmtGrams = g => g >= 1000 ? `${(g / 1000).toLocaleString('es-CL', { maximumFractionDigits: 2 })} kg` : `${Math.round(g)} g`;

// Resumen de la alimentación calculado con las compras registradas: reparto por
// tipo, alimento diario vs snacks y gasto de los últimos 90 días. No depende de
// que el tutor anote lo que come cada día.
function foodSummarySection(items) {
  const sm = foodSummary(items);
  if (!sm.total && !sm.spent90) return '';
  const legend = rows => rows.map(r => `
    <div class="flex items-start gap-2 text-xs">
      <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 mt-0.5" style="background:${r.color}"></span>
      <div class="min-w-0">
        <div class="text-gray-700 leading-tight">${esc(r.label)}</div>
        <div class="text-gray-400 tabular-nums">${fmtGrams(r.value)} · ${r.pct} %</div>
      </div>
    </div>`).join('');
  const typeRows = sm.byType.map((t, i) => ({ label: t.label, value: t.grams, color: FOOD_COLORS[i % FOOD_COLORS.length], pct: Math.round(t.grams / sm.total * 100) }));
  const mixRows = [
    { label: 'Alimento diario', value: sm.daily, color: '#4c5fd7', pct: 100 - sm.snackPct },
    { label: 'Snacks y premios', value: sm.snack, color: '#ff8a6b', pct: sm.snackPct },
  ];
  const mixNote = sm.snack === 0
    ? `<p class="text-xs text-gray-500 mt-2">Aún no registras compras de snacks ni premios.</p>`
    : sm.snackPct > 10
      ? `<p class="text-xs mt-2 text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">Los snacks son el ${sm.snackPct} % de lo que has comprado. Como referencia, lo recomendado es que no pasen del 10 % de lo que come al día.</p>`
      : `<p class="text-xs mt-2 text-green-700 bg-green-50 rounded-lg px-2 py-1.5">Los snacks son el ${sm.snackPct} % de lo que has comprado, dentro de la referencia recomendada (hasta 10 %).</p>`;
  return `
    <div class="mt-4 pt-4 border-t border-gray-100">
      <h4 class="text-sm font-semibold text-gray-800 mb-3">Resumen de tus compras</h4>
      ${sm.total ? `
      <div class="grid md:grid-cols-2 gap-3">
        <div class="p-3 bg-gray-50 rounded-xl">
          <div class="text-xs font-semibold text-gray-600 mb-2">Por tipo de alimento</div>
          <div class="flex items-center gap-3">
            ${foodDonut(typeRows, fmtGrams(sm.total), 'comprado')}
            <div class="flex-1 min-w-0 space-y-1.5">${legend(typeRows)}</div>
          </div>
        </div>
        <div class="p-3 bg-gray-50 rounded-xl">
          <div class="text-xs font-semibold text-gray-600 mb-2">Alimento diario vs snacks</div>
          <div class="flex items-center gap-3">
            ${foodDonut(mixRows, `${sm.snackPct} %`, 'snacks')}
            <div class="flex-1 min-w-0 space-y-1.5">${legend(mixRows)}</div>
          </div>
          ${mixNote}
        </div>
      </div>
      <p class="text-[11px] text-gray-400 mt-2">Según el peso de las compras que has registrado${sm.since ? ` desde ${formatDate(sm.since)}` : ''}, no de lo que come cada día.${sm.skipped ? ` ${sm.skipped} compra${sm.skipped !== 1 ? 's' : ''} en unidades no se incluye${sm.skipped !== 1 ? 'n' : ''}.` : ''}</p>` : ''}
      ${sm.spent90 ? `
      <div class="mt-3 flex items-center justify-between gap-3 p-3 bg-brand-50 rounded-xl">
        <span class="text-xs text-gray-600">Gastado en alimento (últimos 90 días)</span>
        <span class="text-sm font-bold text-gray-900">${fmtCLP(sm.spent90)}</span>
      </div>` : ''}
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
               const history = foodPurchaseHistory(f);
               const per = history[0]?.per || null;
               const insight = foodPriceInsight(f);
               const insightColor = !insight || insight.pct === 0 ? 'text-gray-500' : insight.pct > 0 ? 'text-amber-600' : 'text-green-600';
               const statusColor = { critico: 'text-red-600 bg-red-50', bajo: 'text-amber-600 bg-amber-50', ok: 'text-teal-600 bg-teal-50' };
               return `
               <div class="p-3 bg-gray-50 rounded-xl">
                 <div class="flex items-start justify-between gap-3">
                   <div class="min-w-0">
                     <div class="text-sm font-semibold text-gray-800 truncate">${esc(f.product)}${foodCategory(f) === 'snack' ? ' <span class="badge text-[10px] bg-teal-50 text-teal-700 align-middle">Snack</span>' : ''}</div>
                     <div class="text-xs text-gray-400">${esc(f.type || '')} · ${f.packageSize||0} ${esc(f.packageUnit||'')}${Number(f.dailyAmount) > 0 ? ` · ${f.dailyAmount} ${esc(f.packageUnit||'')}/día` : ''}${f.price ? ` · ${fmtCLP(f.price)}` : ''}${per ? ` · ${fmtCLP(per.value)}/${per.unit}` : ''}${foodCostPerDay(f) ? ` · ≈${fmtCLP(foodCostPerDay(f))}/día` : ''}</div>
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
                   </div>` : `<p class="text-xs text-gray-400 mt-2">Indica cuánto le dura o su consumo diario y te avisamos cuándo se acaba</p>`}
                 ${insight ? `<p class="text-xs mt-2 ${insightColor}">${esc(insight.text)}</p>` : ''}
                 <div class="mt-2 flex flex-wrap gap-2">
                   ${canEdit ? `<button onclick="openFoodPurchaseModal('${safeId(pet.id)}','${safeId(f.id)}')" class="btn-secondary text-xs !py-1.5 !px-3">Ya repuse</button>` : ''}
                   <button onclick="openFoodOffer('${safeId(pet.id)}','${safeId(f.id)}','nutricion')" class="btn-secondary text-xs !py-1.5 !px-3">Buscar oferta</button>
                 </div>
                 ${history.length ? `
                 <details class="mt-2">
                   <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Historial de compras (${history.length})</summary>
                   <div class="mt-1 divide-y divide-gray-100">
                     ${history.slice(0, 8).map(h => `
                       <div class="flex items-center justify-between gap-2 py-1.5 text-xs">
                         <span class="text-gray-500">${formatDate(h.date)}</span>
                         <span class="text-gray-700 text-right">${fmtCLP(h.price)}${h.per ? ` · <span class="font-semibold">${fmtCLP(h.per.value)}/${h.per.unit}</span>` : ''}</span>
                         ${canEdit && h.id ? `<button onclick="deleteFoodPurchase('${safeId(pet.id)}','${safeId(f.id)}','${safeId(h.id)}')" class="text-gray-300 hover:text-red-500 flex-shrink-0" title="Eliminar compra">×</button>` : ''}
                       </div>`).join('')}
                   </div>
                 </details>` : ''}
               </div>`;
             }).join('')}
           </div>${foodSummarySection(foodItems)}`}
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
            <div title="${entry ? esc(entry.type) : 'Sin dato'}"
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
          borderColor: '#4c5fd7',
          backgroundColor: 'rgba(76,95,215,0.08)',
          tension: 0.4, fill: true,
          pointBackgroundColor: '#4c5fd7', pointRadius: 4,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: false, grid: { color: '#f1f4ff' } },
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
            <input id="wt-kg" type="number" required min="0" step="0.1" value="${esc(prevKg)}" placeholder="Ej: 12" class="input-field" />
          </div>
          <div>
            <label class="form-label">Gramos (0-999)</label>
            <input id="wt-gr" type="number" min="0" max="999" step="1" value="${esc(prevGr)}" placeholder="Ej: 500" class="input-field" />
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
        <input type="hidden" id="mood-val" value="${esc(existing?.mood||'')}" />
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
        <div><label class="form-label">¿Qué es?</label>
          <select id="fi-category" class="input-field">
            <option value="diario" ${foodCategory(item) === 'diario' ? 'selected' : ''}>Alimento diario</option>
            <option value="snack" ${foodCategory(item) === 'snack' ? 'selected' : ''}>Snack o premio</option>
          </select>
        </div>
        <div><label class="form-label">Tipo</label>
          <select id="fi-type" class="input-field">
            ${[...['Seco','Húmedo','BARF','Casero'], ...(item?.type && !['Seco','Húmedo','BARF','Casero'].includes(item.type) ? [item.type] : [])].map(t => `<option ${item?.type===t?'selected':''}>${esc(t)}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Tamaño del paquete *</label><input id="fi-size" type="number" required min="0" step="0.1" value="${esc(item?.packageSize||'')}" placeholder="Ej: 15" class="input-field" /></div>
          <div><label class="form-label">Unidad</label>
            <select id="fi-unit" class="input-field">
              <option value="kg" ${item?.packageUnit==='kg'?'selected':''}>kg</option>
              <option value="g" ${item?.packageUnit==='g'?'selected':''}>g</option>
              <option value="unidades" ${item?.packageUnit==='unidades'?'selected':''}>unidades</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">¿Cuánto le dura?</label>
            <select id="fi-duration" class="input-field" onchange="if(this.value)document.getElementById('fi-daily').value=''">
              <option value="">No sé</option>
              ${[7, 15, 30, 45, 60, 90].map(d => `<option value="${d}">${d} días</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">O consumo diario</label><input id="fi-daily" type="number" min="0" step="0.01" oninput="if(this.value)document.getElementById('fi-duration').value=''" value="${Number(item?.dailyAmount) > 0 ? esc(item.dailyAmount) : ''}" placeholder="Ej: 0.3" class="input-field" /></div>
        </div>
        <p class="text-xs text-gray-400 -mt-1">Indica cuánto le dura el paquete o su consumo diario y te avisamos cuándo se acaba. Es opcional. Si ingresas el consumo diario, usa la misma unidad que el paquete (ej: 15 kg y 0.3 kg diarios).</p>
        <div><label class="form-label">Precio (CLP)</label><input id="fi-price" type="text" inputmode="numeric" value="${esc(item?.price||'')}" placeholder="0" class="input-field" /></div>
        <div><label class="form-label">Fecha de compra</label><input id="fi-purchase" type="date" value="${esc(item?.purchaseDate||todayStr())}" class="input-field" /></div>
        <div><label class="form-label">Notas (opcional)</label><input id="fi-notes" value="${esc(item?.notes||'')}" class="input-field" /></div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

// Si la columna `category` aún no existe en Supabase (food_category.sql sin
// ejecutar), reintenta sin ella para que guardar un alimento no falle.
async function withCategoryFallback(run, payload) {
  const res = await run(payload);
  if (res.error && /category/i.test(res.error.message || '')) {
    console.warn('food_items.category no existe todavía; ejecuta supabase/schema/food_category.sql', res.error);
    const { category, ...rest } = payload;
    return run(rest);
  }
  return res;
}

export async function saveFoodItem(e, petId, itemId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const product = g('fi-product'), type = g('fi-type'), category = g('fi-category') === 'snack' ? 'snack' : 'diario';
  const packageSize = parseFloat(g('fi-size') || 0), packageUnit = g('fi-unit');
  let dailyAmount = parseFloat(g('fi-daily') || 0);
  const price = parseCLP(g('fi-price'));
  // "¿Cuánto le dura?" se guarda como consumo diario equivalente (tamaño ÷ días),
  // así el aviso de "cuándo se acaba" funciona igual sin una columna nueva.
  const durationDays = parseInt(g('fi-duration') || 0, 10);
  if (durationDays > 0 && packageSize > 0) dailyAmount = Math.round(packageSize / durationDays * 10000) / 10000;
  const purchaseDate = g('fi-purchase') || todayStr(), notes = g('fi-notes');
  pet.foodItems = pet.foodItems || [];
  if (isDemoUser()) {
    if (itemId) {
      const item = pet.foodItems.find(f => f.id === itemId);
      if (item) {
        const last = (item.purchases || []).find(pu => pu.date === item.purchaseDate);
        if (last && price > 0) Object.assign(last, { date: purchaseDate, price, packageSize, packageUnit });
        Object.assign(item, { product, type, category, packageSize, packageUnit, dailyAmount, price, purchaseDate, notes });
      }
    } else {
      pet.foodItems.push({ id: genId(), product, type, category, packageSize, packageUnit, dailyAmount, price, purchaseDate, notes,
        purchases: price > 0 ? [{ id: genId(), date: purchaseDate, price, packageSize, packageUnit }] : [] });
    }
  } else if (itemId) {
    const { error } = await withCategoryFallback(payload => sb.from('food_items').update(payload).eq('id', itemId), {
      product, type, category, package_size: packageSize, package_unit: packageUnit,
      daily_amount: dailyAmount, price, purchase_date: purchaseDate, notes
    });
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    const item = pet.foodItems.find(f => f.id === itemId);
    if (item) {
      // Editar precio/fecha corrige la compra más reciente en vez de dejarla desactualizada.
      const last = (item.purchases || []).find(pu => pu.date === item.purchaseDate);
      if (last && price > 0) {
        const { error: pErr } = await sb.from('food_purchases').update({
          purchase_date: purchaseDate, price, package_size: packageSize, package_unit: packageUnit }).eq('id', last.id);
        if (pErr) console.warn('No se pudo actualizar el historial de compras', pErr);
        else Object.assign(last, { date: purchaseDate, price, packageSize, packageUnit });
      }
      Object.assign(item, { product, type, category, packageSize, packageUnit, dailyAmount, price, purchaseDate, notes });
    }
  } else {
    const { data, error } = await withCategoryFallback(payload => sb.from('food_items').insert(payload).select().single(), {
      pet_id: petId, product, type, category, package_size: packageSize, package_unit: packageUnit,
      daily_amount: dailyAmount, price, purchase_date: purchaseDate, notes
    });
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    pet.foodItems.push({ id: data.id, product: data.product, type: data.type, category: data.category ?? category, packageSize: data.package_size,
      packageUnit: data.package_unit, dailyAmount: data.daily_amount, price: data.price,
      purchaseDate: data.purchase_date, notes: data.notes, purchases: [] });
    if (price > 0 && packageSize > 0) {
      const { data: pu, error: pErr } = await sb.from('food_purchases').insert({
        food_item_id: data.id, pet_id: petId, purchase_date: purchaseDate, price, package_size: packageSize, package_unit: packageUnit
      }).select().single();
      if (pErr) console.warn('No se pudo guardar el historial de compras', pErr);
      else pet.foodItems[pet.foodItems.length - 1].purchases.push({
        id: pu.id, date: pu.purchase_date, price: pu.price, packageSize: pu.package_size, packageUnit: pu.package_unit });
    }
  }
  closeModal(); render();
  showToast('Alimento guardado', 'success');
}

// "Ya repuse": guarda la compra en el historial y reinicia el conteo de stock
// (la fecha de compra del alimento pasa a ser esta).
export function openFoodPurchaseModal(petId, itemId) {
  const pet = state.pets.find(p => p.id === petId);
  const item = pet?.foodItems?.find(f => f.id === itemId);
  if (!item) return;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">${icon('food','w-5 h-5')} Ya repuse este alimento</h3>
      <p class="text-sm text-gray-500 mb-4">${esc(item.product)}</p>
      <form onsubmit="saveFoodPurchase(event,'${safeId(petId)}','${safeId(itemId)}')" class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Precio pagado (CLP) *</label><input id="fp-price" type="text" inputmode="numeric" required placeholder="0" class="input-field" /></div>
          <div><label class="form-label">Fecha de compra</label><input id="fp-date" type="date" value="${todayStr()}" class="input-field" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Tamaño del paquete *</label><input id="fp-size" type="number" required min="0" step="0.1" value="${esc(item.packageSize||'')}" class="input-field" /></div>
          <div><label class="form-label">Unidad</label>
            <select id="fp-unit" class="input-field">
              ${['kg','g','unidades'].map(u => `<option value="${u}" ${item.packageUnit===u?'selected':''}>${u}</option>`).join('')}
            </select>
          </div>
        </div>
        <p class="text-xs text-gray-400">Al guardar, el conteo de stock parte de esta fecha.</p>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

export async function saveFoodPurchase(e, petId, itemId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  const item = pet?.foodItems?.find(f => f.id === itemId);
  if (!item) return;
  if (blockIfReadOnly(pet)) return;
  const g = id => document.getElementById(id)?.value;
  const price = parseCLP(g('fp-price')), packageSize = parseFloat(g('fp-size') || 0);
  const packageUnit = g('fp-unit') || item.packageUnit, purchaseDate = g('fp-date') || todayStr();
  if (!(price > 0) || !(packageSize > 0)) { showToast('Ingresa el precio y el tamaño del paquete', 'error'); return; }
  item.purchases = item.purchases || [];
  let purchaseId = genId();
  if (!isDemoUser()) {
    const { error } = await sb.from('food_items').update({
      price, purchase_date: purchaseDate, package_size: packageSize, package_unit: packageUnit }).eq('id', itemId);
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    const { data: pu, error: pErr } = await sb.from('food_purchases').insert({
      food_item_id: itemId, pet_id: petId, purchase_date: purchaseDate, price, package_size: packageSize, package_unit: packageUnit
    }).select().single();
    if (pErr) {
      console.warn('No se pudo guardar el historial de compras', pErr);
      purchaseId = null;
      showToast('Compra guardada, pero el historial de precios aún no está disponible', 'error');
    } else purchaseId = pu.id;
  }
  if (purchaseId) item.purchases.push({ id: purchaseId, date: purchaseDate, price, packageSize, packageUnit });
  Object.assign(item, { price, purchaseDate, packageSize, packageUnit });
  track('food_purchase_logged');
  closeModal(); render();
  showToast('Compra registrada', 'success');
}

export async function deleteFoodPurchase(petId, itemId, purchaseId) {
  const pet = state.pets.find(p => p.id === petId);
  const item = pet?.foodItems?.find(f => f.id === itemId);
  if (!item || blockIfReadOnly(pet)) return;
  if (!isDemoUser()) {
    const { error } = await sb.from('food_purchases').delete().eq('id', purchaseId);
    if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  }
  item.purchases = (item.purchases || []).filter(pu => pu.id !== purchaseId);
  render();
}

// "Buscar oferta": deja elegir dónde buscar. Google Shopping muestra más
// diversidad (incluye tiendas de la propia marca); Knasta compara las grandes
// tiendas. `source` distingue desde dónde se hizo clic, para medir interés.
export function openFoodOffer(petId, itemId, source) {
  const item = state.pets.find(p => p.id === petId)?.foodItems?.find(f => f.id === itemId);
  if (!item) return;
  track('food_offer_click', { source: source || 'nutricion' });
  const btn = (store, title, desc) => `
    <button type="button" onclick="goFoodOffer('${safeId(petId)}','${safeId(itemId)}','${store}')" class="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors">
      <div class="text-sm font-semibold text-gray-800">${title}</div>
      <div class="text-xs text-gray-500 mt-0.5">${desc}</div>
    </button>`;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-1">Buscar oferta</h3>
      <p class="text-sm text-gray-500 mb-4">${esc(item.product)}</p>
      <div class="space-y-2">
        ${btn('google', 'Google Shopping', 'Más variedad de tiendas, incluida la de la propia marca. Mejor para marcas pequeñas.')}
        ${btn('knasta', 'Knasta', 'Compara las grandes tiendas y muestra el historial de precios. Mejor para marcas conocidas.')}
      </div>
      <button type="button" onclick="closeModal()" class="btn-secondary w-full mt-4">Cerrar</button>
    </div>`);
}

export function goFoodOffer(petId, itemId, store) {
  const item = state.pets.find(p => p.id === petId)?.foodItems?.find(f => f.id === itemId);
  if (!item) return;
  track('food_offer_store', { store });
  window.open(foodOfferUrl(item, store === 'knasta' ? 'knasta' : 'google'), '_blank', 'noopener');
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
    deleteFoodItem, openFoodPurchaseModal, saveFoodPurchase, deleteFoodPurchase, openFoodOffer, goFoodOffer, logActivity,
  });
}
