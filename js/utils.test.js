import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  todayStr, daysFromNowStr, addDays, daysBetween, addMonths, getAge,
  careAlertStatus, medStockStatus, foodStockStatus, esc, safeId, safeDataUrl, petCompleteness, parseCLP, fmtCompactCLP,
  foodPricePerUnit, foodPurchaseHistory, foodPriceInsight, foodOfferUrl,
  foodCategory, foodCostPerDay, foodCadence, foodPriceSeries, lastWeighedDate,
  STAY_TYPE, hasOtherTutor, stayWho, eventCoversDate, petStayOn, actorLabel, timeOf, recentActivity,
  MAX_STAYS_PER_SERIES, stayTurns, rangesOverlap, handoffSummary, splitBalance,
} from './utils.js';

// Fija "hoy" a una fecha conocida para que las pruebas de fecha sean
// deterministas. Se usa una hora local nocturna (23:00) a propósito: es
// justo la ventana horaria en la que el bug de zona horaria original
// (calcular "hoy" con .toISOString(), que usa UTC) hacía que Chile ya
// pareciera estar un día adelantado.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 15, 23, 0, 0)); // 15 de junio 2026, 23:00 hora local
});

afterEach(() => {
  vi.useRealTimers();
});

describe('todayStr', () => {
  it('devuelve la fecha LOCAL de hoy, no la fecha UTC', () => {
    // A las 23:00 hora local, .toISOString() (UTC) ya reportaría el día
    // siguiente en cualquier huso horario con offset negativo (como Chile,
    // UTC-3/-4) — esta prueba falla si todayStr() vuelve a usar UTC.
    expect(todayStr()).toBe('2026-06-15');
  });
});

describe('daysFromNowStr / addDays / daysBetween', () => {
  it('daysFromNowStr sigue en fecha local, no salta de día por UTC', () => {
    expect(daysFromNowStr(0)).toBe('2026-06-15');
    expect(daysFromNowStr(10)).toBe('2026-06-25');
    expect(daysFromNowStr(-5)).toBe('2026-06-10');
  });

  it('addDays suma/resta días respetando cambios de mes', () => {
    expect(addDays('2026-06-28', 5)).toBe('2026-07-03');
    expect(addDays('2026-06-05', -10)).toBe('2026-05-26');
  });

  it('daysBetween calcula la diferencia en días entre dos fechas', () => {
    expect(daysBetween('2026-06-01', '2026-06-15')).toBe(14);
    expect(daysBetween('2026-06-15', '2026-06-01')).toBe(-14);
    expect(daysBetween('2026-06-15', '2026-06-15')).toBe(0);
  });
});

describe('addMonths', () => {
  it('suma meses completos', () => {
    expect(addMonths('2026-01-10', 1)).toBe('2026-02-10');
    expect(addMonths('2026-01-10', 12)).toBe('2027-01-10');
  });

  it('"1 mes y medio" (1.5) da 1 mes + 15 días, no exactamente 45 días — comportamiento documentado, no un bug', () => {
    expect(addMonths('2026-01-01', 1.5)).toBe('2026-02-16');
  });

  it('sin fecha o sin meses devuelve string vacío', () => {
    expect(addMonths('', 1)).toBe('');
    expect(addMonths('2026-01-01', 0)).toBe('');
  });
});

describe('getAge', () => {
  it('cumpleaños ya ocurrido este año calendario', () => {
    // Hoy es 2026-06-15; nació el 2020-01-01 → el cumpleaños de este año (ene) ya pasó
    expect(getAge('2020-01-01')).toBe('6 años');
  });

  it('cumpleaños que todavía NO ha ocurrido este año calendario', () => {
    // Nació el 2020-12-25 → el cumpleaños de este año todavía no llega, cuenta 5 no 6
    expect(getAge('2020-12-25')).toBe('5 años');
  });

  it('menor a un año se expresa en meses', () => {
    expect(getAge('2026-04-15')).toBe('2 meses');
  });

  it('sin fecha de nacimiento devuelve vacío', () => {
    expect(getAge('')).toBe('');
    expect(getAge(null)).toBe('');
  });
});

describe('careAlertStatus', () => {
  it('sin next_date: estado sin_fecha', () => {
    expect(careAlertStatus(null, 'same', null).status).toBe('sin_fecha');
  });

  it('fecha ya pasada: vencido, sin importar el tipo de alerta', () => {
    expect(careAlertStatus('2026-06-01', 'same', null).status).toBe('vencido');
  });

  it('ventana "same": solo el mismo día cuenta como próximo', () => {
    expect(careAlertStatus('2026-06-15', 'same', null).status).toBe('proximo');
    expect(careAlertStatus('2026-06-16', 'same', null).status).toBe('al_dia');
  });

  it('ventana "week": 7 días antes cuenta como próximo', () => {
    expect(careAlertStatus('2026-06-22', 'week', null).status).toBe('proximo');
    expect(careAlertStatus('2026-06-23', 'week', null).status).toBe('al_dia');
  });

  it('ventana "custom": respeta los días configurados por el usuario', () => {
    expect(careAlertStatus('2026-06-30', 'custom', 15).status).toBe('proximo');
    expect(careAlertStatus('2026-07-01', 'custom', 15).status).toBe('al_dia');
  });
});

