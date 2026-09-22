/* ============================================================
   MASCODATA — Aplicación Principal
   ============================================================ */

// ---- SUPABASE CONFIG ----
const SUPABASE_URL = 'https://dmpvqhdpldlvzwunscah.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHZxaGRwbGRsdnp3dW5zY2FoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NjExNTQsImV4cCI6MjA5NDQzNzE1NH0.gUmmrm7hgzAHMKcIw1hBLDBEj7sr8lZf6g6zaIzgblI';
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- VACUNAS POR ESPECIE ----
export const VACCINES_BY_SPECIES = {
  Perro:   ['Antirrábica','Polivalente DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)','Parvovirus','Moquillo (Distemper)','Hepatitis Infecciosa Canina','Leptospirosis','Parainfluenza','Bordetella (Tos de las perreras)','Coronavirus Canino','Leishmaniasis'],
  Gato:    ['Antirrábica','Triple Felina (Panleucopenia, Rinotraqueítis, Calicivirus)','Cuádruple Felina','Leucemia Felina (FeLV)','Peritonitis Infecciosa Felina (FIP)','Clamidiosis Felina','Inmunodeficiencia Felina (FIV)'],
  Ave:     ['Viruela Aviar','Newcastle','Psitacosis (Clamidiosis)','Influenza Aviar','Marek'],
  Conejo:  ['Mixomatosis','Enfermedad Vírica Hemorrágica (RHD)','Combinada Mixomatosis + RHD'],
  Pez:     ['Furunculosis','Vibriosis','Yersiniosis'],
  Hámster: ['Consultar con veterinario'],
  Reptil:  ['Consultar con veterinario'],
  Otro:    ['Consultar con veterinario'],
};

// ---- PLANES ----
// Modelo de 2 planes: Free (1 mascota, registro médico completo) y Premium
// (5 mascotas + segundo tutor, Finanzas avanzada, exportar expediente,
// Botiquín y adjuntos ilimitados en el historial — ver isPremium()/
// blockIfNotPremium() más abajo).
export const PLAN_PET_LIMITS = { free: 1, premium: 5 };
export const PLAN_LABELS = { free: 'Free', premium: 'Premium' };
// Única fuente de verdad del precio — antes "$2.000/mes" estaba tipeado a
// mano en 2 lugares de js/admin.js (la tarjeta de Planes y el modal de
// cambio de plan), la misma clase de duplicación que ya causó bugs de
// desincronización en otras partes de la app. También se usa para calcular
// el MRR en el dashboard del admin.
export const PREMIUM_PRICE_CLP = 2000;

// ---- PERIODICIDADES ----
export const PERIODICITY_OPTIONS = [
  { label: 'Sin periodicidad',          months: 0,   days: 0    },
  { label: '1 mes (30 días)',           months: 1,   days: 30   },
  { label: '1 1/2 meses (45 días)',     months: 1.5, days: 45   },
  { label: 'Bimestral (60 días)',       months: 2,   days: 60   },
  { label: 'Trimestral (90 días)',      months: 3,  days: 90   },
  { label: 'Semestral (180 días)',      months: 6,  days: 180  },
  { label: 'Anual (365 días)',          months: 12, days: 365  },
  { label: 'Cada 2 años (730 días)',    months: 24, days: 730  },
  { label: 'Cada 3 años (1095 días)',   months: 36, days: 1095 },
];

// ---- RAZAS POR ESPECIE ----
export const BREEDS = {
  Perro: ['Mestizo','Labrador Retriever','Golden Retriever','Pastor Alemán','Bulldog Francés','Bulldog Inglés','Poodle','Beagle','Chihuahua','Yorkshire Terrier','Shih Tzu','Schnauzer','Dachshund','Husky Siberiano','Border Collie','Boxer','Cocker Spaniel','Doberman','Rottweiler','Pomerania','Maltés','Bichón Frisé','Akita','Shar Pei','Weimaraner','Dálmata','Samoyedo','Chow Chow','Setter Irlandés','Gran Danés'],
  Gato: ['Mestizo','Siamés','Persa','Maine Coon','Bengalí','Ragdoll','Abisinio','Sphynx','British Shorthair','Scottish Fold','Noruego del Bosque','Angora Turco','Birmano','Ruso Azul','Somalí','Tonkinés','Devon Rex','Cornish Rex','Manx','Bombay'],
  Ave: ['Mestizo','Canario','Periquito','Loro','Cacatúa','Agaporni','Ninfas','Jilguero','Paloma','Cotorra'],
  Conejo: ['Mestizo','Enano de Holanda','Angora','Rex','Lionhead','Mini Lop','Belier','Californiano','Nueva Zelanda'],
  Pez: ['Mestizo','Betta','Goldfish','Guppy','Tetra','Ángel','Disco','Koi','Molly','Platy','Oscar'],
  Hámster: ['Mestizo','Sirio','Ruso','Chino','Roborovski','Campbell'],
  Reptil: ['Mestizo','Dragón Barbudo','Gecko Leopardo','Iguana Verde','Camaleón','Tortuga','Boa','Pitón','Anolis'],
  Otro: ['Mestizo','Otro'],
};

