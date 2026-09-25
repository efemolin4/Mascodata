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
  { key: 'dob',      points: 11, label: 'Fecha de nacimiento',     hint: 'Activa las sugerencias por edad',    action: 'edit',    has: p => !!p.dateOfBirth },
  { key: 'photo',    points: 7,  label: 'Foto',                    hint: 'Hace la ficha más tuya',             action: 'edit',    has: p => !!p.photo },
  { key: 'breed',    points: 5,  label: 'Raza',                    hint: 'Activa las sugerencias por raza',    action: 'edit',    has: p => !!p.breed },
  { key: 'sex',      points: 3,  label: 'Sexo',                    hint: 'Dato básico de la ficha',            action: 'edit',    has: p => !!p.sex },
  { key: 'chip',     points: 3,  label: 'Microchip',               hint: 'Útil si se pierde',                  action: 'edit',    has: p => !!p.chipNumber, healthOnly: true },
  { key: 'vaccine',  points: 15, label: 'Al menos una vacuna',     hint: 'Activa las alertas de vacunas',      action: 'vaccine', has: p => (p.vaccines || []).length > 0, healthOnly: true },
  { key: 'deworm',   points: 8,  label: 'Al menos una desparasitación', hint: 'Activa sus alertas',            action: 'deworm',  has: p => (p.deworming || []).length > 0, healthOnly: true },
  { key: 'allergies', points: 7, label: 'Alergias y condiciones',  hint: 'Marca "Ninguna" si no tiene',        action: 'edit',    has: p => (p.allergies || []).length > 0 || (Array.isArray(p.chronicConditions) ? p.chronicConditions.length > 0 : !!p.chronicConditions) },
  { key: 'weight',   points: 7,  label: 'Peso',                    hint: 'Alimenta el seguimiento',            action: 'edit',    has: p => Number(p.weightKg) > 0 },
  { key: 'food',     points: 6,  label: 'Alimento',                hint: 'Te avisamos cuándo se acaba',        action: 'food',    has: p => (p.foodItems || []).length > 0 },
  { key: 'repro',    points: 5,  label: 'Estado reproductivo',     hint: 'Dato de la ficha',                   action: 'edit',    has: p => !!p.reproductiveStatus, healthOnly: true },
  { key: 'vetName',  points: 7,  label: 'Nombre del veterinario',  hint: 'Para tenerlo a mano en emergencias', action: 'edit',    has: p => !!(p.vet && p.vet.name && String(p.vet.name).trim()) },
  { key: 'vetPhone', points: 6,  label: 'Teléfono del veterinario', hint: 'Para llamar rápido',                action: 'edit',    has: p => !!(p.vet && p.vet.phone && String(p.vet.phone).trim()) },
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

// Categoría del alimento: 'diario' o 'snack'. Los alimentos anteriores a la
// columna `category` con tipo "Snack" se consideran snack.
export function foodCategory(f) {
  if (f?.category === 'snack' || f?.category === 'diario') return f.category;
  return f?.type === 'Snack' ? 'snack' : 'diario';
}

// Lo que cuesta alimentar por día con este envase: precio ÷ días que dura.
// Solo existe si el tutor ingresó el consumo diario (es opcional): sin él
// devuelve null, no se estima.
export function foodCostPerDay(f) {
  const days = foodDaysTotal(f || {});
  const price = Number(f?.price);
  if (!days || !(price > 0)) return null;
  return Math.round(price / days);
}

