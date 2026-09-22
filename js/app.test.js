import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../js/utils.js';
import { isPremium, blockIfNotPremium, state } from './app.js';

// isPremium()/blockIfNotPremium() llaman a isDemoUser() y leen `state`
// DENTRO del mismo archivo (js/app.js) — esas referencias resuelven por el
// scope léxico del módulo, no por `window`, así que reasignar
// `window.state = {...}` (como se hace en los tests de otros archivos) NO
// las afecta acá: hay que mutar el `state` real importado.
describe('isPremium', () => {
  it('el modo demo siempre se ve como Premium (vitrina del producto completo)', () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' }; // sin id -> isDemoUser() = true
    expect(isPremium()).toBe(true);
  });

  it('un usuario real con plan free NO es premium', () => {
    state.user = { id: 'user-1', plan: 'free' };
    expect(isPremium()).toBe(false);
  });

  it('un usuario real con plan premium SÍ es premium', () => {
    state.user = { id: 'user-1', plan: 'premium' };
    expect(isPremium()).toBe(true);
  });
});

describe('blockIfNotPremium', () => {
  // showToast() está definida en el mismo archivo que blockIfNotPremium(),
  // así que la llamada interna resuelve por scope léxico del módulo, no
  // por `window` — no se puede reemplazar con un mock acá (a diferencia de
  // cuando OTRO archivo llama a showToast como global). Se verifica el
  // toast real que showToast() deja en el DOM en su lugar.
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('bloquea y muestra el toast de upsell cuando no es premium', () => {
    state.user = { id: 'user-1', plan: 'free' };
    const blocked = blockIfNotPremium('Exportar el expediente');
    expect(blocked).toBe(true);
    expect(document.querySelector('.toast')?.textContent).toBe(
      'Exportar el expediente es una función Premium — mejora tu plan para usarla.'
    );
  });

  it('no bloquea (ni muestra toast) cuando es premium', () => {
    state.user = { id: 'user-1', plan: 'premium' };
    const blocked = blockIfNotPremium('Exportar el expediente');
    expect(blocked).toBe(false);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('no bloquea en modo demo', () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    expect(blockIfNotPremium('Cualquier función')).toBe(false);
  });
});
