/* ============================================================
   MASCODATA — Mascotas: alta, ficha, edición, eliminación, tutor2
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Listado y wizard de alta de
   mascotas, ficha general, edición, borrado con código de confirmación,
   exportación de ficha y el flujo de invitación de un segundo tutor. */

export function viewPets() {
  const pets = state.pets;
  return appShell(`
    ${pageHeader('Mis Mascotas', `${pets.length} mascota${pets.length !== 1 ? 's' : ''} registrada${pets.length !== 1 ? 's' : ''}`,
      `<button onclick="navigate('addPet')" class="btn-primary flex items-center gap-1.5">
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
         <span>Agregar mascota</span>
       </button>`)}
    ${pets.length === 0
      ? emptyState('paw', 'Aún no tienes mascotas', 'Registra tu primera mascota para comenzar', '+ Agregar mascota', "navigate('addPet')")
      : `<div class="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
           ${pets.map(p => `
             <div class="bg-white rounded-2xl shadow-sm p-5 card-hover animate-fade-in relative flex flex-col">
               <!-- Botones top-right -->
               <div class="absolute top-3 right-3 flex gap-1.5 z-10">
                 <button onclick="event.stopPropagation();openEditPetModal('${p.id}')"
                   title="Editar"
                   class="w-8 h-8 rounded-lg bg-gray-50 hover:bg-brand-50 text-gray-400 hover:text-brand-600 border border-gray-200 flex items-center justify-center transition-all">
                   <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                 </button>
                 <button onclick="event.stopPropagation();openDeletePetWithCode('${p.id}')"
                   title="Eliminar"
                   class="w-8 h-8 rounded-lg bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200 flex items-center justify-center transition-all">
                   <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                 </button>
               </div>
               <!-- Contenido central -->
               <div class="flex flex-col items-center text-center pt-4">
                 ${petAvatar(p, 'lg')}
                 <div class="mt-3 font-bold text-gray-900">${esc(p.name)}</div>
                 <div class="text-sm text-gray-400 mt-0.5">${esc(p.species)} · ${esc(p.breed || 'Mestizo')}</div>
                 <div class="text-xs text-gray-400 mt-0.5">${getAge(p.dateOfBirth)}</div>
                 ${(() => { const c = petCompleteness(p); return `<div class="mt-2 w-full max-w-[9rem]" title="Perfil ${c.percent} % completo"><div class="flex justify-between text-[11px] text-gray-400 mb-0.5"><span>Perfil</span><span>${c.percent} %</span></div><div class="h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full ${c.percent >= 100 ? 'bg-green-500' : 'bg-brand-500'}" style="width:${c.percent}%"></div></div></div>`; })()}
                 <div class="flex gap-2 mt-3 flex-wrap justify-center">
                   ${(p.personalityTags || []).slice(0,2).map(t => `<span class="tag text-xs">${esc(t)}</span>`).join('')}
                 </div>
               </div>
               <!-- Stats -->
               <div class="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-center text-gray-500">
                 <div><div class="font-semibold text-gray-800">${(p.vaccines||[]).length}</div>Vacunas</div>
                 <div><div class="font-semibold text-gray-800">${(p.medications||[]).length}</div>Medicamentos</div>
               </div>
               <!-- Botón Ver ficha -->
               <button onclick="openPet('${p.id}')"
                 class="mt-4 w-full py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-sm font-semibold transition-colors">
                 Ver ficha →
               </button>
             </div>`).join('')}
         </div>`}
  `);
}