// Cada cuántos días repone el alimento en la práctica: promedio de los últimos
// intervalos entre compras registradas. Necesita al menos 2 compras. `suggest`
// aparece solo si hay 2 o más intervalos y la duración estimada (tamaño ÷ consumo)
// se aleja 20 % o más de la real, para ofrecer ajustarla.
export function foodCadence(f) {
  const dates = foodPurchaseHistory(f).map(h => h.date).filter(Boolean).sort();
  if (dates.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push(daysBetween(dates[i - 1], dates[i]));
  const recent = gaps.slice(-3).filter(g => g > 0);
  if (!recent.length) return null;
  const days = Math.round(recent.reduce((a, g) => a + g, 0) / recent.length);
  const est = foodDaysTotal(f);
  const suggest = est && recent.length >= 2 && Math.abs(est - days) / est >= 0.2 ? days : null;
  return { days, intervals: recent.length, estimated: est || null, suggest };
}

// Precio por kilo (o unidad) de cada compra, de la más antigua a la más reciente,
// para la mini línea de tendencia. Solo compras con la misma unidad que la última.
export function foodPriceSeries(f) {
  const list = foodPurchaseHistory(f).filter(h => h.per);
  if (!list.length) return [];
  const unit = list[0].per.unit;
  const rows = list.filter(h => h.per.unit === unit).reverse().map(h => ({ date: h.date, value: h.per.value }));
  const best = rows.reduce((m, r) => (m == null || r.value < m.value ? r : m), null);
  return rows.map(r => ({ ...r, unit, best: r === best }));
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

// Búsqueda del alimento en un comparador (enlace que abre el usuario; no se
// extrae ningún dato). Google Shopping cubre marcas de nicho que venden en su
// propia tienda (Knasta solo indexa las grandes tiendas); Knasta compara bien
// las marcas masivas y muestra historial de precios.
export function foodOfferUrl(f, store = 'google') {
  const size = f?.packageUnit === 'kg' || f?.packageUnit === 'g' ? `${f.packageSize || ''} ${f.packageUnit}` : '';
  const q = encodeURIComponent(`${f?.product || ''} ${size}`.replace(/\s+/g, ' ').trim());
  return store === 'knasta'
    ? `https://knasta.cl/results?q=${q}`
    : `https://www.google.com/search?tbm=shop&q=${q}`;
}

// Fecha (YYYY-MM-DD) de la última medición de peso, o la de creación de la mascota si
// nunca se pesó. Sirve para el recordatorio mensual de pesar.
export function lastWeighedDate(pet) {
  const dates = (pet?.weightHistory || []).map(h => h.date).filter(Boolean).sort();
  if (dates.length) return dates[dates.length - 1];
  return pet?.createdAt ? String(pet.createdAt).slice(0, 10) : null;
}

// ---- Estadías (tutores separados) ----
// Una estadía es un evento de tipo "Estadía" con fecha de inicio y de fin. `holder` dice quién
// tiene la mascota: 'owner' (el dueño) o 'guest' (el otro tutor). No se guardan ids de personas
// porque un tutor no puede ver quién es el otro: cada quien lo interpreta según su propio rol.
export const STAY_TYPE = 'Estadía';

// ¿Tiene la mascota otro tutor además de mí? (invitación enviada o aceptada)
export function hasOtherTutor(pet) {
  return !!pet?.tutor2;
}

// Quién tiene la mascota en una estadía, visto desde quien mira la pantalla.
export function stayWho(pet, holder) {
  const myGroup = !pet?.myRole || pet.myRole === 'owner' ? 'owner' : 'guest';
  if (holder === myGroup) return { mine: true, label: 'contigo' };
  const other = myGroup === 'owner' ? (pet?.tutor2?.name || '').trim() : '';
  return { mine: false, label: other || 'el otro tutor' };
}

// ¿El evento cubre esta fecha? (evento de un día o rango con fecha de fin)
export function eventCoversDate(e, dateStr) {
  if (!e?.date) return false;
  return e.endDate ? e.date <= dateStr && dateStr <= e.endDate : e.date === dateStr;
}

// La estadía de la mascota que cubre la fecha dada (si hay varias, la que empezó más tarde).
export function petStayOn(pet, events, dateStr) {
  return (events || [])
    .filter(e => e.type === STAY_TYPE && e.petId === pet?.id && eventCoversDate(e, dateStr))
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}

// ---- Gastos compartidos ----
// Saldo entre los dos tutores de una mascota que reparte los gastos a partes iguales.
// `items` son los gastos (con quién pagó: payerId, payerName) y `settlements` los pagos entre tutores.
// net > 0: el otro tutor me debe; net < 0: yo le debo; 0: están al día.
//  - Un gasto pagado por mí: el otro debe la mitad. Pagado por el otro: yo debo la mitad.
//  - Un pago se guarda relativo a quien lo registra ('paid' = él le pagó al otro; 'received' = el otro le pagó a él),
//    así que se invierte cuando lo registró la otra persona.
//  - Los gastos sin pagador conocido (registros antiguos) no entran al saldo: se cuentan en `unassigned`.
//  - El botiquín es personal y nunca se reparte.
export function splitBalance(petId, items, settlements, myId) {
  let net = 0, paidByMe = 0, paidByOther = 0, unassigned = 0, otherName = null;
  const rows = [];
  (items || []).forEach(e => {
    if (e.petId !== petId || e.source === 'botiquin') return;
    const amount = Number(e.amount) || 0;
    if (amount <= 0) return;
    if (!e.payerId) { unassigned++; return; }
    const mine = e.payerId === myId;
    if (mine) { paidByMe += amount; net += amount / 2; }
    else { paidByOther += amount; net -= amount / 2; if (!otherName) otherName = (e.payerName || '').trim() || null; }
    rows.push({ kind: 'expense', id: e.id, date: e.date, text: e.description, amount, mine, by: mine ? 'Tú' : ((e.payerName || '').trim() || null) });
  });
  (settlements || []).forEach(x => {
    if (x.petId !== petId) return;
    const amount = Number(x.amount) || 0;
    if (amount <= 0) return;
    const recorderEffect = x.direction === 'received' ? -amount : amount;
    const mine = x.createdBy === myId;
    net += mine ? recorderEffect : -recorderEffect;
    if (!mine && !otherName) otherName = (x.createdByName || '').trim() || null;
    const iPaid = mine ? x.direction !== 'received' : x.direction === 'received';
    rows.push({ kind: 'settlement', id: x.id, date: x.date, text: iPaid ? 'Pago tuyo' : 'Pago recibido', amount, mine, iPaid, own: mine, note: x.note || '' });
  });
  rows.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  return { net: Math.round(net), paidByMe, paidByOther, unassigned, otherName, rows };
}

// ---- Turnos recurrentes ----
export const MAX_STAYS_PER_SERIES = 80;

// Genera las estadías de un patrón de turnos, en relativo ('me' / 'other' = quien crea / el otro tutor):
//  - 'alternate': bloques de `every` días que se alternan entre los dos, desde `start` hasta `until`.
//  - 'weekends':  cada fin de semana (viernes a domingo) con `firstHolder`, desde el primer viernes.
// Devuelve [{ date, endDate, holder }] con tope de MAX_STAYS_PER_SERIES.
export function stayTurns({ start, until, pattern, every = 7, firstHolder = 'me' }) {
  if (!start || !until || until < start) return [];
  const other = h => (h === 'me' ? 'other' : 'me');
  const rows = [];
  if (pattern === 'alternate') {
    const n = Math.min(60, Math.max(1, parseInt(every, 10) || 7));
    let cur = start, who = firstHolder;
    while (cur <= until && rows.length < MAX_STAYS_PER_SERIES) {
      const end = addDays(cur, n - 1) < until ? addDays(cur, n - 1) : until;
      rows.push({ date: cur, endDate: end, holder: who });
      cur = addDays(end, 1);
      who = other(who);
    }
  } else if (pattern === 'weekends') {
    const dow = new Date(`${start}T12:00:00`).getDay();
    let cur = addDays(start, (5 - dow + 7) % 7); // primer viernes desde la fecha de inicio
    while (cur <= until && rows.length < MAX_STAYS_PER_SERIES) {
      const end = addDays(cur, 2) < until ? addDays(cur, 2) : until;
      rows.push({ date: cur, endDate: end, holder: firstHolder });
      cur = addDays(cur, 7);
    }
  }
  return rows;
}

// ¿Dos rangos de fechas (inicio y fin inclusive) se pisan?
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= (bEnd || bStart) && bStart <= (aEnd || aStart);
}

// ---- Resumen de traspaso ----
// Lo que el otro tutor necesita saber cuando la mascota cambia de casa, armado con lo ya cargado:
// tratamientos y dosis de hoy, alimento, salud, próximas citas y lo último que se registró.
// Devuelve { sections: [{ title, lines: [texto] }], text } (el texto plano sirve para copiar).
export function handoffSummary(pet, events, myId, today) {
  const sections = [];
  const add = (title, lines) => { if (lines.length) sections.push({ title, lines }); };
  const latestBy = (list, key) => {
    const out = {};
    (list || []).forEach(r => { const k = r[key]; if (!out[k] || (r.date || '') > (out[k].date || '')) out[k] = r; });
    return Object.values(out);
  };

  // Tratamientos y dosis de hoy
  const meds = (pet.medications || []).filter(m => m.active);
  const medLines = meds.map(m => `${m.name}${m.dose ? ` · ${m.dose}` : ''}${m.frequency ? ` · ${m.frequency}` : ''}`);
  if (meds.length) {
    const dose = (pet.doseLog || []).find(d => d.date === today && d.given);
    if (dose) {
      const who = actorLabel(dose, myId);
      const at = timeOf(dose.loggedAt);
      medLines.push(`Dosis de hoy: dada${who ? ` por ${who === 'Tú' ? 'ti' : who}` : ''}${at ? ` a las ${at}` : ''}`);
    } else medLines.push('Dosis de hoy: pendiente');
  }
  add('Tratamientos', medLines);

  // Alimento diario
  add('Alimento', (pet.foodItems || []).filter(f => foodCategory(f) === 'diario').map(f => {
    const st = foodStockStatus(f);
    return `${f.product}${st ? (st.daysLeft < 0 ? ' · se estima que ya se acabó' : ` · se acaba ~${formatDate(st.runOutDate)} (${st.daysLeft} día${st.daysLeft !== 1 ? 's' : ''})`) : ''}`;
  }));

  // Salud: último peso y próximas dosis
  const health = [];
  const weights = [...(pet.weightHistory || [])].sort((a, b) => (a.date > b.date ? 1 : -1));
  const w = weights[weights.length - 1];
  if (w) health.push(`Último peso: ${(parseFloat(w.kg || 0) + (parseInt(w.gr || 0, 10) / 1000)).toLocaleString('es-CL', { maximumFractionDigits: 3 })} kg (${formatDate(w.date)})`);
  else if (parseFloat(pet.weightKg || 0) > 0) health.push(`Peso de la ficha: ${pet.weightKg} kg${pet.weightGr ? ` ${pet.weightGr} gr` : ''}`);
  const soon = addDays(today, 30);
  const due = [
    ...latestBy(pet.vaccines, 'name').filter(v => v.nextDate && v.nextDate <= soon).map(v => ({ at: v.nextDate, text: `Vacuna ${v.name}: ${v.nextDate < today ? 'vencida el' : 'próxima el'} ${formatDate(v.nextDate)}` })),
    ...latestBy(pet.deworming, 'product').filter(d => d.nextDate && d.nextDate <= soon).map(d => ({ at: d.nextDate, text: `Desparasitación ${d.product}: ${d.nextDate < today ? 'vencida el' : 'próxima el'} ${formatDate(d.nextDate)}` })),
  ].sort((a, b) => (a.at > b.at ? 1 : -1));
  // Con muchas pendientes la lista se vuelve ruido: se muestran las 6 más urgentes y cuántas faltan.
  due.slice(0, 6).forEach(x => health.push(x.text));
  if (due.length > 6) health.push(`…y ${due.length - 6} más en las fichas de vacunas y desparasitación`);
  add('Salud', health);

  // Próximas citas (14 días)
  const limit = addDays(today, 14);
  add('Próximas citas', (events || [])
    .filter(e => e.petId === pet.id && e.type !== STAY_TYPE && e.date >= today && e.date <= limit)
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map(e => `${formatDate(e.date)}${e.time ? ` ${e.time}` : ''} · ${e.title}`));

  // Lo último que se registró
  add('Lo último que se registró', recentActivity(pet, events, myId, 3)
    .map(r => `${r.by ? `${r.by}: ` : ''}${r.text} (${formatDate(r.date)})`));

  // Veterinario
  const vet = pet.vet || {};
  if (vet.name || vet.phone) add('Veterinario', [[vet.name, vet.clinic, vet.phone].filter(Boolean).join(' · ')]);

  const text = [`Traspaso de ${pet.name} — ${formatDate(today)}`, ...sections.map(s => `\n${s.title}\n${s.lines.map(l => `- ${l}`).join('\n')}`)].join('\n');
  return { sections, text };
}

// ---- Quién hizo qué ----
// Quién creó un registro, visto desde quien mira: "Tú", el nombre de la otra persona o null si
// no se sabe (registros anteriores a que se guardara el autor).
export function actorLabel(rec, myId) {
  if (rec?.createdBy && myId && rec.createdBy === myId) return 'Tú';
  const name = (rec?.createdByName || '').trim();
  return name || null;
}

// Hora (HH:MM) en que se registró algo, si se conoce.
export function timeOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Últimos registros de una mascota, de todos sus tutores, con quién los hizo. Se arma con lo que
// ya está cargado; ordenado por fecha (y hora, cuando se conoce), del más reciente al más antiguo.
export function recentActivity(pet, events, myId, limit = 8) {
  const items = [];
  const add = (date, text, rec, at) => { if (date) items.push({ date, at: at || '', text, by: actorLabel(rec, myId) }); };
  (pet?.vaccines || []).forEach(v => add(v.date, `Vacuna: ${v.name}`, v));
  (pet?.deworming || []).forEach(d => add(d.date, `Desparasitación: ${d.product}`, d));
  (pet?.medications || []).forEach(m => add(m.startDate, `Tratamiento: ${m.name}`, m));
  (pet?.clinicalHistory || []).forEach(h => add(h.date, h.title || 'Historial clínico', h));
  (pet?.weightHistory || []).forEach(w => add(w.date, `Peso: ${(parseFloat(w.kg || 0) + (parseInt(w.gr || 0, 10) / 1000)).toLocaleString('es-CL', { maximumFractionDigits: 3 })} kg`, w));
  (pet?.doseLog || []).filter(d => d.given).forEach(d => add(d.date, 'Dosis dada', d, d.loggedAt));
  (pet?.foodItems || []).forEach(f => (f.purchases || []).forEach(pu => add(pu.date, `Compra de alimento: ${f.product}`, pu)));
  (events || []).filter(e => e.petId === pet?.id && e.type !== STAY_TYPE).forEach(e => add(e.date, `Evento: ${e.title}`, e));
  return items
    .map((it, i) => ({ ...it, i }))
    .sort((a, b) => (a.date === b.date ? (a.at === b.at ? b.i - a.i : (a.at < b.at ? 1 : -1)) : (a.date < b.date ? 1 : -1)))
    .slice(0, limit);
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
    splitBalance, MAX_STAYS_PER_SERIES, stayTurns, rangesOverlap, handoffSummary, actorLabel, timeOf, recentActivity, STAY_TYPE, hasOtherTutor, stayWho, eventCoversDate, petStayOn, lastWeighedDate, foodCategory, foodCostPerDay, foodCadence, foodPriceSeries, foodStockStatus, foodPricePerUnit, foodPurchaseHistory, foodPriceInsight, foodOfferUrl, activityStreak,
  });
}
