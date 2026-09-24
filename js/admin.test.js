import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
import '../js/app.js'; // deja PLANS/fmtCLP/statCard/appShell/icon reales en window
import { esc } from './utils.js';
import { applyPlanChange, viewAdmin } from './admin.js';

describe('applyPlanChange', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.closeModal = vi.fn();
    document.body.innerHTML = `
      <input type="radio" name="new-plan" value="premium" checked />
    `;
    window.state = { user: { id: 'admin-1' }, adminData: { profiles: [{ id: 'user-1', plan: 'free' }], planChanges: [] } };
  });

  it('actualiza el plan localmente y registra la auditoría cuando Supabase confirma el cambio', async () => {
    window.sb = makeMockSb({
      profiles: { data: null, error: null },
      plan_changes: { data: { id: 'pc-1', user_id: 'user-1', from_plan: 'free', to_plan: 'premium', changed_by: 'admin-1' }, error: null },
    });
    await applyPlanChange('user-1');
    expect(window.state.adminData.profiles[0].plan).toBe('premium');
    expect(window.state.adminData.planChanges).toHaveLength(1);
    expect(window.state.adminData.planChanges[0]).toMatchObject({ from_plan: 'free', to_plan: 'premium', changed_by: 'admin-1' });
    expect(window.closeModal).toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalledWith('Plan actualizado', 'success');
  });

  it('si falla el registro de auditoría, el cambio de plan igual se aplica (no bloquea)', async () => {
    window.sb = makeMockSb({
      profiles: { data: null, error: null },
      plan_changes: { data: null, error: { message: 'boom' } },
    });
    await applyPlanChange('user-1');
    expect(window.state.adminData.profiles[0].plan).toBe('premium');
    expect(window.state.adminData.planChanges).toHaveLength(0);
    expect(window.showToast).toHaveBeenCalledWith('Plan actualizado', 'success');
  });

  it('si el plan elegido es el mismo que ya tenía, no llama a Supabase ni registra nada', async () => {
    window.state.adminData.profiles[0].plan = 'premium';
    window.sb = makeMockSb();
    await applyPlanChange('user-1');
    expect(window.sb.from).not.toHaveBeenCalled();
    expect(window.closeModal).toHaveBeenCalled();
  });

  it('si Supabase falla, muestra el toast y no muta el estado local', async () => {
    window.sb = makeMockSb({ profiles: { data: null, error: { message: 'boom' } } });
    await applyPlanChange('user-1');
    expect(window.state.adminData.profiles[0].plan).toBe('free');
    expect(window.showToast).toHaveBeenCalledWith('Error al cambiar plan', 'error');
    expect(window.closeModal).not.toHaveBeenCalled();
  });

  it('no hace nada si no hay un plan seleccionado en el formulario', async () => {
    document.body.innerHTML = '';
    window.sb = makeMockSb();
    await applyPlanChange('user-1');
    expect(window.sb.from).not.toHaveBeenCalled();
  });
});

// Cobertura del dashboard de métricas de negocio (MRR + conversión a un
// plan pago) agregado a viewAdmin(). MRR pondera cada plan pago por su
// propio precio en PLANS (js/app.js) como única fuente de verdad — antes
// los precios estaban tipeados a mano en varios lugares de este archivo
// (tarjeta de Planes y modal de cambio de plan), la misma clase de
// duplicación que ya causó bugs en otras partes de la app.
describe('viewAdmin — dashboard de métricas de negocio', () => {
  it('estima el MRR como usuarios premium × el precio mensual de PLANS', () => {
    window.state = {
      user: { isAdmin: true },
      adminTab: 'dashboard',
      adminData: {
        profiles: [
          { id: 'u1', plan: 'free',    created_at: '2026-01-01' },
          { id: 'u2', plan: 'premium', created_at: '2026-01-01' },
          { id: 'u3', plan: 'premium', created_at: '2026-01-01' },
        ],
        pets: [],
      },
    };
    const html = viewAdmin();
    // 2 usuarios premium × 2.500 = 5.000
    expect(html).toContain('$5.000');
    expect(html).toContain('MRR estimado');
  });

  it('calcula la conversión como % de usuarios que hoy tienen un plan pago (Premium)', () => {
    window.state = {
      user: { isAdmin: true },
      adminTab: 'dashboard',
      adminData: {
        profiles: [
          { id: 'u1', plan: 'free', created_at: '2026-01-01' },
          { id: 'u2', plan: 'free', created_at: '2026-01-01' },
          { id: 'u3', plan: 'free', created_at: '2026-01-01' },
          { id: 'u4', plan: 'premium', created_at: '2026-01-01' },
        ],
        pets: [],
      },
    };
    const html = viewAdmin();
    // 1 de 4 = 25%
    expect(html).toContain('25%');
  });

  it('sin usuarios, la conversión es 0% (no NaN/Infinity)', () => {
    window.state = {
      user: { isAdmin: true },
      adminTab: 'dashboard',
      adminData: { profiles: [], pets: [] },
    };
    const html = viewAdmin();
    expect(html).toContain('0%');
    expect(html).not.toContain('NaN');
  });

  it('los precios mensual y anual de Premium en la pestaña Planes y en el modal salen de PLANS', () => {
    window.state = { user: { isAdmin: true }, adminTab: 'planes', adminData: { profiles: [], pets: [] } };
    const planesHtml = viewAdmin();
    expect(planesHtml).toContain('$2.500');
    expect(planesHtml).toContain('$19.990');

    document.body.innerHTML = '';
    window.openModal = (html) => { document.body.innerHTML = html; };
    window.esc = (s) => s;
    window.closeModal = () => {};
    // openChangePlanModal no se importa acá para no ensuciar el describe de
    // applyPlanChange de arriba con más imports — se prueba indirectamente
    // vía window, ya asignado por el propio módulo al importarse.
    window.openChangePlanModal('u1', 'Ana', 'free');
    expect(document.body.innerHTML).toContain('$2.500');
    expect(document.body.innerHTML).toContain('$19.990');
    expect(document.body.innerHTML).not.toContain('value="plus"');
  });
});

