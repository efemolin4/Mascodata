import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  todayStr, daysFromNowStr, addDays, daysBetween, addMonths, getAge,
  careAlertStatus, medStockStatus, foodStockStatus, esc, safeId, safeDataUrl, petCompleteness, parseCLP, fmtCompactCLP,
  foodPricePerUnit, foodPurchaseHistory, foodPriceInsight, foodOfferUrl,
  foodCategory, foodPackageGrams, foodCostPerDay, foodSummary,
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

  it('convierte el peso del envase a gramos y descarta las unidades', () => {
    expect(foodPackageGrams(12, 'kg')).toBe(12000);
    expect(foodPackageGrams(500, 'g')).toBe(500);
    expect(foodPackageGrams(10, 'unidades')).toBeNull();
    expect(foodPackageGrams(0, 'kg')).toBeNull();
  });

  it('el costo por día es el precio dividido en los días que dura el envase', () => {
    // 10 kg a 0.5 kg/día = 20 días; $40.000 → $2.000/día
    expect(foodCostPerDay({ packageSize: 10, dailyAmount: 0.5, price: 40000 })).toBe(2000);
    expect(foodCostPerDay({ packageSize: 10, dailyAmount: 0.5, price: 0 })).toBeNull();
    // sin consumo diario no se inventa un costo por día
    expect(foodCostPerDay({ packageSize: 10, dailyAmount: 0, price: 40000 })).toBeNull();
  });

  it('calcula el reparto con las compras registradas, sin necesitar el consumo diario', () => {
    const today = todayStr();
    const sm = foodSummary([
      { type: 'Seco', category: 'diario', purchases: [
        { date: addDays(today, -10), price: 40000, packageSize: 10, packageUnit: 'kg' },
        { date: addDays(today, -200), price: 30000, packageSize: 10, packageUnit: 'kg' }] },
      { type: 'Húmedo', category: 'diario', dailyAmount: 0, purchases: [{ date: addDays(today, -5), price: 8000, packageSize: 2, packageUnit: 'kg' }] },
      { type: 'Seco', category: 'snack', purchases: [{ date: addDays(today, -3), price: 5000, packageSize: 1000, packageUnit: 'g' }] },
      { type: 'Seco', category: 'snack', purchases: [{ date: addDays(today, -3), price: 3000, packageSize: 10, packageUnit: 'unidades' }] },
    ]);
    expect(sm.daily).toBe(22000);
    expect(sm.snack).toBe(1000);
    expect(sm.snackPct).toBe(4);
    expect(sm.skipped).toBe(1);
    expect(sm.byType[0]).toEqual({ label: 'Seco', grams: 21000 });
    expect(sm.spent90).toBe(40000 + 8000 + 5000 + 3000); // la compra de hace 200 días no cuenta
    expect(sm.since).toBe(addDays(today, -200));
  });

  it('un alimento sin historial aporta su propia fila como compra', () => {
    const sm = foodSummary([{ type: 'Seco', category: 'diario', packageSize: 15, packageUnit: 'kg', price: 62000, purchaseDate: todayStr() }]);
    expect(sm.daily).toBe(15000);
    expect(sm.purchases).toBe(1);
  });

  it('sin alimentos devuelve todo en cero', () => {
    expect(foodSummary([])).toMatchObject({ total: 0, snackPct: 0, spent90: 0 });
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