describe('medStockStatus', () => {
  it('sin stock cargado: null', () => {
    expect(medStockStatus({ stockTotal: null })).toBeNull();
  });

  it('sin datos de frecuencia/dosis: cae al umbral fijo por unidades', () => {
    expect(medStockStatus({ stockTotal: 3 }).level).toBe('critico');
    expect(medStockStatus({ stockTotal: 10 }).level).toBe('bajo');
    expect(medStockStatus({ stockTotal: 20 }).level).toBe('ok');
  });

  it('con frecuencia y dosis en la misma unidad: calcula días de stock reales', () => {
    // 1 comprimido cada 24h = 1/día; 3 comprimidos de stock → 3 días → crítico
    const m = { stockTotal: 3, freqN: 24, freqUnit: 'horas', doseVal: 1, doseUnit: 'Comprimido(s)', stockUnit: 'Comprimidos' };
    expect(medStockStatus(m).level).toBe('critico');
    expect(medStockStatus(m).days).toBe(3);
  });
});

describe('foodStockStatus', () => {
  it('sin tamaño de paquete o consumo diario: null', () => {
    expect(foodStockStatus({ packageSize: null, dailyAmount: 0.3, purchaseDate: '2026-06-01' })).toBeNull();
  });

  it('calcula la fecha estimada de agotamiento a partir de la fecha de compra', () => {
    // Paquete de 15kg, 0.3kg/día = 50 días de duración, comprado el 2026-05-01
    const f = { packageSize: 15, dailyAmount: 0.3, purchaseDate: '2026-05-01' };
    expect(foodStockStatus(f).runOutDate).toBe(addDays('2026-05-01', 50));
  });

  it('clasifica el nivel según los días restantes hasta esa fecha', () => {
    // Comprado hace 47 de 50 días de duración → quedan 3 días → crítico
    const critico = { packageSize: 15, dailyAmount: 0.3, purchaseDate: addDays(todayStr(), -47) };
    expect(foodStockStatus(critico).level).toBe('critico');
    // Comprado hoy, dura 50 días → ok
    const ok = { packageSize: 15, dailyAmount: 0.3, purchaseDate: todayStr() };
    expect(foodStockStatus(ok).level).toBe('ok');
  });
});

describe('esc', () => {
  it('escapa los 5 caracteres especiales de HTML', () => {
    expect(esc(`<script>alert('hi') & "quotes"</script>`))
      .toBe('&lt;script&gt;alert(&#39;hi&#39;) &amp; &quot;quotes&quot;&lt;/script&gt;');
  });

  it('un texto sin caracteres especiales vuelve idéntico', () => {
    expect(esc('Greta, 5 años')).toBe('Greta, 5 años');
  });

  it('null/undefined se convierten en string vacío, no en el literal "null"', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });

  it('convierte valores no-string (números) a texto', () => {
    expect(esc(42)).toBe('42');
  });
});

describe('parseCLP', () => {
  it('interpreta el punto como separador de miles, no decimal (regresión del bug real)', () => {
    // Bug real: un usuario escribió "190.000" esperando $190.000 en un campo
    // type="number", que lo interpretó como 190 y Supabase rechazó el string
    // "190.000" contra una columna integer con "invalid input syntax".
    expect(parseCLP('190.000')).toBe(190000);
  });

  it('un número sin separadores queda igual', () => {
    expect(parseCLP('190000')).toBe(190000);
  });

  it('ignora comas también, por si acaso', () => {
    expect(parseCLP('190,000')).toBe(190000);
  });

  it('string vacío, null o undefined dan null (costo opcional, no 0)', () => {
    expect(parseCLP('')).toBeNull();
    expect(parseCLP(null)).toBeNull();
    expect(parseCLP(undefined)).toBeNull();
  });

  it('ignora cualquier caracter no numérico (signos, espacios)', () => {
    expect(parseCLP('$ 25.000 CLP')).toBe(25000);
  });
});

describe('fmtCompactCLP', () => {
  it('abrevia miles con "k" y millones con "M" (coma decimal)', () => {
    expect(fmtCompactCLP(0)).toBe('$0');
    expect(fmtCompactCLP(850)).toBe('$850');
    expect(fmtCompactCLP(52400)).toBe('$52k');
    expect(fmtCompactCLP(1712890)).toBe('$1,7M');
    expect(fmtCompactCLP(2000000)).toBe('$2M');
  });
  it('en el borde de los millones no muestra "1000k"', () => {
    expect(fmtCompactCLP(999600)).toBe('$1M');
  });
  it('tolera null/undefined/NaN', () => {
    expect(fmtCompactCLP(null)).toBe('$0');
    expect(fmtCompactCLP(undefined)).toBe('$0');
  });
});

describe('safeId', () => {
  it('deja pasar uuid y genId tal cual', () => {
    expect(safeId('98b1cfe4-51e4-4150-9d80-3b6f70e57740')).toBe('98b1cfe4-51e4-4150-9d80-3b6f70e57740');
    expect(safeId('lq3x9a7bk2m1')).toBe('lq3x9a7bk2m1');
  });

  it('elimina comillas, paréntesis, punto y coma y barras que romperían un literal de JS', () => {
    expect(safeId("');alert(1);//")).toBe('alert1');
    expect(safeId(null)).toBe('');
  });
});