// ---- CIUDADES DE CHILE (para el perfil del usuario) ----
export const CHILE_REGIONS = {
  'Arica y Parinacota': ['Arica','Putre'],
  'Tarapacá': ['Iquique','Alto Hospicio','Pozo Almonte'],
  'Antofagasta': ['Antofagasta','Calama','Tocopilla','Mejillones','San Pedro de Atacama'],
  'Atacama': ['Copiapó','Vallenar','Caldera','Chañaral'],
  'Coquimbo': ['La Serena','Coquimbo','Ovalle','Illapel','Vicuña'],
  'Valparaíso': ['Valparaíso','Viña del Mar','Quilpué','Villa Alemana','San Antonio','Quillota','San Felipe','Los Andes','La Ligua'],
  'Metropolitana de Santiago': ['Santiago','Providencia','Las Condes','Ñuñoa','La Reina','Vitacura','Lo Barnechea','Macul','Peñalolén','La Florida','Puente Alto','San Bernardo','Maipú','Pudahuel','Cerrillos','Estación Central','Quinta Normal','Independencia','Recoleta','Huechuraba','Conchalí','Renca','Quilicura','Colina','Melipilla','Talagante','Buin','Peñaflor','San Miguel','La Cisterna','San Joaquín','El Bosque','La Granja','La Pintana','San Ramón'],
  "O'Higgins": ['Rancagua','Rengo','San Fernando','Santa Cruz','Pichilemu'],
  'Maule': ['Talca','Curicó','Linares','Constitución','Cauquenes'],
  'Ñuble': ['Chillán','Chillán Viejo','San Carlos'],
  'Biobío': ['Concepción','Talcahuano','Los Ángeles','Coronel','San Pedro de la Paz','Chiguayante','Hualpén','Tomé','Lota'],
  'Araucanía': ['Temuco','Padre Las Casas','Villarrica','Pucón','Angol','Victoria'],
  'Los Ríos': ['Valdivia','La Unión','Panguipulli'],
  'Los Lagos': ['Puerto Montt','Osorno','Castro','Ancud','Puerto Varas','Chonchi'],
  'Aysén': ['Coyhaique','Puerto Aysén','Chile Chico'],
  'Magallanes': ['Punta Arenas','Puerto Natales','Porvenir'],
};

// ---- PAGINACIÓN ----
export const PAGE_SIZE = 10;
export function getPage(key) { return ((state.pages||{})[key]) || 1; }
export function setPage(key, p) { state.pages = state.pages||{}; state.pages[key] = p; render(); }
export function paginate(items, key) {
  const page = getPage(key);
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur   = Math.max(1, Math.min(page, pages));
  return { items: items.slice((cur-1)*PAGE_SIZE, cur*PAGE_SIZE), total, pages, page: cur };
}
export function pagerHTML(key, pages, cur) {
  if (pages <= 1) return '';
  const range = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 1) range.push(i);
    else if (range[range.length-1] !== '…') range.push('…');
  }
  return `
  <div class="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
    <button onclick="setPage('${key}',${cur-1})" ${cur<=1?'disabled':''}
      class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default transition-colors font-medium">
      ← Anterior
    </button>
    <div class="flex items-center gap-1">
      ${range.map(n => n==='…'
        ? `<span class="w-8 text-center text-gray-400 text-sm">…</span>`
        : `<button onclick="setPage('${key}',${n})"
            class="w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${n===cur?'bg-brand-600 text-white shadow-sm':'text-gray-500 hover:bg-gray-100'}">
            ${n}
          </button>`).join('')}
    </div>
    <button onclick="setPage('${key}',${cur+1})" ${cur>=pages?'disabled':''}
      class="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-default transition-colors font-medium">
      Siguiente →
    </button>
  </div>`;
}

// ---- ESTADO ----
export const defaultState = {
  user: null, isLoggedIn: false,
  pets: [], events: [], expenses: [],
  currentView: 'login', currentPetId: null,
  currentTab: 'general', addPetStep: 1, newPetData: {},
};
export let state = { ...defaultState };
// Vive en window (no un `let` de módulo): js/finance.js reasigna esta variable
// al crear/destruir el gráfico de gastos, y al ser cada archivo un módulo ES
// separado, un `let` de este archivo no sería visible como identificador ahí.
window.chartInstance = null;

export function loadState() {
  try {
    const s = localStorage.getItem('mascodata_v3');
    if (s) {
      const p = JSON.parse(s);
      state.user = p.user || null;
      state.isLoggedIn = p.isLoggedIn || false;
      const route = resolveInitialViewFromUrl(state.isLoggedIn);
      if (route) { state.currentView = route.view; Object.assign(state, route.params || {}); }
      else state.currentView = state.isLoggedIn ? 'dashboard' : 'login';
      state.currentTab = 'general'; state.addPetStep = 1; state.newPetData = {};
    }
    // Un link de invitación de segundo tutor llega como ?invite=TOKEN — el login real
    // ocurre vía magic link de Supabase, procesado por separado en initApp(). Solo
    // guardamos el token acá; NO tocamos currentView (el usuario ya queda autenticado).
    const inviteMatch = location.search.match(/invite=([^&]+)/);
    if (inviteMatch) {
      state.inviteToken = inviteMatch[1];
      history.replaceState(null, '', location.pathname + location.hash);
    }
  } catch(e) {}
}

export function saveState() {
  try {
    localStorage.setItem('mascodata_v3', JSON.stringify({
      user: state.user, isLoggedIn: state.isLoggedIn,
    }));
  } catch(e) {}
}

export function isDemoUser() { return !state.user?.id; }

// Un segundo tutor invitado con permiso "Solo lectura" (pet_access.role === 'viewer')
// no debería poder editar/eliminar nada de la mascota. Esto es un freno del lado
// del cliente para la UI normal, no reemplaza una política RLS por tabla — eso
// sigue pendiente de verificar/agregar en Supabase para bloquear el acceso real.
export function canEditPet(pet) {
  if (!pet) return true;
  return pet.myRole !== 'viewer';
}

export function blockIfReadOnly(pet) {
  if (canEditPet(pet)) return false;
  showToast('Tienes acceso de solo lectura a esta mascota', 'error');
  return true;
}

// Mismo patrón que canEditPet/blockIfReadOnly, pero para funciones que
// quedan detrás del plan Premium en vez del rol del tutor. El modo demo
// siempre se ve desbloqueado (es una vitrina del producto completo), igual
// que ya hace savePet() con el límite de mascotas.
export function isPremium() {
  return isDemoUser() || state.user?.plan === 'premium';
}

// Analítica de producto (PostHog, ver index.html). No-op si el script no cargó
// (localhost, tests, bloqueador). `demo` separa a quienes solo prueban la demo.
// Nunca mandar nombre, email, teléfono ni datos de salud en `props`.
export function track(event, props = {}) {
  try { window.posthog?.capture(event, { ...props, demo: isDemoUser() }); } catch (e) {}
}

