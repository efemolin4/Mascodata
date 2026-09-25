import { describe, it, expect } from 'vitest';
import { signUnsub as signUnsubProfile } from '../supabase/functions/pet-completion-reminders/index.ts';
import {
  isDaily, runOutDate, pickRestocks, withOwnerAccess, buildRestockEmail, offerUrl, signUnsub, verifyUnsub,
  LEAD_DAYS, GRACE_DAYS, MAX_ITEMS_PER_EMAIL, MAX_PER_RUN,
} from '../supabase/functions/food-restock-reminders/index.ts';

const DAY = 86_400_000;
const NOW = new Date('2026-10-01T13:30:00Z');
const dayIso = (offset) => new Date(NOW.getTime() + offset * DAY).toISOString().slice(0, 10);

// Alimento de 10 kg a 0.5 kg/día = 20 días; comprado hace `bought` días.
const food = (over = {}) => ({
  id: 'f1', pet_id: 'p1', product: 'Barfood', type: 'BARF', category: 'diario',
  package_size: 10, package_unit: 'kg', daily_amount: 0.5, purchase_date: dayIso(-17), ...over,
});
const pets = [{ id: 'p1', owner_id: 'u1', name: 'Greta ' }];
const profiles = [{ id: 'u1', email: 'a@b.cl', name: 'Ana', reminders_opt_out: false }];
const pick = (over = {}) => pickRestocks({ foods: [food()], pets, profiles, sent: [], lastProfileMail: {}, now: NOW, ...over });

describe('cuándo se acaba', () => {
  it('suma los días que dura el paquete a la fecha de compra', () => {
    expect(runOutDate(food())).toBe(dayIso(3));
  });
  it('sin consumo, tamaño o fecha de compra no se estima nada', () => {
    expect(runOutDate(food({ daily_amount: 0 }))).toBeNull();
    expect(runOutDate(food({ package_size: null }))).toBeNull();
    expect(runOutDate(food({ purchase_date: null }))).toBeNull();
  });
  it('los snacks no son alimento diario', () => {
    expect(isDaily(food({ category: 'snack' }))).toBe(false);
    expect(isDaily(food({ category: undefined, type: 'Snack' }))).toBe(false);
    expect(isDaily(food({ category: undefined, type: 'Seco' }))).toBe(true);
  });
});

describe('a quién se le avisa', () => {
  it('avisa cuando faltan 3 días o menos', () => {
    expect(pick()).toHaveLength(1);
    expect(pick()[0].items[0].daysLeft).toBe(LEAD_DAYS);
  });
  it('no avisa si todavía falta más de 3 días', () => {
    expect(pick({ foods: [food({ purchase_date: dayIso(-10) })] })).toHaveLength(0);
  });
  it('sigue avisando hasta 3 días después de la fecha estimada y luego deja de insistir', () => {
    expect(pick({ foods: [food({ purchase_date: dayIso(-20 - GRACE_DAYS) })] })).toHaveLength(1);
    expect(pick({ foods: [food({ purchase_date: dayIso(-20 - GRACE_DAYS - 1) })] })).toHaveLength(0);
  });
  it('un solo aviso por alimento y ciclo de compra; al reponer, el nuevo ciclo puede avisar', () => {
    const sent = [{ food_item_id: 'f1', cycle_date: dayIso(-17) }];
    expect(pick({ sent })).toHaveLength(0);
    expect(pick({ sent, foods: [food({ purchase_date: dayIso(-18) })] })).toHaveLength(1);
  });
  it('no avisa de snacks ni de alimentos sin consumo indicado', () => {
    expect(pick({ foods: [food({ category: 'snack' })] })).toHaveLength(0);
    expect(pick({ foods: [food({ daily_amount: 0 })] })).toHaveLength(0);
  });
  it('respeta la baja de recordatorios y la falta de correo', () => {
    expect(pick({ profiles: [{ ...profiles[0], reminders_opt_out: true }] })).toHaveLength(0);
    expect(pick({ profiles: [{ ...profiles[0], email: null }] })).toHaveLength(0);
  });
  it('espera un día si la persona recibió un recordatorio de perfil hace menos de 24 h', () => {
    expect(pick({ lastProfileMail: { u1: NOW.getTime() - 2 * 3_600_000 } })).toHaveLength(0);
    expect(pick({ lastProfileMail: { u1: NOW.getTime() - 25 * 3_600_000 } })).toHaveLength(1);
  });
  it('junta varios alimentos de una persona en un solo correo, los más urgentes primero, con tope', () => {
    const foods = Array.from({ length: 7 }, (_, i) => food({ id: `f${i}`, purchase_date: dayIso(-17 - (i % 3)) }));
    const out = pick({ foods });
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(MAX_ITEMS_PER_EMAIL);
    const days = out[0].items.map(i => i.daysLeft);
    expect(days).toEqual([...days].sort((a, b) => a - b));
  });
  it('un correo por persona aunque tenga varias mascotas, y respeta el tope por corrida', () => {
    const many = Array.from({ length: MAX_PER_RUN + 5 }, (_, i) => ({ id: `u${i}`, email: `${i}@x.cl`, name: null, reminders_opt_out: false }));
    const foods = many.map((u, i) => food({ id: `f${i}`, pet_id: `p${i}` }));
    const ps = many.map((u, i) => ({ id: `p${i}`, owner_id: u.id, name: 'X' }));
    expect(pick({ foods, pets: ps, profiles: many })).toHaveLength(MAX_PER_RUN);
  });
  it('solo cuenta al dueño de la mascota, no a otros tutores ni a mascotas sin acceso', () => {
    const access = [{ pet_id: 'p1', user_id: 'u1', role: 'owner' }, { pet_id: 'p2', user_id: 'u1', role: 'editor' }];
    const all = [...pets, { id: 'p2', owner_id: 'u1', name: 'Otra' }, { id: 'p3', owner_id: 'u1', name: 'Huérfana' }];
    expect(withOwnerAccess(all, access).map(p => p.id)).toEqual(['p1']);
  });
});

