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
    getAge, careAlertStatus, speciesEmoji, fmtCLP, fmtCompactCLP, parseCLP, esc, safeId, safeDataUrl, slugify, eventIcon, botiquinStatus,
    medStockDaysRemaining, medStockStatus, foodDaysTotal, foodRunOutDate,
    foodStockStatus, activityStreak,
  });
}
