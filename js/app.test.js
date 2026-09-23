import { describe, it, expect, vi, beforeEach } from 'vitest';
import '../js/utils.js';
import { isPremium, blockIfNotPremium, viewToPath, pathToView, state } from './app.js';

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

  it('un usuario real con un plan pago (plus o pro) SÍ es premium', () => {
    state.user = { id: 'user-1', plan: 'plus' };
    expect(isPremium()).toBe(true);
    state.user = { id: 'user-1', plan: 'pro' };
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
    state.user = { id: 'user-1', plan: 'plus' };
    const blocked = blockIfNotPremium('Exportar el expediente');
    expect(blocked).toBe(false);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('no bloquea en modo demo', () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    expect(blockIfNotPremium('Cualquier función')).toBe(false);
  });
});

// La URL de la ficha de mascota antes era /pets/<uuid> a secas — nada legible
// al compartirla o mirarla en la barra de direcciones. viewToPath le agrega
// el nombre de la mascota adelante (/pets/greta-<uuid>); pathToView solo lee
// el uuid del final, así que un link viejo sin nombre sigue funcionando.
describe('viewToPath/pathToView — URL de la ficha de mascota', () => {
  beforeEach(() => {
    state.pets = [{ id: '98b1cfe4-51e4-4150-9d80-3b6f70e57740', name: 'Greta' }];
  });

  it('arma la URL con el nombre de la mascota adelante del uuid', () => {
    expect(viewToPath('petProfile', { currentPetId: '98b1cfe4-51e4-4150-9d80-3b6f70e57740' }))
      .toBe('/pets/greta-98b1cfe4-51e4-4150-9d80-3b6f70e57740');
  });

  it('pathToView recupera el mismo id desde esa URL con nombre', () => {
    const route = pathToView('/pets/greta-98b1cfe4-51e4-4150-9d80-3b6f70e57740');
    expect(route).toEqual({ view: 'petProfile', params: { currentPetId: '98b1cfe4-51e4-4150-9d80-3b6f70e57740', currentTab: 'general' } });
  });

  it('un link viejo sin el nombre (solo el uuid) sigue funcionando', () => {
    const route = pathToView('/pets/98b1cfe4-51e4-4150-9d80-3b6f70e57740');
    expect(route.params.currentPetId).toBe('98b1cfe4-51e4-4150-9d80-3b6f70e57740');
  });

  it('un id que no tiene forma de uuid (modo demo) no lleva nombre adelante', () => {
    state.pets = [{ id: 'pet-greta', name: 'Greta' }];
    expect(viewToPath('petProfile', { currentPetId: 'pet-greta' })).toBe('/pets/pet-greta');
    expect(pathToView('/pets/pet-greta').params.currentPetId).toBe('pet-greta');
  });

  it('/pets/nueva sigue resolviendo a addPet, no a una ficha', () => {
    expect(pathToView('/pets/nueva')).toEqual({ view: 'addPet' });
  });

  it('si no hay mascotas cargadas (o el id no calza con ninguna), no rompe: solo omite el nombre', () => {
    state.pets = [];
    expect(viewToPath('petProfile', { currentPetId: '98b1cfe4-51e4-4150-9d80-3b6f70e57740' }))
      .toBe('/pets/98b1cfe4-51e4-4150-9d80-3b6f70e57740');
  });
});