// Click en "Mejorar a Premium" (todavía sin cobro en línea: solo avisa).
export function requestPremium(source) {
  track('upgrade_clicked', { source });
  showToast('Escríbenos para mejorar tu plan a Premium', '');
}

export function blockIfNotPremium(feature) {
  if (isPremium()) return false;
  track('premium_blocked', { feature });
  showToast(`${feature} es una función Premium — mejora tu plan para usarla.`, 'error');
  return true;
}

// Tarjeta de "esto es Premium" reutilizable — un fragmento, sin appShell
// propio, para insertar dentro de una vista que ya tiene el suyo (ej. el
// cuerpo del gráfico en Finanzas, que convive con filtros/stat cards que sí
// siguen siendo gratis).
export function premiumUpsellCard(iconName, title, desc) {
  return `
    <div class="bg-white rounded-2xl shadow-sm p-8 md:p-10 text-center max-w-lg mx-auto">
      <div class="mb-4 flex justify-center text-brand-300">${icon(iconName, 'w-12 h-12 md:w-14 md:h-14')}</div>
      <span class="badge bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wide">Premium</span>
      <h2 class="text-base md:text-lg font-bold text-gray-900 mt-3 mb-2">${title}</h2>
      <p class="text-sm text-gray-500 mb-6">${desc}</p>
      <button onclick="requestPremium('${iconName}')" class="btn-primary px-5 py-2.5 text-sm">Mejorar a Premium</button>
    </div>`;
}

// Pantalla completa para una sección entera detrás del plan Premium (ej.
// Botiquín) — mismo estilo que noPetsOnboarding() más abajo, pero con badge
// "Premium" y CTA de mejorar de plan en vez de "registrar tu primera mascota".
export function premiumUpsell(iconName, title, desc) {
  return appShell(`
    <div class="max-w-lg mx-auto text-center py-10 md:py-16 animate-fade-in">
      ${premiumUpsellCard(iconName, title, desc)}
    </div>
  `);
}

// ---- CARGA DE DATOS ----
// loadDataFromSupabase, loadAdminData: extraídas a js/data.js.

// ---- UTILIDADES ----
// Fechas, formato y cálculo de estado (todayStr, formatDate, getAge,
// careAlertStatus, medStockStatus, foodStockStatus, botiquinStatus,
// activityStreak, speciesEmoji, eventIcon, esc, genId) viven en
// js/utils.js — cargado como módulo antes que este archivo y expuesto en
// window, así que se siguen llamando igual acá sin cambiar nada.
export function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ---- ROUTER ----
// Rutas reales: la URL refleja la vista actual, el botón atrás/adelante del
// navegador funciona, y recargar la página no te manda siempre al dashboard.
// Requiere que el hosting reescriba cualquier path a index.html (ver vercel.json)
// ya que esto es una SPA de un solo archivo, sin páginas reales en el servidor.
export const ROUTE_PATHS = {
  login: '/login', register: '/register', forgot: '/forgot', resetPassword: '/reset-password',
  dashboard: '/', pets: '/pets', addPet: '/pets/nueva',
  calendar: '/calendar', finance: '/finanzas', botiquin: '/botiquin', admin: '/admin',
  profile: '/perfil',
};
export const AUTH_VIEWS = ['login', 'register', 'forgot', 'resetPassword'];

// Solo los ids reales de Supabase (pets.id) son uuid — los del modo demo son
// strings fijos tipo "pet-greta" (ver loadDemoAndLogin en auth.js), y los
// que genId() genera para otros registros ni siquiera tienen esta forma.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function viewToPath(view, params = {}) {
  if (view === 'petProfile') {
    const id = params.currentPetId || state.currentPetId;
    if (!id) return '/pets';
    // Nombre de la mascota como prefijo legible (ej. /pets/greta-98b1cfe4-...)
    // — el id real sigue siendo lo único que se lee al volver (ver
    // pathToView), así que el prefijo puede quedar desactualizado sin
    // romper nada si la mascota se renombra después. Solo se agrega sobre
    // un id con forma de uuid: para los ids de demo no hay separador que
    // distinga sin ambigüedad dónde termina el nombre y empieza el id.
    const pet = UUID_RE.test(id) && state.pets.find(p => p.id === id);
    const slug = pet?.name ? slugify(pet.name) : '';
    return `/pets/${slug ? slug + '-' : ''}${encodeURIComponent(id)}`;
  }
  return ROUTE_PATHS[view] || '/';
}

export function pathToView(pathname) {
  // El prefijo legible es puramente cosmético: solo el uuid al final importa,
  // así que un link viejo sin nombre (/pets/<uuid>) sigue funcionando igual.
  // Si no hay uuid al final (ids de demo tipo "pet-greta"), cae al patrón
  // genérico de siempre — un solo segmento, tal cual.
  const uuidMatch = pathname.match(/^\/pets\/(?:[a-z0-9-]*-)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i);
  const petMatch = uuidMatch || pathname.match(/^\/pets\/([^/]+)\/?$/);
  if (petMatch && petMatch[1] !== 'nueva') {
    return { view: 'petProfile', params: { currentPetId: decodeURIComponent(petMatch[1]), currentTab: 'general' } };
  }
  for (const [view, path] of Object.entries(ROUTE_PATHS)) {
    if (path === pathname) return { view };
  }
  return null;
}

// Deep-link inicial (carga directa o recarga): solo se respeta si calza con el
// estado de sesión — un usuario logueado no debería aterrizar en /login, y uno
// sin sesión no puede saltar directo a una vista protegida.
export function resolveInitialViewFromUrl(loggedIn) {
  const route = pathToView(location.pathname);
  if (!route) return null;
  const isAuthView = AUTH_VIEWS.includes(route.view);
  if (loggedIn && isAuthView) return null;
  if (!loggedIn && !isAuthView) return null;
  return route;
}

