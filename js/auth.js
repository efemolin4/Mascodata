/* ============================================================
   MASCODATA — Autenticación y datos de demo
   ============================================================
   Fase 2 de la modularización (ver js/utils.js para el porqué de la
   convención export + window.assign). Vistas de login/registro/recuperar
   contraseña, sus controladores, logout, y la carga de datos de prueba
   (modo demo). */

// El logo "G" oficial de Google para el botón "Continuar con Google" — no es
// parte del set de íconos de línea de la app (currentColor), va siempre en
// sus 4 colores de marca tal como Google pide que se use.
function googleIcon() {
  return `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
    <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.348 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
  </svg>`;
}

// Redirige a Google y vuelve a la app ya con sesión — supabase-js detecta el
// token en la URL de vuelta solo (detectSessionInUrl, activado por defecto),
// así que initApp() (que ya corre en cada carga) encuentra la sesión con
// sb.auth.getSession() como si fuera cualquier otra: crea/actualiza su fila
// en profiles y sigue el flujo normal, sin lógica aparte para OAuth.
export async function signInWithGoogle() {
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) { showToast('No se pudo iniciar sesión con Google', 'error'); console.error(error); }
}

// ---- VISTA: LOGIN ----
export function viewLogin() {
  return `
  <div class="min-h-screen flex">
    <div class="hidden lg:flex lg:w-1/2 bg-brand-gradient items-center justify-center p-12 relative overflow-hidden">
      <div class="relative text-center text-white">
        <div class="mb-6 flex justify-center">
          <svg viewBox="0 0 64 64" class="w-20 h-20" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mascodata"><rect x="14" y="19" width="9" height="12" rx="4.5" fill="#FFF8F0"/><rect x="27.5" y="14" width="9" height="17" rx="4.5" fill="#FFF8F0"/><rect x="41" y="9" width="9" height="22" rx="4.5" fill="#FFF8F0"/><path fill="#FFF8F0" d="M32 35c6.5 0 10.5 4.2 13.2 8.6 2.6 4.2 1 9.4-4 9.4-3.4 0-5.6-1.6-9.2-1.6s-5.8 1.6-9.2 1.6c-5 0-6.6-5.2-4-9.4C21.5 39.2 25.5 35 32 35z"/></svg>
        </div>
        <h1 class="text-4xl font-bold mb-3"><span style="color:#F2865E">Masco</span><span style="color:#FFF8F0">da</span><span style="color:#F2865E">ta</span></h1>
        <p class="text-lg text-white/85 max-w-xs mx-auto">Tu compañero digital para el cuidado integral de tus mascotas</p>
        <div class="mt-8 grid grid-cols-2 gap-4 text-sm">
          <div class="bg-white/10 rounded-xl p-3"><div class="mb-1 flex justify-center">${icon('clipboard','w-6 h-6')}</div>Ficha médica completa</div>
          <div class="bg-white/10 rounded-xl p-3"><div class="mb-1 flex justify-center">${icon('bell','w-6 h-6')}</div>Alertas automáticas</div>
          <div class="bg-white/10 rounded-xl p-3"><div class="mb-1 flex justify-center">${icon('pill','w-6 h-6')}</div>Control de medicamentos</div>
          <div class="bg-white/10 rounded-xl p-3"><div class="mb-1 flex justify-center">${icon('money','w-6 h-6')}</div>Control de gastos</div>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div class="min-h-full flex flex-col justify-center px-5 py-8 sm:px-8 lg:items-center">
        <div class="w-full max-w-sm mx-auto animate-scale-in">
          <!-- Logo solo móvil: compacto -->
          <div class="lg:hidden flex items-center gap-3 mb-6">
            <svg viewBox="0 0 64 64" class="w-10 h-10 rounded-2xl flex-shrink-0" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mascodata"><rect width="64" height="64" rx="14" fill="#C2471F"/><rect x="14" y="19" width="9" height="12" rx="4.5" fill="#FFF8F0"/><rect x="27.5" y="14" width="9" height="17" rx="4.5" fill="#FFF8F0"/><rect x="41" y="9" width="9" height="22" rx="4.5" fill="#FFF8F0"/><path fill="#FFF8F0" d="M32 35c6.5 0 10.5 4.2 13.2 8.6 2.6 4.2 1 9.4-4 9.4-3.4 0-5.6-1.6-9.2-1.6s-5.8 1.6-9.2 1.6c-5 0-6.6-5.2-4-9.4C21.5 39.2 25.5 35 32 35z"/></svg>
            <div>
              <div class="font-bold leading-none"><span class="text-brand-500">Masco</span><span class="text-gray-900">da</span><span class="text-brand-500">ta</span></div>
              <div class="text-xs text-brand-400 mt-0.5">Tu compañero digital</div>
            </div>
          </div>
          <h2 class="text-2xl font-bold text-gray-900 mb-1">Bienvenido de vuelta</h2>
          <p class="text-gray-500 text-sm mb-5">Ingresa a tu cuenta para continuar</p>
          <form onsubmit="handleLogin(event)" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="l-email" type="email" required autocomplete="email" placeholder="tu@email.com" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input id="l-pass" type="password" required autocomplete="current-password" placeholder="••••••••" class="input-field" />
            </div>
            <div class="flex items-center justify-between text-sm">
              <label class="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input type="checkbox" class="rounded text-brand-500" /> Recordarme
              </label>
              <button type="button" onclick="navigate('forgot')" class="text-brand-600 hover:underline text-xs font-medium">¿Olvidaste tu contraseña?</button>
            </div>
            <button type="submit" class="btn-primary w-full !py-3 text-base">Iniciar Sesión</button>
          </form>
          <div class="flex items-center gap-3 my-4">
            <div class="flex-1 h-px bg-gray-200"></div>
            <span class="text-xs text-gray-400">o continúa con</span>
            <div class="flex-1 h-px bg-gray-200"></div>
          </div>
          <button type="button" onclick="signInWithGoogle()" class="btn-secondary w-full !py-3 flex items-center justify-center gap-2">
            ${googleIcon()} Continuar con Google
          </button>
          <div class="mt-4 text-center text-sm text-gray-500">
            ¿No tienes cuenta? <button onclick="navigate('register')" class="text-brand-600 font-semibold hover:underline">Regístrate gratis</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// ---- VISTA: REGISTER ----
export function viewRegister() {
  return `
  <div class="min-h-screen overflow-y-auto bg-gray-50">
    <div class="min-h-full flex flex-col justify-center px-5 py-8 sm:px-8 sm:items-center">
    <div class="w-full max-w-sm mx-auto animate-scale-in">
      <div class="text-center mb-5">
        <svg viewBox="0 0 64 64" class="w-12 h-12 rounded-2xl mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mascodata"><rect width="64" height="64" rx="14" fill="#C2471F"/><rect x="14" y="19" width="9" height="12" rx="4.5" fill="#FFF8F0"/><rect x="27.5" y="14" width="9" height="17" rx="4.5" fill="#FFF8F0"/><rect x="41" y="9" width="9" height="22" rx="4.5" fill="#FFF8F0"/><path fill="#FFF8F0" d="M32 35c6.5 0 10.5 4.2 13.2 8.6 2.6 4.2 1 9.4-4 9.4-3.4 0-5.6-1.6-9.2-1.6s-5.8 1.6-9.2 1.6c-5 0-6.6-5.2-4-9.4C21.5 39.2 25.5 35 32 35z"/></svg>
        <h2 class="text-2xl font-bold text-gray-900">Crear cuenta</h2>
        <p class="text-sm text-gray-500 mt-1">Únete a Mascodata gratis</p>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <form onsubmit="handleRegister(event)" class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
            <input id="r-name" type="text" required placeholder="Tu nombre" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input id="r-email" type="email" required placeholder="tu@email.com" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input id="r-pass" type="password" required minlength="6" placeholder="Mínimo 6 caracteres" class="input-field" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
            <input id="r-pass2" type="password" required placeholder="Repite la contraseña" class="input-field" />
          </div>
          <button type="submit" class="btn-primary w-full !py-3">Crear cuenta gratuita</button>
        </form>
        <div class="flex items-center gap-3 my-4">
          <div class="flex-1 h-px bg-gray-200"></div>
          <span class="text-xs text-gray-400">o continúa con</span>
          <div class="flex-1 h-px bg-gray-200"></div>
        </div>
        <button type="button" onclick="signInWithGoogle()" class="btn-secondary w-full !py-3 flex items-center justify-center gap-2">
          ${googleIcon()} Continuar con Google
        </button>
        <div class="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta? <button onclick="navigate('login')" class="text-brand-600 font-semibold hover:underline">Inicia sesión</button>
        </div>
      </div>
    </div>
    </div>
  </div>`;
}

// ---- VISTA: RESET PASSWORD ----
export function viewResetPassword() {
  return `
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <div class="w-full max-w-sm animate-scale-in">
      <div class="text-center mb-6">
        <div class="mb-2 flex justify-center text-gray-300">${icon('lock','w-10 h-10')}</div>
        <h2 class="text-2xl font-bold text-gray-900">Nueva contraseña</h2>
        <p class="text-sm text-gray-500 mt-1">Crea una contraseña segura</p>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
          <input id="rp-pass" type="password" required minlength="6" placeholder="Mínimo 6 caracteres" class="input-field" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Confirmar contraseña</label>
          <input id="rp-pass2" type="password" required placeholder="Repite la contraseña" class="input-field" />
        </div>
        <button onclick="handleResetPassword()" class="btn-primary w-full">Guardar nueva contraseña</button>
        <button onclick="navigate('login')" class="w-full text-sm text-gray-500 hover:text-gray-700">← Volver al inicio</button>
      </div>
    </div>
  </div>`;
}

export async function handleResetPassword() {
  const pass  = document.getElementById('rp-pass')?.value;
  const pass2 = document.getElementById('rp-pass2')?.value;
  if (!pass || pass.length < 6) { showToast('Mínimo 6 caracteres', 'error'); return; }
  if (pass !== pass2) { showToast('Las contraseñas no coinciden', 'error'); return; }
  showToast('Actualizando contraseña...', '');
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  await sb.auth.signOut();
  state.isLoggedIn = false; state.user = null;
  showToast('Contraseña actualizada. Inicia sesión.', 'success');
  navigate('login');
}

// ---- VISTA: FORGOT ----
export function viewForgot() {
  return `
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
    <div class="w-full max-w-sm animate-scale-in">
      <div class="text-center mb-6">
        <div class="mb-2 flex justify-center text-gray-300">${icon('key','w-10 h-10')}</div>
        <h2 class="text-2xl font-bold text-gray-900">Recuperar contraseña</h2>
        <p class="text-sm text-gray-500 mt-1">Te enviaremos un enlace por email</p>
      </div>
      <div class="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input id="f-email" type="email" required placeholder="tu@email.com" class="input-field" />
        </div>
        <button onclick="handleForgot()" class="btn-primary w-full">Enviar enlace</button>
        <button onclick="navigate('login')" class="w-full text-sm text-gray-500 hover:text-gray-700">← Volver al inicio de sesión</button>
      </div>
    </div>
  </div>`;
}

// ---- CONTROLADORES ----
export async function handleLogin(e) {
  e.preventDefault();
  await login();
}

export async function login() {
  const email = document.getElementById('l-email')?.value?.trim().toLowerCase();
  const pass  = document.getElementById('l-pass')?.value;
  if (!email || !pass) { showToast('Completa todos los campos', 'error'); return; }

  showToast('Iniciando sesión...', '');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { showToast(error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos' : error.message, 'error'); return; }

  const userName = data.user.user_metadata?.name || email.split('@')[0];
  state.user = { name: userName, email, id: data.user.id };
  state.isLoggedIn = true;
  saveState();
  // Upsert defensivo: crea el perfil si nunca se creó (ej. trigger ausente) y
  // de paso hace backfill del email para cuentas creadas antes de guardarlo.
  // No bloquea el login si falla (la sesión ya es válida), pero se loguea
  // el error — si esto falla en silencio, cualquier insert posterior que
  // dependa de la fila de profiles (pet_access, invitations) falla después
  // de forma mucho más confusa de diagnosticar.
  const { error: profileError } = await sb.from('profiles').upsert({ id: data.user.id, email, name: userName }, { onConflict: 'id' });
  if (profileError) console.error('Error al crear/actualizar profile:', profileError);
  await loadDataFromSupabase();
  track('login');
  showToast('¡Bienvenido!', 'success');
  navigate('dashboard', {}, { replace: true });
}

export async function handleRegister(e) {
  e.preventDefault();
  await register();
}

export async function register() {
  const name  = document.getElementById('r-name')?.value?.trim();
  const email = document.getElementById('r-email')?.value?.trim().toLowerCase();
  const pass  = document.getElementById('r-pass')?.value;
  const pass2 = document.getElementById('r-pass2')?.value;

  if (!name || !email || !pass) { showToast('Completa todos los campos', 'error'); return; }
  if (pass !== pass2) { showToast('Las contraseñas no coinciden', 'error'); return; }
  if (pass.length < 6) { showToast('Mínimo 6 caracteres', 'error'); return; }

  showToast('Creando cuenta...', '');
  const { data, error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { name } }
  });
  if (error) {
    showToast(error.message === 'User already registered' ? 'Email ya registrado' : error.message, 'error');
    return;
  }

  state.user = { name, email, id: data.user?.id };
  state.isLoggedIn = true;
  state.pets = []; state.events = []; state.expenses = [];
  saveState();
  // profiles no guarda el email por defecto (vive en auth.users) — lo copiamos a
  // la propia fila (creándola vía upsert si no existía) para que el panel de
  // admin pueda mostrarlo sin acceso a auth.users.
  if (data.user?.id) {
    const { error: profileError } = await sb.from('profiles').upsert({ id: data.user.id, email, name }, { onConflict: 'id' });
    if (profileError) console.error('Error al crear profile:', profileError);
  }
  await loadDataFromSupabase();
  track('signup_completed');
  showToast('¡Cuenta creada! Bienvenido', 'success');
  navigate('dashboard', {}, { replace: true });
}

export async function handleForgot() {
  await sendForgotEmail();
}

export async function sendForgotEmail() {
  const email = document.getElementById('f-email')?.value?.trim().toLowerCase();
  if (!email) { showToast('Ingresa tu email', 'error'); return; }

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '?reset=true'
  });
  if (error) { showToast(error.message, 'error'); return; }
  showToast(`Enlace enviado a ${email}`, 'success');
  setTimeout(() => navigate('login'), 2000);
}

export async function logout() {
  await sb.auth.signOut();
  try { window.posthog?.reset(); } catch (e) {}
  const fresh = { isLoggedIn: false, user: null, pets: [], events: [], expenses: [],
    currentView: 'login', currentPetId: null, currentTab: 'general',
    addPetStep: 1, newPetData: {}, pages: {} };
  Object.assign(state, fresh);
  localStorage.removeItem('mascodata_v3');
  history.replaceState(null, '', ROUTE_PATHS.login);
  render();
}

// ---- VISTA: MI PERFIL ----
// Único punto de acceso a los datos de cuenta (nombre, contacto, ciudad,
// promociones) y al upsell a Premium — se llega acá desde la fila de usuario
// del sidebar (desktop) o el avatar de mobileTopBar() (mobile), ver js/app.js.
export function viewProfile() {
  const u = state.user || {};
  return appShell(`
    <div class="max-w-2xl mx-auto">
      <button onclick="navigate('dashboard')" class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← Volver
      </button>

      <div class="flex items-center gap-3 mb-5">
        <div class="w-14 h-14 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xl font-bold flex-shrink-0">${esc((u.name||'U')[0].toUpperCase())}</div>
        <div class="min-w-0">
          <h1 class="text-lg md:text-xl font-bold text-gray-900 truncate">Mi perfil</h1>
          <p class="text-sm text-gray-400 truncate">${esc(u.email||'')}</p>
        </div>
      </div>

      ${!isPremium() ? `
      <div class="bg-brand-gradient rounded-2xl p-5 md:p-6 mb-5 text-white flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
        <div class="min-w-0">
          <span class="badge bg-white/20 text-white text-xs font-bold uppercase tracking-wide">Plan Free</span>
          <h2 class="font-bold text-base md:text-lg mt-2">Mejora a Premium</h2>
          <p class="text-sm text-white/80 mt-1">Hasta 5 mascotas, segundo tutor, gráficos de gastos, exportar expediente y adjuntos ilimitados — ${fmtCLP(PREMIUM_PRICE_CLP)}/mes.</p>
        </div>
        <button onclick="requestPremium('profile')"
          class="btn-secondary !bg-white !text-brand-700 hover:!bg-brand-50 !border-0 px-5 py-2.5 text-sm font-bold flex-shrink-0 w-full sm:w-auto">
          Mejorar a Premium
        </button>
      </div>` : `
      <div class="bg-white rounded-2xl shadow-sm p-4 md:p-5 mb-5 flex items-center gap-3">
        <span class="badge bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wide flex-shrink-0">Premium</span>
        <p class="text-sm text-gray-500">Tu cuenta tiene acceso a todas las funciones.</p>
      </div>`}

      <form onsubmit="saveProfile(event)" class="bg-white rounded-2xl shadow-sm p-5 md:p-6 space-y-4">
        <div>
          <label class="form-label">Nombre completo</label>
          <input id="pf-name" required value="${esc(u.name||'')}" class="input-field" />
        </div>
        <div>
          <label class="form-label">Teléfono de contacto</label>
          <input id="pf-phone" type="tel" placeholder="+56 9 1234 5678" value="${esc(u.phone||'')}" class="input-field" />
        </div>
        <div>
          <label class="form-label">Ciudad</label>
          <select id="pf-city" class="input-field">
            <option value="">Selecciona tu ciudad</option>
            ${Object.entries(CHILE_REGIONS).map(([region, cities]) => `
              <optgroup label="${esc(region)}">
                ${cities.map(c => `<option value="${esc(c)}" ${u.city===c?'selected':''}>${esc(c)}</option>`).join('')}
              </optgroup>`).join('')}
          </select>
        </div>

        <div class="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-gray-50">
          <div class="min-w-0">
            <div class="text-sm font-semibold text-gray-800">Promociones personalizadas</div>
            <div class="text-xs text-gray-500 mt-0.5">Ofertas y novedades de Mascodata más adelante. Las alertas de salud de tus mascotas te llegan siempre, elijas lo que elijas acá.</div>
          </div>
          <label class="toggle-switch flex-shrink-0">
            <input type="checkbox" id="pf-marketing" ${u.marketingOptIn ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="submit" class="btn-primary flex-1 !py-3">Guardar cambios</button>
          <button type="button" onclick="logout()" class="btn-secondary flex-1 !py-3 !text-red-500 hover:!bg-red-50">Cerrar sesión</button>
        </div>
      </form>

      <div class="text-center mt-5">
        <button type="button" onclick="openDeleteAccountModal()" class="text-xs text-gray-400 hover:text-red-500 hover:underline">Eliminar mi cuenta</button>
      </div>
    </div>
  `);
}

export async function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('pf-name')?.value?.trim();
  const phone = document.getElementById('pf-phone')?.value?.trim() || '';
  const city = document.getElementById('pf-city')?.value || '';
  const marketingOptIn = !!document.getElementById('pf-marketing')?.checked;
  if (!name) { showToast('El nombre no puede estar vacío', 'error'); return; }

  if (!isDemoUser()) {
    const { error } = await sb.from('profiles')
      .update({ name, phone, city, marketing_opt_in: marketingOptIn })
      .eq('id', state.user.id);
    if (error) { showToast('Error al guardar el perfil', 'error'); return; }
  }

  state.user.name = name;
  state.user.phone = phone;
  state.user.city = city;
  state.user.marketingOptIn = marketingOptIn;
  saveState();
  track('profile_saved', { has_phone: !!phone, has_city: !!city, marketing_opt_in: marketingOptIn });
  showToast('Perfil actualizado', 'success');
  render();
}

// ---- ELIMINAR CUENTA ----
// Mismo patrón de confirmación que openDeletePetWithCode() en pets.js (código
// de un solo uso enviado por email vía Supabase Auth OTP) pero a nivel de
// cuenta completa. El borrado real — incluida la fila en auth.users — requiere
// la clave de servicio, que nunca puede vivir en el navegador: lo hace una
// Supabase Edge Function (ver supabase/functions/delete-account/index.ts,
// deployment manual, igual que el resto del proyecto no usa la CLI de
// Supabase). Acá solo se pide y verifica el código antes de invocarla.
export function openDeleteAccountModal() {
  const email = state.user?.email || '';
  const ownedPets = state.pets.filter(p => !p.myRole || p.myRole === 'owner');
  const sharedOwnedPets = ownedPets.filter(p => p.tutor2?.name && !p.tutor2.pending);
  const expensesCount = (state.expenses || []).length;

  const consequences = [
    `${ownedPets.length} mascota${ownedPets.length !== 1 ? 's' : ''} y todo su historial médico`,
    ...(expensesCount ? [`${expensesCount} gasto${expensesCount !== 1 ? 's' : ''} registrado${expensesCount !== 1 ? 's' : ''}`] : []),
    ...(isPremium() && !isDemoUser() ? ['tu plan Premium'] : []),
  ];

  openModal(`
    <div class="modal-box p-4 sm:p-6">
      <div class="text-center mb-4">
        <div class="mb-2 flex justify-center text-red-400">${icon('trash','w-12 h-12')}</div>
        <h3 class="text-lg font-bold text-gray-900">Eliminar mi cuenta</h3>
        <p class="text-sm text-gray-500 mt-1">Esta acción es permanente y no se puede deshacer. Se eliminará:</p>
      </div>
      <ul class="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-3 space-y-1">
        ${consequences.map(c => `<li class="flex items-center gap-1.5">${icon('check','w-3.5 h-3.5 text-gray-400 flex-shrink-0')}${c}</li>`).join('')}
      </ul>
      ${sharedOwnedPets.length ? `
      <div class="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700 mb-3">
        ${icon('warning','w-4 h-4 inline align-text-bottom')}
        ${sharedOwnedPets.map(p => `${esc(p.tutor2.name)} pasará a ser tutor/a de ${esc(p.name)} y conservará su historial.`).join(' ')}
      </div>` : ''}
      <div id="del-acc-step-1">
        <div class="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700 mb-4">
          ${icon('warning','w-4 h-4 inline align-text-bottom')} Para confirmar, enviaremos un código de verificación a:<br/>
          <strong>${esc(email)}</strong>
        </div>
        <div class="flex gap-3">
          <button onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="sendAccountDeleteCode()" class="flex-1 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Enviar código
          </button>
        </div>
      </div>
      <div id="del-acc-step-2" class="hidden">
        <p class="text-sm text-gray-500 mb-3">Ingresa el código de verificación enviado a <strong>${esc(email)}</strong></p>
        <input id="del-acc-code-input" type="text" maxlength="12" placeholder="Código"
          class="input-field text-center text-2xl tracking-[0.2em] font-bold mb-1" />
        <p id="del-acc-code-error" class="text-xs text-red-500 text-center mb-3 hidden">Código incorrecto. Intenta nuevamente.</p>
        <div class="flex gap-3">
          <button onclick="closeModal()" class="btn-secondary flex-1">Cancelar</button>
          <button onclick="verifyAccountDeleteCode()" class="flex-1 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
            Eliminar cuenta
          </button>
        </div>
        <button onclick="sendAccountDeleteCode()" class="w-full text-xs text-gray-400 hover:text-gray-600 mt-2">Reenviar código</button>
      </div>
    </div>`);
}

export async function sendAccountDeleteCode() {
  if (isDemoUser()) {
    // Sin sesión real de Supabase en modo demo — simulamos el código acá mismo.
    state.deleteAccountCode = String(Math.floor(100000 + Math.random() * 900000));
    document.getElementById('del-acc-step-1')?.classList.add('hidden');
    document.getElementById('del-acc-step-2')?.classList.remove('hidden');
    showToast(`Código enviado a ${state.user?.email} (demo: ${state.deleteAccountCode})`, 'success');
    return;
  }
  const { error } = await sb.auth.signInWithOtp({ email: state.user.email, options: { shouldCreateUser: false } });
  if (error) { showToast('No se pudo enviar el código', 'error'); console.error(error); return; }
  document.getElementById('del-acc-step-1')?.classList.add('hidden');
  document.getElementById('del-acc-step-2')?.classList.remove('hidden');
  showToast(`Código enviado a ${state.user?.email}`, 'success');
}

export async function verifyAccountDeleteCode() {
  const input = document.getElementById('del-acc-code-input')?.value?.trim();
  const markInvalid = () => {
    document.getElementById('del-acc-code-error')?.classList.remove('hidden');
    document.getElementById('del-acc-code-input')?.classList.add('border-red-400');
  };
  // Si un intento anterior falló por otra razón (ej. la Edge Function, más
  // abajo), sin esto el aviso de "código incorrecto" de esa vez quedaba
  // pegado en pantalla aunque el código de este intento sí fuera válido.
  document.getElementById('del-acc-code-error')?.classList.add('hidden');
  document.getElementById('del-acc-code-input')?.classList.remove('border-red-400');

  if (isDemoUser()) {
    if (input !== state.deleteAccountCode) { markInvalid(); return; }
    closeModal();
    track('account_deleted');
    showToast('Cuenta eliminada', 'success');
    logout();
    return;
  }

  // Misma plantilla de correo que el borrado de mascota (ver el comentario en
  // verifyDeleteCode, js/pets.js) — se emite como tipo 'magiclink', no 'email'.
  let { error: otpError } = await sb.auth.verifyOtp({ email: state.user.email, token: input, type: 'email' });
  if (otpError) {
    ({ error: otpError } = await sb.auth.verifyOtp({ email: state.user.email, token: input, type: 'magiclink' }));
  }
  if (otpError) { markInvalid(); return; }

  const { error: fnError } = await sb.functions.invoke('delete-account');
  if (fnError) {
    showToast('No se pudo eliminar la cuenta. Intenta nuevamente o contáctanos.', 'error');
    console.error('Error al eliminar cuenta:', fnError);
    return;
  }

  closeModal();
  track('account_deleted');
  showToast('Cuenta eliminada', 'success');
  await logout();
}

// ---- DATOS DE PRUEBA ----
// `silent`: true cuando initApp() la reinvoca para restaurar una sesión demo
// tras un F5 (ver ahí el comentario) — solo repuebla el estado, sin el toast
// ni el navigate('dashboard') que sí corresponden al click explícito del
// botón "Ingresar con datos de prueba".
export function loadDemoAndLogin(silent) {
  const id = () => genId();
  const dt = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  const greta = {
    id: 'pet-greta', name: 'Greta', species: 'Perro', breed: 'Mestizo', sex: 'Hembra',
    dateOfBirth: dt(2021,3,15), photo: null, color: 'Dorado', sizeRange: 'Mediano',
    weightKg: 12, weightGr: 500, reproductiveStatus: 'Esterilizado/a', chipNumber: '985112345678901',
    activityLevel: 3, personalityTags: ['Sociable','Tranquilo','Cariñoso'],
    allergies: ['Pollo','Pasto'], chronicConditions: ['Displasia de cadera'],
    vet: { name: 'Dra. Valentina Rojas', clinic: 'Clínica Veterinaria Las Condes', phone: '+56912345678', email: 'vrojas@clinicavet.cl' },
    tutor2: { name: 'María González', email: 'maria@gmail.com', role: 'edicion' },
    vaccines: [
      { id: id(), name: 'Polivalente DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)', code: 'DHPP-21', date: dt(2021,6,10), periodicity: 12, nextDate: dt(2022,6,10), alertType: 'week', cost: 25000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-21', date: dt(2021,6,10), periodicity: 12, nextDate: dt(2022,6,10), alertType: 'same', cost: 18000 },
      { id: id(), name: 'Polivalente DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)', code: 'DHPP-22', date: dt(2022,6,8), periodicity: 12, nextDate: dt(2023,6,8), alertType: 'week', cost: 27000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-22', date: dt(2022,6,8), periodicity: 12, nextDate: dt(2023,6,8), alertType: 'same', cost: 19000 },
      { id: id(), name: 'Leptospirosis', code: 'LEP-22', date: dt(2022,9,15), periodicity: 12, nextDate: dt(2023,9,15), alertType: 'week', cost: 22000 },
      { id: id(), name: 'Polivalente DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)', code: 'DHPP-23', date: dt(2023,6,5), periodicity: 12, nextDate: dt(2024,6,5), alertType: 'week', cost: 29000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-23', date: dt(2023,6,5), periodicity: 12, nextDate: dt(2024,6,5), alertType: 'same', cost: 21000 },
      { id: id(), name: 'Bordetella (Tos de las perreras)', code: 'BOR-23', date: dt(2023,11,20), periodicity: 12, nextDate: dt(2024,11,20), alertType: 'week', cost: 20000 },
      { id: id(), name: 'Polivalente DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)', code: 'DHPP-24', date: dt(2024,6,3), periodicity: 12, nextDate: dt(2025,6,3), alertType: 'week', cost: 32000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-24', date: dt(2024,6,3), periodicity: 12, nextDate: dt(2025,6,3), alertType: 'same', cost: 23000 },
      { id: id(), name: 'Polivalente DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)', code: 'DHPP-25', date: dt(2025,6,10), periodicity: 12, nextDate: dt(2026,6,10), alertType: 'week', cost: 35000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-25', date: dt(2025,6,10), periodicity: 12, nextDate: dt(2026,6,10), alertType: 'same', cost: 25000 },
    ],
    deworming: [
      { id: id(), product: 'Drontal Plus', type: 'Interna', format: 'Comprimido', dose: '1', unit: 'Comprimido(s)', date: dt(2023,3,1), nextDate: dt(2023,6,1), alertType: 'same' },
      { id: id(), product: 'Frontline Combo', type: 'Externa', format: 'Pipeta', dose: '1.34', unit: 'ML', date: dt(2023,3,1), nextDate: dt(2023,6,1), alertType: 'same' },
      { id: id(), product: 'Drontal Plus', type: 'Interna', format: 'Comprimido', dose: '1', unit: 'Comprimido(s)', date: dt(2023,6,1), nextDate: dt(2023,9,1), alertType: 'same' },
      { id: id(), product: 'Frontline Combo', type: 'Externa', format: 'Pipeta', dose: '1.34', unit: 'ML', date: dt(2023,9,1), nextDate: dt(2023,12,1), alertType: 'week' },
      { id: id(), product: 'Milbemax', type: 'Interna', format: 'Comprimido', dose: '1', unit: 'Comprimido(s)', date: dt(2024,1,10), nextDate: dt(2024,4,10), alertType: 'same', cost: 8500 },
      { id: id(), product: 'Frontline Combo', type: 'Externa', format: 'Pipeta', dose: '1.34', unit: 'ML', date: dt(2024,4,10), nextDate: dt(2024,7,10), alertType: 'same', cost: 12000 },
      { id: id(), product: 'Milbemax', type: 'Interna', format: 'Comprimido', dose: '1', unit: 'Comprimido(s)', date: dt(2024,7,10), nextDate: dt(2024,10,10), alertType: 'week', cost: 8500 },
      { id: id(), product: 'Frontline Combo', type: 'Externa', format: 'Pipeta', dose: '1.34', unit: 'ML', date: dt(2024,10,10), nextDate: dt(2025,1,10), alertType: 'same', cost: 12000 },
      { id: id(), product: 'Milbemax', type: 'Interna', format: 'Comprimido', dose: '1', unit: 'Comprimido(s)', date: dt(2025,2,5), nextDate: dt(2025,5,5), alertType: 'same', cost: 9000 },
      { id: id(), product: 'Frontline Combo', type: 'Externa', format: 'Pipeta', dose: '1.34', unit: 'ML', date: dt(2025,5,5), nextDate: dt(2025,8,5), alertType: 'week', cost: 13000 },
      { id: id(), product: 'Milbemax', type: 'Interna', format: 'Comprimido', dose: '1', unit: 'Comprimido(s)', date: dt(2025,8,5), nextDate: dt(2025,11,5), alertType: 'same', cost: 9000 },
      { id: id(), product: 'Frontline Combo', type: 'Externa', format: 'Pipeta', dose: '1.34', unit: 'ML', date: dt(2026,2,10), nextDate: dt(2026,5,10), alertType: 'same', cost: 14000 },
    ],
    medications: [
      { id: id(), name: 'Meloxicam', doseVal: '1', doseUnit: 'mg', dose: '1 mg', freqN: '24', freqUnit: 'horas', frequency: 'Cada 24 horas', startDate: dt(2023,8,1), startTime: '08:00', treatmentDays: 10, endDate: dt(2023,8,11), active: false, reminder: 'exact', stockTotal: '', cost: 5500 },
      { id: id(), name: 'Tramadol', doseVal: '50', doseUnit: 'mg', dose: '50 mg', freqN: '8', freqUnit: 'horas', frequency: 'Cada 8 horas', startDate: dt(2023,8,1), startTime: '08:00', treatmentDays: 5, endDate: dt(2023,8,6), active: false, reminder: '30', stockTotal: '', cost: 8000 },
      { id: id(), name: 'Omeprazol', doseVal: '20', doseUnit: 'mg', dose: '20 mg', freqN: '24', freqUnit: 'horas', frequency: 'Cada 24 horas', startDate: dt(2024,3,15), startTime: '08:00', treatmentDays: 30, endDate: dt(2024,4,14), active: false, reminder: 'exact', stockTotal: '30', stockUnit: 'Comprimidos', expiry: dt(2025,12,31), cost: 12000 },
      { id: id(), name: 'Carprofeno', doseVal: '25', doseUnit: 'mg', dose: '25 mg', freqN: '12', freqUnit: 'horas', frequency: 'Cada 12 horas', startDate: dt(2025,1,10), startTime: '08:00', treatmentDays: 14, endDate: dt(2025,1,24), active: false, reminder: '15', cost: 9500 },
      { id: id(), name: 'Gabapentina', doseVal: '100', doseUnit: 'mg', dose: '100 mg', freqN: '12', freqUnit: 'horas', frequency: 'Cada 12 horas', startDate: dt(2026,4,1), startTime: '08:00', treatmentDays: 60, endDate: dt(2026,5,31), active: true, reminder: 'exact', stockTotal: '45', stockUnit: 'Comprimidos', expiry: dt(2027,3,1), cost: 18000 },
    ],
    clinicalHistory: [
      { id: id(), title: 'Esterilización', type: 'Esterilización', date: dt(2022,4,20), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 180000, notes: 'Procedimiento sin complicaciones. Alta el mismo día.' },
      { id: id(), title: 'Fractura metacarpo derecho', type: 'Cirugía', date: dt(2023,7,28), doctor: 'Dr. Patricio Vega', clinic: 'Clínica Vet. Las Condes', cost: 320000, notes: 'Caída desde altura. Osteosíntesis con placa. Reposo 6 semanas.' },
      { id: id(), title: 'Control displasia cadera', type: 'Diagnóstico', date: dt(2024,2,14), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 45000, notes: 'Radiografías confirman displasia leve. Se indica manejo con suplementos y ejercicio moderado.' },
      { id: id(), title: 'Limpieza dental', type: 'Procedimiento', date: dt(2024,9,5), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 95000, notes: 'Sarro moderado. Extracción de pieza P4 izquierda inferior.' },
      { id: id(), title: 'Control anual + exámenes', type: 'Diagnóstico', date: dt(2025,3,20), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 68000, notes: 'Hemograma y perfil bioquímico normales. Peso estable. Todo en orden.' },
      { id: id(), title: 'Control displasia + ecografía', type: 'Diagnóstico', date: dt(2026,1,8), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 85000, notes: 'Leve progresión displasia. Se agrega gabapentina para manejo dolor crónico.' },
    ],
    weightHistory: [
      { date: dt(2026,1,15), kg: 12, gr: 200 }, { date: dt(2026,2,1), kg: 12, gr: 500 },
      { date: dt(2026,2,15), kg: 12, gr: 800 }, { date: dt(2026,3,1), kg: 13, gr: 0 },
      { date: dt(2026,3,15), kg: 12, gr: 900 }, { date: dt(2026,4,1), kg: 12, gr: 700 },
      { date: dt(2026,4,15), kg: 12, gr: 600 }, { date: dt(2026,5,1), kg: 12, gr: 500 },
      { date: dt(2026,5,12), kg: 12, gr: 400 },
    ],
    moodLog: [
      { date: dt(2026,5,9), mood: 'great', notes: 'Muy activa en el parque' },
      { date: dt(2026,5,10), mood: 'ok', notes: '' },
      { date: dt(2026,5,11), mood: 'low', notes: 'Comió poco' },
      { date: dt(2026,5,12), mood: 'ok', notes: 'Mejorando' },
      { date: dt(2026,5,13), mood: 'great', notes: '' },
      { date: dt(2026,5,14), mood: 'great', notes: 'Jugó toda la tarde' },
    ],
    symptomsLog: [
      { date: dt(2026,5,11), symptoms: ['Sin apetito','Letargo'], notes: 'Posiblemente por el antibiótico' },
      { date: dt(2026,5,9), symptoms: ['Rascado'], notes: 'Se rasca la pata derecha' },
    ],
    foodItems: [
      { id: 'food-greta-1', product: 'Royal Canin Adult', type: 'Seco', packageSize: 15, packageUnit: 'kg', dailyAmount: 0.24, price: 62000, purchaseDate: daysFromNowStr(-45), notes: '' },
    ],
    activities: [
      { date: todayStr(), type: 'Normal' },
      { date: daysFromNowStr(-1), type: 'Mucho' },
      { date: daysFromNowStr(-2), type: 'Normal' },
      { date: daysFromNowStr(-3), type: 'Poco' },
      { date: daysFromNowStr(-4), type: 'Normal' },
    ],
    doseLog: [
      { date: dt(2026,5,8), given: true }, { date: dt(2026,5,9), given: true },
      { date: dt(2026,5,10), given: true }, { date: dt(2026,5,11), given: true },
      { date: dt(2026,5,12), given: true }, { date: dt(2026,5,13), given: true },
      { date: dt(2026,5,14), given: true },
    ],
    bcs: 5,
  };

  const luna = {
    id: 'pet-luna', name: 'Luna', species: 'Gato', breed: 'Siamés', sex: 'Hembra',
    dateOfBirth: dt(2022,8,20), photo: null, color: 'Crema', sizeRange: 'Pequeño',
    weightKg: 3, weightGr: 800, reproductiveStatus: 'Esterilizado/a', chipNumber: '985198765432100',
    activityLevel: 2, personalityTags: ['Independiente','Tranquilo'],
    allergies: ['Maíz'], chronicConditions: ['Ninguna'],
    vet: { name: 'Dra. Valentina Rojas', clinic: 'Clínica Veterinaria Las Condes', phone: '+56912345678', email: 'vrojas@clinicavet.cl' },
    tutor2: null,
    vaccines: [
      { id: id(), name: 'Triple Felina (Panleucopenia, Rinotraqueítis, Calicivirus)', code: 'TF-22', date: dt(2022,10,5), periodicity: 12, nextDate: dt(2023,10,5), alertType: 'week', cost: 28000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-22F', date: dt(2022,10,5), periodicity: 12, nextDate: dt(2023,10,5), alertType: 'same', cost: 18000 },
      { id: id(), name: 'Triple Felina (Panleucopenia, Rinotraqueítis, Calicivirus)', code: 'TF-23', date: dt(2023,10,3), periodicity: 12, nextDate: dt(2024,10,3), alertType: 'week', cost: 30000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-23F', date: dt(2023,10,3), periodicity: 12, nextDate: dt(2024,10,3), alertType: 'same', cost: 20000 },
      { id: id(), name: 'Leucemia Felina (FeLV)', code: 'FEL-23', date: dt(2023,10,3), periodicity: 12, nextDate: dt(2024,10,3), alertType: 'week', cost: 35000 },
      { id: id(), name: 'Triple Felina (Panleucopenia, Rinotraqueítis, Calicivirus)', code: 'TF-24', date: dt(2024,10,7), periodicity: 12, nextDate: dt(2025,10,7), alertType: 'week', cost: 32000 },
      { id: id(), name: 'Antirrábica', code: 'RAB-24F', date: dt(2024,10,7), periodicity: 12, nextDate: dt(2025,10,7), alertType: 'same', cost: 22000 },
      { id: id(), name: 'Triple Felina (Panleucopenia, Rinotraqueítis, Calicivirus)', code: 'TF-25', date: dt(2025,10,10), periodicity: 12, nextDate: dt(2026,10,10), alertType: 'week', cost: 35000 },
    ],
    deworming: [
      { id: id(), product: 'Profender', type: 'Interna', format: 'Pipeta', dose: '0.35', unit: 'ML', date: dt(2023,1,15), nextDate: dt(2023,7,15), alertType: 'same', cost: 14000 },
      { id: id(), product: 'Broadline', type: 'Ambas', format: 'Pipeta', dose: '0.3', unit: 'ML', date: dt(2023,7,15), nextDate: dt(2024,1,15), alertType: 'same', cost: 16000 },
      { id: id(), product: 'Broadline', type: 'Ambas', format: 'Pipeta', dose: '0.3', unit: 'ML', date: dt(2024,1,15), nextDate: dt(2024,7,15), alertType: 'same', cost: 16000 },
      { id: id(), product: 'Broadline', type: 'Ambas', format: 'Pipeta', dose: '0.3', unit: 'ML', date: dt(2024,7,15), nextDate: dt(2025,1,15), alertType: 'week', cost: 17000 },
      { id: id(), product: 'Broadline', type: 'Ambas', format: 'Pipeta', dose: '0.3', unit: 'ML', date: dt(2025,1,15), nextDate: dt(2025,7,15), alertType: 'same', cost: 17000 },
      { id: id(), product: 'Broadline', type: 'Ambas', format: 'Pipeta', dose: '0.3', unit: 'ML', date: dt(2025,7,15), nextDate: dt(2026,1,15), alertType: 'same', cost: 18000 },
      { id: id(), product: 'Broadline', type: 'Ambas', format: 'Pipeta', dose: '0.3', unit: 'ML', date: dt(2026,1,20), nextDate: dt(2026,7,20), alertType: 'same', cost: 18000 },
    ],
    medications: [
      { id: id(), name: 'Prednisolona', doseVal: '5', doseUnit: 'mg', dose: '5 mg', freqN: '24', freqUnit: 'horas', frequency: 'Cada 24 horas', startDate: dt(2024,5,10), startTime: '08:00', treatmentDays: 7, endDate: dt(2024,5,17), active: false, reminder: 'exact', cost: 7000 },
      { id: id(), name: 'Amoxicilina', doseVal: '62.5', doseUnit: 'mg', dose: '62.5 mg', freqN: '12', freqUnit: 'horas', frequency: 'Cada 12 horas', startDate: dt(2025,2,3), startTime: '08:00', treatmentDays: 10, endDate: dt(2025,2,13), active: false, reminder: '15', cost: 9500 },
      { id: id(), name: 'Suplemento Articular (Cosequin)', doseVal: '1', doseUnit: 'Comprimido(s)', dose: '1 Comprimido(s)', freqN: '24', freqUnit: 'horas', frequency: 'Cada 24 horas', startDate: dt(2026,3,1), startTime: '08:00', treatmentDays: 90, endDate: dt(2026,5,30), active: true, reminder: 'exact', stockTotal: '60', stockUnit: 'Comprimidos', expiry: dt(2027,6,1), cost: 25000 },
    ],
    clinicalHistory: [
      { id: id(), title: 'Esterilización', type: 'Esterilización', date: dt(2023,3,10), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 160000, notes: 'Sin complicaciones. Alta el mismo día. Ayuno 12h previo.' },
      { id: id(), title: 'Infección urinaria', type: 'Diagnóstico', date: dt(2025,2,1), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 55000, notes: 'Urocultivo positivo E. coli. Tratamiento antibiótico 10 días. Dieta húmeda.' },
      { id: id(), title: 'Control renal preventivo', type: 'Diagnóstico', date: dt(2026,3,1), doctor: 'Dra. Valentina Rojas', clinic: 'Clínica Vet. Las Condes', cost: 48000, notes: 'Creatinina y BUN dentro de rango normal. Ecografía renal sin hallazgos.' },
    ],
    weightHistory: [
      { date: dt(2026,1,15), kg: 3, gr: 600 }, { date: dt(2026,2,1), kg: 3, gr: 700 },
      { date: dt(2026,2,15), kg: 3, gr: 750 }, { date: dt(2026,3,1), kg: 3, gr: 800 },
      { date: dt(2026,3,15), kg: 3, gr: 800 }, { date: dt(2026,4,1), kg: 3, gr: 750 },
      { date: dt(2026,4,15), kg: 3, gr: 700 }, { date: dt(2026,5,1), kg: 3, gr: 680 },
      { date: dt(2026,5,12), kg: 3, gr: 650 },
    ],
    moodLog: [
      { date: dt(2026,5,9), mood: 'ok', notes: 'Normal, durmió mucho' },
      { date: dt(2026,5,10), mood: 'ok', notes: '' },
      { date: dt(2026,5,11), mood: 'great', notes: 'Jugó con el ratón de peluche' },
      { date: dt(2026,5,12), mood: 'ok', notes: '' },
      { date: dt(2026,5,13), mood: 'great', notes: 'Muy activa' },
      { date: dt(2026,5,14), mood: 'ok', notes: 'Tranquila' },
    ],
    symptomsLog: [
      { date: dt(2026,5,10), symptoms: ['Estornudos'], notes: 'Algunos estornudos por la mañana' },
    ],
    foodItems: [
      { id: 'food-luna-1', product: 'Royal Canin Siamese', type: 'Seco', packageSize: 4, packageUnit: 'kg', dailyAmount: 0.08, price: 28000, purchaseDate: daysFromNowStr(-46), notes: '' },
    ],
    activities: [
      { date: todayStr(), type: 'Poco' },
      { date: daysFromNowStr(-1), type: 'Normal' },
      { date: daysFromNowStr(-3), type: 'Poco' },
    ],
    doseLog: [
      { date: dt(2026,5,10), given: true }, { date: dt(2026,5,11), given: true },
      { date: dt(2026,5,12), given: true }, { date: dt(2026,5,13), given: true },
      { date: dt(2026,5,14), given: true },
    ],
    bcs: 4,
  };

  const coco = {
    id: 'pet-coco', name: 'Coco', species: 'Conejo', breed: 'Enano de Holanda', sex: 'Macho',
    dateOfBirth: dt(2023,11,5), photo: null, color: 'Blanco', sizeRange: 'Pequeño',
    weightKg: 1, weightGr: 200, reproductiveStatus: 'Castrado/a', chipNumber: '',
    activityLevel: 2, personalityTags: ['Juguetón','Tímido'],
    allergies: [], chronicConditions: ['Ninguna'],
    vet: { name: 'Dr. Rodrigo Méndez', clinic: 'Exotic Pets Vet', phone: '+56987654321', email: 'rmendez@exoticvet.cl' },
    tutor2: null,
    vaccines: [
      { id: id(), name: 'Mixomatosis', code: 'MIX-24', date: dt(2024,2,10), periodicity: 12, nextDate: dt(2025,2,10), alertType: 'week', cost: 32000 },
      { id: id(), name: 'Enfermedad Vírica Hemorrágica (RHD)', code: 'RHD-24', date: dt(2024,2,10), periodicity: 12, nextDate: dt(2025,2,10), alertType: 'week', cost: 32000 },
      { id: id(), name: 'Mixomatosis', code: 'MIX-25', date: dt(2025,2,8), periodicity: 12, nextDate: dt(2026,2,8), alertType: 'week', cost: 35000 },
      { id: id(), name: 'Enfermedad Vírica Hemorrágica (RHD)', code: 'RHD-25', date: dt(2025,2,8), periodicity: 12, nextDate: dt(2026,2,8), alertType: 'week', cost: 35000 },
    ],
    deworming: [
      { id: id(), product: 'Panacur (Fenbendazol)', type: 'Interna', format: 'Jarabe', dose: '0.5', unit: 'ML', date: dt(2024,3,1), nextDate: dt(2024,9,1), alertType: 'same', cost: 11000 },
      { id: id(), product: 'Panacur (Fenbendazol)', type: 'Interna', format: 'Jarabe', dose: '0.5', unit: 'ML', date: dt(2024,9,1), nextDate: dt(2025,3,1), alertType: 'same', cost: 11000 },
      { id: id(), product: 'Panacur (Fenbendazol)', type: 'Interna', format: 'Jarabe', dose: '0.5', unit: 'ML', date: dt(2025,3,1), nextDate: dt(2025,9,1), alertType: 'same', cost: 12000 },
      { id: id(), product: 'Panacur (Fenbendazol)', type: 'Interna', format: 'Jarabe', dose: '0.5', unit: 'ML', date: dt(2025,9,1), nextDate: dt(2026,3,1), alertType: 'same', cost: 12000 },
      { id: id(), product: 'Panacur (Fenbendazol)', type: 'Interna', format: 'Jarabe', dose: '0.5', unit: 'ML', date: dt(2026,3,5), nextDate: dt(2026,9,5), alertType: 'same', cost: 13000 },
    ],
    medications: [
      { id: id(), name: 'Meloxicam (post castración)', doseVal: '0.5', doseUnit: 'mg', dose: '0.5 mg', freqN: '24', freqUnit: 'horas', frequency: 'Cada 24 horas', startDate: dt(2024,6,15), startTime: '08:00', treatmentDays: 5, endDate: dt(2024,6,20), active: false, reminder: 'exact', cost: 4500 },
    ],
    clinicalHistory: [
      { id: id(), title: 'Castración', type: 'Esterilización', date: dt(2024,6,15), doctor: 'Dr. Rodrigo Méndez', clinic: 'Exotic Pets Vet', cost: 120000, notes: 'Procedimiento sin complicaciones. Alta el mismo día. Dieta blanda 48h.' },
      { id: id(), title: 'Control bienestar + corte uñas', type: 'Procedimiento', date: dt(2025,1,20), doctor: 'Dr. Rodrigo Méndez', clinic: 'Exotic Pets Vet', cost: 22000, notes: 'Todo en orden. Peso ideal. Se realizó corte de uñas y revisión dental.' },
      { id: id(), title: 'Control general 1 año', type: 'Diagnóstico', date: dt(2025,11,5), doctor: 'Dr. Rodrigo Méndez', clinic: 'Exotic Pets Vet', cost: 28000, notes: 'Primer año de vida sin incidentes. Buen desarrollo. Dieta correcta.' },
    ],
    weightHistory: [
      { date: dt(2026,1,15), kg: 1, gr: 150 }, { date: dt(2026,2,1), kg: 1, gr: 180 },
      { date: dt(2026,2,15), kg: 1, gr: 200 }, { date: dt(2026,3,1), kg: 1, gr: 210 },
      { date: dt(2026,3,15), kg: 1, gr: 220 }, { date: dt(2026,4,1), kg: 1, gr: 200 },
      { date: dt(2026,5,1), kg: 1, gr: 190 }, { date: dt(2026,5,12), kg: 1, gr: 180 },
    ],
    moodLog: [
      { date: dt(2026,5,12), mood: 'great', notes: 'Corrió por toda la habitación' },
      { date: dt(2026,5,13), mood: 'ok', notes: '' },
      { date: dt(2026,5,14), mood: 'great', notes: 'Comió bien todos sus pellets' },
    ],
    symptomsLog: [],
    foodItems: [
      { id: 'food-coco-1', product: 'Pellets + heno Timothy', type: 'Seco', packageSize: 2, packageUnit: 'kg', dailyAmount: 0.03, price: 9000, purchaseDate: daysFromNowStr(-2), notes: '' },
    ],
    activities: [
      { date: todayStr(), type: 'Mucho' },
      { date: daysFromNowStr(-1), type: 'Mucho' },
      { date: daysFromNowStr(-2), type: 'Normal' },
    ],
    doseLog: [],
    bcs: 5,
  };

  // Construir gastos a partir de todos los registros
  const buildExpenses = (pets) => {
    const exps = [];
    const push = (desc, amount, date, cat, pet, tutor) =>
      exps.push({ id: id(), description: desc, amount, date, category: cat, pet, tutor });

    // Gastos de Greta
    greta.vaccines.forEach(v => push(`Vacuna ${v.name.split(' ')[0]} – Greta`, v.cost||0, v.date, 'Veterinaria', 'Greta', 'Felipe Molina'));
    greta.deworming.forEach(d => d.cost && push(`Desparasitación ${d.product} – Greta`, d.cost, d.date, 'Veterinaria', 'Greta', 'Felipe Molina'));
    greta.medications.forEach(m => m.cost && push(`Medicamento ${m.name} – Greta`, m.cost, m.startDate, 'Medicamentos', 'Greta', 'Felipe Molina'));
    greta.clinicalHistory.forEach(h => h.cost && push(`${h.title} – Greta`, h.cost, h.date, 'Veterinaria', 'Greta', 'Felipe Molina'));

    // Gastos de Luna
    luna.vaccines.forEach(v => push(`Vacuna ${v.name.split(' ')[0]} – Luna`, v.cost||0, v.date, 'Veterinaria', 'Luna', 'Felipe Molina'));
    luna.deworming.forEach(d => d.cost && push(`Desparasitación ${d.product} – Luna`, d.cost, d.date, 'Veterinaria', 'Luna', 'Felipe Molina'));
    luna.medications.forEach(m => m.cost && push(`Medicamento ${m.name} – Luna`, m.cost, m.startDate, 'Medicamentos', 'Luna', 'Felipe Molina'));
    luna.clinicalHistory.forEach(h => h.cost && push(`${h.title} – Luna`, h.cost, h.date, 'Veterinaria', 'Luna', 'Felipe Molina'));

    // Gastos de Coco
    coco.vaccines.forEach(v => push(`Vacuna ${v.name.split(' ')[0]} – Coco`, v.cost||0, v.date, 'Veterinaria', 'Coco', 'Felipe Molina'));
    coco.deworming.forEach(d => d.cost && push(`Desparasitación ${d.product} – Coco`, d.cost, d.date, 'Veterinaria', 'Coco', 'Felipe Molina'));
    coco.medications.forEach(m => m.cost && push(`Medicamento ${m.name} – Coco`, m.cost, m.startDate, 'Medicamentos', 'Coco', 'Felipe Molina'));
    coco.clinicalHistory.forEach(h => h.cost && push(`${h.title} – Coco`, h.cost, h.date, 'Veterinaria', 'Coco', 'Felipe Molina'));

    // Gastos de alimentación mensuales
    const months = [];
    for (let y = 2023; y <= 2026; y++) {
      for (let m = 1; m <= 12; m++) {
        if (y === 2026 && m > 5) break;
        months.push(dt(y, m, 5));
      }
    }
    months.forEach(d => {
      push('Alimento Premium Greta (10kg)', 32000, d, 'Alimentación', 'Greta', 'Felipe Molina');
      push('Alimento Royal Canin Luna', 24000, d, 'Alimentación', 'Luna', 'Felipe Molina');
      if (d >= dt(2024,1,1)) push('Alimento Timothy Hay + Pellets Coco', 15000, d, 'Alimentación', 'Coco', 'Felipe Molina');
    });

    // Peluquería Greta
    ['2023-04-10','2023-07-15','2023-10-20','2024-01-12','2024-04-18','2024-07-22','2024-10-15','2025-01-20','2025-04-10','2025-07-18','2025-10-14','2026-01-25','2026-04-22'].forEach(d =>
      push('Peluquería Greta', 25000, d, 'Peluquería', 'Greta', 'Felipe Molina'));

    return exps.filter(e => e.amount > 0);
  };

  const events = [
    { id: id(), title: 'Vacuna anual Greta', type: 'Vacuna', date: dt(2026,6,10), pet: 'Greta', notes: 'DHPP + Rabia' },
    { id: id(), title: 'Vacuna anual Luna', type: 'Vacuna', date: dt(2026,6,15), pet: 'Luna', notes: 'Triple Felina + Rabia' },
    { id: id(), title: 'Control displasia Greta', type: 'Consulta', date: dt(2026,6,20), pet: 'Greta', notes: 'Radiografías cadera' },
    { id: id(), title: 'Desparasitación Greta', type: 'Consulta', date: dt(2026,5,10), pet: 'Greta', notes: 'Frontline Combo' },
    { id: id(), title: 'Desparasitación Luna', type: 'Consulta', date: dt(2026,7,20), pet: 'Luna', notes: 'Broadline' },
    { id: id(), title: 'Desparasitación Coco', type: 'Consulta', date: dt(2026,9,5), pet: 'Coco', notes: 'Panacur' },
    { id: id(), title: 'Peluquería Greta', type: 'Peluquería', date: dt(2026,6,5), pet: 'Greta', notes: 'Corte de verano' },
    { id: id(), title: 'Control general Luna', type: 'Examen', date: dt(2026,7,10), pet: 'Luna', notes: 'Examen renal anual' },
    { id: id(), title: 'Control Coco 2 años', type: 'Consulta', date: dt(2026,8,5), pet: 'Coco', notes: 'Revisión dental' },
  ];

  const demoState = {
    user: { name: 'Felipe Molina', email: 'demo@mascodata.cl' },
    isLoggedIn: true,
    pets: [greta, luna, coco],
    events,
    expenses: buildExpenses([greta, luna, coco]),
    botiquin: [
      { id: genId(), name: 'Vendas elásticas', category: 'Vendaje', petId: null, quantity: 3, unit: 'unidades', expiryDate: null, notes: '', status: 'disponible' },
      { id: genId(), name: 'Jeringas 5ml', category: 'Accesorio', petId: null, quantity: 4, unit: 'unidades', expiryDate: dt(2027,3,1), notes: '', status: 'por_agotarse' },
      { id: genId(), name: 'Suero fisiológico', category: 'Higiene', petId: null, quantity: 0, unit: 'frascos', expiryDate: dt(2026,10,1), notes: 'Reponer en próxima compra', status: 'agotado' },
      { id: genId(), name: 'Pregalex', category: 'Medicamento', petId: 'pet-greta', quantity: 20, unit: 'comprimidos',
        doseVal: 75, doseUnit: 'mg', cost: 14500, purchaseDate: daysFromNowStr(-10),
        expiryDate: dt(2027,6,1), notes: 'Para el manejo de dolor crónico de Greta', status: 'disponible' },
    ],
  };

  Object.assign(state, demoState);
  saveState();
  if (silent) return;
  track('demo_started');
  showToast('Datos de prueba cargados (3 años)', 'success');
  navigate('dashboard', {}, { replace: true });
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    viewLogin, viewRegister, viewResetPassword, handleResetPassword, viewForgot,
    handleLogin, login, handleRegister, register, handleForgot, sendForgotEmail, signInWithGoogle,
    logout, loadDemoAndLogin, viewProfile, saveProfile,
    openDeleteAccountModal, sendAccountDeleteCode, verifyAccountDeleteCode,
  });
}