export function viewAddPet() {
  const step = state.addPetStep;
  const steps = ['Identificación', 'Características', 'Salud', 'Tutores'];
  return appShell(`
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center gap-3 mb-6">
        <button onclick="cancelAddPet()" class="flex items-center gap-1 h-9 px-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors">‹ Cancelar</button>
        <div>
          <h1 class="text-xl font-bold text-gray-900">Nueva mascota</h1>
          <p class="text-sm text-gray-400">Paso ${step} de 4</p>
        </div>
      </div>

      <div class="flex items-center mb-5 px-1">
        ${steps.map((s, i) => `
          <div class="flex-1 flex flex-col items-center">
            <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold mb-1
              ${i+1 < step ? 'bg-brand-500 text-white' : i+1 === step ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-gray-100 text-gray-400'}">
              ${i+1 < step ? '✓' : i+1}
            </div>
            <div class="text-[10px] sm:text-xs text-center ${i+1 === step ? 'text-brand-600 font-medium' : 'text-gray-400'}">${s.split(' ')[0]}</div>
          </div>
          ${i < steps.length-1 ? `<div class="flex-1 h-0.5 mb-4 ${i+1 < step ? 'bg-brand-500' : 'bg-gray-200'}"></div>` : ''}
        `).join('')}
      </div>

      <div class="bg-white rounded-2xl shadow-sm p-4 sm:p-6 animate-scale-in">
        ${step === 1 ? stepBasic() : step === 2 ? stepPhysical() : step === 3 ? stepHealth() : stepTutors()}
        <div class="flex gap-3 mt-5 pt-5 border-t border-gray-100">
          ${step > 1 ? `<button onclick="prevStep()" class="btn-secondary flex-1 !py-3">← Anterior</button>` : ''}
          <button onclick="nextStep()" class="btn-primary flex-1 !py-3">${step === 4 ? '✓ Guardar mascota' : 'Siguiente →'}</button>
        </div>
      </div>
    </div>
  `);
}

export function stepBasic() {
  const d = state.newPetData;
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-4">Identificación</h2>
    <div class="space-y-4">
      <div class="flex flex-col items-center mb-4">
        <div id="photo-preview" class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-4xl mb-2 overflow-hidden">
          ${safeDataUrl(d.photo) ? `<img src="${safeDataUrl(d.photo)}" class="w-full h-full object-cover" />` : icon('paw','w-8 h-8 text-gray-300')}
        </div>
        <label class="cursor-pointer text-sm text-brand-600 hover:underline font-medium">
          Subir foto <input type="file" accept="image/*" class="hidden" onchange="previewPhoto(event)" />
        </label>
      </div>
      <div class="space-y-3">
        <div>
          <label class="form-label">Nombre *</label>
          <input id="pet-name" type="text" required value="${esc(d.name||'')}" placeholder="Nombre de tu mascota" class="input-field" oninput="clearFieldError('pet-name')" />
          <p id="pet-name-error" class="text-xs text-red-500 mt-1 hidden">Ingresa el nombre de tu mascota para continuar</p>
        </div>
        <!-- Especie + Sexo siempre en 2 col (selects cortos) -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Especie *</label>
            <select id="pet-species" class="input-field" onchange="updateBreedOptions(this.value)">
              ${['Perro','Gato','Ave','Conejo','Pez','Hámster','Reptil','Otro'].map(s => `<option ${(d.species||'Perro')===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Sexo <span class="text-gray-400 font-normal">(opcional)</span></label>
            <select id="pet-sex" class="input-field">
              ${['Macho','Hembra'].map(s => `<option ${d.sex===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <!-- Raza + Fecha: 1 col en mobile, 2 col en sm+ -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="form-label">Raza <span class="text-gray-400 font-normal">(opcional)</span></label>
            <select id="pet-breed" class="input-field">
              ${(BREEDS[d.species || 'Perro'] || BREEDS.Otro).map(b => `<option ${(d.breed||'Mestizo')===b?'selected':''}>${b}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Fecha de nacimiento <span class="text-gray-400 font-normal">(opcional)</span></label>
            <input id="pet-dob" type="date" value="${esc(d.dateOfBirth||'')}" class="input-field" />
            <p class="text-xs text-gray-400 mt-1">Si no la sabes con exactitud, deja el campo vacío</p>
          </div>
        </div>
      </div>
    </div>`;
}

export function stepPhysical() {
  const d = state.newPetData;
  const tags = ['Juguetón','Cariñoso','Tranquilo','Activo','Tímido','Sociable','Independiente','Protector'];
  const colors = ['Negro','Blanco','Gris','Café','Dorado','Amarillo','Crema','Naranja','Rojo','Canela','Atigrado','Manchado negro y blanco','Manchado café y blanco','Tricolor','Bicolor','Azul grisáceo','Plateado','Otro'];
  const sizes = [
    { label: 'Pequeño', range: 'hasta 10 kg' },
    { label: 'Mediano', range: '10 – 25 kg' },
    { label: 'Grande',  range: '25 – 45 kg' },
    { label: 'Gigante', range: 'más de 45 kg' },
  ];
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-4">Características físicas</h2>
    <div class="space-y-3">
      <!-- Color + Tamaño: 2 col (selects cortos, OK en mobile) -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="form-label">Color</label>
          <select id="pet-color" class="input-field">
            ${colors.map(c => `<option ${(d.color||'')=== c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Tamaño</label>
          <select id="pet-size" class="input-field">
            ${sizes.map(s => `<option value="${s.label}" ${d.sizeRange===s.label?'selected':''}>${s.label} (${s.range})</option>`).join('')}
          </select>
        </div>
      </div>
      <!-- Peso -->
      <div>
        <label class="form-label">Peso</label>
        <div class="grid grid-cols-2 gap-3 mt-1">
          <div class="relative">
            <input id="pet-wkg" type="number" min="0" max="200" value="${esc(d.weightKg||'')}" placeholder="0" class="input-field pr-10" />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">kg</span>
          </div>
          <div class="relative">
            <input id="pet-wgr" type="number" min="0" max="999" value="${esc(d.weightGr||'')}" placeholder="0" class="input-field pr-10" />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">gr</span>
          </div>
        </div>
        <p class="text-xs text-gray-400 mt-1">Ej: 4 kg 500 gr → ingresa 4 en kilos y 500 en gramos</p>
      </div>
      <!-- Estado reproductivo + Chip: 1 col en mobile -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="form-label">Estado reproductivo</label>
          <select id="pet-repro" class="input-field">
            ${['Entero/a','Esterilizado/a','Castrado/a'].map(s => `<option ${d.reproductiveStatus===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="form-label">Nro. de chip</label>
          <input id="pet-chip" type="text" value="${esc(d.chipNumber||'')}" placeholder="123456789" class="input-field" />
        </div>
      </div>
      <div>
        <label class="form-label">Nivel de actividad</label>
        <div class="flex gap-3 mt-1">
          ${[{v:1,l:'Bajo'},{v:2,l:'Medio'},{v:3,l:'Alto'}].map(a => `
            <button type="button" onclick="setActivity(${a.v})" id="act-${a.v}"
              class="flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all
              ${(d.activityLevel||2)===a.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}">
              ${a.l}
            </button>`).join('')}
        </div>
      </div>
      <div>
        <label class="form-label">Personalidad (selecciona varios)</label>
        <div class="flex flex-wrap gap-2 mt-1" id="tag-container">
          ${tags.map(t => `
            <button type="button" onclick="toggleTag('${t}')"
              class="tag ${(d.personalityTags||[]).includes(t) ? 'selected' : ''}">${t}</button>`).join('')}
        </div>
      </div>
    </div>`;
}

export function stepHealth() {
  const d = state.newPetData;
  const allergyOpts = ['Pollo','Pescado','Pasto','Polen','Ácaros','Maíz','Trigo','Soya','Lácteos'];
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-4">Salud inicial</h2>
    <div class="space-y-4">
      <div>
        <label class="form-label">Alergias conocidas</label>
        <div class="flex flex-wrap gap-2 mt-1">
          ${allergyOpts.map(a => `
            <button type="button" onclick="toggleAllergy('${a}')"
              class="tag ${(d.allergies||[]).includes(a) ? 'selected' : ''}">${a}</button>`).join('')}
        </div>
      </div>
      <div>
        <label class="form-label">Condiciones crónicas <span class="text-gray-400 font-normal">(selecciona una o más)</span></label>
        <div class="flex flex-wrap gap-2 mt-1">
          ${['Ninguna','Diabetes','Epilepsia','Hipotiroidismo','Hipertiroidismo','Displasia de cadera','Displasia de codo','Enfermedad renal crónica','Enfermedad cardíaca','Artritis','Obesidad','Cushing','Addison','Pancreatitis crónica','Enfermedad inflamatoria intestinal','Asma','Dermatitis atópica','Cáncer','Cataratas','Glaucoma','Otra'].map(c => `
            <button type="button" onclick="toggleCondition('${c}')"
              class="tag ${(d.chronicConditions||[]).includes(c) ? 'selected' : ''}">${c}</button>`).join('')}
        </div>
      </div>
      <hr class="border-gray-100" />
      <h3 class="font-semibold text-gray-700 text-sm">Veterinario de cabecera <span class="text-gray-400 font-normal">(opcional)</span></h3>
      <div class="space-y-3">
        <div>
          <label class="form-label">Nombre del veterinario</label>
          <input id="vet-name" type="text" value="${esc(d.vet?.name||'')}" placeholder="Dr. García" class="input-field" />
        </div>
        <div>
          <label class="form-label">Clínica</label>
          <input id="vet-clinic" type="text" value="${esc(d.vet?.clinic||'')}" placeholder="Clínica Veterinaria" class="input-field" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="form-label">Teléfono</label>
            <input id="vet-phone" type="tel" value="${esc(d.vet?.phone||'')}" placeholder="+56 9 1234 5678" class="input-field" />
          </div>
          <div>
            <label class="form-label">Email</label>
            <input id="vet-email" type="email" value="${esc(d.vet?.email||'')}" placeholder="vet@clinica.cl" class="input-field" />
          </div>
        </div>
      </div>
    </div>`;
}

export function stepTutors() {
  const d = state.newPetData;
  return `
    <h2 class="text-lg font-bold text-gray-900 mb-4">Gestión de tutores</h2>
    <div class="space-y-4">
      <div class="bg-brand-50 border border-brand-100 rounded-xl p-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white font-bold">
            ${esc((state.user?.name||'U')[0].toUpperCase())}
          </div>
          <div>
            <div class="font-medium text-gray-900 text-sm">${esc(state.user?.name || 'Tu nombre')}</div>
            <div class="text-xs text-gray-500">${esc(state.user?.email || '')}</div>
            <span class="badge bg-brand-100 text-brand-700 mt-1">Tutor principal</span>
          </div>
        </div>
      </div>
      <div>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" id="add-tutor2" class="rounded text-brand-500" onchange="toggleTutor2(this)" ${d.tutor2?.name?'checked':''} />
          <span class="text-sm font-medium text-gray-700">Agregar segundo tutor</span>
        </label>
      </div>
      <div id="tutor2-fields" class="${d.tutor2?.name?'':'hidden'} space-y-3 p-4 border border-gray-200 rounded-xl">
        <div>
          <label class="form-label">Nombre</label>
          <input id="t2-name" type="text" value="${esc(d.tutor2?.name||'')}" placeholder="Nombre del segundo tutor" class="input-field" />
        </div>
        <div>
          <label class="form-label">Email</label>
          <input id="t2-email" type="email" value="${esc(d.tutor2?.email||'')}" placeholder="email@ejemplo.com" class="input-field" />
        </div>
        <div>
          <label class="form-label">Permisos</label>
          <select id="t2-role" class="input-field">
            <option value="edicion" ${d.tutor2?.role==='edicion'?'selected':''}>Edición</option>
            <option value="lectura" ${d.tutor2?.role==='lectura'?'selected':''}>Solo lectura</option>
          </select>
        </div>
      </div>
      <div class="bg-teal-50 rounded-xl p-4 text-sm text-teal-700">
        Tu mascota quedará registrada con toda la información ingresada. ¡Podrás editarla en cualquier momento!
      </div>
    </div>`;
}

export function viewPetProfile() {
  const pet = state.pets.find(p => p.id === state.currentPetId);
  if (!pet) { navigate('pets'); return ''; }
  const tabs = ['general','vacunas','desparasitación','medicamentos','historial','seguimiento','nutricion'];
  const tabLabels = { general:'General', vacunas:'Vacunas', 'desparasitación':'Desparasitación', medicamentos:'Tratamiento', historial:'Historial', seguimiento:'Seguimiento', nutricion:'Nutrición' };
  const tab = state.currentTab;

  return appShell(`
    <div class="max-w-3xl mx-auto">
      <button onclick="navigate('pets')" class="print:hidden flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Mis Mascotas
      </button>
      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5 mb-4">
        <div class="flex items-start gap-3 md:gap-4">
          <div class="flex-shrink-0">${petAvatar(pet, 'lg')}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <h1 class="text-lg md:text-xl font-bold text-gray-900 truncate">${esc(pet.name)}</h1>
                <div class="text-xs md:text-sm text-gray-400">${esc(pet.species)} · ${esc(pet.breed || 'Mestizo')}${pet.sex ? ` · ${esc(pet.sex)}` : ''}</div>
                <div class="text-xs md:text-sm text-gray-400">${getAge(pet.dateOfBirth)}</div>
              </div>
              <div class="print:hidden flex gap-1.5 flex-shrink-0">
                <button onclick="openEditPetModal('${pet.id}')"
                  title="Editar"
                  class="w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-xl bg-gray-50 hover:bg-brand-50 text-gray-500 hover:text-brand-600 border border-gray-200 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span class="hidden md:inline">Editar</span>
                </button>
                <button onclick="confirmDeletePet('${pet.id}')"
                  title="Eliminar"
                  class="w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-xl bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 border border-gray-200 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  <span class="hidden md:inline">Eliminar</span>
                </button>
                <button onclick="exportPetRecord('${pet.id}')"
                  title="Exportar expediente"
                  class="w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-xl bg-gray-50 hover:bg-teal-50 text-gray-400 hover:text-teal-600 border border-gray-200 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <span class="hidden md:inline">Exportar</span>
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">
              ${(pet.personalityTags||[]).map(t => `<span class="tag text-xs">${esc(t)}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="print:hidden bg-white rounded-2xl shadow-sm mb-4 relative">
        <div class="overflow-x-auto" style="scrollbar-width:none;-webkit-overflow-scrolling:touch">
          <div class="flex border-b border-gray-100" style="min-width:max-content">
            ${tabs.map(t => `
              <button onclick="setTab('${t}')"
                class="px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${tab===t ? 'text-brand-600 border-b-2 border-brand-500' : 'text-gray-500 hover:text-gray-700'}">
                ${tabLabels[t]}
              </button>`).join('')}
          </div>
        </div>
        <div class="pointer-events-none absolute right-0 top-0 bottom-0 w-8 rounded-r-2xl md:hidden"
          style="background:linear-gradient(to left,rgba(255,255,255,1),rgba(255,255,255,0))"></div>
      </div>

      <div class="pet-tab-content animate-fade-in">
        ${tab === 'general'        ? tabGeneral(pet)         : ''}
        ${tab === 'vacunas'        ? tabVaccines(pet)        : ''}
        ${tab === 'desparasitación' ? tabDeworming(pet)      : ''}
        ${tab === 'medicamentos'   ? tabMedications(pet)     : ''}
        ${tab === 'historial'      ? tabHistory(pet)         : ''}
        ${tab === 'seguimiento'    ? tabSeguimiento(pet)     : ''}
        ${tab === 'nutricion'      ? tabNutricion(pet)       : ''}
      </div>
    </div>
  `);
}

// Barra de progreso del perfil + los próximos pasos (el de mayor peso primero).
// Solo la ve quien puede editar la mascota: un tutor de solo lectura no puede completarla.
export function petCompletenessCard(pet, { compact = false } = {}) {
  if (!canEditPet(pet)) return '';
  const c = petCompleteness(pet);
  const id = safeId(pet.id);
  if (c.percent >= 100) {
    return compact ? '' : `<div class="bg-green-50 rounded-2xl p-4 mb-4 flex items-center gap-3"><span class="badge bg-green-100 text-green-700 text-xs font-bold flex-shrink-0">${icon('check','w-3 h-3')} Perfil completo</span><span class="text-sm text-green-700">El perfil de ${esc(pet.name)} está al 100 %.</span></div>`;
  }
  const next = c.missing.slice(0, compact ? 2 : 3);
  return `
    <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5 ${compact ? '' : 'mb-4'}">
      <div class="flex items-center justify-between gap-3 mb-2">
        <h3 class="font-semibold text-gray-900 text-sm md:text-base">${compact ? 'Completa el perfil de' : 'Perfil de'} ${esc(pet.name)}</h3>
        <span class="text-sm font-bold text-brand-600 flex-shrink-0">${c.percent} %</span>
      </div>
      <div class="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow="${c.percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Perfil completado"><div class="h-2 rounded-full bg-brand-500" style="width:${c.percent}%"></div></div>
      <div class="mt-3 space-y-1.5">
        ${next.map(m => `
        <button onclick="completionAction('${id}','${m.key}')" class="w-full flex items-center gap-3 text-left px-3 py-2 rounded-xl border border-gray-200 hover:bg-brand-50 transition-colors">
          <span class="badge bg-brand-100 text-brand-700 text-xs font-bold flex-shrink-0">+${m.gain} %</span>
          <span class="min-w-0"><span class="block text-sm font-medium text-gray-900">${m.label}</span>${m.hint ? `<span class="block text-xs text-gray-500">${m.hint}</span>` : ''}</span>
        </button>`).join('')}
      </div>
    </div>`;
}

// Un clic en un paso pendiente: abre el formulario que lo resuelve.
export function completionAction(petId, key) {
  const pet = state.pets.find(p => p.id === petId);
  const field = COMPLETENESS_FIELDS.find(f => f.key === key);
  if (!pet || !field) return;
  track('profile_completion_click', { field: key });
  if (field.action === 'vaccine') openVaccineModal(petId);
  else if (field.action === 'deworm') openDewormModal(petId);
  else if (field.action === 'food') { navigate('petProfile', { currentPetId: petId, currentTab: 'nutricion' }); openFoodItemModal(petId); }
  else openEditPetModal(petId);
}

export function tabGeneral(pet) {
  return `
    ${petCompletenessCard(pet)}
    <div class="grid md:grid-cols-2 gap-4">
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <h3 class="font-semibold text-gray-700 mb-3">Datos básicos</h3>
        <dl class="space-y-2 text-sm">
          ${infoRow('Especie', esc(pet.species))} ${infoRow('Raza', esc(pet.breed||'Mestizo'))}
          ${infoRow('Sexo', esc(pet.sex))} ${infoRow('Nacimiento', formatDate(pet.dateOfBirth))}
          ${infoRow('Edad', getAge(pet.dateOfBirth))}
        </dl>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <h3 class="font-semibold text-gray-700 mb-3">Datos físicos</h3>
        <dl class="space-y-2 text-sm">
          ${infoRow('Color', esc(pet.color))} ${infoRow('Tamaño', esc(pet.sizeRange))}
          ${infoRow('Peso', pet.weightKg ? `${esc(pet.weightKg)} kg ${esc(pet.weightGr||0)} gr` : '—')}
          ${infoRow('Estado reproductivo', esc(pet.reproductiveStatus))}
          ${infoRow('Nro. chip', esc(pet.chipNumber||'Sin chip'))}
          ${infoRow('Nivel actividad', ['','Bajo','Medio','Alto'][pet.activityLevel]||'—')}
        </dl>
      </div>
      ${pet.allergies?.length||pet.chronicConditions ? `
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <h3 class="font-semibold text-gray-700 mb-3">Salud</h3>
        <dl class="space-y-2 text-sm">
          ${infoRow('Alergias', esc((pet.allergies||[]).join(', ')||'Ninguna'))}
          ${infoRow('Condiciones crónicas', esc(Array.isArray(pet.chronicConditions) ? (pet.chronicConditions.join(', ')||'Ninguna') : (pet.chronicConditions||'Ninguna')))}
        </dl>
      </div>` : ''}
      ${pet.vet?.name ? `
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <h3 class="font-semibold text-gray-700 mb-3">Veterinario</h3>
        <dl class="space-y-2 text-sm">
          ${infoRow('Nombre', esc(pet.vet.name))} ${infoRow('Clínica', esc(pet.vet.clinic))}
          ${infoRow('Teléfono', pet.vet.phone ? `<span>${esc(pet.vet.phone)}</span>
            ${pet.vet.phone ? `<a href="https://wa.me/${pet.vet.phone.replace(/\D/g,'')}" target="_blank"
              class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.932-1.414C8.354 21.481 10.146 22 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/></svg>
              WhatsApp</a>` : ''}` : '—')}
          ${infoRow('Email', pet.vet.email ? `<a href="mailto:${encodeURIComponent(pet.vet.email)}" class="text-brand-600 hover:underline">${esc(pet.vet.email)}</a>` : '—')}
        </dl>
      </div>` : ''}
      <div class="bg-white rounded-2xl shadow-sm p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold text-gray-700 flex items-center gap-1.5">Segundo Tutor ${!isPremium() ? '<span class="badge bg-brand-100 text-brand-700 text-[10px] font-bold uppercase tracking-wide">Premium</span>' : ''}</h3>
          ${(!pet.myRole || pet.myRole === 'owner') ? (pet.tutor2?.name
            ? `<button onclick="removeTutor2('${pet.id}')" class="text-xs text-red-500 hover:underline">${pet.tutor2.pending ? 'Cancelar invitación' : 'Quitar tutor'}</button>`
            : `<button onclick="openInviteTutor2Modal('${pet.id}')" class="btn-primary text-xs">+ Invitar</button>`) : ''}
        </div>
        ${pet.tutor2?.name
          ? `<div class="flex items-center gap-3">
               <div class="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600">${esc(pet.tutor2.name[0].toUpperCase())}</div>
               <div>
                 <div class="text-sm font-medium text-gray-900">${esc(pet.tutor2.name)} ${pet.tutor2.pending ? '<span class="badge bg-amber-100 text-amber-600 ml-1">Invitación pendiente</span>' : ''}</div>
                 <div class="text-xs text-gray-400">${esc(pet.tutor2.email)} · <span class="capitalize">${esc(pet.tutor2.role||'lectura')}</span></div>
               </div>
             </div>`
          : `<p class="text-sm text-gray-400">Sin segundo tutor asignado. Invita a alguien para que también pueda ver y gestionar a ${esc(pet.name)}.</p>`}
      </div>
    </div>`;
}

export function infoRow(label, value) {
  return `<div class="flex justify-between"><dt class="text-gray-400">${label}</dt><dd class="font-medium text-gray-800 text-right max-w-[60%]">${value||'—'}</dd></div>`;
}

export function openEditPetModal(petId) {
  const p = state.pets.find(x => x.id === petId);
  if (!p) return;
  state.editPetData = {
    allergies: [...(p.allergies||[])], chronicConditions: [...(p.chronicConditions||[])],
    personalityTags: [...(p.personalityTags||[])], activityLevel: p.activityLevel || 2,
    photo: p.photo || null,
  };
  const allergyOpts = ['Pollo','Pescado','Pasto','Polen','Ácaros','Maíz','Trigo','Soya','Lácteos'];
  const conditionOpts = ['Ninguna','Diabetes','Epilepsia','Hipotiroidismo','Hipertiroidismo','Displasia de cadera','Displasia de codo','Enfermedad renal crónica','Enfermedad cardíaca','Artritis','Obesidad','Cushing','Addison','Pancreatitis crónica','Enfermedad inflamatoria intestinal','Asma','Dermatitis atópica','Cáncer','Cataratas','Glaucoma','Otra'];
  const personalityOpts = ['Juguetón','Cariñoso','Tranquilo','Activo','Tímido','Sociable','Independiente','Protector'];
  const sizeOpts = [
    { label: 'Pequeño', range: 'hasta 10 kg' },
    { label: 'Mediano', range: '10 – 25 kg' },
    { label: 'Grande',  range: '25 – 45 kg' },
    { label: 'Gigante', range: 'más de 45 kg' },
  ];
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-4">Editar mascota</h3>
      <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <div class="flex flex-col items-center mb-2">
          <div id="ep-photo-preview" class="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-4xl mb-2 overflow-hidden">
            ${safeDataUrl(p.photo) ? `<img src="${safeDataUrl(p.photo)}" class="w-full h-full object-cover" />` : icon('paw','w-8 h-8 text-gray-300')}
          </div>
          <label class="cursor-pointer text-sm text-brand-600 hover:underline font-medium">
            ${p.photo ? 'Cambiar foto' : 'Subir foto'} <input type="file" accept="image/*" class="hidden" onchange="previewEditPhoto(event)" />
          </label>
        </div>
        <div><label class="form-label">Nombre</label><input id="ep-name" value="${esc(p.name||'')}" class="input-field" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="form-label">Especie</label>
            <select id="ep-species" class="input-field">${['Perro','Gato','Ave','Conejo','Pez','Hámster','Reptil','Otro'].map(s=>`<option ${p.species===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div><label class="form-label">Raza</label><input id="ep-breed" value="${esc(p.breed||'')}" class="input-field" /></div>
          <div><label class="form-label">Sexo</label>
            <select id="ep-sex" class="input-field">${['Macho','Hembra'].map(s=>`<option ${p.sex===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div><label class="form-label">Color</label><input id="ep-color" value="${esc(p.color||'')}" class="input-field" /></div>
          <div><label class="form-label">Tamaño</label>
            <select id="ep-size" class="input-field">${sizeOpts.map(s=>`<option value="${s.label}" ${p.sizeRange===s.label?'selected':''}>${s.label} (${s.range})</option>`).join('')}</select>
          </div>
          <div><label class="form-label">Peso (kg)</label><input id="ep-wkg" type="number" min="0" value="${esc(p.weightKg||'')}" class="input-field" /></div>
          <div><label class="form-label">Peso (gr)</label><input id="ep-wgr" type="number" min="0" max="999" value="${esc(p.weightGr||'')}" class="input-field" /></div>
          <div><label class="form-label">Nacimiento</label><input id="ep-dob" type="date" value="${esc(p.dateOfBirth||'')}" class="input-field" /></div>
          <div><label class="form-label">Estado reproductivo</label>
            <select id="ep-repro" class="input-field">${['Entero/a','Esterilizado/a','Castrado/a'].map(s=>`<option ${p.reproductiveStatus===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="col-span-2"><label class="form-label">Nro. de chip</label><input id="ep-chip" value="${esc(p.chipNumber||'')}" class="input-field" /></div>
        </div>
        <div>
          <label class="form-label">Nivel de actividad</label>
          <div class="flex gap-3 mt-1">
            ${[{v:1,l:'Bajo'},{v:2,l:'Medio'},{v:3,l:'Alto'}].map(a => `
              <button type="button" onclick="setEditActivity(${a.v})" id="ep-act-${a.v}"
                class="flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all
                ${(p.activityLevel||2)===a.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}">
                ${a.l}
              </button>`).join('')}
          </div>
        </div>
        <div>
          <label class="form-label">Personalidad</label>
          <div class="flex flex-wrap gap-2 mt-1" id="ep-personality-tags">
            ${personalityOpts.map(t => `<button type="button" onclick="toggleEditPersonality('${t}')" class="tag ${(p.personalityTags||[]).includes(t)?'selected':''}">${t}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="form-label">Alergias conocidas</label>
          <div class="flex flex-wrap gap-2 mt-1" id="ep-allergy-tags">
            ${allergyOpts.map(a => `<button type="button" onclick="toggleEditAllergy('${a}')" class="tag ${(p.allergies||[]).includes(a)?'selected':''}">${a}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="form-label">Condiciones crónicas</label>
          <div class="flex flex-wrap gap-2 mt-1" id="ep-condition-tags">
            ${conditionOpts.map(c => `<button type="button" onclick="toggleEditCondition('${c}')" class="tag ${(p.chronicConditions||[]).includes(c)?'selected':''}">${c}</button>`).join('')}
          </div>
        </div>
        <hr class="border-gray-100" />
        <h3 class="font-semibold text-gray-700 text-sm">Veterinario de cabecera</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2"><label class="form-label">Nombre</label><input id="ep-vet-name" value="${esc(p.vet?.name||'')}" class="input-field" /></div>
          <div class="col-span-2"><label class="form-label">Clínica</label><input id="ep-vet-clinic" value="${esc(p.vet?.clinic||'')}" class="input-field" /></div>
          <div><label class="form-label">Teléfono</label><input id="ep-vet-phone" value="${esc(p.vet?.phone||'')}" class="input-field" /></div>
          <div><label class="form-label">Email</label><input id="ep-vet-email" value="${esc(p.vet?.email||'')}" class="input-field" /></div>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="saveEditPet('${petId}')" class="btn-primary flex-1">Guardar</button>
        </div>
      </div>
    </div>`);
}

export function toggleEditAllergy(a) {
  const list = state.editPetData.allergies;
  const idx = list.indexOf(a);
  if (idx >= 0) list.splice(idx,1); else list.push(a);
  document.querySelectorAll('#ep-allergy-tags .tag').forEach(el => { if (el.textContent.trim()===a) el.classList.toggle('selected', list.includes(a)); });
}

export function toggleEditCondition(c) {
  const list = state.editPetData.chronicConditions;
  if (c === 'Ninguna') {
    state.editPetData.chronicConditions = list.includes('Ninguna') ? [] : ['Ninguna'];
  } else {
    state.editPetData.chronicConditions = list.filter(x => x !== 'Ninguna');
    const idx = state.editPetData.chronicConditions.indexOf(c);
    if (idx >= 0) state.editPetData.chronicConditions.splice(idx,1); else state.editPetData.chronicConditions.push(c);
  }
  document.querySelectorAll('#ep-condition-tags .tag').forEach(el => {
    el.classList.toggle('selected', state.editPetData.chronicConditions.includes(el.textContent.trim()));
  });
}

export function toggleEditPersonality(t) {
  const tags = state.editPetData.personalityTags || (state.editPetData.personalityTags = []);
  const idx = tags.indexOf(t);
  if (idx >= 0) tags.splice(idx,1); else tags.push(t);
  document.querySelectorAll('#ep-personality-tags .tag').forEach(el => {
    if (el.textContent.trim() === t) el.classList.toggle('selected', tags.includes(t));
  });
}

export function setEditActivity(level) {
  state.editPetData.activityLevel = level;
  [1,2,3].forEach(l => {
    const btn = document.getElementById('ep-act-'+l);
    if (btn) btn.className = `flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${l===level ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`;
  });
}

export function previewEditPhoto(e) {
  const file = e.target.files[0]; if (!file) return;
  shrinkImage(file).then(dataUrl => {
    state.editPetData.photo = dataUrl;
    const preview = document.getElementById('ep-photo-preview');
    if (preview) preview.innerHTML = `<img src="${safeDataUrl(dataUrl)}" class="w-full h-full object-cover rounded-full" />`;
  });
}

export function openPet(id) { navigate('petProfile', { currentPetId: id, currentTab: 'general' }); }

export function setTab(t) { state.currentTab = t; render(); }

export function cancelAddPet() {
  collectStepData();
  const hasProgress = Object.values(state.newPetData || {}).some(v => Array.isArray(v) ? v.length : v);
  if (hasProgress && !confirm('¿Salir sin guardar? Se perderá el progreso de esta mascota.')) return;
  state.newPetData = {}; state.addPetStep = 1;
  navigate('pets');
}

export function prevStep() { if (state.addPetStep > 1) { collectStepData(); state.addPetStep--; render(); } }

export function showFieldError(fieldId, errorId) {
  document.getElementById(fieldId)?.classList.add('border-red-400');
  document.getElementById(errorId)?.classList.remove('hidden');
  document.getElementById(fieldId)?.focus();
}

export function clearFieldError(fieldId) {
  document.getElementById(fieldId)?.classList.remove('border-red-400');
  document.getElementById(fieldId + '-error')?.classList.add('hidden');
}

export function nextStep() {
  collectStepData();
  if (state.addPetStep === 1 && !state.newPetData.name?.trim()) {
    showFieldError('pet-name', 'pet-name-error');
    return;
  }
  if (state.addPetStep === 4) { savePet(); return; }
  state.addPetStep++; render();
}

export function collectStepData() {
  const d = state.newPetData;
  const g = id => document.getElementById(id);
  if (state.addPetStep === 1) {
    if (g('pet-name')) d.name = g('pet-name').value;
    if (g('pet-species')) d.species = g('pet-species').value;
    if (g('pet-sex')) d.sex = g('pet-sex').value;
    if (g('pet-breed')) d.breed = g('pet-breed').value;
    if (g('pet-dob')) d.dateOfBirth = g('pet-dob').value;
  } else if (state.addPetStep === 2) {
    if (g('pet-color')) d.color = g('pet-color').value;
    if (g('pet-size')) d.sizeRange = g('pet-size').value;
    if (g('pet-wkg')) d.weightKg = g('pet-wkg').value;
    if (g('pet-wgr')) d.weightGr = g('pet-wgr').value;
    if (g('pet-repro')) d.reproductiveStatus = g('pet-repro').value;
    if (g('pet-chip')) d.chipNumber = g('pet-chip').value;
  } else if (state.addPetStep === 3) {
    // chronicConditions se gestiona con toggleCondition()
    d.vet = {
      name: g('vet-name')?.value||'', clinic: g('vet-clinic')?.value||'',
      phone: g('vet-phone')?.value||'', email: g('vet-email')?.value||'',
    };
  } else if (state.addPetStep === 4) {
    if (g('add-tutor2')?.checked) {
      d.tutor2 = { name: g('t2-name')?.value||'', email: g('t2-email')?.value||'', role: g('t2-role')?.value||'edicion' };
    }
  }
}

export async function savePet() {
  const d = state.newPetData;
  if (!d.name) { showToast('El nombre es requerido', 'error'); state.addPetStep = 1; render(); return; }
  if (!isDemoUser()) {
    const plan = PLANS[state.user.plan] || PLANS.free;
    if (state.pets.length >= plan.petLimit) {
      showToast(`Tu plan ${plan.label} permite ${plan.petLimit} mascota${plan.petLimit!==1?'s':''}. Pásate a Premium para agregar más.`, 'error');
      return;
    }
  }
  showToast('Guardando...', '');
  const petData = {
    owner_id: state.user.id,
    name: d.name, species: d.species, breed: d.breed,
    date_of_birth: d.dateOfBirth || null, sex: d.sex, color: d.color,
    reproductive_status: d.reproductiveStatus, microchip: d.chipNumber,
    personality_tags: d.personalityTags || [],
    avatar_emoji: d.avatar || '', photo: d.photo || null,
    vet_name: d.vet?.name || '', vet_clinic: d.vet?.clinic || '',
    vet_phone: d.vet?.phone || '', vet_email: d.vet?.email || '',
    weight_kg: d.weightKg || null, weight_gr: d.weightGr || null,
    size_range: d.sizeRange || null, activity_level: d.activityLevel || 2,
    allergies: d.allergies || [], chronic_conditions: d.chronicConditions || [],
  };
  const { data: petRow, error } = await sb.from('pets').insert(petData).select().single();
  if (error) { showToast('Error al guardar mascota', 'error'); console.error(error); return; }
  const { error: accessError } = await sb.from('pet_access').insert({ pet_id: petRow.id, user_id: state.user.id, role: 'owner' });
  if (accessError) {
    // Sin esta fila la mascota queda huérfana (invisible en la próxima carga,
    // ver loadDataFromSupabase) — mejor deshacer el insert que dejarla a medias.
    await sb.from('pets').delete().eq('id', petRow.id);
    showToast('Error al guardar mascota', 'error'); console.error(accessError); return;
  }
  const pet = {
    ...d, id: petRow.id, myRole: 'owner',
    vaccines: [], deworming: [], medications: [], clinicalHistory: [],
    personalityTags: d.personalityTags || [], allergies: d.allergies || [],
    chronicConditions: d.chronicConditions || [], activityLevel: d.activityLevel || 2,
    weightHistory: [], moodLog: [], symptomsLog: [], foodItems: [], activities: [], doseLog: [],
    tutor2: null,
  };
  state.pets.push(pet);
  state.newPetData = {}; state.addPetStep = 1;
  // Si se completaron los datos del segundo tutor en el wizard, enviamos la invitación
  if (d.tutor2?.email) await createPetInvite(pet, d.tutor2);
  track('pet_created', { species: pet.species, pets_total: state.pets.length });
  showToast(`${pet.name} registrado con éxito!`, 'success');
  navigate('petProfile', { currentPetId: pet.id, currentTab: 'general' });
}

export function openDeletePetWithCode(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  const hasTwoTutors = pet.tutor2?.name;
  const email = state.user?.email || '';
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <div class="text-center mb-4">
        <div class="mb-2 flex justify-center text-red-400">${icon('trash','w-12 h-12')}</div>
        <h3 class="text-lg font-bold text-gray-900">Eliminar a ${esc(pet.name)}</h3>
        <p class="text-sm text-gray-500 mt-1">
          ${hasTwoTutors
            ? `Esta mascota tiene 2 tutores. Solo se eliminará de <strong>tu perfil</strong>. El otro tutor mantendrá acceso.`
            : `Esta acción eliminará toda la información de <strong>${esc(pet.name)}</strong> permanentemente.`}
        </p>
      </div>
      <div id="delete-step-1">
        <div class="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 mb-4">
          ${icon('warning','w-4 h-4 inline align-text-bottom')} Para confirmar, enviaremos un código de verificación a:<br/>
          <strong>${esc(email)}</strong>
        </div>
        <div class="flex gap-3">
          <button onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="sendDeleteCode('${petId}')" class="flex-1 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Enviar código
          </button>
        </div>
      </div>
      <div id="delete-step-2" class="hidden">
        <p class="text-sm text-gray-500 mb-3">Ingresa el código de verificación enviado a <strong>${esc(email)}</strong></p>
        <input id="delete-code-input" type="text" maxlength="12" placeholder="Código"
          class="input-field text-center text-2xl tracking-[0.2em] font-bold mb-1" />
        <p id="delete-code-error" class="text-xs text-red-500 text-center mb-3 hidden">Código incorrecto. Intenta nuevamente.</p>
        <div class="flex gap-3">
          <button onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="verifyDeleteCode('${petId}')" class="flex-1 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Confirmar eliminación
          </button>
        </div>
        <button onclick="sendDeleteCode('${petId}')" class="w-full text-xs text-gray-400 hover:text-gray-600 mt-2">Reenviar código</button>
      </div>
    </div>`);
}

export async function sendDeleteCode(petId) {
  state.deletePetId = petId;
  if (isDemoUser()) {
    // No hay sesión real de Supabase en modo demo — simulamos el código acá mismo.
    state.deleteCode = String(Math.floor(100000 + Math.random() * 900000));
    document.getElementById('delete-step-1').classList.add('hidden');
    document.getElementById('delete-step-2').classList.remove('hidden');
    showToast(`Código enviado a ${state.user?.email} (demo: ${state.deleteCode})`, 'success');
    return;
  }
  // Código real de un solo uso vía Supabase Auth (email OTP) — se envía por el
  // mismo SMTP configurado en el proyecto. Requiere que la plantilla "Magic Link"
  // en Supabase → Authentication → Email Templates incluya {{ .Token }}, si no,
  // el correo solo mostrará el link y no el código (su largo lo define Supabase,
  // no asumir 6 dígitos).
  const { error } = await sb.auth.signInWithOtp({ email: state.user.email, options: { shouldCreateUser: false } });
  if (error) { showToast('No se pudo enviar el código', 'error'); console.error(error); return; }
  document.getElementById('delete-step-1').classList.add('hidden');
  document.getElementById('delete-step-2').classList.remove('hidden');
  showToast(`Código enviado a ${state.user?.email}`, 'success');
}

export async function verifyDeleteCode(petId) {
  const input = document.getElementById('delete-code-input')?.value?.trim();
  const error = document.getElementById('delete-code-error');
  // Si un intento anterior falló por otra razón (ej. el borrado en Supabase,
  // más abajo en deletePet()), sin esto el aviso de "código incorrecto" de
  // esa vez quedaba pegado en pantalla aunque el código de este intento sí
  // fuera válido.
  error?.classList.add('hidden');
  document.getElementById('delete-code-input')?.classList.remove('border-red-400');
  if (isDemoUser()) {
    if (input !== state.deleteCode) {
      error?.classList.remove('hidden');
      document.getElementById('delete-code-input').classList.add('border-red-400');
      return;
    }
    deletePet(petId);
    return;
  }
  // Nuestra plantilla de correo ("Magic Link or OTP") mantiene {{ .ConfirmationURL }}
  // además de {{ .Token }} para no romper el flujo de invitación de segundo tutor,
  // que sí depende del link. Eso hace que Supabase emita el token como tipo
  // 'magiclink' en vez de 'email' — se prueban ambos tipos por robustez.
  let { error: otpError } = await sb.auth.verifyOtp({ email: state.user.email, token: input, type: 'email' });
  if (otpError) {
    ({ error: otpError } = await sb.auth.verifyOtp({ email: state.user.email, token: input, type: 'magiclink' }));
  }
  if (otpError) {
    error?.classList.remove('hidden');
    document.getElementById('delete-code-input').classList.add('border-red-400');
    return;
  }
  deletePet(petId);
}

export function confirmDeletePet(petId) { openDeletePetWithCode(petId); }

export async function deletePet(petId) {
  const pet = state.pets.find(p => p.id === petId);
  // Antes esta rama se decidía por "¿existe un tutor2?" (pet?.tutor2?.name),
  // no por si el usuario actual es el dueño — así que el dueño de una
  // mascota compartida (invitación aceptada O TODAVÍA PENDIENTE) entraba
  // por error a la rama de "salir": borraba la invitación y su propio
  // pet_access, pero nunca la fila de `pets`, dejándola huérfana en la
  // base para siempre mientras la app mostraba "eliminada permanentemente".
  const isOwner = !pet?.myRole || pet.myRole === 'owner';
  if (!isOwner) {
    // Salir de una mascota compartida es una acción sobre el propio acceso, no
    // una edición de la mascota — se permite incluso con rol de solo lectura.
    if (!isDemoUser()) {
      const { error: invError } = await sb.from('invitations').delete().eq('pet_id', petId);
      if (invError) { showToast('Error al eliminar', 'error'); console.error(invError); return; }
      // Quita solo el acceso del usuario actual — el otro tutor conserva el suyo.
      const { error } = await sb.from('pet_access').delete().eq('pet_id', petId).eq('user_id', state.user.id);
      if (error) { showToast('Error al eliminar', 'error'); console.error(error); return; }
    }
    state.pets = state.pets.filter(p => p.id !== petId);
    showToast(`${pet.name} eliminada de tu perfil`, 'success');
  } else {
    if (blockIfReadOnly(pet)) return;
    if (!isDemoUser()) {
      const { error } = await sb.from('pets').delete().eq('id', petId);
      if (error) { showToast('Error al eliminar', 'error'); return; }
    }
    state.pets = state.pets.filter(p => p.id !== petId);
    showToast(`${pet?.name} eliminada`, 'error');
  }
  state.deleteCode = null; state.deletePetId = null;
  closeModal(); navigate('pets');
}

export async function saveEditPet(petId) {
  const p = state.pets.find(x => x.id === petId);
  if (!p) return;
  if (blockIfReadOnly(p)) return;
  const g = id => document.getElementById(id)?.value;
  const name = g('ep-name') || p.name;
  const species = g('ep-species') || p.species;
  const breed = g('ep-breed');
  const sex = g('ep-sex'), color = g('ep-color');
  const weightKg = g('ep-wkg') || null, weightGr = g('ep-wgr') || null;
  const dateOfBirth = g('ep-dob');
  const reproductiveStatus = g('ep-repro');
  const chipNumber = g('ep-chip');
  const vet = { name: g('ep-vet-name')||'', clinic: g('ep-vet-clinic')||'', phone: g('ep-vet-phone')||'', email: g('ep-vet-email')||'' };
  const sizeRange = g('ep-size');
  const allergies = state.editPetData?.allergies || p.allergies || [];
  const chronicConditions = state.editPetData?.chronicConditions || p.chronicConditions || [];
  const personalityTags = state.editPetData?.personalityTags || p.personalityTags || [];
  const activityLevel = state.editPetData?.activityLevel || p.activityLevel || 2;
  const photo = state.editPetData?.photo ?? p.photo ?? null;
  if (!isDemoUser()) {
    const { error } = await sb.from('pets').update({
      name, species, breed, date_of_birth: dateOfBirth || null, sex, color,
      reproductive_status: reproductiveStatus, microchip: chipNumber,
      weight_kg: weightKg, weight_gr: weightGr, size_range: sizeRange || null,
      activity_level: activityLevel, personality_tags: personalityTags,
      allergies, chronic_conditions: chronicConditions, photo,
      vet_name: vet.name, vet_clinic: vet.clinic, vet_phone: vet.phone, vet_email: vet.email,
    }).eq('id', petId);
    if (error) { showToast('Error al guardar', 'error'); console.error(error); return; }
  }
  Object.assign(p, { name, species, breed, dateOfBirth, sex, color, weightKg, weightGr,
    reproductiveStatus, chipNumber, sizeRange, activityLevel, personalityTags, photo,
    allergies, chronicConditions, vet });
  state.editPetData = null;
  closeModal(); render();
  showToast('Cambios guardados', 'success');
}

export function previewPhoto(e) {
  const file = e.target.files[0]; if (!file) return;
  shrinkImage(file).then(dataUrl => {
    state.newPetData.photo = dataUrl;
    const preview = document.getElementById('photo-preview');
    if (preview) preview.innerHTML = `<img src="${safeDataUrl(dataUrl)}" class="w-full h-full object-cover rounded-full" />`;
  });
}

export function setActivity(level) {
  state.newPetData.activityLevel = level;
  [1,2,3].forEach(l => {
    const btn = document.getElementById('act-'+l);
    if (btn) btn.className = `flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${l===level ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-brand-300'}`;
  });
}

export function toggleTag(t) {
  const tags = state.newPetData.personalityTags || [];
  const idx = tags.indexOf(t);
  if (idx >= 0) tags.splice(idx,1); else tags.push(t);
  state.newPetData.personalityTags = tags;
  document.querySelectorAll('.tag').forEach(el => {
    if (el.textContent.trim() === t) el.classList.toggle('selected', tags.includes(t));
  });
}

export function toggleCondition(c) {
  if (!state.newPetData.chronicConditions) state.newPetData.chronicConditions = [];
  const list = state.newPetData.chronicConditions;
  if (c === 'Ninguna') {
    state.newPetData.chronicConditions = list.includes('Ninguna') ? [] : ['Ninguna'];
  } else {
    state.newPetData.chronicConditions = list.filter(x => x !== 'Ninguna');
    const idx = state.newPetData.chronicConditions.indexOf(c);
    if (idx >= 0) state.newPetData.chronicConditions.splice(idx, 1); else state.newPetData.chronicConditions.push(c);
  }
  document.querySelectorAll('.tag').forEach(el => {
    const val = el.textContent.trim();
    if (['Ninguna','Diabetes','Epilepsia','Hipotiroidismo','Hipertiroidismo','Displasia de cadera','Displasia de codo','Enfermedad renal crónica','Enfermedad cardíaca','Artritis','Obesidad','Cushing','Addison','Pancreatitis crónica','Enfermedad inflamatoria intestinal','Asma','Dermatitis atópica','Cáncer','Cataratas','Glaucoma','Otra'].includes(val)) {
      el.classList.toggle('selected', state.newPetData.chronicConditions.includes(val));
    }
  });
}

export function toggleAllergy(a) {
  const allergies = state.newPetData.allergies || [];
  const idx = allergies.indexOf(a);
  if (idx >= 0) allergies.splice(idx,1); else allergies.push(a);
  state.newPetData.allergies = allergies;
  document.querySelectorAll('.tag').forEach(el => {
    if (el.textContent.trim() === a) el.classList.toggle('selected', allergies.includes(a));
  });
}

export function toggleTutor2(el) {
  const fields = document.getElementById('tutor2-fields');
  if (fields) fields.classList.toggle('hidden', !el.checked);
}

export function updateBreedOptions(species) {
  const select = document.getElementById('pet-breed');
  if (!select) return;
  const breeds = BREEDS[species] || BREEDS.Otro;
  select.innerHTML = breeds.map(b => `<option ${b==='Mestizo'?'selected':''}>${b}</option>`).join('');
}

// El expediente exportado siempre incluye las 5 secciones completas
// (General, Vacunas, Desparasitaciones, Tratamiento, Historial) sin
// importar en qué pestaña de la ficha estaba el usuario al hacer clic en
// "Exportar" — antes el print imprimía la página detrás del modal, así
// que el resultado dependía de la pestaña activa (ver pet-tab-content /
// body:has(.modal-overlay) en injectStyles()).
export function exportPetRecord(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfNotPremium('Exportar el expediente')) return;
  const vet = pet.vet || {};
  const vaccines = [...(pet.vaccines||[])].sort((a,b)=>b.date>a.date?1:-1);
  const dewormings = [...(pet.deworming||[])].sort((a,b)=>b.date>a.date?1:-1);
  const meds = [...(pet.medications||[])].sort((a,b)=>b.startDate>a.startDate?1:-1);
  const history = [...(pet.clinicalHistory||[])].sort((a,b)=>b.date>a.date?1:-1);

  const printSection = (title, rows) => rows.length ? `
    <div class="mb-4 break-inside-avoid">
      <h5 class="font-semibold text-gray-700 text-sm mb-2 border-b border-gray-100 pb-1">${title}</h5>
      <div class="space-y-1.5">${rows.join('')}</div>
    </div>` : `
    <div class="mb-4">
      <h5 class="font-semibold text-gray-700 text-sm mb-2 border-b border-gray-100 pb-1">${title}</h5>
      <p class="text-xs text-gray-400">Sin registros</p>
    </div>`;

  openModal(`
    <div class="modal-box p-4 sm:p-6" id="export-record">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-900 flex items-center gap-2">${icon('document','w-5 h-5')} Expediente médico — ${esc(pet.name)}</h3>
        <button onclick="closeModal()" class="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center">✕</button>
      </div>

      <div id="printable-record">
        <div class="border-b border-gray-200 pb-4 mb-4">
          <h4 class="font-bold text-gray-800 text-lg">${esc(pet.name)}</h4>
          <p class="text-sm text-gray-500">${esc(pet.species)} · ${esc(pet.breed||'Mestizo')} · ${esc(pet.sex||'')} · ${getAge(pet.dateOfBirth)}</p>
          ${pet.chipNumber ? `<p class="text-xs text-gray-400">Chip: ${esc(pet.chipNumber)}</p>` : ''}
          ${pet.reproductiveStatus ? `<p class="text-xs text-gray-400">${esc(pet.reproductiveStatus)}</p>` : ''}
          ${(pet.allergies||[]).length ? `<p class="text-xs text-red-500 font-medium">Alergias: ${esc(pet.allergies.join(', '))}</p>` : ''}
          ${(pet.chronicConditions||[]).filter(c=>c!=='Ninguna').length ? `<p class="text-xs text-orange-600 font-medium">Condiciones: ${esc(pet.chronicConditions.join(', '))}</p>` : ''}
        </div>

        <div class="mb-4 break-inside-avoid">
          <h5 class="font-semibold text-gray-700 text-sm mb-2 border-b border-gray-100 pb-1">General</h5>
          <dl class="space-y-1 text-xs text-gray-600">
            ${infoRow('Color', esc(pet.color))} ${infoRow('Tamaño', esc(pet.sizeRange))}
            ${infoRow('Peso', pet.weightKg ? `${pet.weightKg} kg ${pet.weightGr||0} gr` : '—')}
            ${infoRow('Nivel actividad', ['','Bajo','Medio','Alto'][pet.activityLevel]||'—')}
          </dl>
          ${vet.name ? `
          <p class="text-xs text-gray-600 mt-2"><span class="font-medium">Veterinario:</span> ${esc(vet.name)}${vet.clinic ? ` · ${esc(vet.clinic)}` : ''}${vet.phone ? ` · ${esc(vet.phone)}` : ''}</p>` : ''}
        </div>

        ${printSection('Vacunas', vaccines.map(v => `
          <div class="text-xs bg-blue-50 rounded-lg p-2">
            <span class="font-medium">${esc(v.name)}</span> · Aplicada: ${formatDate(v.date)}${v.nextDate ? ` · Próxima: ${formatDate(v.nextDate)}` : ''}${v.code ? ` · Código: ${esc(v.code)}` : ''}
          </div>`))}

        ${printSection('Desparasitaciones', dewormings.map(d => `
          <div class="text-xs bg-teal-50 rounded-lg p-2">
            <span class="font-medium">${esc(d.product)}</span> (${esc(d.type)}) · ${esc(d.format)} · Dosis: ${esc(d.dose)} ${esc(d.unit)} · ${formatDate(d.date)}${d.nextDate ? ` · Próxima: ${formatDate(d.nextDate)}` : ''}
          </div>`))}

        ${printSection('Tratamiento', meds.map(m => `
          <div class="text-xs bg-green-50 rounded-lg p-2">
            <span class="font-medium">${esc(m.name)}</span> ${m.active ? '· Activo' : '· Finalizado'} · ${esc(m.dose || `${m.doseVal||''} ${m.doseUnit||''}`)} · ${esc(m.frequency)} · ${formatDate(m.startDate)}${m.endDate ? ` → ${formatDate(m.endDate)}` : ''}
          </div>`))}

        ${printSection('Historial clínico', history.map(h => `
          <div class="text-xs bg-gray-50 rounded-lg p-2">
            <span class="font-medium">${formatDate(h.date)}</span> · ${esc(h.title)} (${esc(h.type)})${h.doctor ? ` · ${esc(h.doctor)}` : ''}${h.notes ? `<br>${esc(h.notes)}` : ''}${h.cost ? `<br>Costo: ${fmtCLP(h.cost)}` : ''}${(h.files||[]).length ? `<br>${h.files.length} archivo${h.files.length!==1?'s':''} adjunto${h.files.length!==1?'s':''}` : ''}
          </div>`))}

        <p class="text-xs text-gray-300 text-right mt-4">Generado por Mascodata · ${new Date().toLocaleDateString('es-CL')}</p>
      </div>

      <div class="flex gap-3 pt-4 border-t border-gray-100 mt-4">
        <button onclick="closeModal()" class="btn-secondary flex-1">Cerrar</button>
        <button onclick="printPetRecord('${safeId(pet.id)}')" class="btn-primary flex-1 flex items-center justify-center gap-1.5">${icon('printer','w-4 h-4')} Imprimir / Guardar PDF</button>
      </div>
    </div>`);
}

// El título del documento es lo que Chrome usa como nombre de archivo por
// defecto en "Guardar como PDF" y como encabezado impreso — sin esto,
// tanto el PDF como el encabezado quedaban con el nombre genérico de la
// pestaña ("Mascodata — Gestión Integral de Mascotas") en vez del nombre
// de la mascota.
export function printPetRecord(petId) {
  const petName = state.pets.find(p => p.id === petId)?.name || '';
  const prevTitle = document.title;
  document.title = `Expediente médico - ${petName}`;
  track('expediente_exported');
  window.print();
  document.title = prevTitle;
}

export function openInviteTutor2Modal(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  if (blockIfNotPremium('Compartir con un segundo tutor')) return;
  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <h3 class="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">${icon('users','w-5 h-5')} Invitar Segundo Tutor</h3>
      <p class="text-sm text-gray-500 mb-4">El invitado recibirá un correo para crear su cuenta y acceder a <strong>${esc(pet.name)}</strong>.</p>
      <form onsubmit="sendTutor2Invite(event,'${petId}')" class="space-y-3">
        <div><label class="form-label">Nombre del tutor *</label><input id="t2-inv-name" required placeholder="Nombre completo" class="input-field" /></div>
        <div><label class="form-label">Email *</label><input id="t2-inv-email" type="email" required placeholder="correo@ejemplo.com" class="input-field" /></div>
        <div><label class="form-label">Tipo de acceso</label>
          <select id="t2-inv-role" class="input-field">
            <option value="lectura">Solo lectura</option>
            <option value="edicion">Edición completa</option>
          </select>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button type="submit" class="btn-primary flex-1 flex items-center justify-center gap-1.5">${icon('mail','w-4 h-4')} Enviar invitación</button>
        </div>
      </form>
    </div>`);
}

export async function createPetInvite(pet, { name, email, role }) {
  if (isDemoUser()) {
    pet.tutor2 = { name, email, role, pending: true };
    showToast(`Invitación simulada para ${email} (modo demo)`, 'success');
    return true;
  }
  const token = genId() + genId();
  const link = `${location.origin}${location.pathname}?invite=${token}`;
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const { error: inviteError } = await sb.from('invitations').insert({
    token, pet_id: pet.id, pet_name: pet.name, inviter_id: state.user.id,
    invited_email: email, invited_name: name, role, used: false, expires_at: expiresAt,
  });
  if (inviteError) { showToast('Error al crear la invitación', 'error'); console.error(inviteError); return false; }
  // Enviado vía Supabase Auth (magic link) en vez de un tercero: requiere SMTP
  // configurado en el proyecto de Supabase (Auth → Emails → SMTP Settings).
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: link,
      data: { invited_name: name, pet_name: pet.name, inviter_name: state.user?.name || '', role },
    },
  });
  if (error) { showToast('Error al enviar el correo de invitación', 'error'); console.error(error); return false; }
  pet.tutor2 = { name, email, role, pending: true };
  showToast(`Invitación enviada a ${email}`, 'success');
  return true;
}

export async function acceptPetInvite(token) {
  const { data: invite, error } = await sb.from('invitations').select('*').eq('token', token).eq('used', false).maybeSingle();
  if (error || !invite) return;
  if ((invite.invited_email || '').toLowerCase() !== (state.user?.email || '').toLowerCase()) {
    showToast('Esta invitación fue enviada a otro correo', 'error');
    return;
  }
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    showToast('Esta invitación ya expiró', 'error');
    return;
  }
  const { error: accessError } = await sb.from('pet_access').insert({
    pet_id: invite.pet_id, user_id: state.user.id, role: invite.role === 'edicion' ? 'editor' : 'viewer'
  });
  if (accessError) { showToast('No se pudo aceptar la invitación', 'error'); console.error(accessError); return; }
  await sb.from('invitations').update({ used: true }).eq('token', token);
  showToast(`Ahora tienes acceso a ${invite.pet_name}`, 'success');
  await loadDataFromSupabase();
}

export async function sendTutor2Invite(e, petId) {
  e.preventDefault();
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  const name  = document.getElementById('t2-inv-name')?.value?.trim();
  const email = document.getElementById('t2-inv-email')?.value?.trim().toLowerCase();
  const role  = document.getElementById('t2-inv-role')?.value;
  const ok = await createPetInvite(pet, { name, email, role });
  if (ok) { track('invite_sent', { role }); closeModal(); render(); }
}

export async function removeTutor2(petId) {
  const pet = state.pets.find(p => p.id === petId);
  if (!pet) return;
  // Solo el dueño puede quitar al segundo tutor: si lo llamara el propio tutor2,
  // `.neq('user_id', state.user.id)` de abajo borraría el acceso del DUEÑO en vez
  // del suyo — esto asume exactamente un dueño + un tutor2, que es lo único que
  // este modelo de datos soporta.
  if (pet.myRole && pet.myRole !== 'owner') {
    showToast('Solo el tutor principal puede quitar al segundo tutor', 'error');
    return;
  }
  if (!confirm(`¿Quitar a ${pet.tutor2?.name} como segundo tutor de ${pet.name}?`)) return;
  if (!isDemoUser()) {
    const { error: invError } = await sb.from('invitations').delete().eq('pet_id', petId).eq('invited_email', pet.tutor2.email);
    if (invError) { showToast('Error al quitar el tutor', 'error'); console.error(invError); return; }
    if (!pet.tutor2.pending) {
      // Ya había aceptado la invitación: también se le quita el acceso a la mascota
      const { error: accessError } = await sb.from('pet_access').delete().eq('pet_id', petId).neq('user_id', state.user.id);
      if (accessError) { showToast('Error al quitar el tutor', 'error'); console.error(accessError); return; }
    }
  }
  pet.tutor2 = null; render();
  showToast('Segundo tutor eliminado', 'success');
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    viewPets, viewAddPet, stepBasic, stepPhysical, stepHealth, stepTutors,
    viewPetProfile, tabGeneral, infoRow, openEditPetModal, toggleEditAllergy,
    toggleEditCondition, toggleEditPersonality, setEditActivity, previewEditPhoto,
    openPet, setTab, cancelAddPet, prevStep, showFieldError, clearFieldError,
    nextStep, collectStepData, savePet, openDeletePetWithCode, sendDeleteCode,
    verifyDeleteCode, confirmDeletePet, deletePet, saveEditPet, previewPhoto,
    setActivity, toggleTag, toggleCondition, toggleAllergy, toggleTutor2,
    updateBreedOptions, petCompletenessCard, completionAction, exportPetRecord, printPetRecord, openInviteTutor2Modal, createPetInvite,
    acceptPetInvite, sendTutor2Invite, removeTutor2,
  });
}