export function navigate(view, params = {}, opts = {}) {
  if (window.chartInstance) { window.chartInstance.destroy(); window.chartInstance = null; }
  Object.assign(state, { currentView: view, ...params });
  const path = viewToPath(view, params);
  if (location.pathname !== path) {
    if (opts.replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
  }
  render();
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => {
  const route = pathToView(location.pathname);
  if (!route) return;
  if (window.chartInstance) { window.chartInstance.destroy(); window.chartInstance = null; }
  Object.assign(state, { currentView: route.view, ...(route.params || {}) });
  render();
});

// ---- COMPONENTES ----
export function iconSVG(name) {
  const icons = {
    home:    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`,
    paw:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243zm7.364-9.243a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"/>`,
    calendar:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`,
    finance: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    kit:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>`,
    logout:  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>`,
    admin:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`,
    check:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>`,
    checkCircle:`<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    x:          `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`,
    warning:    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>`,
    bell:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>`,
    pencil:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>`,
    trash:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>`,
    paperclip:  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>`,
    plus:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>`,
    money:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    creditCard: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-9 4h16a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>`,
    clipboard:  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>`,
    users:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm5 0a4 4 0 10-1.5-7.7"/>`,
    mail:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>`,
    phone:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>`,
    chartBar:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>`,
    pin:        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>`,
    box:        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>`,
    bolt:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>`,
    fire:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.657 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"/>`,
    arrowUp:    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/>`,
    arrowDown:  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>`,
    arrowRight: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>`,
    arrowLeft:  `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"/>`,
    minus:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>`,
    lock:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>`,
    key:        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>`,
    flask:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5.106 14.4a2.25 2.25 0 00-.659 1.591v.001c0 1.242 1.007 2.25 2.25 2.25h10.606c1.243 0 2.25-1.008 2.25-2.25 0-.597-.237-1.169-.659-1.591l-3.985-3.991a2.25 2.25 0 01-.659-1.591V3.104M9.75 3.104a24.301 24.301 0 014.5 0"/>`,
    bug:        `<circle cx="12" cy="13" r="4" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9V6m0 0L9.5 4M12 6l2.5-2M8 12H5m11 1h3M9 16l-2 2m8-2l2 2M12 5.5v0"/>`,
    pill:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 15.5L15.5 7a4.243 4.243 0 116 6L13 21.5a4.243 4.243 0 01-6-6z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 11.5l3 3"/>`,
    weight:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v2m0 0a4 4 0 014 4H8a4 4 0 014-4zM5 9h14l1.4 8.4A2 2 0 0118.42 20H5.58a2 2 0 01-1.98-2.6L5 9z"/>`,
    activity:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>`,
    food:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12h18M3 12a9 9 0 0018 0M3 12a9 9 0 0118-0M8 6v2m4-2v2m4-2v2"/>`,
    heart:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>`,
    cake:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 2v4m0 0c-.5 0-1 .5-1 1s.5 1 1 1 1-.5 1-1-.5-1-1-1zM4 21v-7a2 2 0 012-2h12a2 2 0 012 2v7M4 21h16M4 21a2 2 0 002-2m14 2a2 2 0 01-2-2M4 15h16M9 12v3m6-3v3"/>`,
    face:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 15s1 1.5 3 1.5S15 15 15 15M9 9h.01M15 9h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    idea:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 18h6m-5 3h4m-7-9a6 6 0 1112 0c0 2.223-1.25 3.5-2.25 4.5S13 15 12 15s-1.75-.5-2.75-1.5S7 12.223 7 10z"/>`,
    hospital:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V7a2 2 0 00-2-2H7a2 2 0 00-2 2v14m14 0H5m14 0h2M5 21H3m8-14v4m-2-2h4M9 21v-4a1 1 0 011-1h4a1 1 0 011 1v4"/>`,
    scissors:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9a3 3 0 100-6 3 3 0 000 6zm0 0v0a3 3 0 013 3v0m-3-3l12 8m0-14L9 12m9 6a3 3 0 11-6 0 3 3 0 016 0z"/>`,
    building:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01M10 21v-4a2 2 0 014 0v4"/>`,
    menu:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>`,
    receipt:    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l2 2 4-4m3 9l-1.5-1.5L15 21l-1.5-1.5L12 21l-1.5-1.5L9 21l-1.5-1.5L6 21V5a2 2 0 012-2h8a2 2 0 012 2v16z"/>`,
    folder:     `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>`,
    clock:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`,
    document:   `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`,
    printer:    `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m10 0v4a1 1 0 01-1 1H8a1 1 0 01-1-1v-4m10 0H7m10-9V4a1 1 0 00-1-1H8a1 1 0 00-1 1v4h10z"/>`,
    party:      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.25 5.25l1.5 1.5m10.5-1.5l-1.5 1.5M3 12h2.25m13.5 0H21M8 21l8-15 5 15-8-4-5 4z"/>`,
    wave:       `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904"/>`,
    dog:        `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8c0-1.5 1-3 3-3l2 3M20 8c0-1.5-1-3-3-3l-2 3M6 8c0 4 2.5 7 6 7s6-3 6-7M6 8H5a1 1 0 000 2h1m12-2h1a1 1 0 010 2h-1M10 15v2m4-2v2m-5 2h6"/>`,
  };
  return icons[name] || '';
}

// Envuelve un ícono lineal (svg) con tamaño/color consistentes — reemplaza el
// uso disperso de emojis como iconografía funcional en toda la app.
export function icon(name, cls = 'w-5 h-5') {
  return `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconSVG(name)}</svg>`;
}

export function sidebar() {
  const items = [
    { v:'dashboard', label:'Inicio' },
    { v:'pets',      label:'Mis Mascotas' },
    { v:'calendar',  label:'Agenda' },
    { v:'finance',   label:'Finanzas' },
    { v:'botiquin',  label:'Botiquín' },
    ...(state.user?.isAdmin ? [{ v:'admin', label:'Admin' }] : []),
  ];
  const navIcons = { dashboard:'home', pets:'paw', calendar:'calendar', finance:'finance', botiquin:'kit', admin:'admin' };
  return `
  <aside class="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-20">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
      <svg viewBox="0 0 64 64" class="w-8 h-8 rounded-xl flex-shrink-0" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mascodata"><rect width="64" height="64" rx="14" fill="#C2471F"/><rect x="14" y="19" width="9" height="12" rx="4.5" fill="#FFF8F0"/><rect x="27.5" y="14" width="9" height="17" rx="4.5" fill="#FFF8F0"/><rect x="41" y="9" width="9" height="22" rx="4.5" fill="#FFF8F0"/><path fill="#FFF8F0" d="M32 35c6.5 0 10.5 4.2 13.2 8.6 2.6 4.2 1 9.4-4 9.4-3.4 0-5.6-1.6-9.2-1.6s-5.8 1.6-9.2 1.6c-5 0-6.6-5.2-4-9.4C21.5 39.2 25.5 35 32 35z"/></svg>
      <div class="font-bold text-sm leading-none"><span class="text-brand-500">Masco</span><span class="text-gray-900">da</span><span class="text-brand-500">ta</span></div>
    </div>
    <nav class="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
      ${items.map(i => {
        const active = state.currentView === i.v;
        return `
        <button onclick="navigate('${i.v}')" aria-current="${active?'page':'false'}"
          class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 ${active ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}">
          <svg class="w-4.5 h-4.5 flex-shrink-0 ${active?'text-brand-600':'text-gray-400 group-hover:text-gray-600'}" style="width:1.1rem;height:1.1rem" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${iconSVG(navIcons[i.v]||'home')}
          </svg>
          <span>${i.label}</span>
        </button>`;
      }).join('')}
    </nav>
    <div class="px-3 py-3 border-t border-gray-100">
      <div class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors">
        <button onclick="navigate('profile')" title="Mi perfil" class="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div class="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${esc((state.user?.name||'U')[0].toUpperCase())}</div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-gray-900 truncate">${esc(state.user?.name||'')}</div>
            <div class="text-xs text-gray-400 truncate" title="${esc(state.user?.email||'')}">${esc(state.user?.email||'')}</div>
          </div>
        </button>
        <button onclick="logout()" title="Cerrar sesión"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconSVG('logout')}</svg>
        </button>
      </div>
    </div>
  </aside>`;
}

// Antes no había NINGUNA forma de llegar al perfil/logout en mobile — sidebar()
// es hidden md:flex y bottomNav() solo trae las 5 secciones principales. Esta
// barra chica (sticky, no fixed, para no tener que compensar su alto con
// padding en <main>) le da al mobile un acceso equivalente al de la fila de
// usuario del sidebar de escritorio.
export function mobileTopBar() {
  return `
  <div class="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 flex items-center justify-between px-4 py-2.5"
    style="padding-top:calc(0.625rem + env(safe-area-inset-top))">
    <div class="flex items-center gap-2">
      <svg viewBox="0 0 64 64" class="w-7 h-7 rounded-lg flex-shrink-0" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mascodata"><rect width="64" height="64" rx="14" fill="#C2471F"/><rect x="14" y="19" width="9" height="12" rx="4.5" fill="#FFF8F0"/><rect x="27.5" y="14" width="9" height="17" rx="4.5" fill="#FFF8F0"/><rect x="41" y="9" width="9" height="22" rx="4.5" fill="#FFF8F0"/><path fill="#FFF8F0" d="M32 35c6.5 0 10.5 4.2 13.2 8.6 2.6 4.2 1 9.4-4 9.4-3.4 0-5.6-1.6-9.2-1.6s-5.8 1.6-9.2 1.6c-5 0-6.6-5.2-4-9.4C21.5 39.2 25.5 35 32 35z"/></svg>
      <span class="font-bold text-sm"><span class="text-brand-500">Masco</span><span class="text-gray-900">da</span><span class="text-brand-500">ta</span></span>
    </div>
    <button onclick="navigate('profile')" title="Mi perfil"
      class="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      ${esc((state.user?.name||'U')[0].toUpperCase())}
    </button>
  </div>`;
}

export function bottomNav() {
  const items = [
    { v:'dashboard', icon:'home',     label:'Inicio' },
    { v:'pets',      icon:'paw',      label:'Mascotas' },
    { v:'calendar',  icon:'calendar', label:'Agenda' },
    { v:'finance',   icon:'finance',  label:'Finanzas' },
    { v:'botiquin',  icon:'kit',      label:'Botiquín' },
  ];
  return `
  <nav class="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-gray-100 z-20" style="padding-bottom:env(safe-area-inset-bottom)">
    <div class="flex">
      ${items.map(i => {
        const active = state.currentView === i.v;
        return `
        <button onclick="navigate('${i.v}')" class="relative flex-1 flex flex-col items-center gap-0.5 pt-2 pb-1.5 transition-colors ${active?'text-brand-600':'text-gray-400'}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconSVG(i.icon)}</svg>
          <span class="text-[10px] font-medium">${i.label}</span>
          ${active?`<span class="absolute bottom-0 w-8 h-0.5 rounded-full bg-brand-500 mb-0.5"></span>`:''}
        </button>`;
      }).join('')}
    </div>
  </nav>`;
}

export function appShell(content) {
  return `
  ${sidebar()}
  <div class="md:ml-60 flex flex-col min-h-screen">
    ${mobileTopBar()}
    <main class="flex-1 pb-24 md:pb-10 px-4 py-5 md:px-8 md:py-8 max-w-6xl mx-auto w-full animate-fade-in">${content}</main>
    ${bottomNav()}
  </div>`;
}

export function pageHeader(title, subtitle = '', action = '') {
  return `
  <div class="flex items-start justify-between gap-3 mb-6 flex-wrap">
    <div class="min-w-0 flex-1">
      <h1 class="text-xl md:text-2xl font-bold text-gray-900 leading-tight">${title}</h1>
      ${subtitle ? `<p class="text-sm text-gray-500 mt-0.5">${subtitle}</p>` : ''}
    </div>
    ${action ? `<div class="flex-shrink-0">${action}</div>` : ''}
  </div>`;
}

export function statCard(icon, label, value, color = 'brand') {
  const colors = {
    brand: 'bg-brand-50 text-brand-600',
    teal:  'bg-teal-50 text-teal-600',
    amber: 'bg-amber-50 text-amber-600',
    red:   'bg-red-50 text-red-600',
  };
  return `
  <div class="bg-white rounded-2xl p-4 md:p-5 shadow-sm card-hover animate-fade-in">
    <div class="w-9 h-9 md:w-10 md:h-10 rounded-xl ${colors[color]} flex items-center justify-center text-lg md:text-xl mb-3">${icon}</div>
    <div class="text-xl md:text-2xl font-bold text-gray-900 leading-none">${value}</div>
    <div class="text-xs md:text-sm text-gray-500 mt-1">${label}</div>
  </div>`;
}

export function petAvatar(pet, size = 'sm') {
  const dim = size === 'lg' ? 'w-24 h-24 text-4xl' : 'w-14 h-14 text-2xl';
  if (pet.photo) return `<img src="${pet.photo}" class="${size === 'lg' ? 'pet-avatar-lg' : 'pet-avatar'}" alt="${esc(pet.name)}" />`;
  return `<div class="${dim} pet-avatar-placeholder rounded-full">${speciesEmoji(pet.species)}</div>`;
}

export function emptyState(iconName, title, sub, btnLabel = '', btnFn = '') {
  return `
  <div class="text-center py-8 md:py-10 animate-fade-in">
    <div class="mb-3 flex justify-center text-gray-300">${icon(iconName, 'w-12 h-12 md:w-14 md:h-14')}</div>
    <h3 class="text-base md:text-lg font-semibold text-gray-700 mb-1">${title}</h3>
    <p class="text-sm text-gray-400 mb-5">${sub}</p>
    ${btnLabel ? `<button onclick="${btnFn}" class="btn-primary">${btnLabel}</button>` : ''}
  </div>`;
}

// Pantalla completa que reemplaza a Finanzas/Agenda/Botiquín cuando no hay
// mascotas registradas — antes mostraban tarjetas de estadísticas en 0 y
// filtros vacíos que aparentaban funcionar sin tener sobre qué operar.
export function noPetsOnboarding(iconName, title, desc) {
  return appShell(`
    <div class="max-w-lg mx-auto text-center py-10 md:py-16 animate-fade-in">
      <div class="mb-4 flex justify-center text-brand-300">${icon(iconName, 'w-14 h-14 md:w-16 md:h-16')}</div>
      <h2 class="text-lg md:text-xl font-bold text-gray-900 mb-2">${title}</h2>
      <p class="text-sm text-gray-500 mb-6">${desc}</p>
      <button onclick="navigate('addPet')" class="btn-primary px-6 py-3 text-base">+ Registrar mi primera mascota</button>
    </div>
  `);
}

// viewLogin, viewRegister, viewResetPassword, handleResetPassword, viewForgot: extraídas a js/auth.js.

// viewDashboard: extraída a js/dashboard.js.

// getAgendaEvents: extraída a js/data.js.

// ---- VISTA: MASCOTAS ----

// ---- VISTA: AGREGAR MASCOTA (STEPPER) ----

// ---- VISTA: PERFIL DE MASCOTA ----

// ---- VISTA: CALENDARIO ----

// getFinanceExpenses: extraída a js/data.js.

// ---- VISTA: FINANZAS ----

// ---- MODALES ----
export function openModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="closeModal(event)">${html}</div>`;
}
export function closeModal(e) {
  if (!e || e.target.classList.contains('modal-overlay')) {
    document.getElementById('modal-root').innerHTML = '';
  }
}

// ---- CONTROLADORES ----
// handleLogin, login, handleRegister, register, handleForgot, sendForgotEmail, logout: extraídos a js/auth.js.

// Helpers for stepper

// mantener compatibilidad con llamadas antiguas

// ---- CSS CLASSES HELPER (inject into head) ----
export function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    *{box-sizing:border-box}
    .input-field{width:100%;padding:0.55rem 0.75rem;border:1.5px solid #e6d8c9;border-radius:0.875rem;font-size:0.875rem;transition:border-color .15s,box-shadow .15s;background:white;color:#1d2b3a;line-height:1.4}
    .input-field:focus{border-color:#1f7a6e;box-shadow:0 0 0 3px rgba(31,122,110,.18);outline:none}
    .input-field::placeholder{color:#9c8b7b}
    select.input-field{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236e6259'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 0.6rem center;background-size:1.1rem;padding-right:2rem;appearance:none;cursor:pointer}
    .form-label{display:block;font-size:0.72rem;font-weight:600;color:#6e6259;margin-bottom:0.3rem;text-transform:uppercase;letter-spacing:.03em}
    .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;padding:.5rem 1.125rem;background:#c2471f;color:white;border-radius:0.875rem;font-weight:600;font-size:.875rem;transition:opacity .15s,transform .1s,box-shadow .15s;cursor:pointer;border:none;letter-spacing:-.01em;box-shadow:0 1px 3px 0 rgba(194,71,31,.35)}
    .btn-primary:hover{opacity:.92;transform:translateY(-1px);box-shadow:0 4px 12px rgba(194,71,31,.4)}
    .btn-primary:active{transform:translateY(0);opacity:1}
    .btn-secondary{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;padding:.5rem 1.125rem;background:#f6ece0;color:#1d2b3a;border-radius:0.875rem;font-weight:600;font-size:.875rem;transition:background .15s,color .15s;cursor:pointer;border:1.5px solid #e6d8c9}
    .btn-secondary:hover{background:#e6d8c9;border-color:#c1b2a2}
    .bg-brand-gradient{background:#c2471f}
    .card-elevated{background:white;border-radius:1.25rem;box-shadow:0 1px 2px 0 rgba(29,43,58,.06),0 4px 12px 0 rgba(29,43,58,.06);border:1px solid rgba(29,43,58,.05)}
    .page-header-action button,.page-header-action a{white-space:nowrap}
    /* ---- Mobile overrides ---- */
    input[type="date"]::-webkit-date-and-time-value{text-align:center;display:block;width:100%}
    input[type="date"]{text-align:center;text-align-last:center;min-width:0!important;max-width:100%!important;width:100%!important;box-sizing:border-box!important}
    @media(max-width:640px){
      .input-field{font-size:16px}
      /* Modal slides up from bottom on mobile */
      .modal-overlay{align-items:flex-end;padding:0}
      .modal-box{border-radius:1.5rem 1.5rem 0 0;max-width:100%;max-height:92vh;padding-bottom:env(safe-area-inset-bottom,0px)}
      /* Calendar cells compact on mobile */
      .calendar-day{min-height:44px!important;padding:3px}
      /* Bigger tap area for small buttons */
      .btn-primary,.btn-secondary{min-height:40px}
      /* Section cards: tighter padding */
      .space-y-3>*+*{margin-top:.6rem}
    }
    /* Modal: flex column so footer can stick */
    .modal-box{display:flex;flex-direction:column}
    /* Sticky action buttons — last direct div child of modal-box (the button row) */
    .modal-box>form>div:last-child,
    .modal-box>div.space-y-3>div:last-child,
    .modal-box>div.space-y-4>div:last-child{
      position:sticky;bottom:0;background:white;
      padding-top:12px;margin-top:4px;
      border-top:1px solid #f6ece0;z-index:2
    }
    @keyframes slideInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideUpModal{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
    .animate-slide-in-up{animation:slideInUp .25s ease both}
    @media(max-width:640px){
      .modal-box{animation:slideUpModal .3s cubic-bezier(.32,.72,0,1) both}
    }
    @media print {
      @page { margin: 1.2cm; }
      .modal-overlay { position:static !important; background:none !important; overflow:visible !important; }
      .modal-box { box-shadow:none !important; max-height:none !important; border-radius:0 !important; }
      aside, nav, .modal-overlay > div > div:last-child { display:none !important; }
      /* Al imprimir el expediente desde el modal "Exportar", oculta la
         ficha de la mascota que queda detrás — si no, el print mezclaba
         la pestaña activa (General, Vacunas, etc.) con el contenido del
         modal, dando un resultado distinto según en qué pestaña estabas. */
      body:has(.modal-overlay) .pet-tab-content { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

// ---- VISTA: BOTIQUÍN ----
// botiquinStatus/medStockStatus/medStockDaysRemaining/foodStockStatus/etc.
// viven en js/utils.js (ver comentario en la sección UTILIDADES más arriba).

// ---- TAB: SEGUIMIENTO ----

// ---- TAB: NUTRICIÓN ----

// ---- WEIGHT CHART ----

// ---- BCS setter ----

// ---- MODAL: Peso ----

// ---- MODAL: Mood ----

// ---- MODAL: Síntomas ----
export const SYMPTOM_TAGS = ['Vómito','Diarrea','Sin apetito','Letargo','Tos','Estornudos','Cojera','Rascado','Otros'];

// ---- ALIMENTO: stock en vez de registro diario ----
// En vez de anotar cada comida (engorroso y poco práctico), se guarda el
// producto que se compra y cuánto se le da por día — la app calcula sola
// cuándo se estima que se acaba y avisa con anticipación (mismo enfoque que
// el stock de medicamentos del Botiquín, ver foodStockStatus más arriba).

// ---- ACTIVIDAD: check-in diario en vez de registro detallado ----
// Un toque ("Poco"/"Normal"/"Mucho") en vez de un formulario con tipo,
// duración y distancia — reutiliza la tabla `activities` (type guarda el
// nivel elegido), un registro por día.
export const ACTIVITY_LEVELS = ['Poco', 'Normal', 'Mucho'];

// ---- EXPORT PET RECORD ----

// ---- RENDER ----
export function render() {
  const app = document.getElementById('app');
  const v = state.currentView;
  if (!state.isLoggedIn && !AUTH_VIEWS.includes(v)) { navigate('login', {}, { replace: true }); return; }
  if (state.isLoggedIn && AUTH_VIEWS.includes(v)) { navigate('dashboard', {}, { replace: true }); return; }
  if      (v === 'login')         app.innerHTML = viewLogin();
  else if (v === 'register')      app.innerHTML = viewRegister();
  else if (v === 'forgot')        app.innerHTML = viewForgot();
  else if (v === 'resetPassword') app.innerHTML = viewResetPassword();
  else if (v === 'dashboard')     app.innerHTML = viewDashboard();
  else if (v === 'pets')          app.innerHTML = viewPets();
  else if (v === 'addPet')        app.innerHTML = viewAddPet();
  else if (v === 'petProfile')    app.innerHTML = viewPetProfile();
  else if (v === 'calendar')      app.innerHTML = viewCalendar();
  else if (v === 'finance')       app.innerHTML = viewFinance();
  else if (v === 'botiquin')      app.innerHTML = viewBotiquin();
  else if (v === 'profile')       app.innerHTML = viewProfile();
  else if (v === 'admin')        { if (state.user?.isAdmin) { loadAdminData().then(() => { app.innerHTML = viewAdmin(); }); } else navigate('dashboard', {}, { replace: true }); }
  else navigate('dashboard', {}, { replace: true });
}

// loadDemoAndLogin: extraída a js/auth.js.

// ---- EDITAR VACUNA ----

// ---- EDITAR DESPARASITACIÓN ----

// ---- EDITAR MEDICAMENTO/TRATAMIENTO ----

// ---- EDITAR HISTORIAL ----

// ---- SEGUNDO TUTOR ----

// Crea la invitación (tabla invitations) y dispara el magic link de Supabase.
// Se usa tanto desde el wizard de alta (paso 4) como desde el botón "+ Invitar"
// del perfil de la mascota. En modo demo no hay sesión real de Supabase, así que
// solo simulamos el estado "pendiente" localmente.

// Se ejecuta cuando alguien llega a la app desde el link del magic link (?invite=TOKEN).
// El magic link ya autentica a la persona invitada — solo falta darle acceso a la mascota.

// ---- VISTA ADMINISTRADOR ----
// Extraído a js/admin.js (viewAdmin, openChangePlanModal, applyPlanChange).
// ---- INIT ----
export async function initApp() {
  injectStyles();
  loadState();

  // Detect password recovery link FIRST (hash contains type=recovery)
  const hash = location.hash;
  const isRecovery = hash.includes('type=recovery');
  if (isRecovery) {
    // Let Supabase exchange the token silently, then show reset form
    await sb.auth.getSession(); // exchanges the token from hash
    state.currentView = 'resetPassword';
    state.isLoggedIn = false;
    history.replaceState(null, '', ROUTE_PATHS.resetPassword);
    render();
    // Register listener for sign-out after reset
    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { state.isLoggedIn = false; state.user = null; navigate('login', {}, { replace: true }); }
    });
    return; // skip normal init
  }

  // Check for existing Supabase session
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    if (!state.isLoggedIn) {
      const userName = session.user.user_metadata?.name || session.user.email.split('@')[0];
      state.user = { name: userName, email: session.user.email, id: session.user.id };
      state.isLoggedIn = true;
      // Cubre sesiones que nunca pasan por register()/login() — ej. un segundo
      // tutor que crea su cuenta vía el magic link de una invitación — para que
      // siempre exista una fila en profiles antes de cualquier insert que dependa
      // de ella (pet_access.user_id, etc.).
      const { error: profileError } = await sb.from('profiles').upsert({ id: session.user.id, email: session.user.email, name: userName }, { onConflict: 'id' });
      if (profileError) console.error('Error al crear/actualizar profile:', profileError);
      if (!state.currentView || state.currentView === 'login') {
        const route = resolveInitialViewFromUrl(true);
        state.currentView = route ? route.view : 'dashboard';
        if (route?.params) Object.assign(state, route.params);
      }
    }
    // state.pets/events/expenses nunca se persisten en localStorage (solo user/
    // isLoggedIn, ver saveState()), así que hay que recargarlos desde Supabase
    // en TODA carga con sesión activa — no solo la primera vez que se detecta
    // login. Antes esto solo corría dentro del `if (!state.isLoggedIn)` de arriba,
    // por lo que recargar la página con sesión ya iniciada dejaba state.pets
    // vacío y mostraba el onboarding de "agrega tu primera mascota" aunque ya
    // tuviera una — llevando a mascotas duplicadas.
    await loadDataFromSupabase();
  } else if (state.isLoggedIn && isDemoUser()) {
    // El modo demo no tiene sesión real de Supabase, así que el `if
    // (session)` de arriba nunca corre para él — y state.pets/events/
    // expenses/botiquin tampoco se persisten en localStorage (ver
    // saveState()). Antes de este else-if, recargar la página (o volver a
    // abrir la pestaña) mientras se estaba "logueado" en modo demo dejaba
    // isLoggedIn en true pero todos los arreglos vacíos — el dashboard
    // mostraba el onboarding de "sin mascotas" como si los datos de
    // prueba hubieran desaparecido. Se vuelve a generar en silencio (sin
    // el toast/navigate del click explícito) para no interrumpir un
    // deep-link ya resuelto por loadState().
    loadDemoAndLogin(true);
  }

  // Invitación de segundo tutor pendiente (llegó por ?invite=TOKEN, ver loadState())
  if (session && state.inviteToken) {
    const token = state.inviteToken;
    state.inviteToken = null;
    await acceptPetInvite(token);
    state.currentView = 'dashboard';
    history.replaceState(null, '', ROUTE_PATHS.dashboard);
  }

  // Listen for auth changes
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      state.currentView = 'resetPassword';
      state.isLoggedIn = false;
      history.replaceState(null, '', ROUTE_PATHS.resetPassword);
      render();
      return;
    }
    if (event === 'SIGNED_OUT') {
      state.isLoggedIn = false;
      state.user = null;
      state.currentView = 'login';
      history.replaceState(null, '', ROUTE_PATHS.login);
      render();
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      state.user = {
        name: session.user.user_metadata?.name || session.user.email.split('@')[0],
        email: session.user.email,
        id: session.user.id
      };
    }
  });

  // Si el deep link inicial no era válido para el estado de sesión resuelto
  // (ej: sin sesión pidiendo /pets/x), la URL debe reflejar la vista real.
  const expectedPath = viewToPath(state.currentView, state);
  if (location.pathname !== expectedPath) history.replaceState(null, '', expectedPath);

  render();
}

