/* ============================================================
   MASCODATA — Utilidades puras (fechas, formato, cálculo de estado)
   ============================================================
   Primer módulo extraído de js/app.js (2026-09-08). Ninguna de estas
   funciones se llama desde un onclick="..." del HTML generado, así que
   moverlas acá no puede romper ningún botón — son las funciones más
   seguras de aislar y las más valiosas de testear (ver js/utils.test.js).

   Se cargan como módulo ES (`<script type="module" src="/js/utils.js">`
   en index.html, antes de js/app.js) para que Vitest pueda importarlas
   directamente, y además se agregan a `window` al final de este archivo
   para que js/app.js — que sigue siendo un script clásico, sin tocar —
   las siga viendo como globales exactamente igual que antes. */

export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T12:00:00');
  return dt.toLocaleDateString('es-CL', { day:'2-digit', month:'2-digit', year:'numeric' });
}

// "Hoy" en fecha LOCAL (YYYY-MM-DD), no en UTC. `new Date().toISOString()` usa UTC,
// así que en Chile (UTC-4/-3) desde ~las 20:00 hasta medianoche ya reporta el día
// siguiente — rompía vencimientos, calendario, eventos próximos y alertas.
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fecha local, N días desde hoy (para umbrales tipo "vence en 30 días").
export function daysFromNowStr(days) {
  const d = new Date(todayStr() + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addMonths(dateStr, months) {
  if (!dateStr || !months) return '';
  const d = new Date(dateStr + 'T12:00:00');
  const whole = Math.trunc(months);
  const frac = months - whole;
  d.setMonth(d.getMonth() + whole);
  if (frac) d.setDate(d.getDate() + Math.round(frac * 30));
  return d.toISOString().slice(0, 10);
}

// Fecha local, N días desde una fecha dada (mismo cuidado de horario local que
// todayStr/daysFromNowStr — nunca .toISOString() acá).
export function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + Math.round(days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Días entre dos fechas locales YYYY-MM-DD (b - a).
export function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T12:00:00'), b = new Date(dateB + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

export function getAge(dob) {
  if (!dob) return '';
  const b = new Date(dob + 'T12:00:00'), n = new Date();
  let y = n.getFullYear() - b.getFullYear();
  let m = n.getMonth() - b.getMonth();
  if (n.getDate() < b.getDate()) m--;
  if (m < 0) { y--; m += 12; }
  if (y <= 0) { const totalMonths = Math.max(0, y * 12 + m); return `${totalMonths} mes${totalMonths !== 1 ? 'es' : ''}`; }
  return `${y} año${y !== 1 ? 's' : ''}`;
}

// Convierte alertType/alertDays (guardados en vacunas/desparasitaciones pero antes
// nunca usados) en un estado de 3 niveles: vencido / próximo / al día.
export function careAlertStatus(nextDate, alertType, alertDays) {
  if (!nextDate) return { status: 'sin_fecha', label: '', color: 'text-gray-400', badge: 'bg-gray-100 text-gray-500' };
  const today = todayStr();
  if (nextDate < today) return { status: 'vencido', label: 'Vencido', color: 'text-red-500', badge: 'bg-red-100 text-red-600' };
  const windowDays = alertType === 'week' ? 7 : alertType === 'custom' ? (parseInt(alertDays) || 0) : 0;
  const thresholdDate = new Date(today + 'T12:00:00');
  thresholdDate.setDate(thresholdDate.getDate() + windowDays);
  const thresholdStr = `${thresholdDate.getFullYear()}-${String(thresholdDate.getMonth() + 1).padStart(2, '0')}-${String(thresholdDate.getDate()).padStart(2, '0')}`;
  if (nextDate <= thresholdStr) {
    const daysLeft = Math.round((new Date(nextDate + 'T12:00:00') - new Date(today + 'T12:00:00')) / 86400000);
    return { status: 'proximo', label: daysLeft <= 0 ? 'Vence hoy' : `Vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`, color: 'text-amber-500', badge: 'bg-amber-100 text-amber-600' };
  }
  return { status: 'al_dia', label: 'Al día', color: 'text-green-600', badge: 'bg-green-100 text-green-700' };
}

export function speciesEmoji(s) {
  return { Perro:'🐕', Gato:'🐈', Ave:'🦜', Conejo:'🐇', Pez:'🐠', Hámster:'🐹', Reptil:'🦎', Otro:'🐾' }[s] || '🐾';
}

export function fmtCLP(n) {
  return Number(n || 0).toLocaleString('es-CL', { style:'currency', currency:'CLP', maximumFractionDigits:0 });
}

// Monto abreviado para etiquetas donde no cabe el número completo (ej. sobre
// cada barra del gráfico de Finanzas): 52400 → "$52k", 1712890 → "$1,7M".
export function fmtCompactCLP(n) {
  const v = Math.round(Number(n || 0));
  if (v < 1000) return '$' + v;
  if (Math.round(v / 1000) < 1000) return '$' + Math.round(v / 1000) + 'k';
  return '$' + String(Math.round(v / 100000) / 10).replace('.', ',') + 'M';
}

// Convierte el valor tipeado en un campo de costo (CLP) a un entero limpio
// para guardar. Los campos de costo son type="text" (no type="number"): en
// es-CL el "." es separador de miles, no decimal, y un usuario que escribe
// "190.000" esperando 190 mil pesos — si el campo fuera type="number", el
// navegador lo interpreta como 190.000 = doscientos noventa (!), y ese
// string se mandaba tal cual a una columna integer de Supabase, tirando
// "invalid input syntax for type integer". Acá se ignora cualquier
// caracter que no sea dígito (separadores de miles, decimales, signos),
// así que "190.000", "190000" y "190,000" dan todos 190000 — CLP no tiene
// centavos, así que no hay ambigüedad real que perder.
export function parseCLP(str) {
  if (str === null || str === undefined) return null;
  const digits = String(str).replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

// Escapa texto libre (nombres, notas, descripciones) antes de insertarlo como
// contenido HTML o valor de atributo — toda la app arma su UI por
// interpolación de strings + innerHTML sin sanitizar, así que un tutor
// compartido podría meter HTML/JS en un campo de texto y afectar la sesión
// del otro tutor cuando abre esa ficha. NUNCA usar dentro de un atributo
// onclick que llama una función pasándole el valor como argumento — ahí es un
// literal de JS y el navegador decodifica las entidades antes de compilarlo,
// así que NO protege. En onclick pasa solo ids (usa safeId) y busca el texto
// en el estado dentro de la función.
// ---- COMPLETITUD DEL PERFIL DE UNA MASCOTA ----
// 13 campos con peso que suman 100. Nombre y especie ya vienen al crear, así
// que toda mascota parte en 10 %. En especies donde vacunas, desparasitación,
// estado reproductivo y microchip no suelen aplicar (peces, aves, hámsteres,
// reptiles) esos campos se excluyen y el porcentaje se recalcula sobre el resto.
// Sexo y estado reproductivo llegan preseleccionados desde el asistente, así que
// casi siempre cuentan como completos: no distinguen "no sé" de "respondió".
// Si cambian pesos o campos, actualizar también
// supabase/functions/pet-completion-reminders/index.ts (hay un test de paridad).
export const COMPLETENESS_FIELDS = [
  { key: 'basic',    points: 10, label: 'Nombre y especie',        hint: '',                                   action: 'edit',    has: p => !!(p.name && p.species) },
  { key: 'dob',      points: 12, label: 'Fecha de nacimiento',     hint: 'Activa las sugerencias por edad',    action: 'edit',    has: p => !!p.dateOfBirth },
  { key: 'photo',    points: 7,  label: 'Foto',                    hint: 'Hace la ficha más tuya',             action: 'edit',    has: p => !!p.photo },
  { key: 'breed',    points: 5,  label: 'Raza',                    hint: 'Activa las sugerencias por raza',    action: 'edit',    has: p => !!p.breed },
  { key: 'sex',      points: 3,  label: 'Sexo',                    hint: 'Dato básico de la ficha',            action: 'edit',    has: p => !!p.sex },
  { key: 'chip',     points: 3,  label: 'Microchip',               hint: 'Útil si se pierde',                  action: 'edit',    has: p => !!p.chipNumber, healthOnly: true },
  { key: 'vaccine',  points: 16, label: 'Al menos una vacuna',     hint: 'Activa las alertas de vacunas',      action: 'vaccine', has: p => (p.vaccines || []).length > 0, healthOnly: true },
  { key: 'deworm',   points: 8,  label: 'Al menos una desparasitación', hint: 'Activa sus alertas',            action: 'deworm',  has: p => (p.deworming || []).length > 0, healthOnly: true },
  { key: 'allergies', points: 8, label: 'Alergias y condiciones',  hint: 'Marca "Ninguna" si no tiene',        action: 'edit',    has: p => (p.allergies || []).length > 0 || (Array.isArray(p.chronicConditions) ? p.chronicConditions.length > 0 : !!p.chronicConditions) },
  { key: 'weight',   points: 8,  label: 'Peso',                    hint: 'Alimenta el seguimiento',            action: 'edit',    has: p => Number(p.weightKg) > 0 },
  { key: 'repro',    points: 5,  label: 'Estado reproductivo',     hint: 'Dato de la ficha',                   action: 'edit',    has: p => !!p.reproductiveStatus, healthOnly: true },
  { key: 'vetName',  points: 8,  label: 'Nombre del veterinario',  hint: 'Para tenerlo a mano en emergencias', action: 'edit',    has: p => !!(p.vet && p.vet.name && String(p.vet.name).trim()) },
  { key: 'vetPhone', points: 7,  label: 'Teléfono del veterinario', hint: 'Para llamar rápido',                action: 'edit',    has: p => !!(p.vet && p.vet.phone && String(p.vet.phone).trim()) },
];
const NO_HEALTH_SPECIES = ['Pez', 'Ave', 'Hámster', 'Reptil'];

export function petCompleteness(pet) {
  const skipHealth = NO_HEALTH_SPECIES.includes(pet?.species);
  const fields = COMPLETENESS_FIELDS.filter(f => !(skipHealth && f.healthOnly));
  const total = fields.reduce((a, f) => a + f.points, 0);
  const done = fields.filter(f => f.has(pet || {}));
  const earned = done.reduce((a, f) => a + f.points, 0);
  const missing = fields.filter(f => !f.has(pet || {}))
    .map(f => ({ key: f.key, label: f.label, hint: f.hint, action: f.action, gain: Math.round(f.points * 100 / total), points: f.points }))
    .sort((a, b) => b.points - a.points);
  return { percent: Math.round(earned * 100 / total), missing, done: done.map(f => f.key) };
}

// Para valores que entran a un literal de JS dentro de un atributo onclick:
// solo deja los caracteres que tienen los ids internos (uuid/genId). esc() NO
// protege ahí — el navegador decodifica las entidades antes de compilar el JS.
export function safeId(id) {
  return String(id ?? '').replace(/[^A-Za-z0-9_-]/g, '');
}

// Solo acepta data URLs base64 de imágenes, PDF y Word — lo único que genera la
// app con FileReader. Cualquier otra cosa (comillas, javascript:, HTML) vuelve
// vacía, así que es seguro usarla directo en src/href sin escapar.
export function safeDataUrl(str) {
  const s = typeof str === 'string' ? str : '';
  return /^data:(image\/(png|jpe?g|gif|webp|bmp)|application\/(pdf|msword|octet-stream|vnd\.[a-z0-9.+-]+));base64,[A-Za-z0-9+/=]+$/i.test(s) ? s : '';
}

// Reduce una imagen en el navegador antes de guardarla: las fotos de celular
// pesan 3-6 MB y se guardan como base64 dentro de la base de datos (plan Free
// de Supabase = 500 MB). Devuelve un data URL JPEG; si el navegador no puede
// decodificar el archivo (HEIC, corrupto) devuelve el original sin tocar.
export function shrinkImage(file, maxSide = 512, quality = 0.82) {
  const readRaw = () => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  if (!file || !/^image\/(png|jpe?g|webp|bmp)$/i.test(file.type || '')) return readRaw();
  return readRaw().then(raw => new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // PNG con transparencia → fondo blanco, no negro
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        res(out.length < raw.length ? out : raw);
      } catch (e) { res(raw); }
    };
    img.onerror = () => res(raw);
    setTimeout(() => res(raw), 8000); // por si el navegador nunca decodifica
    img.src = raw;
  }));
}