describe('safeDataUrl', () => {
  it('acepta data URLs base64 de imagen, PDF y Word', () => {
    expect(safeDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(safeDataUrl('data:application/pdf;base64,JVBERi0xLjQ=')).not.toBe('');
    expect(safeDataUrl('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBA==')).not.toBe('');
  });

  it('rechaza una comilla que rompe el atributo, javascript: y HTML', () => {
    expect(safeDataUrl('data:image/x" onerror="window.__x=1')).toBe('');
    expect(safeDataUrl('data:image/png;base64,AAAA" onerror="window.__x=1')).toBe('');
    expect(safeDataUrl('javascript:alert(1)')).toBe('');
    expect(safeDataUrl('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('rechaza SVG (navegable desde un enlace) y valores que no son string', () => {
    expect(safeDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe('');
    expect(safeDataUrl(undefined)).toBe('');
    expect(safeDataUrl(42)).toBe('');
    expect(safeDataUrl({ toString: () => 'data:image/png;base64,AAAA' })).toBe('');
  });
});

describe('petCompleteness', () => {
  const full = () => ({
    name: 'Luna', species: 'Perro', dateOfBirth: '2020-01-01', photo: 'data:image/png;base64,AAAA', breed: 'Mestizo', sex: 'Hembra',
    chipNumber: '123', vaccines: [{}], deworming: [{}], foodItems: [{}], allergies: [], chronicConditions: ['Ninguna'], weightKg: 12,
    reproductiveStatus: 'Esterilizada', vet: { name: 'Dra. Pérez', phone: '+56 9 1' },
  });

  it('una mascota con solo nombre y especie parte en 10 %', () => {
    const c = petCompleteness({ name: 'Luna', species: 'Perro' });
    expect(c.percent).toBe(10);
    expect(c.done).toEqual(['basic']);
  });

  it('con todos los campos llega a 100 % y no quedan pasos pendientes', () => {
    const c = petCompleteness(full());
    expect(c.percent).toBe(100);
    expect(c.missing).toEqual([]);
  });

  it('los pasos pendientes salen de mayor a menor peso (vacuna 15 % primero)', () => {
    const c = petCompleteness({ name: 'Luna', species: 'Perro' });
    expect(c.missing[0]).toMatchObject({ key: 'vaccine', gain: 15, action: 'vaccine' });
    expect(c.missing[1].key).toBe('dob');
    expect(c.missing.map(m => m.gain)).toEqual([...c.missing.map(m => m.gain)].sort((a, b) => b - a));
  });

  it('marcar "Ninguna" en condiciones cuenta como respondido; sin alergias ni condiciones no', () => {
    const base = { name: 'Luna', species: 'Perro' };
    expect(petCompleteness({ ...base, chronicConditions: ['Ninguna'] }).done).toContain('allergies');
    expect(petCompleteness({ ...base, allergies: ['Pollo'] }).done).toContain('allergies');
    expect(petCompleteness({ ...base, allergies: [], chronicConditions: [] }).done).not.toContain('allergies');
  });

  it('en peces, aves, hámsteres y reptiles excluye vacunas, desparasitación, estado reproductivo y microchip y recalcula', () => {
    const c = petCompleteness({ name: 'Nemo', species: 'Pez' });
    expect(c.missing.map(m => m.key)).not.toContain('vaccine');
    expect(c.missing.map(m => m.key)).not.toContain('chip');
    expect(c.percent).toBe(Math.round(10 * 100 / (100 - 15 - 8 - 3 - 5)));
    const whole = { ...full(), species: 'Ave', vaccines: [], deworming: [], chipNumber: '', reproductiveStatus: '' };
    expect(petCompleteness(whole).percent).toBe(100);
  });

  it('el peso cuenta solo si es un número mayor que cero', () => {
    expect(petCompleteness({ name: 'a', species: 'Perro', weightKg: '' }).done).not.toContain('weight');
    expect(petCompleteness({ name: 'a', species: 'Perro', weightKg: 0 }).done).not.toContain('weight');
    expect(petCompleteness({ name: 'a', species: 'Perro', weightKg: '7.5' }).done).toContain('weight');
  });

  it('el veterinario suma por separado nombre (8) y teléfono (7); los espacios no cuentan', () => {
    expect(petCompleteness({ name: 'a', species: 'Perro', vet: { name: '  ', phone: '' } }).done).not.toContain('vetName');
    expect(petCompleteness({ name: 'a', species: 'Perro', vet: { name: 'Dr X', phone: '' } }).done).toContain('vetName');
    expect(petCompleteness({ name: 'a', species: 'Perro', vet: { name: 'Dr X', phone: '' } }).done).not.toContain('vetPhone');
  });
});

describe('precio por kilo del alimento', () => {
  it('calcula el precio por kilo según la unidad del envase', () => {
    expect(foodPricePerUnit(39990, 15, 'kg')).toEqual({ value: 2666, unit: 'kg' });
    expect(foodPricePerUnit(3000, 500, 'g')).toEqual({ value: 6000, unit: 'kg' });
    expect(foodPricePerUnit(12000, 12, 'unidades')).toEqual({ value: 1000, unit: 'unidad' });
  });

  it('devuelve null si faltan datos o la unidad no se reconoce', () => {
    expect(foodPricePerUnit(0, 15, 'kg')).toBeNull();
    expect(foodPricePerUnit(1000, 0, 'kg')).toBeNull();
    expect(foodPricePerUnit(1000, 5, 'litros')).toBeNull();
  });

  it('el historial va de la compra más reciente a la más antigua', () => {
    const h = foodPurchaseHistory({ purchases: [
      { id: 'a', date: '2026-03-01', price: 30000, packageSize: 12, packageUnit: 'kg' },
      { id: 'b', date: '2026-08-01', price: 36000, packageSize: 12, packageUnit: 'kg' },
    ] });
    expect(h.map(x => x.id)).toEqual(['b', 'a']);
    expect(h[0].per.value).toBe(3000);
  });

  it('un alimento sin historial usa su propia fila como única compra', () => {
    const h = foodPurchaseHistory({ price: 20000, purchaseDate: '2026-05-01', packageSize: 10, packageUnit: 'kg' });
    expect(h).toHaveLength(1);
    expect(h[0].per.value).toBe(2000);
    expect(foodPurchaseHistory({ price: null })).toEqual([]);
  });

  it('compara las dos últimas compras y dice cuánto subió', () => {
    const ins = foodPriceInsight({ purchases: [
      { id: 'a', date: '2025-03-10', price: 24500, packageSize: 10, packageUnit: 'kg' },
      { id: 'b', date: '2026-08-10', price: 27800, packageSize: 10, packageUnit: 'kg' },
    ] });
    expect(ins.pct).toBe(13);
    expect(ins.text).toContain('2.450');
    expect(ins.text).toContain('2.780');
    expect(ins.text).toContain('13 % más caro');
  });

  it('no compara con una sola compra ni entre unidades distintas', () => {
    expect(foodPriceInsight({ purchases: [{ id: 'a', date: '2026-01-01', price: 1000, packageSize: 1, packageUnit: 'kg' }] })).toBeNull();
    expect(foodPriceInsight({ purchases: [
      { id: 'a', date: '2026-01-01', price: 1000, packageSize: 1, packageUnit: 'kg' },
      { id: 'b', date: '2026-02-01', price: 1000, packageSize: 10, packageUnit: 'unidades' },
    ] })).toBeNull();
  });

  it('el enlace de búsqueda lleva el producto y el tamaño codificados', () => {
    const f = { product: 'Bravery pollo & arroz', packageSize: 12, packageUnit: 'kg' };
    expect(foodOfferUrl(f, 'knasta')).toBe('https://knasta.cl/results?q=Bravery%20pollo%20%26%20arroz%2012%20kg');
    expect(foodOfferUrl(f)).toBe('https://www.google.com/search?tbm=shop&q=Bravery%20pollo%20%26%20arroz%2012%20kg');
  });
});

describe('resumen de alimentación', () => {
  it('la categoría usa la columna y, sin ella, el tipo "Snack" de los alimentos antiguos', () => {
    expect(foodCategory({ category: 'snack' })).toBe('snack');
    expect(foodCategory({ type: 'Snack' })).toBe('snack');
    expect(foodCategory({ type: 'Seco' })).toBe('diario');
    expect(foodCategory(null)).toBe('diario');
  });

  it('el costo por día es el precio dividido en los días que dura el envase', () => {
    // 10 kg a 0.5 kg/día = 20 días; $40.000 → $2.000/día
    expect(foodCostPerDay({ packageSize: 10, dailyAmount: 0.5, price: 40000 })).toBe(2000);
    expect(foodCostPerDay({ packageSize: 10, dailyAmount: 0.5, price: 0 })).toBeNull();
    // sin consumo diario no se inventa un costo por día
    expect(foodCostPerDay({ packageSize: 10, dailyAmount: 0, price: 40000 })).toBeNull();
  });

});

describe('cada cuánto repone y serie de precios', () => {
  const buy = (date, price = 30000, size = 10) => ({ id: date, date, price, packageSize: size, packageUnit: 'kg' });

  it('con menos de 2 compras no calcula la cadencia', () => {
    expect(foodCadence({ purchases: [buy('2026-06-01')] })).toBeNull();
    expect(foodCadence({})).toBeNull();
  });

  it('promedia los intervalos entre compras y compara con la duración estimada', () => {
    const f = { packageSize: 10, dailyAmount: 0.2, purchases: [buy('2026-06-01'), buy('2026-07-10')] }; // 39 días; estimaba 50
    const c = foodCadence(f);
    expect(c).toMatchObject({ days: 39, intervals: 1, estimated: 50 });
    expect(c.suggest).toBeNull(); // con un solo intervalo no se sugiere ajustar
  });

  it('sugiere ajustar cuando hay 2 intervalos y la diferencia es de 20 % o más', () => {
    const f = { packageSize: 10, dailyAmount: 0.2, purchases: [buy('2026-05-01'), buy('2026-06-10'), buy('2026-07-20')] }; // 40 y 40; estimaba 50
    expect(foodCadence(f)).toMatchObject({ days: 40, intervals: 2, estimated: 50, suggest: 40 });
    const cerca = { packageSize: 10, dailyAmount: 0.2, purchases: [buy('2026-05-01'), buy('2026-06-16'), buy('2026-08-01')] }; // 46 y 46 vs 50
    expect(foodCadence(cerca).suggest).toBeNull();
  });

  it('sin consumo indicado muestra la cadencia real sin estimada ni sugerencia', () => {
    const c = foodCadence({ packageSize: 10, dailyAmount: 0, purchases: [buy('2026-05-01'), buy('2026-06-10'), buy('2026-07-20')] });
    expect(c).toMatchObject({ days: 40, estimated: null, suggest: null });
  });

  it('la serie de precios va de la más antigua a la más reciente y marca el mejor precio', () => {
    const rows = foodPriceSeries({ purchases: [buy('2026-05-01', 30000), buy('2026-06-01', 27000), buy('2026-07-01', 33000)] });
    expect(rows.map(r => r.value)).toEqual([3000, 2700, 3300]);
    expect(rows.find(r => r.best).value).toBe(2700);
    expect(foodPriceSeries({})).toEqual([]);
  });
});

describe('petCompleteness — alimento', () => {
  it('registrar un alimento suma 6 puntos y quita el paso pendiente "Alimento"', () => {
    const base = { name: 'Luna', species: 'Perro' };
    const sin = petCompleteness(base), con = petCompleteness({ ...base, foodItems: [{ product: 'Barfood' }] });
    expect(sin.missing.find(m => m.key === 'food')).toMatchObject({ gain: 6, action: 'food' });
    expect(con.done).toContain('food');
    expect(con.percent - sin.percent).toBe(6);
  });

  it('el alimento cuenta también para peces, aves, hámsteres y reptiles', () => {
    expect(petCompleteness({ name: 'Nemo', species: 'Pez' }).missing.map(m => m.key)).toContain('food');
  });
});

describe('lastWeighedDate', () => {
  it('es la fecha de la medición más reciente', () => {
    expect(lastWeighedDate({ weightHistory: [{ date: '2026-08-01' }, { date: '2026-09-10' }, { date: '2026-07-01' }] })).toBe('2026-09-10');
  });
  it('sin mediciones usa la fecha de creación de la mascota', () => {
    expect(lastWeighedDate({ weightHistory: [], createdAt: '2026-06-15T12:00:00Z' })).toBe('2026-06-15');
  });
  it('sin mediciones ni fecha de creación no hay fecha', () => {
    expect(lastWeighedDate({})).toBeNull();
    expect(lastWeighedDate(null)).toBeNull();
  });
});

describe('estadías (tutores separados)', () => {
  const owner = { id: 'p1', myRole: 'owner', tutor2: { name: 'Pedro' } };
  const guest = { id: 'p1', myRole: 'editor', tutor2: { name: 'Yo mismo' } };

  it('hasOtherTutor: solo si la mascota tiene un segundo tutor', () => {
    expect(hasOtherTutor(owner)).toBe(true);
    expect(hasOtherTutor({ id: 'p2' })).toBe(false);
    expect(hasOtherTutor(null)).toBe(false);
  });

  it('el dueño ve "contigo" en sus estadías y el nombre del otro tutor en las del invitado', () => {
    expect(stayWho(owner, 'owner')).toEqual({ mine: true, label: 'contigo' });
    expect(stayWho(owner, 'guest')).toEqual({ mine: false, label: 'Pedro' });
  });

  it('el tutor invitado ve "contigo" en las suyas y "el otro tutor" en las del dueño (no conoce su nombre)', () => {
    expect(stayWho(guest, 'guest')).toEqual({ mine: true, label: 'contigo' });
    expect(stayWho(guest, 'owner')).toEqual({ mine: false, label: 'el otro tutor' });
  });

  it('sin el nombre del otro tutor usa "el otro tutor"', () => {
    expect(stayWho({ myRole: 'owner', tutor2: { name: '  ' } }, 'guest').label).toBe('el otro tutor');
  });

  it('un evento cubre un día o todo un rango', () => {
    expect(eventCoversDate({ date: '2026-10-10' }, '2026-10-10')).toBe(true);
    expect(eventCoversDate({ date: '2026-10-10' }, '2026-10-11')).toBe(false);
    const stay = { date: '2026-10-10', endDate: '2026-10-14' };
    expect(['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'].map(d => eventCoversDate(stay, d))).toEqual([false, true, true, true, false]);
  });

  it('petStayOn devuelve la estadía de esa mascota que cubre la fecha, ignorando otras mascotas y otros tipos', () => {
    const events = [
      { id: 'a', type: STAY_TYPE, petId: 'p1', date: '2026-10-01', endDate: '2026-10-10', holder: 'owner' },
      { id: 'b', type: STAY_TYPE, petId: 'p2', date: '2026-10-01', endDate: '2026-10-10', holder: 'guest' },
      { id: 'c', type: 'Consulta', petId: 'p1', date: '2026-10-05' },
    ];
    expect(petStayOn({ id: 'p1' }, events, '2026-10-05').id).toBe('a');
    expect(petStayOn({ id: 'p1' }, events, '2026-10-20')).toBeNull();
  });

  it('con estadías solapadas gana la que empezó más tarde', () => {
    const events = [
      { id: 'a', type: STAY_TYPE, petId: 'p1', date: '2026-10-01', endDate: '2026-10-31' },
      { id: 'b', type: STAY_TYPE, petId: 'p1', date: '2026-10-10', endDate: '2026-10-12' },
    ];
    expect(petStayOn({ id: 'p1' }, events, '2026-10-11').id).toBe('b');
  });
});

describe('quién hizo qué', () => {
  it('actorLabel: "Tú" para mis registros, el nombre para los del otro tutor, null si no se sabe', () => {
    expect(actorLabel({ createdBy: 'yo', createdByName: 'Ana' }, 'yo')).toBe('Tú');
    expect(actorLabel({ createdBy: 'otro', createdByName: ' Pedro ' }, 'yo')).toBe('Pedro');
    expect(actorLabel({ createdBy: 'otro', createdByName: '' }, 'yo')).toBeNull();
    expect(actorLabel({}, 'yo')).toBeNull();
    expect(actorLabel(null, 'yo')).toBeNull();
  });

  it('timeOf devuelve la hora local o vacío', () => {
    expect(timeOf('')).toBe('');
    expect(timeOf('no-es-fecha')).toBe('');
    expect(timeOf('2026-10-01T12:04:00Z')).toMatch(/^\d{2}:\d{2}/);
  });

  it('recentActivity junta registros de varias tablas, del más reciente al más antiguo, con su autor', () => {
    const pet = {
      id: 'p1',
      vaccines: [{ date: '2026-09-01', name: 'Antirrábica', createdBy: 'otro', createdByName: 'Pedro' }],
      weightHistory: [{ date: '2026-09-20', kg: 12, gr: 500, createdBy: 'yo', createdByName: 'Ana' }],
      doseLog: [{ date: '2026-09-25', given: true, loggedAt: '2026-09-25T12:00:00Z', createdBy: 'otro', createdByName: 'Pedro' }, { date: '2026-09-26', given: false }],
      clinicalHistory: [{ date: '2026-09-10', title: 'Control anual' }],
      foodItems: [{ product: 'Barfood', purchases: [{ date: '2026-09-15', createdBy: 'yo', createdByName: 'Ana' }] }],
    };
    const events = [{ petId: 'p1', date: '2026-09-22', title: 'Peluquería' }, { petId: 'p2', date: '2026-09-30', title: 'Ajeno' }, { petId: 'p1', type: STAY_TYPE, date: '2026-09-29' }];
    const rows = recentActivity(pet, events, 'yo');
    expect(rows.map(r => r.text)).toEqual(['Dosis dada', 'Evento: Peluquería', 'Peso: 12,5 kg', 'Compra de alimento: Barfood', 'Control anual', 'Vacuna: Antirrábica']);
    expect(rows.map(r => r.by)).toEqual(['Pedro', null, 'Tú', 'Tú', null, 'Pedro']);
  });

  it('respeta el límite y ordena por hora dos registros del mismo día', () => {
    const pet = { id: 'p1', doseLog: [
      { date: '2026-09-25', given: true, loggedAt: '2026-09-25T09:00:00Z' },
      { date: '2026-09-25', given: true, loggedAt: '2026-09-25T20:00:00Z' },
    ], weightHistory: [{ date: '2026-09-01', kg: 5, gr: 0 }] };
    const rows = recentActivity(pet, [], 'yo', 2);
    expect(rows).toHaveLength(2);
    expect(rows[0].at > rows[1].at).toBe(true);
  });
});

describe('turnos recurrentes', () => {
  it('alternar cada 7 días reparte semanas entre los dos, empezando por quien se elija', () => {
    const rows = stayTurns({ start: '2026-10-05', until: '2026-10-25', pattern: 'alternate', every: 7, firstHolder: 'me' });
    expect(rows).toEqual([
      { date: '2026-10-05', endDate: '2026-10-11', holder: 'me' },
      { date: '2026-10-12', endDate: '2026-10-18', holder: 'other' },
      { date: '2026-10-19', endDate: '2026-10-25', holder: 'me' },
    ]);
  });

  it('el último turno se recorta al fin del período', () => {
    const rows = stayTurns({ start: '2026-10-05', until: '2026-10-14', pattern: 'alternate', every: 7, firstHolder: 'other' });
    expect(rows[rows.length - 1]).toEqual({ date: '2026-10-12', endDate: '2026-10-14', holder: 'me' });
  });

  it('turnos de 3 días alternados', () => {
    const rows = stayTurns({ start: '2026-10-01', until: '2026-10-09', pattern: 'alternate', every: 3, firstHolder: 'me' });
    expect(rows.map(r => `${r.date}→${r.endDate}:${r.holder}`)).toEqual(['2026-10-01→2026-10-03:me', '2026-10-04→2026-10-06:other', '2026-10-07→2026-10-09:me']);
  });

  it('los fines de semana van de viernes a domingo, desde el primer viernes', () => {
    const rows = stayTurns({ start: '2026-10-05', until: '2026-10-31', pattern: 'weekends', firstHolder: 'other' }); // 5-oct es lunes
    expect(rows.map(r => `${r.date}→${r.endDate}`)).toEqual(['2026-10-09→2026-10-11', '2026-10-16→2026-10-18', '2026-10-23→2026-10-25', '2026-10-30→2026-10-31']); // el último se recorta al fin
    expect(rows.every(r => r.holder === 'other')).toBe(true);
  });

  it('si el inicio ya es viernes, ese fin de semana cuenta', () => {
    expect(stayTurns({ start: '2026-10-09', until: '2026-10-11', pattern: 'weekends' })[0].date).toBe('2026-10-09');
  });

  it('rangos inválidos o un patrón desconocido no generan nada', () => {
    expect(stayTurns({ start: '2026-10-10', until: '2026-10-01', pattern: 'alternate' })).toEqual([]);
    expect(stayTurns({ start: '', until: '2026-10-01', pattern: 'alternate' })).toEqual([]);
    expect(stayTurns({ start: '2026-10-01', until: '2026-12-01', pattern: 'otro' })).toEqual([]);
  });

  it('nunca genera más del tope por serie', () => {
    expect(stayTurns({ start: '2026-01-01', until: '2036-01-01', pattern: 'alternate', every: 1 })).toHaveLength(MAX_STAYS_PER_SERIES);
  });

  it('rangesOverlap detecta los rangos que se pisan, incluidos los de un solo día', () => {
    expect(rangesOverlap('2026-10-01', '2026-10-05', '2026-10-05', '2026-10-08')).toBe(true);
    expect(rangesOverlap('2026-10-01', '2026-10-05', '2026-10-06', '2026-10-08')).toBe(false);
    expect(rangesOverlap('2026-10-03', null, '2026-10-01', '2026-10-05')).toBe(true);
  });
});

describe('handoffSummary — resumen de traspaso', () => {
  const today = '2026-10-10';
  const pet = () => ({
    id: 'p1', name: 'Greta', vet: { name: 'Dra. Rojas', clinic: 'Las Condes', phone: '+56912345678' },
    medications: [{ name: 'Gabapentina', active: true, dose: '1 comp', frequency: 'Cada 12 horas' }, { name: 'Antiguo', active: false }],
    doseLog: [], weightHistory: [{ date: '2026-10-01', kg: 12, gr: 500 }],
    foodItems: [{ product: 'Barfood', category: 'diario', packageSize: 10, packageUnit: 'kg', dailyAmount: 0.5, purchaseDate: '2026-09-28' }, { product: 'Galletas', category: 'snack' }],
    vaccines: [{ name: 'Antirrábica', date: '2025-10-05', nextDate: '2026-10-20' }, { name: 'Antirrábica', date: '2024-10-05', nextDate: '2025-10-05' }, { name: 'Lejana', date: '2026-06-01', nextDate: '2027-06-01' }],
    deworming: [{ product: 'Frontline', date: '2026-07-01', nextDate: '2026-10-01' }],
  });
  const titles = r => r.sections.map(s => s.title);

  it('junta tratamientos, alimento diario, salud, citas próximas, lo último y veterinario', () => {
    const events = [{ petId: 'p1', date: '2026-10-12', time: '10:00', title: 'Control', type: 'Consulta' }, { petId: 'p1', date: '2026-11-30', title: 'Lejos', type: 'Consulta' }, { petId: 'p1', date: '2026-10-11', title: 'Estadía', type: STAY_TYPE }];
    const r = handoffSummary(pet(), events, 'yo', today);
    expect(titles(r)).toEqual(['Tratamientos', 'Alimento', 'Salud', 'Próximas citas', 'Lo último que se registró', 'Veterinario']);
    const by = t => r.sections.find(s => s.title === t).lines;
    expect(by('Tratamientos')[0]).toBe('Gabapentina · 1 comp · Cada 12 horas');
    expect(by('Tratamientos').some(l => l.includes('Antiguo'))).toBe(false);
    expect(by('Alimento')).toHaveLength(1);
    expect(by('Alimento')[0]).toContain('Barfood');
    expect(by('Salud').some(l => l.startsWith('Último peso: 12,5 kg'))).toBe(true);
    expect(by('Salud').some(l => l.includes('Antirrábica') && l.includes('próxima el'))).toBe(true);
    expect(by('Salud').some(l => l.includes('Frontline') && l.includes('vencida el'))).toBe(true);
    expect(by('Salud').some(l => l.includes('Lejana'))).toBe(false); // más de 30 días
    expect(by('Próximas citas')).toHaveLength(1);
    expect(by('Veterinario')[0]).toContain('Dra. Rojas');
  });

  it('con muchas vacunas o desparasitaciones pendientes muestra las 6 más urgentes y cuántas faltan', () => {
    const p = pet();
    p.vaccines = Array.from({ length: 9 }, (_, i) => ({ name: `V${i}`, date: '2025-01-01', nextDate: `2026-0${(i % 9) + 1}-15` }));
    p.deworming = [];
    const lines = handoffSummary(p, [], 'yo', today).sections.find(s => s.title === 'Salud').lines;
    expect(lines.filter(l => l.startsWith('Vacuna'))).toHaveLength(6);
    expect(lines[lines.length - 1]).toBe('…y 3 más en las fichas de vacunas y desparasitación');
    expect(lines.filter(l => l.startsWith('Vacuna'))[0]).toContain('V0'); // la más antigua (más vencida) primero
  });

  it('dice si la dosis de hoy está pendiente o quién la dio', () => {
    const r1 = handoffSummary(pet(), [], 'yo', today);
    expect(r1.sections[0].lines).toContain('Dosis de hoy: pendiente');
    const p = pet(); p.doseLog = [{ date: today, given: true, createdBy: 'otro', createdByName: 'Pedro' }];
    expect(handoffSummary(p, [], 'yo', today).sections[0].lines.some(l => l.startsWith('Dosis de hoy: dada por Pedro'))).toBe(true);
    p.doseLog = [{ date: today, given: true, createdBy: 'yo', createdByName: 'Ana' }];
    expect(handoffSummary(p, [], 'yo', today).sections[0].lines.some(l => l.startsWith('Dosis de hoy: dada por ti'))).toBe(true);
  });

  it('omite las secciones sin datos y arma un texto plano para copiar', () => {
    const r = handoffSummary({ id: 'p2', name: 'Luna' }, [], 'yo', today);
    expect(r.sections).toEqual([]);
    expect(r.text).toContain('Traspaso de Luna');
    const full = handoffSummary(pet(), [], 'yo', today).text;
    expect(full).toContain('\nTratamientos\n- Gabapentina');
  });
});

describe('splitBalance — saldo de gastos compartidos', () => {
  const ex = (over = {}) => ({ id: 'e', petId: 'p1', amount: 10000, payerId: 'yo', payerName: 'Ana', date: '2026-10-01', description: 'x', source: 'manual', ...over });
  const st = (over = {}) => ({ id: 's', petId: 'p1', amount: 1000, direction: 'paid', createdBy: 'yo', createdByName: 'Ana', date: '2026-10-05', ...over });

  it('lo que pagué yo: el otro me debe la mitad', () => {
    expect(splitBalance('p1', [ex({ amount: 30000 })], [], 'yo').net).toBe(15000);
  });

  it('lo que pagó el otro: yo le debo la mitad, y se toma su nombre', () => {
    const r = splitBalance('p1', [ex({ amount: 30000, payerId: 'otro', payerName: ' Pedro ' })], [], 'yo');
    expect(r.net).toBe(-15000);
    expect(r.otherName).toBe('Pedro');
  });

  it('gastos de los dos se compensan', () => {
    const r = splitBalance('p1', [ex({ amount: 40000 }), ex({ id: 'f', amount: 10000, payerId: 'otro', payerName: 'Pedro' })], [], 'yo');
    expect(r.net).toBe(15000); // 20.000 a mi favor - 5.000 en contra
    expect(r.paidByMe).toBe(40000);
    expect(r.paidByOther).toBe(10000);
  });

  it('un pago mío al otro reduce lo que le debo', () => {
    const r = splitBalance('p1', [ex({ amount: 30000, payerId: 'otro', payerName: 'Pedro' })], [st({ amount: 10000 })], 'yo');
    expect(r.net).toBe(-5000);
  });

  it('un pago que me hizo el otro reduce lo que me debe, visto desde ambas cuentas', () => {
    const gasto = ex({ amount: 30000 }); // pagué yo: me deben 15.000
    // Yo registré "me pagaron 6.000"
    expect(splitBalance('p1', [gasto], [st({ direction: 'received', amount: 6000 })], 'yo').net).toBe(9000);
    // Pedro registró "yo le pagué 6.000" al otro: desde mi cuenta es lo mismo
    expect(splitBalance('p1', [gasto], [st({ direction: 'paid', amount: 6000, createdBy: 'otro', createdByName: 'Pedro' })], 'yo').net).toBe(9000);
  });

  it('desde la cuenta del otro el saldo es el opuesto', () => {
    const items = [ex({ amount: 30000 })];
    const sets = [st({ direction: 'received', amount: 6000 })];
    expect(splitBalance('p1', items, sets, 'yo').net).toBe(9000);
    expect(splitBalance('p1', items, sets, 'otro').net).toBe(-9000);
  });

  it('están al día cuando los pagos cubren la deuda', () => {
    expect(splitBalance('p1', [ex({ amount: 30000 })], [st({ direction: 'received', amount: 15000 })], 'yo').net).toBe(0);
  });

  it('los gastos sin pagador conocido no entran al saldo y se cuentan aparte', () => {
    const r = splitBalance('p1', [ex({ payerId: null }), ex({ id: 'g', amount: 2000 })], [], 'yo');
    expect(r.unassigned).toBe(1);
    expect(r.net).toBe(1000);
  });

  it('ignora el botiquín, otras mascotas y montos no válidos', () => {
    const r = splitBalance('p1', [ex({ source: 'botiquin' }), ex({ petId: 'p2' }), ex({ amount: 0 }), ex({ amount: 'abc' })], [st({ petId: 'p2' })], 'yo');
    expect(r.net).toBe(0);
    expect(r.rows).toEqual([]);
  });

  it('redondea el saldo a pesos enteros', () => {
    expect(splitBalance('p1', [ex({ amount: 10001 })], [], 'yo').net).toBe(5001);
  });

  it('el detalle ordena gastos y pagos del más reciente al más antiguo e indica quién pagó', () => {
    const r = splitBalance('p1', [ex({ date: '2026-10-01' }), ex({ id: 'f', date: '2026-10-09', payerId: 'otro', payerName: 'Pedro' })], [st({ date: '2026-10-05' })], 'yo');
    expect(r.rows.map(x => `${x.kind}:${x.date}`)).toEqual(['expense:2026-10-09', 'settlement:2026-10-05', 'expense:2026-10-01']);
    expect(r.rows[0].by).toBe('Pedro');
    expect(r.rows[2].by).toBe('Tú');
    expect(r.rows[1]).toMatchObject({ iPaid: true, own: true });
  });
});
