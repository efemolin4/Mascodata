/* ============================================================
   MASCODATA — Finanzas
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vista de finanzas y registro
   manual de gastos. */

// Bloque de alimentación: lo monetario (cuánto se gasta y qué parte del total es).
// Lo operativo (cuándo se acaba, precio por kilo, cada cuánto repone) está en la
// pestaña Nutrición de cada mascota. Se calcula con las compras registradas, que
// ya cuentan como gastos de categoría "Alimentación".
function foodFinanceCard(expenses, petFilter, thisMonth, monthTotal) {
  const food = expenses.filter(e => e.category === 'Alimentación');
  if (!food.length) return '';
  const sum = list => list.reduce((a, e) => a + Number(e.amount || 0), 0);
  const [y, m] = thisMonth.split('-').map(Number);
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`;
  const foodMonth = sum(food.filter(e => e.date?.startsWith(thisMonth)));
  const foodPrev = sum(food.filter(e => e.date?.startsWith(prev)));
  const delta = foodPrev > 0 ? Math.round((foodMonth - foodPrev) / foodPrev * 100) : null;
  const share = monthTotal > 0 ? Math.round(foodMonth / monthTotal * 100) : null;
  // Costo por día: solo de los alimentos diarios que tienen duración o consumo indicado.
  const inScope = state.pets.filter(p => !petFilter || p.name === petFilter);
  const perDay = inScope.reduce((a, p) => a + (p.foodItems || []).filter(f => foodCategory(f) === 'diario').reduce((b, f) => b + (foodCostPerDay(f) || 0), 0), 0);
  const tile = (label, value, sub) => `
    <div class="bg-gray-50 rounded-xl p-3 min-w-0">
      <div class="text-[10px] font-semibold tracking-wide uppercase text-gray-400">${label}</div>
      <div class="text-lg font-bold text-gray-900 tabular-nums leading-tight mt-0.5">${value}</div>
      <div class="text-[11px] text-gray-500 mt-0.5">${sub}</div>
    </div>`;
  const deltaTxt = delta == null ? 'Sin compras el mes pasado' : `<span class="${delta > 0 ? 'text-amber-600' : delta < 0 ? 'text-green-600' : ''}">${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta)} %</span> vs mes anterior`;
  return `
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5 mb-6">
      <h3 class="font-semibold text-gray-800 flex items-center gap-1.5 mb-3">${icon('food','w-4 h-4')} Alimentación${petFilter ? ` · ${esc(petFilter)}` : ''}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        ${tile('Este mes', fmtCLP(foodMonth), deltaTxt)}
        ${tile('Del gasto del mes', share == null ? '—' : `${share} %`, 'Lo que es alimento del total')}
        ${tile('Costo por día', perDay > 0 ? `≈ ${fmtCLP(perDay)}` : '—', perDay > 0 ? 'Según lo que dura cada paquete' : 'Indica cuánto le dura el alimento')}
      </div>
    </div>`;
}

export function viewFinance() {
  if (state.pets.length === 0) {
    return noPetsOnboarding('money', 'Aún no hay gastos que mostrar', 'Registra una mascota primero para empezar a llevar el control de sus gastos veterinarios, alimentación y más.');
  }
  const allExpenses = getFinanceExpenses();
  const pets = state.pets;
  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;

  // Filtros activos
  const petFilter  = state.finPet    || '';
  const period     = state.finPeriod || 'mensual';
  const viewMode   = state.finView   || 'listado';

  // Gastos filtrados por mascota
  const expenses = petFilter ? allExpenses.filter(e => e.pet === petFilter) : allExpenses;

  const total      = expenses.reduce((s,e) => s + Number(e.amount||0), 0);
  const monthTotal = expenses.filter(e => e.date?.startsWith(thisMonth)).reduce((s,e) => s + Number(e.amount||0), 0);
  const catColors  = { Veterinaria:'#4c5fd7', Medicamentos:'#ff8a6b', Alimentación:'#8f9cff', Peluquería:'#252a62', Hotel:'#3856b8', Otro:'#9299ba' };

  // Construir períodos para el gráfico
  function buildPeriods() {
    if (period === 'mensual') {
      const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      return Array.from({length:6}, (_,i) => {
        const d = new Date(today.getFullYear(), today.getMonth()-5+i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        // Solo el mes ("abr", "may"…) — el año se agrega únicamente cuando la
        // ventana cruza a otro año, para no repetirlo en las 6 barras.
        const yy = d.getFullYear() !== today.getFullYear() ? ` ’${String(d.getFullYear()).slice(2)}` : '';
        return { label: MESES[d.getMonth()] + yy, full: d.toLocaleDateString('es-CL',{month:'long'}), key, match: e => e.date?.startsWith(key) };
      });
    }
    if (period === 'trimestral') {
      return Array.from({length:4}, (_,i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - (3-i)*3, 1);
        const q = Math.floor(d.getMonth()/3)+1;
        // d.getMonth() es el mes de HOY desplazado, no necesariamente el
        // primer mes del trimestre (0/3/6/9) — sin este ajuste, los meses
        // del trimestre se contaban desde d.getMonth()+1 en vez de desde
        // el inicio real del trimestre: para 8 de los 12 meses del año
        // generaba claves fuera de rango (ej. "13"/"14") que nunca
        // calzaban con ninguna fecha real, mostrando $0 en esa barra; y
        // el trimestre "actual" quedaba mal etiquetado incluso cuando no
        // desbordaba (ej. hoy en septiembre mostraba Sep/Oct/Nov en vez
        // del Q3 real Jul/Ago/Sep). Ver el mismo patrón ya usado abajo en
        // "semestral" con baseMonth.
        const baseMonth = (q-1)*3;
        const months = [0,1,2].map(m => `${d.getFullYear()}-${String(baseMonth+m+1).padStart(2,'0')}`);
        return { label: `Q${q} ${d.getFullYear()}`, full: `Q${q} ${d.getFullYear()}`, match: e => months.some(m => e.date?.startsWith(m)) };
      });
    }
    if (period === 'semestral') {
      return Array.from({length:4}, (_,i) => {
        const offset = (3-i)*6;
        const d = new Date(today.getFullYear(), today.getMonth()-offset, 1);
        const sem = d.getMonth() < 6 ? 1 : 2;
        const baseMonth = sem === 1 ? 0 : 6;
        const months = Array.from({length:6}, (_,m) => `${d.getFullYear()}-${String(baseMonth+m+1).padStart(2,'0')}`);
        return { label: `S${sem} ${d.getFullYear()}`, full: `S${sem} ${d.getFullYear()}`, match: e => months.some(m => e.date?.startsWith(m)) };
      });
    }
    if (period === 'anual') {
      return Array.from({length:4}, (_,i) => {
        const y = today.getFullYear() - (3-i);
        return { label: `${y}`, full: `${y}`, match: e => e.date?.startsWith(`${y}`) };
      });
    }
    return [];
  }

  const periods = buildPeriods();

  // Vista Gráfico (Premium): barras HTML en vez de Chart.js — el valor va
  // escrito sobre cada barra y el período actual se resalta, así no hay que
  // leer un eje de $ ni pasar el mouse para saber cuánto fue cada período.
  const totals = periods.map(p => expenses.filter(p.match).reduce((s,e) => s + Number(e.amount||0), 0));
  const windowExpenses = expenses.filter(e => periods.some(p => p.match(e)));
  const windowTotal = totals.reduce((a,b) => a + b, 0);
  const maxTotal = Math.max(0, ...totals);
  const curTotal = totals[totals.length-1] ?? 0;
  const prevPeriod = periods[periods.length-2];
  const prevTotal = totals[totals.length-2] ?? 0;
  const windowLabel = {mensual:'últimos 6 meses',trimestral:'últimos 4 trimestres',semestral:'últimos 4 semestres',anual:'últimos 4 años'}[period];
  const currentWord = {mensual:'este mes',trimestral:'este trimestre',semestral:'este semestre',anual:'este año'}[period];
  // Subir el gasto es "malo" (rojo) y bajarlo "bueno" (verde) — al revés de
  // un ingreso.
  const deltaPill = (() => {
    if (!prevPeriod || (!curTotal && !prevTotal)) return '';
    if (!prevTotal) return `<span class="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">Sin gasto en ${prevPeriod.full}</span>`;
    const pct = Math.round((curTotal - prevTotal) / prevTotal * 100);
    if (pct === 0) return `<span class="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">→ Igual que ${prevPeriod.full}</span>`;
    return pct > 0
      ? `<span class="text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 text-red-600">↑ ${pct}% vs. ${prevPeriod.full}</span>`
      : `<span class="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-50 text-green-700">↓ ${Math.abs(pct)}% vs. ${prevPeriod.full}</span>`;
  })();
  const catTotals = {};
  windowExpenses.forEach(e => { const c = e.category || 'Otro'; catTotals[c] = (catTotals[c] || 0) + Number(e.amount||0); });
  const catRows = Object.entries(catTotals).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]);

  return appShell(`
    ${pageHeader('Finanzas', 'Control de gastos por mascota',
      `<button onclick="openExpenseModal()" class="btn-primary flex items-center gap-1.5">
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
         <span>Registrar gasto</span>
       </button>`)}

    <!-- Filtros -->
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-6 space-y-3">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Selector mascota -->
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Mascota</span>
          <select onchange="state.finPet=this.value;render()" class="input-field text-sm py-1.5" style="width:auto;min-width:130px">
            <option value="">Todas</option>
            ${pets.map(p=>`<option ${petFilter===p.name?'selected':''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <!-- Vista toggle -->
        <div class="flex rounded-xl overflow-hidden border border-gray-200 text-sm font-medium ml-auto">
          ${['listado','grafico'].map(m=>`
            <button onclick="state.finView='${m}';render()"
              class="px-3 py-1.5 transition-colors ${viewMode===m?'bg-brand-600 text-white':'text-gray-500 hover:bg-gray-50'}">
              ${m==='listado'?icon('menu','w-3.5 h-3.5 inline align-text-bottom')+' Lista':icon('chartBar','w-3.5 h-3.5 inline align-text-bottom')+' Gráfico'}
            </button>`).join('')}
        </div>
      </div>
      <!-- Período (segunda fila en móvil, inline en desktop) -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">Período</span>
        <div class="flex rounded-xl overflow-hidden border border-gray-200 text-xs md:text-sm font-medium">
          ${['mensual','trimestral','semestral','anual'].map(p=>`
            <button onclick="state.finPeriod='${p}';render()"
              class="px-2.5 md:px-3 py-1.5 transition-colors ${period===p?'bg-brand-600 text-white':'text-gray-500 hover:bg-gray-50'}">
              <span class="md:hidden">${{mensual:'Mensual',trimestral:'Trimest.',semestral:'Semest.',anual:'Anual'}[p]}</span>
              <span class="hidden md:inline">${{mensual:'Mensual',trimestral:'Trimestral',semestral:'Semestral',anual:'Anual'}[p]}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>

    <!-- Widgets -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
      ${statCard(icon('money','w-5 h-5 md:w-6 md:h-6'),'Total '+(petFilter||'todas'), fmtCLP(total), 'brand')}
      ${statCard(icon('calendar','w-5 h-5 md:w-6 md:h-6'),'Este mes', fmtCLP(monthTotal), 'teal')}
      ${statCard(icon('receipt','w-5 h-5 md:w-6 md:h-6'),'Registros', expenses.length, 'amber')}
      ${statCard(icon('paw','w-5 h-5 md:w-6 md:h-6'),'Mascotas', pets.length, 'brand')}
    </div>

    ${foodFinanceCard(expenses, petFilter, thisMonth, monthTotal)}

    ${viewMode === 'grafico' ? `
    <!-- DASHBOARD: el desglose por categoría es libre; el gráfico por período y la predicción son Premium -->
    <div id="finance-dashboard" class="grid lg:grid-cols-5 gap-4 md:gap-6 mb-6">
      ${!isPremium() ? `<div class="lg:col-span-3">${premiumUpsellCard('chartBar', 'Gráficos y predicción de gastos', 'Compara tus gastos período a período, ve cuánto subieron o bajaron y proyecta el próximo mes. Disponible en el plan Premium.')}</div>` : `
      <div id="finance-period-chart" class="lg:col-span-3 bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <div class="text-[11px] font-semibold tracking-wider uppercase text-gray-400">Total · ${windowLabel}</div>
        <div class="text-xs text-gray-400 mt-0.5">${petFilter ? esc(petFilter) : 'Todas las mascotas'}</div>
        <div class="flex flex-wrap items-end justify-between gap-3 mt-3">
          <div>
            <div class="text-3xl md:text-4xl font-bold text-gray-900 tabular-nums leading-none">${fmtCLP(windowTotal)}</div>
            <div class="text-sm text-gray-500 mt-2">${windowExpenses.length} registro${windowExpenses.length!==1?'s':''} · ${fmtCLP(curTotal)} ${currentWord}</div>
          </div>
          ${deltaPill}
        </div>
        ${windowExpenses.length === 0
          ? `<div class="h-44 md:h-56 mt-6 flex items-center justify-center text-sm text-gray-400">Sin gastos en este período</div>`
          : `<div class="mt-6">
               <div class="flex items-end gap-2 md:gap-3 h-44 md:h-56 border-b border-gray-100">
                 ${periods.map((p, i) => {
                   const v = totals[i];
                   const isCur = i === periods.length - 1;
                   const h = maxTotal > 0 ? (v / maxTotal) * 80 : 0;
                   return `<div class="flex-1 min-w-0 h-full flex flex-col items-center justify-end" title="${esc(p.full)}: ${fmtCLP(v)}">
                     <span class="text-[11px] md:text-xs font-semibold tabular-nums mb-1.5 ${isCur ? 'text-gray-900' : 'text-gray-500'}">${fmtCompactCLP(v)}</span>
                     <div class="w-full max-w-[72px] rounded-t-xl rounded-b-sm ${isCur ? 'bg-brand-600' : 'bg-brand-200'}" style="height:${h}%;min-height:4px"></div>
                   </div>`;
                 }).join('')}
               </div>
               <div class="flex gap-2 md:gap-3 mt-2">
                 ${periods.map((p, i) => `<span class="flex-1 min-w-0 text-center text-xs truncate ${i === periods.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500'}">${esc(p.label)}</span>`).join('')}
               </div>
             </div>`}
      </div>`}
      <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm p-5 md:p-6">
        <h3 class="font-semibold text-gray-900 mb-1">Por categoría</h3>
        <p class="text-xs text-gray-400 mb-5">${windowLabel.charAt(0).toUpperCase() + windowLabel.slice(1)}</p>
        ${catRows.length === 0 ? '<p class="text-sm text-gray-400 text-center py-6">Sin datos</p>' : catRows.map(([cat, v]) => {
          const pct = Math.round(v / windowTotal * 100);
          const color = catColors[cat] || catColors.Otro;
          return `<div class="mb-4 last:mb-0">
            <div class="flex items-baseline justify-between gap-2 mb-1.5">
              <span class="flex items-center gap-2 text-sm text-gray-700 min-w-0"><span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></span><span>${esc(cat)}</span></span>
              <span class="text-sm font-semibold text-gray-900 tabular-nums whitespace-nowrap">${fmtCLP(v)} <span class="text-xs font-normal text-gray-500">${pct}%</span></span>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-2"><div class="h-2 rounded-full" style="width:${Math.max(pct, 2)}%;background:${color}"></div></div>
          </div>`;
        }).join('')}
        ${pets.length > 1 && !petFilter && windowTotal > 0 ? `
        <div class="mt-5 pt-4 border-t border-gray-100">
          <div class="text-xs font-semibold text-gray-500 mb-3">Por mascota</div>
          ${pets.map(p => {
            const pt = windowExpenses.filter(e => e.pet === p.name).reduce((s,e) => s + Number(e.amount||0), 0);
            if (!pt) return '';
            const pct = Math.round(pt / windowTotal * 100);
            return `<div class="mb-3 last:mb-0">
              <div class="flex justify-between text-sm mb-1.5">
                <span class="text-gray-700">${speciesEmoji(p.species)} ${esc(p.name)}</span>
                <span class="font-semibold text-gray-900 tabular-nums">${fmtCLP(pt)} <span class="text-xs font-normal text-gray-500">${pct}%</span></span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-1.5"><div class="h-1.5 rounded-full bg-brand-400" style="width:${Math.max(pct, 2)}%"></div></div>
            </div>`;
          }).join('')}
        </div>` : ''}
      </div>
    </div>` : `
    <!-- LISTADO -->
    ${(() => {
      const sorted = [...expenses].sort((a,b)=>b.date>a.date?1:-1);
      const { items: expPage, total: expTotal, pages: expPages, page: expPage_ } = paginate(sorted, 'finance');
      return `
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="font-semibold text-gray-800">Historial de gastos${petFilter?' · '+petFilter:''}</h3>
            <p class="text-xs text-gray-400 mt-0.5">${expTotal} registro${expTotal!==1?'s':''} · Total ${fmtCLP(total)}</p>
          </div>
        </div>
        ${expTotal === 0
          ? emptyState('money','Sin gastos registrados','Comienza a registrar los gastos de tus mascotas')
          : `<div class="overflow-x-auto -mx-5 px-5">
               <table class="w-full text-sm min-w-[540px]">
                 <thead>
                   <tr class="text-left text-xs text-gray-400 border-b border-gray-100">
                     <th class="pb-3 font-semibold">Fecha</th>
                     <th class="pb-3 font-semibold">Descripción</th>
                     <th class="pb-3 font-semibold">Mascota</th>
                     <th class="pb-3 font-semibold">Categoría</th>
                     <th class="pb-3 font-semibold text-right">Monto</th>
                     <th class="pb-3 w-8"></th>
                   </tr>
                 </thead>
                 <tbody>
                   ${expPage.map(e => `
                     <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                       <td class="py-3 text-gray-400 whitespace-nowrap text-xs">${formatDate(e.date)}</td>
                       <td class="py-3 font-medium text-gray-800 max-w-[200px]">
                         <span class="truncate block">${esc(e.description)}</span>
                         ${e.source && e.source !== 'manual' ? `<span class="text-[10px] text-gray-400">Automático · ficha de la mascota</span>` : ''}
                       </td>
                       <td class="py-3 text-gray-500 text-xs">${e.pet ? `${speciesEmoji(pets.find(p=>p.name===e.pet)?.species||'')} ${esc(e.pet)}` : '—'}</td>
                       <td class="py-3"><span class="badge text-xs" style="background:${catColors[e.category]+'22'};color:${catColors[e.category]}">${esc(e.category||'—')}</span></td>
                       <td class="py-3 text-right font-bold text-gray-900 whitespace-nowrap">${fmtCLP(e.amount)}</td>
                       <td class="py-3 text-right">
                         ${(!e.source || e.source === 'manual') ? `
                         <button onclick="deleteExpense('${e.id}')"
                           class="w-7 h-7 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors ml-auto md:opacity-0 md:group-hover:opacity-100">
                           <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                         </button>` : ''}
                       </td>
                     </tr>`).join('')}
                 </tbody>
               </table>
             </div>
             ${pagerHTML('finance', expPages, expPage_)}`}
      </div>`;
    })()}`}

    ${(() => {
      // Predicción de gastos: función Premium (igual que el gráfico) — se
      // muestra el upsell una sola vez arriba (al entrar a "Gráfico"), acá
      // simplemente no se calcula nada para no duplicar el mensaje en la
      // vista de Lista.
      if (!isPremium()) return '';
      // Usa `expenses` (ya filtrado por mascota), no `allExpenses` — antes
      // usaba allExpenses acá y la proyección/tendencia seguía mostrando el
      // gasto de TODAS las mascotas aunque el usuario hubiera filtrado por
      // una sola en el selector "Mascota", a diferencia de cada otro widget
      // de la página.
      const last90Days = daysFromNowStr(-90);
      const last90Expenses = expenses.filter(e => e.date >= last90Days);
      const last90Amounts = last90Expenses.map(e => Number(e.amount || 0)).filter(a => a > 0);
      if (!last90Amounts.length) return '';
      // Un gasto puntual grande (cirugía, emergencia) no debería inflar la proyección
      // "normal" de gasto mensual: se topa cada gasto a 4x la mediana antes de promediar.
      const sortedAmounts = [...last90Amounts].sort((a, b) => a - b);
      const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
      const cap = medianAmount * 4;
      const hadOutliers = last90Amounts.some(a => a > cap);
      const cappedTotal = last90Amounts.reduce((s, a) => s + Math.min(a, cap), 0);
      const avgMonthly = Math.round(cappedTotal / 3);
      if (avgMonthly === 0) return '';

      // Compare last month vs prev month (maneja el cruce de año con Date en vez de aritmética de string)
      const now = new Date();
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;
      const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth()+1).padStart(2,'0')}`;
      const lastMonthTotal = expenses.filter(e=>e.date?.startsWith(lastMonthStr)).reduce((s,e)=>s+Number(e.amount||0),0);
      const prevMonthTotal = expenses.filter(e=>e.date?.startsWith(prevMonthStr)).reduce((s,e)=>s+Number(e.amount||0),0);
      const trend = lastMonthTotal > prevMonthTotal ? '↑' : lastMonthTotal < prevMonthTotal ? '↓' : '→';
      const trendColor = trend==='↑' ? 'text-red-500' : trend==='↓' ? 'text-green-500' : 'text-gray-400';

      return `
      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5 mt-4">
        <h3 class="font-semibold text-gray-800 mb-1 flex items-center gap-1.5">${icon('chartBar','w-4 h-4')} Predicción de gastos</h3>
        <p class="text-xs text-gray-400 mb-3">Basado en los últimos 3 meses${hadOutliers ? ' · excluye el efecto de gastos puntuales grandes' : ''}</p>
        <div class="flex items-center gap-4 flex-wrap">
          <div>
            <div class="text-2xl font-bold text-gray-900">~${fmtCLP(avgMonthly)}</div>
            <div class="text-xs text-gray-500">Proyección próximo mes</div>
          </div>
          <div class="flex items-center gap-1">
            <span class="text-2xl font-bold ${trendColor}">${trend}</span>
            <span class="text-xs text-gray-400">vs mes anterior</span>
          </div>
        </div>
      </div>`;
    })()}
  `);
}

export function openExpenseModal() {
  const pets = state.pets;
  // Mascota preseleccionada: la que esté filtrada en Finanzas, si hay una.
  const filtered = pets.find(p => p.name === state.finPet);
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Registrar gasto</h3>
      <form onsubmit="saveExpense(event)" class="space-y-3">
        <div id="ex-manual" class="space-y-3">
          <div><label class="form-label">Descripción *</label><input id="ex-desc" required placeholder="Ej: Consulta veterinaria" class="input-field" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Monto (CLP) *</label><input id="ex-amount" type="text" inputmode="numeric" required placeholder="0" class="input-field" /></div>
            <div><label class="form-label">Fecha *</label><input id="ex-date" type="date" required value="${todayStr()}" class="input-field" /></div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Categoría</label>
            <select id="ex-cat" class="input-field" onchange="onExpenseCategoryChange()">
              <option>Veterinaria</option><option>Medicamentos</option><option>Alimentación</option>
              <option>Peluquería</option><option>Hotel</option><option>Otro</option>
            </select>
          </div>
          <div id="ex-pet-wrap"><label class="form-label">Mascota</label>
            <select id="ex-pet" class="input-field">
              <option value="">General</option>
              ${pets.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
            </select>
          </div>
        </div>
        <!-- Alimentación: las compras se registran en la ficha (un solo lugar para el dato) -->
        <div id="ex-food-panel" class="hidden space-y-3">
          <p class="text-xs text-gray-500 bg-brand-50 rounded-xl p-3 leading-relaxed">Las compras de alimento se registran en la ficha de la mascota: así también calculamos el precio por kilo y cuándo se acaba, y el gasto aparece aquí solo.</p>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="form-label">Mascota *</label>
              <select id="ex-food-pet" class="input-field" onchange="onExpenseFoodPetChange()">
                <option value="">Elige una</option>
                ${pets.map(p => `<option value="${esc(p.id)}" ${filtered?.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
              </select>
            </div>
            <div><label class="form-label">¿Qué alimento?</label>
              <select id="ex-food-item" class="input-field"><option value="">Otro alimento nuevo</option></select>
            </div>
          </div>
          <button type="button" onclick="continueFoodExpense()" class="btn-primary w-full">Continuar</button>
          <button type="button" onclick="showManualExpense()" class="w-full text-xs text-gray-500 hover:text-gray-700 underline">Registrar solo como gasto</button>
        </div>
        <div id="ex-actions" class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

// Al elegir "Alimentación" el modal deja de pedir un monto suelto y lleva al
// formulario de compra de la ficha (una sola fuente para el dato). "Registrar solo
// como gasto" vuelve al formulario manual para gastos que no son de un alimento.
export function onExpenseCategoryChange() {
  const food = document.getElementById('ex-cat')?.value === 'Alimentación' && state.pets.length > 0;
  const manualAsked = document.getElementById('ex-food-panel')?.dataset.manual === '1';
  if (!food) { const p = document.getElementById('ex-food-panel'); if (p) p.dataset.manual = ''; }
  const showFood = food && !manualAsked;
  document.getElementById('ex-food-panel')?.classList.toggle('hidden', !showFood);
  document.getElementById('ex-manual')?.classList.toggle('hidden', showFood);
  document.getElementById('ex-pet-wrap')?.classList.toggle('hidden', showFood);
  document.getElementById('ex-actions')?.classList.toggle('hidden', showFood);
  if (showFood) onExpenseFoodPetChange();
}

export function onExpenseFoodPetChange() {
  const pet = state.pets.find(p => p.id === document.getElementById('ex-food-pet')?.value);
  const sel = document.getElementById('ex-food-item');
  if (!sel) return;
  sel.innerHTML = `<option value="">Otro alimento nuevo</option>` +
    (pet?.foodItems || []).map(f => `<option value="${esc(f.id)}">${esc(f.product)}</option>`).join('');
  // Si la mascota ya tiene alimentos, lo más común es una compra de uno de ellos.
  if (pet?.foodItems?.length) sel.value = pet.foodItems[0].id;
}

export function showManualExpense() {
  const panel = document.getElementById('ex-food-panel');
  if (panel) panel.dataset.manual = '1';
  onExpenseCategoryChange();
}

export function continueFoodExpense() {
  const petId = document.getElementById('ex-food-pet')?.value;
  const itemId = document.getElementById('ex-food-item')?.value;
  if (!petId) { showToast('Elige la mascota', 'error'); return; }
  track('expense_food_redirect', { existing: !!itemId });
  // openModal reemplaza el contenido, así que abrir el otro formulario cierra este.
  if (itemId) openFoodPurchaseModal(petId, itemId);
  else openFoodItemModal(petId);
}

export async function saveExpense(e) {
  e.preventDefault();
  const g = id => document.getElementById(id)?.value;
  const { data, error } = await sb.from('expenses').insert({
    user_id: state.user.id,
    pet_id: g('ex-pet') || null,
    date: g('ex-date'), category: g('ex-cat'),
    amount: parseCLP(g('ex-amount')), description: g('ex-desc')
  }).select().single();
  if (error) { showToast('Error al guardar gasto', 'error'); return; }
  state.expenses.push({ id: data.id, petId: data.pet_id, pet: state.pets.find(p => p.id === data.pet_id)?.name || null,
    date: data.date, category: data.category, amount: data.amount, description: data.description });
  closeModal(); render();
  track('record_saved', { kind: 'expense' });
  showToast('Gasto guardado', 'success');
}

export async function deleteExpense(id) {
  const { error } = await sb.from('expenses').delete().eq('id', id);
  if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  state.expenses = state.expenses.filter(e => e.id !== id); render();
}

if (typeof window !== 'undefined') {
  Object.assign(window, { viewFinance, openExpenseModal, onExpenseCategoryChange, onExpenseFoodPetChange, showManualExpense, continueFoodExpense, saveExpense, deleteExpense });
}