export function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Para URLs legibles (ver viewToPath/pathToView en app.js): "Greta" → "greta",
// "Mel & Rocco" → "mel-rocco". Nunca es el único identificador de la ruta —
// siempre va pegado al id real — así que no necesita ser único.
export function slugify(str) {
  return (str || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function eventIcon(t) {
  return { Consulta:'hospital', Examen:'flask', Peluquería:'scissors', Hotel:'building', Vacuna:'flask',
    Desparasitación:'bug', Tratamiento:'pill', Historial:'clipboard', Otro:'pin' }[t] || 'pin';
}

export function botiquinStatus(item) {
  const qty = Number(item.quantity || 0);
  if (qty <= 0) return 'agotado';
  if (qty <= 5) return 'por_agotarse';
  return 'disponible';
}

// Stock de un medicamento en tratamiento: si se puede inferir el consumo diario
// (frecuencia + dosis, en la misma unidad que el stock), calcula días restantes
// reales en vez de un umbral fijo de unidades ("5 comprimidos" no significa lo
// mismo para un tratamiento diario que para uno semanal).
export function medStockDaysRemaining(m) {
  const stock = parseFloat(m.stockTotal);
  const freqN = parseFloat(m.freqN);
  if (!stock || stock <= 0 || !freqN) return null;
  const dosesPerDay = m.freqUnit === 'dias' ? 1 / freqN : 24 / freqN;
  const doseVal = parseFloat(m.doseVal) || 1;
  const sameUnit = (m.doseUnit || '').toLowerCase().replace(/\(s\)$/, '') === (m.stockUnit || '').toLowerCase().replace(/s$/, '');
  const consumptionPerDay = dosesPerDay * (sameUnit ? doseVal : 1);
  if (!consumptionPerDay) return null;
  return Math.floor(stock / consumptionPerDay);
}

export function medStockStatus(m) {
  const stock = parseInt(m.stockTotal);
  if (!stock) return null;
  const days = medStockDaysRemaining(m);
  if (days == null) {
    // Sin datos suficientes para estimar consumo: umbral por unidades, como antes
    const level = stock <= 5 ? 'critico' : stock <= 15 ? 'bajo' : 'ok';
    return { level, label: `${stock} ${m.stockUnit || ''}`.trim(), pct: Math.min(100, stock / 30 * 100) };
  }
  const level = days <= 3 ? 'critico' : days <= 10 ? 'bajo' : 'ok';
  return { level, label: `~${days} día${days !== 1 ? 's' : ''} de stock`, pct: Math.min(100, days / 30 * 100), days };
}

// Estimación de stock de alimento: a partir del tamaño del paquete y el
// consumo diario, calcula cuánto dura y en qué fecha se estima que se acabe
// (fecha de compra + días que dura), igual que el stock de medicamentos pero
// anclado a una fecha de compra en vez de "lo que queda ahora mismo".
export function foodDaysTotal(f) {
  const size = parseFloat(f.packageSize), daily = parseFloat(f.dailyAmount);
  if (!size || !daily) return null;
  return Math.floor(size / daily);
}

export function foodRunOutDate(f) {
  const days = foodDaysTotal(f);
  if (days == null || !f.purchaseDate) return null;
  return addDays(f.purchaseDate, days);
}

export function foodStockStatus(f) {
  const runOut = foodRunOutDate(f);
  if (!runOut) return null;
  const daysLeft = daysBetween(todayStr(), runOut);
  const level = daysLeft <= 3 ? 'critico' : daysLeft <= 7 ? 'bajo' : 'ok';
  return {
    level, daysLeft, runOutDate: runOut,
    label: daysLeft < 0 ? 'Se debería haber acabado' : daysLeft === 0 ? 'Se acaba hoy' : `~${daysLeft} día${daysLeft !== 1 ? 's' : ''} restantes`,
  };
}

// Precio por kilo (o por unidad) de una compra de alimento. Sirve para comparar
// compras de distinto tamaño de envase: 15 kg a $39.990 y 3 kg a $9.990 no se
// pueden comparar por precio total. Devuelve null si faltan datos.
export function foodPricePerUnit(price, size, unit) {
  const p = Number(price), n = Number(size);
  if (!(p > 0) || !(n > 0)) return null;
  if (unit === 'g') return { value: Math.round(p / (n / 1000)), unit: 'kg' };
  if (unit === 'kg') return { value: Math.round(p / n), unit: 'kg' };
  if (unit === 'unidades') return { value: Math.round(p / n), unit: 'unidad' };
  return null;
}

// Compras de un alimento, de la más reciente a la más antigua, con su precio
// por kilo. Un alimento sin historial (creado antes de food_purchases) usa su
// propia fila como única compra.
export function foodPurchaseHistory(f) {
  let list = (f?.purchases || []).map(p => ({ ...p }));
  if (!list.length && Number(f?.price) > 0 && f?.purchaseDate) {
    list = [{ id: null, date: f.purchaseDate, price: f.price, packageSize: f.packageSize, packageUnit: f.packageUnit }];
  }
  return list
    .map(p => ({ ...p, per: foodPricePerUnit(p.price, p.packageSize, p.packageUnit) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// "Pagaste $2.450/kg en marzo; en tu última compra pagaste $2.780/kg" comparando
// las dos compras más recientes. Solo compara si ambas están en la misma unidad.
export function foodPriceInsight(f) {
  const [cur, prev] = foodPurchaseHistory(f).filter(h => h.per);
  if (!cur || !prev || cur.per.unit !== prev.per.unit) return null;
  const pct = Math.round((cur.per.value - prev.per.value) / prev.per.value * 100);
  const monthOf = d => {
    const dt = new Date(d + 'T12:00:00');
    const opts = dt.getFullYear() === new Date().getFullYear() ? { month: 'long' } : { month: 'long', year: 'numeric' };
    return dt.toLocaleDateString('es-CL', opts);
  };
  const unit = cur.per.unit;
  const trend = pct === 0 ? '' : pct > 0 ? 'más caro' : 'más barato';
  return {
    pct, trend, unit, prev, cur,
    text: `Pagaste ${fmtCLP(prev.per.value)}/${unit} en ${monthOf(prev.date)}; en tu última compra pagaste ${fmtCLP(cur.per.value)}/${unit}${pct === 0 ? '' : ` (${Math.abs(pct)} % ${trend})`}.`,
  };
}

// Búsqueda del alimento en Knasta (comparador de precios). Es solo un enlace que
// abre el usuario: no se extrae ningún dato de Knasta.
export function foodOfferUrl(f) {
  const size = f?.packageUnit === 'kg' || f?.packageUnit === 'g' ? `${f.packageSize || ''} ${f.packageUnit}` : '';
  const q = `${f?.product || ''} ${size}`.replace(/\s+/g, ' ').trim();
  return `https://knasta.cl/results?q=${encodeURIComponent(q)}`;
}

// Racha de días consecutivos (incluyendo hoy) con actividad registrada.
export function activityStreak(activities) {
  const dates = new Set((activities||[]).map(a => a.date));
  let streak = 0, d = todayStr();
  while (dates.has(d)) { streak++; d = addDays(d, -1); }
  return streak;
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    genId, formatDate, todayStr, daysFromNowStr, addMonths, addDays, daysBetween,
    getAge, careAlertStatus, speciesEmoji, fmtCLP, fmtCompactCLP, parseCLP, esc, safeId, safeDataUrl, shrinkImage, slugify, petCompleteness, COMPLETENESS_FIELDS, eventIcon, botiquinStatus,
    medStockDaysRemaining, medStockStatus, foodDaysTotal, foodRunOutDate,
    foodStockStatus, foodPricePerUnit, foodPurchaseHistory, foodPriceInsight, foodOfferUrl, activityStreak,
  });
}