describe('el correo', () => {
  const o = { appUrl: 'https://mascodata.cl', unsubUrl: 'https://x.test/f?unsub=u1&t=abc' };
  const item = (over = {}, daysLeft = 3) => ({ food: food(over), pet: pets[0], runOut: dayIso(daysLeft), daysLeft });

  it('con un alimento, el asunto dice cuándo se acaba, sin espacios dobles', () => {
    expect(buildRestockEmail({ profile: profiles[0], items: [item({}, 3)] }, o).subject).toBe('El alimento de Greta se acaba en 3 días');
    expect(buildRestockEmail({ profile: profiles[0], items: [item({}, 1)] }, o).subject).toBe('El alimento de Greta se acaba mañana');
    expect(buildRestockEmail({ profile: profiles[0], items: [item({}, 0)] }, o).subject).toBe('El alimento de Greta se acaba hoy');
    expect(buildRestockEmail({ profile: profiles[0], items: [item({}, -2)] }, o).subject).toBe('El alimento de Greta ya debería haberse acabado');
  });
  it('con varios, el asunto cuenta cuántos son', () => {
    expect(buildRestockEmail({ profile: profiles[0], items: [item({}, 3), item({ id: 'f2' }, 2)] }, o).subject).toBe('Tienes 2 alimentos por acabarse');
  });
  it('lleva buscar oferta, ya repuse, la baja y escapa el texto del producto', () => {
    const m = buildRestockEmail({ profile: profiles[0], items: [item({ product: '<img src=x onerror=alert(1)>' })] }, o);
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('Buscar oferta');
    expect(m.html).toContain('Compré de nuevo');
    expect(m.html).toContain('unsub=u1');
    expect(m.text).toContain('Dejar de recibir estos recordatorios');
    expect(m.text).toContain('https://mascodata.cl/pets/p1');
  });
  it('el enlace de búsqueda lleva el producto y el tamaño codificados', () => {
    expect(offerUrl(food({ product: 'Bravery pollo & arroz', package_size: 12 }))).toBe('https://www.google.com/search?tbm=shop&q=Bravery%20pollo%20%26%20arroz%2012%20kg');
  });
  it('la firma de baja es la misma que la de los recordatorios de perfil y se rechaza si se altera', async () => {
    const sig = await signUnsub('u1', 'secreto');
    expect(await verifyUnsub('u1', sig, 'secreto')).toBe(true);
    expect(await verifyUnsub('u2', sig, 'secreto')).toBe(false);
    expect(await verifyUnsub('u1', sig, 'otro')).toBe(false);
    expect(sig).toBe(await signUnsubProfile('u1', 'secreto'));
  });
});
