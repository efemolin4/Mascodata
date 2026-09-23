import { describe, it, expect } from 'vitest';
import '../js/utils.js';
import { state } from '../js/app.js'; // isPremium() (llamada dentro de viewBotiquin) lee `state` del scope de app.js, no de window — hay que mutar el mismo objeto, no reemplazar window.state
import { viewBotiquin } from './botiquin.js';

describe('viewBotiquin — gating Premium', () => {
  it('muestra el upsell de Premium en vez del inventario cuando el usuario no es premium', () => {
    state.user = { id: 'user-1', plan: 'free' };
    state.pets = [];
    state.botiquin = [{ id: 'b1', name: 'Vendas' }];
    const html = viewBotiquin();
    expect(html).toContain('Premium');
    expect(html).toContain('Botiquín del hogar');
    expect(html).not.toContain('Vendas'); // no se filtra el inventario real aunque exista en el estado
    expect(html).not.toContain('Agregar producto');
  });

  it('muestra el inventario real para un usuario premium', () => {
    state.user = { id: 'user-1', plan: 'plus' };
    state.pets = [];
    state.botiquin = [{ id: 'b1', name: 'Vendas elásticas', category: 'Vendaje', quantity: 3, unit: 'unidades' }];
    state.botiquinTab = 'inventario';
    const html = viewBotiquin();
    expect(html).toContain('Vendas elásticas');
    expect(html).toContain('Agregar producto');
  });

  it('el modo demo ve el inventario real (nunca el upsell)', () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    state.pets = [];
    state.botiquin = [{ id: 'b1', name: 'Jeringas', category: 'Accesorio', quantity: 4, unit: 'unidades' }];
    state.botiquinTab = 'inventario';
    const html = viewBotiquin();
    expect(html).toContain('Jeringas');
  });
});