document.addEventListener('DOMContentLoaded', initApp);

// Exposición explícita en window: como js/app.js pasa a ser un módulo ES
// (igual que el resto), sus funciones y constantes de nivel superior ya no
// son globales implícitos — hay que asignarlas a mano, igual que en cada
// módulo de feature (ver js/utils.js para el porqué de esta convención).
if (typeof window !== 'undefined') {
  Object.assign(window, {
    getPage, setPage, paginate, pagerHTML, loadState, saveState, isDemoUser,
    canEditPet, blockIfReadOnly, isPremium, blockIfNotPremium, premiumUpsell, premiumUpsellCard, track, requestPremium,
    showToast, viewToPath, pathToView,
    resolveInitialViewFromUrl, navigate, iconSVG, icon, sidebar, bottomNav, mobileTopBar,
    appShell, pageHeader, statCard, petAvatar, emptyState, noPetsOnboarding,
    openModal, closeModal, injectStyles, render, initApp,
    sb, VACCINES_BY_SPECIES, PLAN_PET_LIMITS, PLAN_LABELS, PREMIUM_PRICE_CLP, PERIODICITY_OPTIONS,
    BREEDS, CHILE_REGIONS, PAGE_SIZE, defaultState, ROUTE_PATHS, AUTH_VIEWS, SYMPTOM_TAGS,
    ACTIVITY_LEVELS, state,
  });
}
