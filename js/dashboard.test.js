import { describe, it, expect, beforeEach } from 'vitest';
import '../js/utils.js';
import '../js/app.js';   // deja state/icon/esc/appShell/statCard/petAvatar reales en window
import '../js/pets.js';   // deja petCompletenessCard real en window
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

describe('viewDashboard — completar el perfil de la mascota', () => {
  beforeEach(() => {
    window.state.user = { name: 'Felipe Molina' };
    window.state.pets = [];
    window.state.events = [];
    window.state.dashAttnAll = false;
    window.getFinanceExpenses = () => [];
  });

  it('una mascota con solo lo mínimo muestra la tarjeta al 10 % con el paso de mayor peso primero', () => {
    window.state.pets = [{ id: 'pet-1', name: 'Luna', species: 'Perro', myRole: 'owner', vaccines: [], deworming: [], medications: [] }];
    const html = viewDashboard();
    expect(html).toContain('Completa el perfil de');
    expect(html).toContain('10 %');
    expect(html.indexOf('Al menos una vacuna')).toBeGreaterThan(-1);
    expect(html.indexOf('Al menos una vacuna')).toBeLessThan(html.indexOf('Fecha de nacimiento'));
    expect(html).toContain("completionAction('pet-1','vaccine')");
  });

  it('muestra la mascota con el perfil MENOS completo', () => {
    window.state.pets = [
      { id: 'a', name: 'Casi', species: 'Perro', myRole: 'owner', dateOfBirth: '2020-01-01', photo: 'data:image/png;base64,AAAA', breed: 'Mestizo', sex: 'Macho', vaccines: [{}], deworming: [{}], weightKg: 10, vet: { name: 'X', phone: '1' }, allergies: [], chronicConditions: ['Ninguna'], chipNumber: '1', reproductiveStatus: 'Esterilizado' },
      { id: 'b', name: 'Poco', species: 'Gato', myRole: 'owner', vaccines: [], deworming: [], medications: [] },
    ];
    const html = viewDashboard();
    expect(html).toContain('Completa el perfil de Poco');
    expect(html).not.toContain('Completa el perfil de Casi');
  });

  it('un perfil al 100 % no muestra la tarjeta', () => {
    window.state.pets = [{ id: 'a', name: 'Listo', species: 'Perro', myRole: 'owner', dateOfBirth: '2020-01-01', photo: 'data:image/png;base64,AAAA', breed: 'Mestizo', sex: 'Macho', vaccines: [{}], deworming: [{}], foodItems: [{}], weightKg: 10, vet: { name: 'X', phone: '1' }, chronicConditions: ['Ninguna'], chipNumber: '1', reproductiveStatus: 'Esterilizado', medications: [] }];
    expect(viewDashboard()).not.toContain('Completa el perfil de');
  });

  it('un tutor de solo lectura no ve la tarjeta (no puede completar esa ficha)', () => {
    window.state.pets = [{ id: 'pet-1', name: 'Luna', species: 'Perro', myRole: 'viewer', vaccines: [], deworming: [], medications: [] }];
    expect(viewDashboard()).not.toContain('Completa el perfil de');
  });
});

describe('viewDashboard — alimento por acabarse', () => {
  beforeEach(() => {
    window.state.user = { name: 'Felipe Molina' };
    window.state.events = [];
    window.state.dashAttnAll = true;
    window.getFinanceExpenses = () => [];
    window.canEditPet = () => true;
  });

  it('avisa cuando al alimento le quedan pocos días, con buscar oferta y "ya repuse"', () => {
    // 10 kg a 0.5 kg/día = 20 días; comprado hace 17 → quedan ~3
    window.state.pets = [healthyPet({ foodItems: [
      { id: 'f1', product: 'Bravery Pollo', packageSize: 10, packageUnit: 'kg', dailyAmount: 0.5, purchaseDate: day(-17) }] })];
    const html = viewDashboard();
    expect(html).toContain('Alimento por acabarse · Bravery Pollo');
    expect(html).toContain("openFoodOffer('pet-1','f1','dashboard')");
    expect(html).toContain("openFoodPurchaseModal('pet-1','f1')");
  });

  it('no avisa si queda alimento para más de una semana', () => {
    window.state.pets = [healthyPet({ foodItems: [
      { id: 'f1', product: 'Bravery Pollo', packageSize: 10, packageUnit: 'kg', dailyAmount: 0.5, purchaseDate: day(-2) }] })];
    expect(viewDashboard()).not.toContain('Alimento por acabarse');
  });

  it('un tutor de solo lectura ve buscar oferta pero no "ya repuse"', () => {
    window.canEditPet = () => false;
    window.state.pets = [healthyPet({ foodItems: [
      { id: 'f1', product: 'Bravery Pollo', packageSize: 10, packageUnit: 'kg', dailyAmount: 0.5, purchaseDate: day(-17) }] })];
    const html = viewDashboard();
    expect(html).toContain('Buscar oferta');
    expect(html).not.toContain('Compré de nuevo');
  });
});

describe('viewDashboard — recordatorio mensual de pesar', () => {
  beforeEach(() => {
    window.state.user = { name: 'Felipe Molina' };
    window.state.events = [];
    window.state.dashAttnAll = true;
    window.getFinanceExpenses = () => [];
    window.canEditPet = () => true;
  });

  it('avisa cuando la última medición tiene 30 días o más', () => {
    window.state.pets = [healthyPet({ weightHistory: [{ id: 'w1', date: day(-45), kg: 6, gr: 0 }] })];
    const html = viewDashboard();
    expect(html).toContain('Hace 45 días que no registras el peso de Greta');
    expect(html).toContain("openWeightModal('pet-1')");
  });

  it('no avisa si se pesó hace menos de 30 días', () => {
    window.state.pets = [healthyPet({ weightHistory: [{ id: 'w1', date: day(-10), kg: 6, gr: 0 }] })];
    expect(viewDashboard()).not.toContain('no registras el peso');
  });

  it('una mascota que nunca se pesó avisa a los 30 días de creada', () => {
    window.state.pets = [healthyPet({ weightHistory: [], createdAt: `${day(-40)}T12:00:00Z` })];
    expect(viewDashboard()).toContain('Aún no registras mediciones de peso de Greta');
    window.state.pets = [healthyPet({ weightHistory: [], createdAt: `${day(-5)}T12:00:00Z` })];
    expect(viewDashboard()).not.toContain('mediciones de peso');
  });

  it('no avisa a un tutor de solo lectura ni en peces', () => {
    window.state.pets = [healthyPet({ weightHistory: [{ id: 'w1', date: day(-90), kg: 6, gr: 0 }] })];
    window.canEditPet = () => false;
    expect(viewDashboard()).not.toContain('no registras el peso');
    window.canEditPet = () => true;
    window.state.pets = [healthyPet({ species: 'Pez', weightHistory: [{ id: 'w1', date: day(-90), kg: 1, gr: 0 }] })];
    expect(viewDashboard()).not.toContain('no registras el peso');
  });
});
