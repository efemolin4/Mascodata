/* ============================================================
   MASCODATA — Seguimiento y Nutrición
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Pestaña de Seguimiento (peso,
   ánimo, síntomas) y Nutrición (stock de alimento, check-in de
   actividad con racha). */

// Peso en kg de una medición (kg + gramos).
const weightKgOf = h => parseFloat(h.kg || 0) + (parseInt(h.gr || 0, 10) / 1000);
const fmtKg = n => `${n.toLocaleString('es-CL', { maximumFractionDigits: 3 })} kg`;

// Serie para el gráfico: el peso de la ficha (que se guarda aparte del historial, sin
// fecha) va primero como punto "Ficha", seguido de las mediciones registradas. Sin
// mediciones no hay serie: en ese caso la pestaña muestra solo el peso de la ficha.
export function weightSeries(pet) {
  const history = [...(pet.weightHistory || [])].sort((a, b) => (a.date > b.date ? 1 : -1));
  if (!history.length) return [];
  const rows = history.map(h => ({ id: h.id, label: formatDate(h.date), kg: weightKgOf(h), real: true }));
  const ficha = parseFloat(pet.weightKg || 0) + (parseInt(pet.weightGr || 0, 10) / 1000);
  if (ficha > 0) rows.unshift({ id: null, label: 'Ficha', kg: ficha, real: false });
  return rows;
}

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
        ${weightSummary(pet)}
        <canvas id="weight-chart-${pet.id}" height="180"></canvas>
        <div class="mt-2 text-xs text-gray-400 text-center">${history.length} medición${history.length !== 1 ? 'es' : ''}${pet.weightKg ? ' · el primer punto es el peso de la ficha' : ''}</div>
        ${weightList(pet, canEdit)}
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

// Lo gastado este mes en alimento (compras registradas; un alimento sin historial
// cuenta su propia fila).
function foodMonthSpend(items) {
  const month = todayStr().slice(0, 7);
  return items.reduce((sum, f) => {
    const buys = f.purchases?.length ? f.purchases : (f.purchaseDate ? [{ date: f.purchaseDate, price: f.price }] : []);
    return sum + buys.filter(b => (b.date || '').startsWith(month)).reduce((a, b) => a + (Number(b.price) || 0), 0);
  }, 0);
}