// Cobertura de la auditoría de cambios de plan (plan_changes) en el
// dashboard: churn de los últimos 30 días e historial reciente.
describe('viewAdmin — churn e historial de cambios de plan', () => {
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); };

  it('cuenta como churn solo las bajas Premium→Free dentro de los últimos 30 días', () => {
    window.state = {
      user: { isAdmin: true },
      adminTab: 'dashboard',
      adminData: {
        profiles: [{ id: 'u1', name: 'Ana' }],
        pets: [],
        planChanges: [
          { id: 'pc1', user_id: 'u1', from_plan: 'premium', to_plan: 'free', changed_at: daysAgo(5) },   // cuenta
          { id: 'pc2', user_id: 'u1', from_plan: 'premium', to_plan: 'free', changed_at: daysAgo(45) },  // muy vieja, no cuenta
          { id: 'pc3', user_id: 'u1', from_plan: 'free', to_plan: 'premium', changed_at: daysAgo(2) },   // es un alta, no una baja
        ],
      },
    };
    const html = viewAdmin();
    expect(html).toContain('Bajas de Premium (30d)');
    // De las 3 entradas, solo pc1 cuenta como churn -> "1"
    expect(html).toMatch(/>\s*1\s*<\/div>\s*<div class="text-xs md:text-sm text-gray-500 mt-1">Bajas de Premium/);
  });

  it('muestra el historial de cambios con nombres resueltos y flecha de plan', () => {
    window.state = {
      user: { isAdmin: true },
      adminTab: 'dashboard',
      adminData: {
        profiles: [{ id: 'u1', name: 'Ana' }, { id: 'admin-1', name: 'Felipe' }],
        pets: [],
        planChanges: [{ id: 'pc1', user_id: 'u1', from_plan: 'free', to_plan: 'premium', changed_by: 'admin-1', changed_at: daysAgo(1) }],
      },
    };
    const html = viewAdmin();
    expect(html).toContain('Historial de cambios de plan');
    expect(html).toContain('Ana');
    expect(html).toContain('Felipe');
    expect(html).not.toContain('Todavía no se registró ningún cambio de plan');
  });

  it('sin cambios de plan, muestra el estado vacío en vez de una lista rota', () => {
    window.state = { user: { isAdmin: true }, adminTab: 'dashboard', adminData: { profiles: [], pets: [], planChanges: [] } };
    const html = viewAdmin();
    expect(html).toContain('Todavía no se registró ningún cambio de plan');
  });
});

// Regresión de la auditoría de seguridad: profiles.name lo escribe cada usuario
// y se metía en un literal de JS del onclick de "Cambiar plan" (donde esc() no
// protege). Ahora el onclick lleva solo el id y el nombre se busca en el estado.
describe('viewAdmin — tabla de usuarios con nombre hostil', () => {
  const hostile = "');window.__x=1;//";
  beforeEach(() => {
    window.state = {
      user: { isAdmin: true },
      adminTab: 'usuarios',
      adminData: { profiles: [{ id: 'u1', name: hostile, plan: "free');alert(1);//", email: 'a@t.cl' }], pets: [] },
    };
    window.openModal = (html) => { document.body.innerHTML = html; };
    window.closeModal = () => {};
    window.esc = esc; // otro test de este archivo lo reemplaza por un mock
  });

  it('el onclick de "Cambiar plan" lleva solo el id, sin nombre ni plan', () => {
    const html = viewAdmin();
    const onclick = html.match(/onclick="openChangePlanModal\(([^"]*)\)"/);
    expect(onclick[1]).toBe("'u1'");
  });

  it('un id de perfil con caracteres de JS queda reducido', () => {
    window.state.adminData.profiles[0].id = "u1');alert(1);//";
    const html = viewAdmin();
    expect(html.match(/onclick="openChangePlanModal\(([^"]*)\)"/)[1]).toBe("'u1alert1'");
  });

  it('openChangePlanModal toma el nombre y el plan actual del estado, escapando el nombre', () => {
    window.openModal = vi.fn();
    window.openChangePlanModal('u1');
    const html = window.openModal.mock.calls[0][0];
    expect(html).toContain('Usuario: <strong>&#39;);window.__x=1;//</strong>');
    expect(html).not.toContain("<strong>');window");
  });
});
