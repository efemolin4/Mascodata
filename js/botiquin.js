/* ============================================================
   MASCODATA — Botiquín
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vista de botiquín y CRUD de sus
   productos (vendajes, jeringas, etc. — no ligados a un tratamiento). */

export function viewBotiquin() {
  if (!isPremium()) {
    return premiumUpsell('kit', 'Botiquín del hogar',
      'Lleva el inventario de vendas, jeringas y medicamentos que tienes en casa, con alertas de stock bajo y vencimiento. Disponible en el plan Premium.');
  }
  const pets = state.pets;
  const allMeds = pets.flatMap(p => (p.medications||[]).map(m => ({ ...m, petName: p.name, petId: p.id })));
  const today = todayStr();
  const active = allMeds.filter(m => m.active);
  const expiringSoon = allMeds.filter(m => m.expiry && m.expiry <= daysFromNowStr(30));
  const lowStock = allMeds.filter(m => { const ms = medStockStatus(m); return ms && ms.level !== 'ok'; });
  const filterPet = state.botiquinFilter || '';
  const filterStatus = state.botiquinStatus || '';
  let displayed = allMeds.filter(m => !filterPet || m.petName === filterPet);
  if (filterStatus === 'active')   displayed = displayed.filter(m => m.active);
  if (filterStatus === 'expired')  displayed = displayed.filter(m => m.expiry && m.expiry < today);
  if (filterStatus === 'finished') displayed = displayed.filter(m => !m.active);

  const inventory = state.botiquin || [];
  const statusLabel = { disponible: 'Disponible', por_agotarse: 'Por agotarse', agotado: 'Agotado' };
  const statusColor = { disponible: 'bg-green-100 text-green-700', por_agotarse: 'bg-amber-100 text-amber-700', agotado: 'bg-red-100 text-red-600' };
  const invExpiringSoon = inventory.filter(i => i.expiryDate && i.expiryDate <= daysFromNowStr(30));
  const invLowStock = inventory.filter(i => botiquinStatus(i) !== 'disponible');

  const botTab = state.botiquinTab || 'inventario';

  const inventoryPanel = `
    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p class="text-xs text-gray-400 max-w-md">Insumos y medicamentos que guardas en casa (no ligados a un tratamiento activo)</p>
        <button onclick="openBotiquinItemModal()" class="btn-primary text-sm">+ Agregar producto</button>
      </div>
      <div class="grid grid-cols-3 gap-3 mb-4">
        ${statCard(icon('box','w-5 h-5 md:w-6 md:h-6'),'Productos', inventory.length, 'brand')}
        ${statCard(icon('warning','w-5 h-5 md:w-6 md:h-6'),'Stock bajo', invLowStock.length, 'amber')}
        ${statCard(icon('calendar','w-5 h-5 md:w-6 md:h-6'),'Por vencer (30d)', invExpiringSoon.length, 'red')}
      </div>
      ${inventory.length === 0
        ? emptyState('kit','Sin productos en el inventario','Agrega vendas, jeringas u otros insumos que tengas en casa','+ Agregar producto',"openBotiquinItemModal()")
        : `<div class="divide-y divide-gray-50">
             ${inventory.map(item => {
               const st = botiquinStatus(item);
               const isExpired = item.expiryDate && item.expiryDate < today;
               return `
               <div class="flex items-center gap-3 py-3">
                 <div class="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-500 flex-shrink-0">${icon('kit','w-4.5 h-4.5')}</div>
                 <div class="flex-1 min-w-0">
                   <div class="flex items-center gap-2 flex-wrap">
                     <span class="font-medium text-gray-900 text-sm">${esc(item.name)}</span>
                     ${item.doseVal ? `<span class="badge bg-brand-50 text-brand-600 text-xs">${esc(item.doseVal)} ${esc(item.doseUnit||'')}</span>` : ''}
                     ${item.category ? `<span class="badge bg-gray-100 text-gray-500 text-xs">${esc(item.category)}</span>` : ''}
                     <span class="badge text-xs ${statusColor[st]}">${statusLabel[st]}</span>
                   </div>
                   <div class="text-xs mt-0.5 text-gray-400">
                     ${esc(item.quantity ?? 0)} ${esc(item.unit||'')}
                     ${Number(item.cost) > 0 ? ` · ${fmtCLP(item.cost)}` : ''}
                     ${item.expiryDate ? ` · <span class="${isExpired?'text-red-500':'text-gray-400'}">${isExpired?'Venció':'Vence'} ${formatDate(item.expiryDate)}</span>` : ''}
                   </div>
                 </div>
                 <div class="flex items-center gap-1 flex-shrink-0">
                   <button onclick="openBotiquinItemModal('${item.id}')" title="Editar"
                     class="w-8 h-8 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 flex items-center justify-center transition-colors">
                     ${icon('pencil','w-3.5 h-3.5')}
                   </button>
                   <button onclick="deleteBotiquinItem('${item.id}')" title="Eliminar"
                     class="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                     ${icon('trash','w-3.5 h-3.5')}
                   </button>
                 </div>
               </div>`;
             }).join('')}
           </div>`}
    </div>`;

  const treatmentsPanel = `
    ${pets.length > 0 ? `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
      ${statCard(icon('pill','w-5 h-5 md:w-6 md:h-6'),'Total', allMeds.length, 'brand')}
      ${statCard(icon('checkCircle','w-5 h-5 md:w-6 md:h-6'),'Activos', active.length, 'teal')}
      ${statCard(icon('warning','w-5 h-5 md:w-6 md:h-6'),'Stock bajo', lowStock.length, 'amber')}
      ${statCard(icon('calendar','w-5 h-5 md:w-6 md:h-6'),'Por vencer (30d)', expiringSoon.length, 'red')}
    </div>` : ''}

    ${expiringSoon.length > 0 ? `
    <div class="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
      <h3 class="font-semibold text-amber-700 mb-2 text-sm flex items-center gap-1.5">${icon('warning','w-4 h-4')} Próximos a vencer (30 días)</h3>
      <div class="flex gap-2 overflow-x-auto pb-1 -mb-1" style="scrollbar-width:none">
        ${expiringSoon.map(m => `
          <div class="bg-white rounded-xl px-3 py-2 text-sm border border-amber-200 flex items-center gap-2 flex-shrink-0">
            <span class="font-medium text-gray-800">${esc(m.name)}</span>
            <span class="badge bg-brand-50 text-brand-600 text-xs">${esc(m.petName)}</span>
            <span class="text-amber-600 text-xs whitespace-nowrap">Vence ${formatDate(m.expiry)}</span>
          </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="bg-white rounded-2xl shadow-sm p-5">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p class="text-xs text-gray-400">Tratamientos activos por mascota</p>
        <div class="flex items-center gap-2 flex-wrap">
          ${pets.length === 0 ? `
          <select disabled title="Registra una mascota para filtrar" class="input-field text-sm py-1.5 w-auto text-gray-400 bg-gray-50 cursor-not-allowed">
            <option>Registra una mascota para filtrar</option>
          </select>` : `
          <select onchange="state.botiquinFilter=this.value;render()" class="input-field text-sm py-1.5 w-auto">
            <option value="">Todas las mascotas</option>
            ${pets.map(p => `<option ${filterPet===p.name?'selected':''}>${esc(p.name)}</option>`).join('')}
          </select>
          <select onchange="state.botiquinStatus=this.value;render()" class="input-field text-sm py-1.5 w-auto">
            <option value="">Todos los estados</option>
            <option value="active" ${filterStatus==='active'?'selected':''}>Activos</option>
            <option value="finished" ${filterStatus==='finished'?'selected':''}>Finalizados</option>
            <option value="expired" ${filterStatus==='expired'?'selected':''}>Vencidos</option>
          </select>`}
        </div>
      </div>

      ${(() => {
        const { items: dispPage, total: dispTotal, pages: dispPages, page: dispPage_ } = paginate(displayed, 'botiquin');
        if (pets.length === 0) return emptyState('paw','Sin mascotas registradas','Registra tu primera mascota para empezar a llevar sus tratamientos','+ Registrar mascota',"navigate('addPet')");
        return dispTotal === 0
          ? emptyState('pill','Sin medicamentos','Agrega tratamientos desde el perfil de cada mascota')
          : `<div class="divide-y divide-gray-50">
               ${dispPage.map(m => {
               const isExpired     = m.expiry && m.expiry < today;
               const isExpiringSoon = m.expiry && !isExpired && m.expiry <= daysFromNowStr(30);
               return `
               <div class="flex items-center gap-3 py-3">
                 <div class="w-9 h-9 rounded-xl ${m.active?'bg-brand-50 text-brand-600':'bg-gray-50 text-gray-400'} flex items-center justify-center flex-shrink-0">${icon('pill','w-4.5 h-4.5')}</div>
                 <div class="flex-1 min-w-0">
                   <div class="flex items-center gap-2 flex-wrap">
                     <span class="font-medium text-gray-900 text-sm">${esc(m.name)}</span>
                     <span class="badge bg-brand-50 text-brand-600 text-xs">${esc(m.petName)}</span>
                     ${m.active ? '<span class="badge bg-green-100 text-green-700 text-xs">Activo</span>' : '<span class="badge bg-gray-100 text-gray-400 text-xs">Finalizado</span>'}
                   </div>
                   <div class="text-xs mt-0.5 ${isExpired?'text-red-500':isExpiringSoon?'text-amber-500':'text-gray-400'}">
                     ${m.expiry ? `${isExpired?'Venció':'Vence'}: ${formatDate(m.expiry)}` : '<span class="text-gray-300">Sin vencimiento</span>'}
                   </div>
                 </div>
                 <button onclick="openPet('${m.petId}');setTab('medicamentos')"
                   class="text-xs text-brand-600 hover:underline whitespace-nowrap flex-shrink-0">Ver detalle →</button>
               </div>`;
             }).join('')}
             </div>
             ${pagerHTML('botiquin', dispPages, dispPage_)}`;
      })()}
    </div>`;

  return appShell(`
    ${pageHeader('Botiquín', 'Inventario del hogar y medicamentos de todas tus mascotas')}

    <div class="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
      <button onclick="state.botiquinTab='inventario';render()" class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${botTab==='inventario'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}">
        ${icon('kit','w-4 h-4')} Inventario
      </button>
      <button onclick="state.botiquinTab='tratamientos';render()" class="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${botTab==='tratamientos'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}">
        ${icon('pill','w-4 h-4')} Tratamientos
      </button>
    </div>

    ${botTab === 'inventario' ? inventoryPanel : treatmentsPanel}
  `);
}

export function openBotiquinItemModal(itemId) {
  const item = itemId ? (state.botiquin||[]).find(i => i.id === itemId) : null;
  const categories = ['Medicamento','Vendaje','Higiene','Alimento','Accesorio','Otro'];
  const units = ['unidades','comprimidos','ml','mg','cajas','frascos'];
  const doseUnits = ['mg','ml','Comprimido(s)','Gotas','UI'];
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">${item ? icon('pencil','w-5 h-5') : icon('kit','w-5 h-5')} ${item ? 'Editar producto' : 'Agregar producto al botiquín'}</h3>
      <form onsubmit="saveBotiquinItem(event${item ? `,'${item.id}'` : ''})" class="space-y-3">
        <div><label class="form-label">Nombre *</label><input id="bq-name" required value="${esc(item?.name||'')}" placeholder="Ej: Pregalex" class="input-field" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Categoría</label>
            <select id="bq-category" class="input-field">${categories.map(c=>`<option ${c===item?.category?'selected':''}>${c}</option>`).join('')}</select>
          </div>
          <div><label class="form-label">Mascota (opcional)</label>
            <select id="bq-pet" class="input-field">
              <option value="">General</option>
              ${state.pets.map(p=>`<option value="${esc(p.id)}" ${p.id===item?.petId?'selected':''}>${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div><label class="form-label">Cantidad *</label><input id="bq-qty" type="number" min="0" step="0.1" required value="${esc(item?.quantity??'')}" class="input-field" /></div>
          <div><label class="form-label">Unidad</label>
            <select id="bq-unit" class="input-field">${units.map(u=>`<option ${u===item?.unit?'selected':''}>${u}</option>`).join('')}</select>
          </div>
          <div><label class="form-label">Dosis / concentración (opcional)</label><input id="bq-dose-val" type="number" min="0" step="0.1" placeholder="Ej: 75" value="${esc(item?.doseVal??'')}" class="input-field" /></div>
          <div><label class="form-label">&nbsp;</label>
            <select id="bq-dose-unit" class="input-field">${doseUnits.map(u=>`<option ${u===item?.doseUnit?'selected':''}>${u}</option>`).join('')}</select>
          </div>
        </div>
        <p class="text-xs text-gray-400 -mt-1">La dosis es por unidad (ej: cada comprimido de Pregalex es de 75 mg) — distinto de la cantidad en stock de arriba.</p>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Costo (CLP, opcional)</label><input id="bq-cost" type="text" inputmode="numeric" placeholder="0" value="${esc(item?.cost??'')}" class="input-field" /></div>
          <div><label class="form-label">Fecha de compra</label><input id="bq-purchase" type="date" value="${esc(item?.purchaseDate||todayStr())}" class="input-field" /></div>
        </div>
        <div><label class="form-label">Fecha de caducidad (opcional)</label><input id="bq-expiry" type="date" value="${esc(item?.expiryDate||'')}" class="input-field" /></div>
        <div><label class="form-label">Notas</label><textarea id="bq-notes" rows="2" class="input-field resize-none">${esc(item?.notes||'')}</textarea></div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1">Guardar</button>
        </div>
      </form>
    </div>`);
}

export async function saveBotiquinItem(e, itemId) {
  e.preventDefault();
  const g = id => document.getElementById(id)?.value;
  const name = g('bq-name'), category = g('bq-category'), petId = g('bq-pet') || null;
  const quantity = parseFloat(g('bq-qty') || 0), unit = g('bq-unit');
  const doseVal = g('bq-dose-val') || null, doseUnit = g('bq-dose-unit');
  const cost = parseCLP(g('bq-cost')), purchaseDate = g('bq-purchase') || null;
  const expiryDate = g('bq-expiry') || null, notes = g('bq-notes');
  const status = botiquinStatus({ quantity });
  const local = { name, category, petId, quantity, unit, doseVal, doseUnit, cost, purchaseDate, expiryDate, notes, status };
  state.botiquin = state.botiquin || [];
  if (isDemoUser()) {
    if (itemId) {
      const item = state.botiquin.find(i => i.id === itemId);
      if (item) Object.assign(item, local);
    } else {
      state.botiquin.push({ id: genId(), ...local });
    }
  } else if (itemId) {
    const { error } = await sb.from('botiquin_items').update({
      name, type: category, pet_id: petId, quantity, unit,
      dose_val: doseVal, dose_unit: doseUnit, cost, purchase_date: purchaseDate,
      expiry_date: expiryDate, notes
    }).eq('id', itemId);
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    const item = state.botiquin.find(i => i.id === itemId);
    if (item) Object.assign(item, local);
  } else {
    const { data, error } = await sb.from('botiquin_items').insert({
      user_id: state.user.id, name, type: category, pet_id: petId, quantity, unit,
      dose_val: doseVal, dose_unit: doseUnit, cost, purchase_date: purchaseDate,
      expiry_date: expiryDate, notes
    }).select().single();
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
    state.botiquin.push({ id: data.id, petId: data.pet_id, name: data.name, category: data.type,
      quantity: data.quantity, unit: data.unit, doseVal: data.dose_val, doseUnit: data.dose_unit,
      cost: data.cost, purchaseDate: data.purchase_date, expiryDate: data.expiry_date, notes: data.notes, status });
  }
  closeModal(); render();
  track('record_saved', { kind: 'botiquin' });
  showToast('Producto guardado', 'success');
}

export async function deleteBotiquinItem(itemId) {
  if (!isDemoUser()) {
    const { error } = await sb.from('botiquin_items').delete().eq('id', itemId);
    if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
  }
  state.botiquin = (state.botiquin||[]).filter(i => i.id !== itemId);
  render();
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    viewBotiquin, openBotiquinItemModal, saveBotiquinItem, deleteBotiquinItem,
  });
}