// Mini línea del precio por kilo entre compras (SVG sin librerías). El punto
// resaltado es la compra más reciente; el aro, el mejor precio pagado.
function foodSparkline(series) {
  if (series.length < 2) return '';
  const W = 64, H = 22, pad = 3;
  const vals = series.map(r => r.value), min = Math.min(...vals), max = Math.max(...vals);
  const x = i => pad + i * (W - pad * 2) / (series.length - 1);
  const y = v => max === min ? H / 2 : H - pad - (v - min) * (H - pad * 2) / (max - min);
  const pts = series.map((r, i) => `${x(i).toFixed(1)},${y(r.value).toFixed(1)}`).join(' ');
  const last = series[series.length - 1], lastI = series.length - 1;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="flex-shrink-0" role="img" aria-label="Precio por ${series[0].unit} en cada compra">
    <polyline points="${pts}" fill="none" stroke="#9fadeb" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"></polyline>
    ${series.map((r, i) => r.best && i !== lastI ? `<circle cx="${x(i).toFixed(1)}" cy="${y(r.value).toFixed(1)}" r="2.4" fill="#fff" stroke="#237b58" stroke-width="1.4"></circle>` : '').join('')}
    <circle cx="${x(lastI).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="2.6" fill="#4c5fd7"></circle>
  </svg>`;
}

// Tres indicadores por alimento, calculados con las compras registradas:
// cuándo se acaba, precio por kilo con su tendencia y cada cuánto repone.
function foodIndicators(pet, f, canEdit) {
  const status = foodStockStatus(f);
  const insight = foodPriceInsight(f);
  const series = foodPriceSeries(f);
  const cadence = foodCadence(f);
  const statusColor = { critico: 'text-red-600', bajo: 'text-amber-600', ok: 'text-gray-900' };
  const tile = (label, value, sub) => `
    <div class="bg-white rounded-xl p-2.5 min-w-0">
      <div class="text-[10px] font-semibold tracking-wide uppercase text-gray-400">${label}</div>
      ${value}${sub}
    </div>`;
  const stockTile = status
    ? tile('Se acaba', `<div class="text-base font-bold leading-tight mt-0.5 ${statusColor[status.level]}">${status.daysLeft < 0 ? 'Ya debería' : status.daysLeft === 0 ? 'Hoy' : `~${status.daysLeft} día${status.daysLeft !== 1 ? 's' : ''}`}</div>`, `<div class="text-[11px] text-gray-500 mt-0.5">${status.daysLeft < 0 ? 'Estimado el ' : ''}${formatDate(status.runOutDate)}</div>`)
    : tile('Se acaba', `<div class="text-base font-bold leading-tight mt-0.5 text-gray-300">—</div>`, `<div class="text-[11px] text-gray-500 mt-0.5">Indica cuánto le dura para estimarlo</div>`);
  const cur = series[series.length - 1];
  const trend = insight
    ? `<span class="${insight.pct > 0 ? 'text-amber-600' : insight.pct < 0 ? 'text-green-600' : 'text-gray-500'}">${insight.pct > 0 ? '▲' : insight.pct < 0 ? '▼' : '='} ${Math.abs(insight.pct)} % vs compra anterior</span>`
    : '<span>1 compra registrada</span>';
  const best = series.length > 1 ? series.find(r => r.best) : null;
  const priceTile = cur
    ? tile('Precio por ' + cur.unit, `<div class="flex items-center justify-between gap-2"><div class="text-base font-bold leading-tight mt-0.5 text-gray-900 tabular-nums">${fmtCLP(cur.value)}</div>${foodSparkline(series)}</div>`, `<div class="text-[11px] text-gray-500 mt-0.5">${trend}${best && best !== cur && !series[series.length - 1].best ? ` · mejor: ${fmtCLP(best.value)}` : ''}</div>`)
    : tile('Precio por kg', `<div class="text-base font-bold leading-tight mt-0.5 text-gray-300">—</div>`, `<div class="text-[11px] text-gray-500 mt-0.5">Ingresa el precio para calcularlo</div>`);
  const cadenceTile = cadence
    ? tile('Repones cada', `<div class="text-base font-bold leading-tight mt-0.5 text-gray-900">~${cadence.days} días</div>`,
        `<div class="text-[11px] text-gray-500 mt-0.5">${cadence.estimated ? `Estimabas ${cadence.estimated}` : `Según ${cadence.intervals + 1} compras`}${cadence.suggest && canEdit ? ` · <button onclick="adjustFoodDuration('${safeId(pet.id)}','${safeId(f.id)}',${cadence.suggest})" class="text-brand-600 font-semibold hover:underline">Ajustar</button>` : ''}</div>`)
    : tile('Repones cada', `<div class="text-base font-bold leading-tight mt-0.5 text-gray-300">—</div>`, `<div class="text-[11px] text-gray-500 mt-0.5">Con 2 compras lo calculamos</div>`);
  return `<div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">${stockTile}${priceTile}${cadenceTile}</div>`;
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
      ${foodMonthSpend(foodItems) > 0 ? `<p class="text-xs text-gray-500 -mt-1 mb-3">Este mes llevas ${fmtCLP(foodMonthSpend(foodItems))} en alimento · <button onclick="navigate('finance')" class="text-brand-600 font-semibold hover:underline">Ver en Finanzas</button></p>` : ''}
      ${foodItems.length === 0
        ? `<div class="text-center py-6"><div class="mb-2 flex justify-center text-gray-300">${icon('food','w-10 h-10')}</div><p class="text-sm text-gray-400">Sin alimentos registrados</p></div>`
        : `<div class="space-y-3">
             ${foodItems.map(f => {
               const history = foodPurchaseHistory(f);
               const per = history[0]?.per || null;
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
                 ${foodIndicators(pet, f, canEdit)}
                 <div class="mt-2 flex flex-wrap gap-2">
                   ${canEdit ? `<button onclick="openFoodPurchaseModal('${safeId(pet.id)}','${safeId(f.id)}')" class="btn-secondary text-xs !py-1.5 !px-3">Compré de nuevo</button>` : ''}
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

// Resumen sobre el gráfico: último peso y cambio frente a la medición anterior.
function weightSummary(pet) {
  const rows = weightSeries(pet);
  if (rows.length < 2) return '';
  const cur = rows[rows.length - 1], prev = rows[rows.length - 2];
  const diff = Math.round((cur.kg - prev.kg) * 1000) / 1000;
  const tone = diff === 0 ? 'text-gray-500' : 'text-gray-700';
  return `<div class="flex items-baseline gap-2 mb-3">
    <span class="text-2xl font-bold text-gray-900 tabular-nums">${fmtKg(cur.kg)}</span>
    <span class="text-sm ${tone}">${diff === 0 ? 'sin cambio' : `${diff > 0 ? '▲ +' : '▼ '}${fmtKg(Math.abs(diff)).replace(/^/, diff > 0 ? '' : '−')} vs ${prev.real ? 'la medición anterior' : 'el peso de la ficha'}`}</span>
  </div>`;
}

// Lista de mediciones (la más reciente primero), con opción de eliminar.
function weightList(pet, canEdit) {
  const real = weightSeries(pet).filter(r => r.real);
  if (!real.length) return '';
  const all = weightSeries(pet);
  return `<details class="mt-3">
    <summary class="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Ver y eliminar mediciones</summary>
    <div class="mt-1 divide-y divide-gray-100">
      ${[...real].reverse().map(r => {
        const i = all.indexOf(r), prev = all[i - 1];
        const d = prev ? Math.round((r.kg - prev.kg) * 1000) / 1000 : null;
        return `<div class="flex items-center justify-between gap-2 py-1.5 text-xs">
          <span class="text-gray-500">${esc(r.label)}</span>
          <span class="text-gray-700 tabular-nums">${fmtKg(r.kg)}${d ? ` <span class="text-gray-400">(${d > 0 ? '+' : '−'}${fmtKg(Math.abs(d))})</span>` : ''}</span>
          ${canEdit ? `<button onclick="deleteWeight('${safeId(pet.id)}','${safeId(r.id)}')" class="text-gray-300 hover:text-red-500 flex-shrink-0" title="Eliminar medición">×</button>` : '<span></span>'}
        </div>`;
      }).join('')}
    </div>
  </details>`;
}

export async function deleteWeight(petId, weightId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet || blockIfReadOnly(pet)) return;
  if (!isDemoUser()) {
    const { error } = await sb.from('weight_history').delete().eq('id', weightId);
    if (error) { showToast('Error al eliminar la medición', 'error'); console.error(error); return; }
  }
  pet.weightHistory = (pet.weightHistory || []).filter(h => h.id !== weightId);
  render();
  showToast('Medición eliminada', 'success');
}

export function renderWeightChart(pet) {
  setTimeout(() => {
    const canvas = document.getElementById(`weight-chart-${pet.id}`);
    if (!canvas) return;
    if (window._weightCharts && window._weightCharts[pet.id]) {
      window._weightCharts[pet.id].destroy();
    }
    if (!window._weightCharts) window._weightCharts = {};
    const history = weightSeries(pet).slice(-13);
    if (history.length === 0) return;
    window._weightCharts[pet.id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: history.map(h => h.label),
        datasets: [{
          label: 'Peso (kg)',
          data: history.map(h => h.kg),
          borderColor: '#4c5fd7',
          backgroundColor: 'rgba(76,95,215,0.08)',
          tension: 0.2, fill: true,
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
        <div><label class="form-label">Precio pagado (CLP)</label><input id="fi-price" type="text" inputmode="numeric" value="${esc(item?.price||'')}" placeholder="0" class="input-field" /></div>
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

// "Compré de nuevo": guarda la compra en el historial y reinicia el conteo de stock
// (la fecha de compra del alimento pasa a ser esta).
export function openFoodPurchaseModal(petId, itemId) {
  const pet = state.pets.find(p => p.id === petId);
  const item = pet?.foodItems?.find(f => f.id === itemId);
  if (!item) return;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">${icon('food','w-5 h-5')} Nueva compra</h3>
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

// Ajusta la duración del paquete a lo que el tutor realmente demora en reponer
// (se guarda como consumo diario equivalente, igual que "¿Cuánto le dura?").
export async function adjustFoodDuration(petId, itemId, days) {
  const pet = state.pets.find(p => p.id === petId);
  const item = pet?.foodItems?.find(f => f.id === itemId);
  const n = parseInt(days, 10);
  if (!item || !(n > 0) || !(Number(item.packageSize) > 0)) return;
  if (blockIfReadOnly(pet)) return;
  const dailyAmount = Math.round(Number(item.packageSize) / n * 10000) / 10000;
  if (!isDemoUser()) {
    const { error } = await sb.from('food_items').update({ daily_amount: dailyAmount }).eq('id', itemId);
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
  }
  item.dailyAmount = dailyAmount;
  track('food_duration_adjusted');
  render();
  showToast(`Listo: ahora estimamos que te dura ~${n} días`, 'success');
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
    saveWeight, deleteWeight, weightSeries, openMoodModal, selectMood, saveMood, openSymptomsModal,
    toggleSymptomTag, saveSymptoms, openFoodItemModal, saveFoodItem,
    deleteFoodItem, openFoodPurchaseModal, saveFoodPurchase, deleteFoodPurchase, adjustFoodDuration, openFoodOffer, goFoodOffer, logActivity,
  });
}
