/* ============================================================
   MASCODATA — Panel de administrador
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vista de administrador, modal
   de cambio de plan y su guardado. */

// ---- VISTA ADMINISTRADOR ----
export function viewAdmin() {
  if (!state.user?.isAdmin) { navigate('dashboard', {}, { replace: true }); return ''; }
  const ad = state.adminData || { profiles: [], pets: [], planChanges: [] };
  const profiles = ad.profiles;
  const allPets  = ad.pets;
  const planChanges = ad.planChanges || [];

  const planColors = {
    free:    'bg-gray-100 text-gray-600',
    premium: 'bg-brand-100 text-brand-700',
  };
  const planLabel = { free: 'Free', premium: 'Premium' };

  const totalUsers  = profiles.length;
  const totalPets   = allPets.length;
  const paidUsers   = profiles.filter(p => p.plan === 'premium').length;
  // Métricas de negocio: el MRR es una ESTIMACIÓN con el precio mensual de
  // Premium — hoy no se guarda si cada usuario paga mes a mes o por año, así
  // que quien paga el año completo aporta en realidad menos por mes
  // (PLANS.premium.priceYearlyCLP / 12). La conversión sigue siendo una foto
  // del estado ACTUAL (% de usuarios que hoy pagan), no un embudo por cohorte.
  const mrr = paidUsers * PLANS.premium.priceMonthlyCLP;
  const conversionPct = totalUsers > 0 ? Math.round((paidUsers / totalUsers) * 100) : 0;
  // Churn: bajas de un plan pago a Free en los últimos 30 días, según
  // plan_changes (ver applyPlanChange() en este archivo, que ahora sí deja
  // registro de cada cambio de plan). 'premium' se mantiene en el check por
  // filas de auditoría históricas de antes de este cambio de modelo.
  const churnCutoff = new Date(); churnCutoff.setDate(churnCutoff.getDate() - 30);
  const churnedLast30 = planChanges.filter(pc =>
    pc.from_plan === 'premium' && pc.to_plan === 'free' && new Date(pc.changed_at) >= churnCutoff
  ).length;

  const speciesDist = allPets.reduce((acc, p) => { acc[p.species] = (acc[p.species]||0)+1; return acc; }, {});

  // Bucketea por día CALENDARIO LOCAL, no por día UTC: created_at llega de Supabase
  // como timestamp UTC, así que comparar con startsWith() contra una fecha UTC
  // clasificaba mal los registros nocturnos (ej: 21:00 en Chile ya es "mañana" en UTC).
  const localDateOf = (isoTimestamp) => {
    const dt = new Date(isoTimestamp);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const week = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const signupsByDay = week.map(wd => profiles.filter(p => p.created_at && localDateOf(p.created_at) === wd).length);

  const tab = state.adminTab || 'dashboard';
  const tabs = [
    { id:'dashboard', label:'Dashboard', iconName:'chartBar' },
    { id:'usuarios',  label:'Usuarios',  iconName:'users' },
    { id:'planes',    label:'Planes',    iconName:'creditCard' },
  ];

  const tabContent = () => {
    if (tab === 'dashboard') return `
      <div class="mb-6">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Métricas de negocio</h3>
        <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
          ${statCard(icon('money','w-5 h-5 md:w-6 md:h-6'), 'MRR estimado', fmtCLP(mrr), 'teal')}
          ${statCard(icon('chartBar','w-5 h-5 md:w-6 md:h-6'), 'Conversión a Premium', conversionPct + '%', 'brand')}
          ${statCard(icon('arrowDown','w-5 h-5 md:w-6 md:h-6'), 'Bajas de Premium (30d)', churnedLast30, churnedLast30 > 0 ? 'red' : 'teal')}
        </div>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        ${statCard(icon('users','w-5 h-5 md:w-6 md:h-6'), 'Usuarios', totalUsers, 'brand')}
        ${statCard(icon('paw','w-5 h-5 md:w-6 md:h-6'), 'Mascotas', totalPets, 'teal')}
        ${statCard(icon('creditCard','w-5 h-5 md:w-6 md:h-6'), 'Usuarios pagos', paidUsers, 'amber')}
        ${statCard(icon('box','w-5 h-5 md:w-6 md:h-6'), 'Plan Free', totalUsers - paidUsers, 'red')}
      </div>
      <div class="grid md:grid-cols-2 gap-6 mb-6">
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-1.5">${icon('creditCard','w-4 h-4')} Distribución de planes</h3>
          <div class="space-y-3">
            ${[['free','Free',totalUsers-paidUsers,'bg-gray-400'],['premium','Premium',paidUsers,'bg-brand-500']].map(([_,label,n,color]) => {
              const pct = totalUsers > 0 ? Math.round(n/totalUsers*100) : 0;
              return '<div><div class="flex justify-between text-sm mb-1"><span class="font-medium text-gray-700">'+label+'</span><span class="text-gray-500">'+n+' usuarios ('+pct+'%)</span></div><div class="bg-gray-100 rounded-full h-2"><div class="h-2 rounded-full '+color+'" style="width:'+pct+'%"></div></div></div>';
            }).join('')}
          </div>
        </div>
        <div class="bg-white rounded-2xl shadow-sm p-5">
          <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-1.5">${icon('paw','w-4 h-4')} Mascotas por especie</h3>
          <div class="space-y-2">
            ${Object.entries(speciesDist).length === 0
              ? '<p class="text-sm text-gray-400 text-center py-6">Sin mascotas registradas</p>'
              : Object.entries(speciesDist).sort((a,b)=>b[1]-a[1]).map(([sp,n]) => {
                  const pct = Math.round(n/totalPets*100);
                  return '<div class="flex items-center gap-3"><span class="text-xl w-8">'+speciesEmoji(sp)+'</span><div class="flex-1 bg-gray-100 rounded-full h-2"><div class="h-2 rounded-full bg-teal-500" style="width:'+pct+'%"></div></div><span class="text-sm text-gray-500 w-28 text-right">'+sp+' · '+n+'</span></div>';
                }).join('')}
          </div>
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-1.5">${icon('chartBar','w-4 h-4')} Registros últimos 7 días</h3>
        <div class="flex items-end gap-2 h-24">
          ${signupsByDay.map((n, i) => {
            const max = Math.max(...signupsByDay, 1);
            const h   = Math.round((n/max)*100);
            const day = week[i].slice(5).replace('-','/');
            return '<div class="flex-1 flex flex-col items-center gap-1"><span class="text-xs font-semibold text-brand-600">'+(n>0?n:'')+'</span><div class="w-full rounded-t-md bg-brand-500 transition-all" style="height:'+h+'%;min-height:'+(n>0?8:2)+'px"></div><span class="text-[10px] text-gray-400">'+day+'</span></div>';
          }).join('')}
        </div>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-5 mt-6">
        <h3 class="font-semibold text-gray-800 mb-4 flex items-center gap-1.5">${icon('clock','w-4 h-4')} Historial de cambios de plan</h3>
        ${planChanges.length === 0
          ? '<p class="text-sm text-gray-400 text-center py-6">Todavía no se registró ningún cambio de plan</p>'
          : '<div class="space-y-2">' + planChanges.slice(0, 10).map(pc => {
              const target = profiles.find(p => p.id === pc.user_id);
              const admin  = profiles.find(p => p.id === pc.changed_by);
              const isDowngrade = pc.from_plan === 'premium' && pc.to_plan === 'free';
              const when = pc.changed_at ? new Date(pc.changed_at).toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
              return '<div class="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">'
                + '<div class="min-w-0"><span class="font-medium text-gray-800">'+esc(target?.name||target?.email||'Usuario eliminado')+'</span>'
                + ' <span class="text-gray-400">'+esc(planLabel[pc.from_plan]||pc.from_plan)+' → </span>'
                + '<span class="font-semibold '+(isDowngrade?'text-red-500':'text-brand-600')+'">'+esc(planLabel[pc.to_plan]||pc.to_plan)+'</span>'
                + '</div><div class="text-right flex-shrink-0"><div class="text-xs text-gray-400">'+when+'</div>'
                + '<div class="text-[10px] text-gray-300">por '+esc(admin?.name||'—')+'</div></div></div>';
            }).join('') + '</div>'}
      </div>`;

    if (tab === 'usuarios') return `
      <div class="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div class="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 class="font-semibold text-gray-800">Todos los usuarios <span class="text-xs text-gray-400 font-normal ml-2">${totalUsers} total</span></h3>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-gray-400 bg-gray-50">
                <th class="px-5 py-3 font-medium">Usuario</th>
                <th class="px-4 py-3 font-medium hidden md:table-cell">Email</th>
                <th class="px-4 py-3 font-medium">Plan</th>
                <th class="px-4 py-3 font-medium hidden md:table-cell">Mascotas</th>
                <th class="px-4 py-3 font-medium hidden md:table-cell">Registro</th>
                <th class="px-4 py-3 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              ${profiles.length === 0
                ? '<tr><td colspan="6" class="text-center py-10 text-gray-400">Sin usuarios</td></tr>'
                : profiles.map(u => {
                    const petCount = allPets.filter(p => p.owner_id === u.id).length;
                    const plan = u.plan || 'free';
                    const pColor = planColors[plan] || planColors.free;
                    const pLbl   = planLabel[plan] || plan;
                    return '<tr class="hover:bg-gray-50 transition-colors"><td class="px-5 py-3"><div class="flex items-center gap-3"><div class="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">'+esc((u.name||'?')[0].toUpperCase())+'</div><div><div class="font-medium text-gray-900">'+esc(u.name||'—')+'</div>'+(u.is_admin?'<span class="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">ADMIN</span>':'')+'</div></div></td><td class="px-4 py-3 text-gray-500 hidden md:table-cell">'+esc(u.email||'—')+'</td><td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-semibold '+pColor+'">'+pLbl+'</span></td><td class="px-4 py-3 text-gray-500 hidden md:table-cell">'+petCount+'</td><td class="px-4 py-3 text-gray-400 hidden md:table-cell">'+(u.created_at?new Date(u.created_at).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'}):'—')+'</td><td class="px-4 py-3"><button onclick="openChangePlanModal(\''+safeId(u.id)+'\')" class="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 font-medium transition-colors">Cambiar plan</button></td></tr>';
                  }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    if (tab === 'planes') return `
      <div class="grid md:grid-cols-2 gap-4 max-w-2xl">
        ${[
          { id:'free', name:PLANS.free.label, price:'$0', features:['1 mascota','Fichas, vacunas, desparasitaciones y tratamientos','Historial clínico','Agenda y alertas','Finanzas básicas (lista, total y desglose por categoría)','Seguimiento y Nutrición','1 archivo adjunto por evento del historial'] },
          { id:'premium', name:PLANS.premium.label, price:fmtCLP(PLANS.premium.priceMonthlyCLP)+'/mes · '+fmtCLP(PLANS.premium.priceYearlyCLP)+'/año', features:['Mascotas ilimitadas','Todo lo de Free','Compartir con un segundo tutor','Gráficos y predicción de gastos','Exportar expediente en PDF','Botiquín del hogar','Adjuntos ilimitados en el historial'] },
        ].map(p => {
          const cnt = profiles.filter(u=>(u.plan||'free')===p.id).length;
          return '<div class="bg-white rounded-2xl shadow-sm p-5 border-2 '+(p.id==='premium'?'border-brand-400':'border-transparent')+'"><div class="mb-3">'+(p.id==='premium'?'<span class="text-[10px] bg-brand-500 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Popular</span>':'')+'<h3 class="font-bold text-gray-900 text-lg mt-1">'+p.name+'</h3><p class="text-2xl font-black text-gray-900 mt-1">'+p.price+'</p></div><ul class="space-y-1.5 mb-4">'+p.features.map(f=>'<li class="flex items-start gap-2 text-sm text-gray-600"><span class="text-green-500 mt-0.5">✓</span>'+f+'</li>').join('')+'</ul><div class="pt-3 border-t border-gray-100 text-xs text-gray-400">'+cnt+' usuario'+(cnt!==1?'s':'')+' activo'+(cnt!==1?'s':'')+'</div></div>';
        }).join('')}
      </div>`;
    return '';
  };

  return appShell(`
    <div class="max-w-5xl mx-auto">
      ${pageHeader('Panel Administrador', 'Command Center · Mascodata SaaS')}
      <div class="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        ${tabs.map(t => '<button onclick="state.adminTab=\''+t.id+'\';render()" class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 '+(tab===t.id?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700')+'">'+icon(t.iconName,'w-4 h-4')+t.label+'</button>').join('')}
      </div>
      ${tabContent()}
    </div>
  `);
}

export async function openChangePlanModal(userId) {
  const profile = (state.adminData?.profiles||[]).find(p => p.id === userId);
  const userName = profile?.name || '';
  const currentPlan = profile?.plan || 'free';
  const plans = [
    { id:'free',    label:PLANS.free.label,    desc:'Gratis' },
    { id:'premium', label:PLANS.premium.label, desc:fmtCLP(PLANS.premium.priceMonthlyCLP)+'/mes · '+fmtCLP(PLANS.premium.priceYearlyCLP)+'/año' },
  ];
  openModal('<div class="modal-box p-5"><h3 class="text-lg font-bold text-gray-900 mb-1">Cambiar plan</h3><p class="text-sm text-gray-500 mb-4">Usuario: <strong>'+esc(userName)+'</strong></p><div class="space-y-2 mb-5">'+plans.map(p=>'<label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all '+(p.id===currentPlan?'border-brand-400 bg-brand-50':'border-gray-100 hover:border-gray-200')+'"><input type="radio" name="new-plan" value="'+p.id+'" '+(p.id===currentPlan?'checked':'')+' class="accent-brand-600"><div class="flex-1"><div class="font-semibold text-sm text-gray-900">'+p.label+'</div><div class="text-xs text-gray-400">'+p.desc+'</div></div></label>').join('')+'</div><div class="flex gap-3"><button onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button><button onclick="applyPlanChange(\''+safeId(userId)+'\')" class="btn-primary flex-1">Guardar</button></div></div>');
}

export async function applyPlanChange(userId) {
  const plan = document.querySelector('input[name="new-plan"]:checked')?.value;
  if (!plan) return;
  const profile = (state.adminData?.profiles||[]).find(p=>p.id===userId);
  const fromPlan = profile?.plan || 'free';
  if (fromPlan === plan) { closeModal(); return; } // sin cambio real, no hay nada que auditar
  const { error } = await sb.from('profiles').update({ plan }).eq('id', userId);
  if (error) { showToast('Error al cambiar plan', 'error'); return; }
  // Registro de auditoría — antes esta función sobrescribía el plan sin dejar
  // ningún rastro de quién lo cambió, de qué a qué, ni cuándo. No bloquea el
  // flujo si falla: el cambio de plan en sí ya se guardó, lo único que se
  // pierde es la entrada del historial.
  const { data: auditRow, error: auditError } = await sb.from('plan_changes').insert({
    user_id: userId, from_plan: fromPlan, to_plan: plan, changed_by: state.user.id
  }).select().single();
  if (auditError) {
    console.error('Error al registrar el cambio de plan:', auditError);
  } else {
    state.adminData.planChanges = state.adminData.planChanges || [];
    state.adminData.planChanges.unshift(auditRow);
  }
  if (profile) profile.plan = plan;
  closeModal();
  showToast('Plan actualizado', 'success');
  render();
}

if (typeof window !== 'undefined') {
  Object.assign(window, { viewAdmin, openChangePlanModal, applyPlanChange });
}
