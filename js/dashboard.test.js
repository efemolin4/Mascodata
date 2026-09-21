import { describe, it, expect, beforeEach } from 'vitest';
import '../js/utils.js';
import '../js/app.js';   // deja state/icon/esc/appShell/statCard/petAvatar reales en window
import { viewDashboard } from './dashboard.js';

const day = (offset) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const healthyPet = (over = {}) => ({
  id: 'pet-1', name: 'Greta', species: 'Perro', dateOfBirth: '2021-01-01', vet: { name: 'Dra. Rojas' },
  vaccines: [], deworming: [], medications: [], ...over,
});

describe('viewDashboard', () => {
  beforeEach(() => {
    window.state.user = { name: 'Felipe Molina' };
    window.state.pets = [];
    window.state.events = [];
    window.state.dashAttnAll = false;
    window.getFinanceExpenses = () => [];
  });

  it('muestra el onboarding cuando el usuario no tiene mascotas', () => {
    const html = viewDashboard();
    expect(html).toContain('Empecemos con tu primera mascota');
    expect(html).toContain('Hola, Felipe');
  });

  it('muestra las mascotas registradas y una vacuna vencida en "Necesita atención"', () => {
    window.state.pets = [{
      id: 'pet-1', name: 'Greta', species: 'Perro', dateOfBirth: '2021-01-01', vet: { name: 'Dra. Rojas' },
      vaccines: [{ id: 'v1', name: 'Antirrábica', date: day(-400), nextDate: '2020-01-01', alertType: 'same' }], // vencida
      deworming: [], medications: [],
    }];
    const html = viewDashboard();
    expect(html).not.toContain('Empecemos con tu primera mascota');
    expect(html).toContain('Greta');
    expect(html).toContain('Necesita atención');
    expect(html).toContain('Antirrábica');
    expect(html).toContain('Venció el');
    expect(html).toContain("openVaccineModal('pet-1')");
    expect(html).toContain('1 vencida');
  });

  it('escapa el nombre del usuario para evitar HTML/JS inyectado', () => {
    window.state.user = { name: '<img src=x onerror=alert(1)>' };
    const html = viewDashboard();
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img');
  });

  it('sin nada pendiente muestra "Todo al día" en vez de una lista vacía', () => {
    window.state.pets = [healthyPet({ vaccines: [{ id: 'v', name: 'Antirrábica', date: day(-30), nextDate: day(300), alertType: 'same' }] })];
    const html = viewDashboard();
    expect(html).toContain('Todo al día');
    expect(html).not.toContain('Necesita atención');
  });

  it('una dosis vieja cuyo "próximo" ya pasó no alerta si después se aplicó otra de la misma vacuna', () => {
    window.state.pets = [healthyPet({ vaccines: [
      { id: 'v1', name: 'Antirrábica', date: day(-800), nextDate: day(-435), alertType: 'same' },
      { id: 'v2', name: 'Antirrábica', date: day(-70), nextDate: day(295), alertType: 'same' },
    ] })];
    const html = viewDashboard();
    expect(html).toContain('Todo al día');
    expect(html).not.toContain('Venció el');
  });

  it('un tratamiento terminado y ya cerrado (active=false) no genera alerta; uno que sigue activo sí', () => {
    window.state.pets = [healthyPet({
      vaccines: [{ id: 'v', name: 'Antirrábica', date: day(-30), nextDate: day(300) }],
      medications: [
        { id: 'm1', name: 'Meloxicam', active: false, endDate: day(-20) },
        { id: 'm2', name: 'Gabapentina', active: true, endDate: day(-2) },
      ],
    })];
    const html = viewDashboard();
    expect(html).toContain('Gabapentina');
    expect(html).not.toContain('Meloxicam');
  });

  it('ordena por urgencia: vencidas, luego por vencer, luego recomendaciones', () => {
    window.state.pets = [healthyPet({
      vet: null,
      vaccines: [{ id: 'v', name: 'Antirrábica', date: day(-30), nextDate: day(300) }],
      deworming: [
        { id: 'd1', product: 'Bravecto', date: day(-80), nextDate: day(3), alertType: 'week' },
        { id: 'd2', product: 'Drontal', date: day(-100), nextDate: day(-5), alertType: 'same' },
      ],
    })];
    const html = viewDashboard();
    const iOverdue = html.indexOf('Drontal');
    const iSoon = html.indexOf('Bravecto');
    const iRec = html.indexOf('no tiene veterinario');
    expect(iOverdue).toBeGreaterThan(-1);
    expect(iOverdue).toBeLessThan(iSoon);
    expect(iSoon).toBeLessThan(iRec);
  });

  it('no duplica el aviso de "sin vacunas hace un año" cuando ya hay una vacuna vencida de esa mascota', () => {
    window.state.pets = [healthyPet({ vaccines: [{ id: 'v', name: 'Antirrábica', date: day(-500), nextDate: day(-135), alertType: 'same' }] })];
    const html = viewDashboard();
    expect(html).toContain('Venció el');
    expect(html).not.toContain('sin registrar vacunas');
  });

  it('con más de 4 pendientes muestra 4 y ofrece "Ver los N restantes"', () => {
    window.state.pets = [healthyPet({
      vaccines: [1, 2, 3, 4, 5, 6].map(i => ({ id: 'v' + i, name: 'Vacuna ' + i, date: day(-400), nextDate: day(-10 * i), alertType: 'same' })),
    })];
    const html = viewDashboard();
    expect(html).toContain('Ver los 2 restantes');
    expect(html).toContain('Vacuna 6');   // la más vieja (vence primero) va arriba
    expect(html).not.toContain('Vacuna 1<'); // la más reciente queda fuera de las 4 visibles
    window.state.dashAttnAll = true;
    expect(viewDashboard()).toContain('Ver menos');
  });

  it('cada mascota muestra su estado: "Al día" o cuántas vencidas tiene', () => {
    window.state.pets = [
      healthyPet({ id: 'a', name: 'Greta', vaccines: [{ id: 'v', name: 'Antirrábica', date: day(-30), nextDate: day(300) }] }),
      healthyPet({ id: 'b', name: 'Luna', species: 'Gato', vaccines: [{ id: 'w', name: 'Triple', date: day(-500), nextDate: day(-100), alertType: 'same' }] }),
    ];
    const html = viewDashboard();
    expect(html).toContain('Al día');
    expect(html).toContain('1 vencida');
  });

  it('una mascota sin fechas vencidas pero con una recomendación pendiente no dice "Al día"', () => {
    window.state.pets = [healthyPet({ vaccines: [{ id: 'v', name: 'Antirrábica', date: day(-500), nextDate: null }] })];
    const html = viewDashboard();
    expect(html).toContain('1 sugerencia');
    expect(html).not.toContain('>Al día<');
  });

  it('muestra el gasto del mes en la franja de hoy', () => {
    window.state.pets = [healthyPet()];
    window.getFinanceExpenses = () => [{ id: 1, amount: 23500, date: day(0), category: 'Otro' }];
    expect(viewDashboard()).toContain('$23.500');
  });
});
