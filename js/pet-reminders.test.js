import { describe, it, expect } from 'vitest';
import { petCompleteness, COMPLETENESS_FIELDS } from './utils.js';
import {
  FIELDS, scorePet, pickReminders, withOwnerAccess, buildEmail, signUnsub, verifyUnsub, safeEqual,
  STEP_DAYS, MAX_PER_RUN,
} from '../supabase/functions/pet-completion-reminders/index.ts';

const DAY = 86_400_000;
const NOW = new Date('2026-10-01T13:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY).toISOString();

// Mascota en el formato del navegador -> el mismo dato en el formato de la base.
const toRow = (p, id = 'pet-1') => ({
  id, owner_id: 'u1', name: p.name ?? null, species: p.species ?? null, breed: p.breed ?? null,
  date_of_birth: p.dateOfBirth ?? null, sex: p.sex ?? null, microchip: p.chipNumber ?? null,
  reproductive_status: p.reproductiveStatus ?? null, weight_kg: p.weightKg ?? null,
  allergies: p.allergies ?? null, chronic_conditions: p.chronicConditions ?? null,
  vet_name: p.vet?.name ?? null, vet_phone: p.vet?.phone ?? null, created_at: daysAgo(3),
});
const toCtx = (p) => ({ hasPhoto: !!p.photo, hasVaccine: (p.vaccines || []).length > 0, hasDeworm: (p.deworming || []).length > 0, hasFood: (p.foodItems || []).length > 0 });

const FIXTURES = {
  minimo: { name: 'Luna', species: 'Perro' },
  completo: { name: 'Luna', species: 'Perro', dateOfBirth: '2020-01-01', photo: 'data:image/png;base64,AAAA', breed: 'Mestizo', sex: 'Hembra', chipNumber: '1', vaccines: [{}], deworming: [{}], foodItems: [{}], allergies: [], chronicConditions: ['Ninguna'], weightKg: 12, reproductiveStatus: 'Esterilizada', vet: { name: 'Dra. Pérez', phone: '+56 9 1' } },
  parcial: { name: 'Michi', species: 'Gato', dateOfBirth: '2022-05-05', vaccines: [{}], weightKg: '4.2', vet: { name: 'Dr X', phone: '' } },
  pez: { name: 'Nemo', species: 'Pez', breed: 'Betta' },
  ave: { name: 'Kiwi', species: 'Ave', dateOfBirth: '2024-01-01', photo: 'data:image/png;base64,AAAA', sex: 'Macho', allergies: ['Polen'], weightKg: 0.1, vet: { name: 'A', phone: 'B' }, breed: 'Canario' },
  pesoCero: { name: 'Rex', species: 'Perro', weightKg: 0 },
  espacios: { name: 'Rex', species: 'Perro', vet: { name: '   ', phone: '  ' } },
};

describe('paridad entre el puntaje del navegador y el de la función de correos', () => {
  it('tienen exactamente los mismos campos, en el mismo orden y con los mismos pesos', () => {
    expect(FIELDS.map(f => [f.key, f.points, !!f.healthOnly])).toEqual(COMPLETENESS_FIELDS.map(f => [f.key, f.points, !!f.healthOnly]));
    expect(FIELDS.reduce((a, f) => a + f.points, 0)).toBe(100);
  });

  for (const [nombre, pet] of Object.entries(FIXTURES)) {
    it(`da el mismo porcentaje y los mismos pasos pendientes: ${nombre}`, () => {
      const a = petCompleteness(pet);
      const b = scorePet(toRow(pet), toCtx(pet));
      expect(b.percent).toBe(a.percent);
      expect(b.missing.map(m => [m.key, m.gain])).toEqual(a.missing.map(m => [m.key, m.gain]));
    });
  }
});

describe('pickReminders — cadencia', () => {
  const prof = (over = {}) => ({ id: 'u1', email: 'ana@t.cl', name: 'Ana', reminders_opt_out: false, ...over });
  const pet = (over = {}, id = 'pet-1') => ({ ...toRow(FIXTURES.minimo, id), ...over });
  const run = (o) => pickReminders({ pets: [], ctx: {}, reminders: [], profiles: [prof()], now: NOW, ...o });

  it('no avisa antes del día 2', () => {
    expect(run({ pets: [pet({ created_at: daysAgo(1) })] })).toEqual([]);
  });

  it('respeta el tope diario para no pasarse del límite de Resend (100/día compartidos con el aviso de alimento)', () => {
    expect(MAX_PER_RUN).toBe(50);
    const n = MAX_PER_RUN + 10;
    const profiles = Array.from({ length: n }, (_, i) => prof({ id: `u${i}`, email: `${i}@t.cl` }));
    const pets = profiles.map((p, i) => pet({ owner_id: p.id, created_at: daysAgo(3) }, `pet-${String(i).padStart(3, '0')}`));
    expect(run({ pets, profiles })).toHaveLength(MAX_PER_RUN);
  });

  it('el primer aviso toca desde el día 2', () => {
    const r = run({ pets: [pet({ created_at: daysAgo(2) })] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ step: 1, percent: 10 });
  });

  it('el segundo aviso espera al día 7 y a que pasen 5 días desde el primero', () => {
    const first = { pet_id: 'pet-1', user_id: 'u1', step: 1, sent_at: daysAgo(5) };
    expect(run({ pets: [pet({ created_at: daysAgo(6) })], reminders: [first] })).toEqual([]);
    expect(run({ pets: [pet({ created_at: daysAgo(7) })], reminders: [first] })[0].step).toBe(2);
  });

  it('mascota antigua sin avisos: parte por el primero, no salta al tercero', () => {
    const r = run({ pets: [pet({ created_at: daysAgo(40) })] });
    expect(r[0].step).toBe(1);
  });

  it('mascota antigua: el 2.º espera 5 días tras el 1.º y el 3.º espera 14 tras el 2.º', () => {
    const p = [pet({ created_at: daysAgo(40) })];
    const s1 = (d) => [{ pet_id: 'pet-1', user_id: 'u1', step: 1, sent_at: daysAgo(d) }];
    expect(run({ pets: p, reminders: s1(4) })).toEqual([]);
    expect(run({ pets: p, reminders: s1(5) })[0].step).toBe(2);
    const s2 = (d) => [...s1(30), { pet_id: 'pet-1', user_id: 'u1', step: 2, sent_at: daysAgo(d) }];
    expect(run({ pets: p, reminders: s2(13) })).toEqual([]);
    expect(run({ pets: p, reminders: s2(14) })[0].step).toBe(3);
  });

  it('el tercer aviso es el último: después de 3 no se manda más', () => {
    const sent = [1, 2, 3].map(step => ({ pet_id: 'pet-1', user_id: 'u1', step, sent_at: daysAgo(30 - step) }));
    expect(run({ pets: [pet({ created_at: daysAgo(40) })], reminders: sent })).toEqual([]);
    expect(STEP_DAYS).toEqual([2, 7, 21]);
  });

  it('no avisa si el perfil ya está al 100 %', () => {
    const full = FIXTURES.completo;
    const r = run({ pets: [{ ...toRow(full), created_at: daysAgo(10) }], ctx: { 'pet-1': toCtx(full) } });
    expect(r).toEqual([]);
  });

  it('respeta la baja, y no escribe a quien no tiene correo', () => {
    const pets = [pet({ created_at: daysAgo(5) })];
    expect(run({ pets, profiles: [prof({ reminders_opt_out: true })] })).toEqual([]);
    expect(run({ pets, profiles: [prof({ email: null })] })).toEqual([]);
    expect(run({ pets, profiles: [] })).toEqual([]);
  });

  it('con varias mascotas escribe una sola vez a la persona: la de perfil más incompleto', () => {
    const parcial = FIXTURES.parcial;
    const pets = [
      { ...toRow(parcial, 'pet-a'), created_at: daysAgo(5) },
      pet({ created_at: daysAgo(5) }, 'pet-b'),
    ];
    const r = run({ pets, ctx: { 'pet-a': toCtx(parcial), 'pet-b': toCtx(FIXTURES.minimo) } });
    expect(r).toHaveLength(1);
    expect(r[0].pet.id).toBe('pet-b');
  });

  it('tope semanal entre mascotas distintas: si ya le avisamos por otra hace 3 días, espera', () => {
    const other = { pet_id: 'pet-otra', user_id: 'u1', step: 1, sent_at: daysAgo(3) };
    expect(run({ pets: [pet({ created_at: daysAgo(5) })], reminders: [other] })).toEqual([]);
    const old = { ...other, sent_at: daysAgo(8) };
    expect(run({ pets: [pet({ created_at: daysAgo(5) })], reminders: [old] })).toHaveLength(1);
  });

  it('en peces el porcentaje se recalcula sin vacunas ni microchip', () => {
    const r = run({ pets: [{ ...toRow(FIXTURES.pez), created_at: daysAgo(5) }], ctx: { 'pet-1': toCtx(FIXTURES.pez) } });
    expect(r[0].missing.map(m => m.key)).not.toContain('vaccine');
  });
});

describe('buildEmail', () => {
  const mk = (step, name = 'Luna') => ({
    pet: { ...toRow({ ...FIXTURES.minimo, name }), id: 'pet-1' }, profile: { id: 'u1', email: 'a@t.cl', name: 'Ana', reminders_opt_out: false },
    step, percent: 10, missing: scorePet(toRow(FIXTURES.minimo), toCtx(FIXTURES.minimo)).missing,
  });
  const opts = { appUrl: 'https://mascodata.cl', unsubUrl: 'https://x.supabase.co/functions/v1/f?unsub=u1&t=abc' };

  it('lleva el porcentaje en el asunto, los 3 pasos de mayor peso, el enlace a la ficha y el de baja', () => {
    const m = buildEmail(mk(1), opts);
    expect(m.subject).toBe('El perfil de Luna está al 10 %');
    expect(m.html).toContain('Al menos una vacuna');
    expect(m.html).toContain('+15 %');
    expect(m.html).toContain('href="https://mascodata.cl/pets/pet-1"');
    expect(m.html).toContain('Dejar de recibir estos recordatorios');
    expect(m.html).toContain('unsub=u1&amp;t=abc');
    expect(m.text).toContain(opts.unsubUrl);
    expect((m.html.match(/\+\d+ %/g) || []).length).toBe(3);
  });

  it('escapa el nombre de la mascota (no inyecta HTML en el correo)', () => {
    const m = buildEmail(mk(1, '<img src=x onerror=alert(1)>'), opts);
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('el tercer aviso avisa que es el último', () => {
    expect(buildEmail(mk(3), opts).html).toContain('último recordatorio');
    expect(buildEmail(mk(1), opts).html).not.toContain('último recordatorio');
  });
});

describe('enlace de baja firmado', () => {
  it('una firma válida verifica, y cualquier cambio la invalida', async () => {
    const sig = await signUnsub('user-1', 'secreto');
    expect(await verifyUnsub('user-1', sig, 'secreto')).toBe(true);
    expect(await verifyUnsub('user-2', sig, 'secreto')).toBe(false);
    expect(await verifyUnsub('user-1', sig, 'otro-secreto')).toBe(false);
    const last = sig.slice(-1);
    expect(await verifyUnsub('user-1', sig.slice(0, -1) + (last === '0' ? '1' : '0'), 'secreto')).toBe(false);
  });

  it('sin secreto, sin usuario o sin firma nunca verifica', async () => {
    const sig = await signUnsub('user-1', 'secreto');
    expect(await verifyUnsub('user-1', sig, '')).toBe(false);
    expect(await verifyUnsub('', sig, 'secreto')).toBe(false);
    expect(await verifyUnsub('user-1', '', 'secreto')).toBe(false);
  });

  it('safeEqual compara sin cortocircuitar y respeta el largo', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('withOwnerAccess — mascotas que el dueño no puede ver', () => {
  const pets = [
    { id: 'a', owner_id: 'u1' }, { id: 'b', owner_id: 'u1' }, { id: 'c', owner_id: 'u2' }, { id: 'd', owner_id: 'u2' },
  ];
  it('descarta las mascotas sin fila de acceso del dueño (huérfanas)', () => {
    const access = [{ pet_id: 'a', user_id: 'u1', role: 'owner' }, { pet_id: 'c', user_id: 'u2', role: 'owner' }];
    expect(withOwnerAccess(pets, access).map(p => p.id)).toEqual(['a', 'c']);
  });

  it('el acceso de otra persona, o con otro rol, no cuenta como acceso del dueño', () => {
    const access = [
      { pet_id: 'a', user_id: 'u9', role: 'owner' },   // otra persona
      { pet_id: 'b', user_id: 'u1', role: 'editor' },  // mismo usuario, rol distinto
      { pet_id: 'd', user_id: 'u2', role: 'owner' },
    ];
    expect(withOwnerAccess(pets, access).map(p => p.id)).toEqual(['d']);
  });

  it('sin filas de acceso no queda ninguna mascota', () => {
    expect(withOwnerAccess(pets, [])).toEqual([]);
  });
});
