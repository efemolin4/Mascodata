import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
// isPremium()/isDemoUser() (llamadas dentro de openDeleteAccountModal y
// verifyAccountDeleteCode) leen `state` del scope léxico de js/app.js — hay
// que mutar ese mismo objeto, no reemplazar window.state (ver el mismo
// patrón ya documentado en finance.test.js/app.test.js).
import { state } from '../js/app.js';
import { openDeleteAccountModal, sendAccountDeleteCode, verifyAccountDeleteCode } from './auth.js';

describe('openDeleteAccountModal', () => {
  beforeEach(() => {
    window.openModal = vi.fn();
    state.pets = [];
    state.expenses = [];
  });

  it('muestra cuántas mascotas y gastos se van a borrar', () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.pets = [
      { id: 'p1', name: 'Greta', myRole: 'owner' },
      { id: 'p2', name: 'Luna', myRole: 'owner' },
    ];
    state.expenses = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
    openDeleteAccountModal();
    const html = window.openModal.mock.calls[0][0];
    expect(html).toContain('2 mascotas');
    expect(html).toContain('3 gastos registrados');
    expect(html).toContain('felipe@mqlab.io');
  });

  it('si una mascota propia tiene un segundo tutor activo, avisa que le pasará la propiedad', () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.pets = [{ id: 'p1', name: 'Greta', myRole: 'owner', tutor2: { name: 'María González', pending: false } }];
    openDeleteAccountModal();
    const html = window.openModal.mock.calls[0][0];
    expect(html).toContain('María González');
    expect(html).toContain('dueño/a de Greta');
  });

  it('una invitación de segundo tutor todavía pendiente no cuenta como que ya tiene tutor2', () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.pets = [{ id: 'p1', name: 'Greta', myRole: 'owner', tutor2: { name: 'María González', pending: true } }];
    openDeleteAccountModal();
    const html = window.openModal.mock.calls[0][0];
    expect(html).not.toContain('María González');
  });

  it('una mascota donde el usuario es tutor invitado (no dueño) no se cuenta entre "sus" mascotas', () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.pets = [{ id: 'p1', name: 'Greta', myRole: 'viewer' }];
    openDeleteAccountModal();
    const html = window.openModal.mock.calls[0][0];
    expect(html).toContain('0 mascotas');
  });

  it('en modo demo no menciona "tu plan Premium" (isPremium() da true pero no es una suscripción real)', () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    openDeleteAccountModal();
    const html = window.openModal.mock.calls[0][0];
    expect(html).not.toContain('tu plan Premium');
  });

  it('un usuario Premium real sí ve la mención a su plan', () => {
    state.user = { id: 'user-1', plan: 'premium', email: 'felipe@mqlab.io' };
    openDeleteAccountModal();
    const html = window.openModal.mock.calls[0][0];
    expect(html).toContain('tu plan Premium');
  });
});

describe('sendAccountDeleteCode', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    document.body.innerHTML = `
      <div id="del-acc-step-1"></div>
      <div id="del-acc-step-2" class="hidden"></div>
    `;
  });

  it('en modo demo genera un código local y no llama a Supabase', async () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    window.sb = makeMockSb();
    await sendAccountDeleteCode();
    expect(state.deleteAccountCode).toMatch(/^\d{6}$/);
    expect(window.sb.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(document.getElementById('del-acc-step-2').classList.contains('hidden')).toBe(false);
  });

  it('para un usuario real, pide el código por email vía signInWithOtp', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    await sendAccountDeleteCode();
    expect(window.sb.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'felipe@mqlab.io', options: { shouldCreateUser: false } });
    expect(document.getElementById('del-acc-step-1').classList.contains('hidden')).toBe(true);
  });

  it('si Supabase falla al enviar el código, muestra un toast y no avanza al paso 2', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    window.sb.auth.signInWithOtp = vi.fn(async () => ({ error: { message: 'boom' } }));
    await sendAccountDeleteCode();
    expect(window.showToast).toHaveBeenCalledWith('No se pudo enviar el código', 'error');
    expect(document.getElementById('del-acc-step-2').classList.contains('hidden')).toBe(true);
  });
});

describe('verifyAccountDeleteCode', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.closeModal = vi.fn();
    window.render = vi.fn();
    window.track = vi.fn();
    document.body.innerHTML = `
      <input id="del-acc-code-input" value="123456" />
      <p id="del-acc-code-error" class="hidden"></p>
    `;
  });

  it('en modo demo, con el código correcto, cierra el modal y cierra sesión (sin llamar a Supabase)', async () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    state.isLoggedIn = true;
    state.deleteAccountCode = '123456';
    window.sb = makeMockSb();
    await verifyAccountDeleteCode();
    expect(window.closeModal).toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalledWith('Cuenta eliminada', 'success');
    expect(window.sb.functions.invoke).not.toHaveBeenCalled();
    // logout() es del mismo archivo (js/auth.js) — corre de verdad, no por window.
    expect(state.isLoggedIn).toBe(false);
    expect(state.user).toBeNull();
  });

  it('en modo demo, con el código incorrecto, marca el error y no cierra sesión', async () => {
    state.user = { name: 'Demo', email: 'demo@mascodata.cl' };
    state.isLoggedIn = true;
    state.deleteAccountCode = '999999';
    await verifyAccountDeleteCode();
    expect(document.getElementById('del-acc-code-error').classList.contains('hidden')).toBe(false);
    expect(state.isLoggedIn).toBe(true);
  });

  it('para un usuario real, verifica el código por OTP y luego invoca la Edge Function', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.isLoggedIn = true;
    window.sb = makeMockSb();
    await verifyAccountDeleteCode();
    expect(window.sb.auth.verifyOtp).toHaveBeenCalledWith({ email: 'felipe@mqlab.io', token: '123456', type: 'email' });
    expect(window.sb.functions.invoke).toHaveBeenCalledWith('delete-account');
    expect(window.showToast).toHaveBeenCalledWith('Cuenta eliminada', 'success');
    expect(state.isLoggedIn).toBe(false);
  });

  it('si el tipo "email" del OTP falla, reintenta como "magiclink" antes de rendirse', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    window.sb.auth.verifyOtp = vi.fn()
      .mockResolvedValueOnce({ error: { message: 'wrong type' } })
      .mockResolvedValueOnce({ error: null });
    await verifyAccountDeleteCode();
    expect(window.sb.auth.verifyOtp).toHaveBeenCalledTimes(2);
    expect(window.sb.auth.verifyOtp).toHaveBeenNthCalledWith(2, { email: 'felipe@mqlab.io', token: '123456', type: 'magiclink' });
    expect(window.sb.functions.invoke).toHaveBeenCalled();
  });

  it('código incorrecto (ambos tipos de OTP fallan): no invoca la función ni cierra sesión', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.isLoggedIn = true;
    window.sb = makeMockSb();
    window.sb.auth.verifyOtp = vi.fn(async () => ({ error: { message: 'invalid' } }));
    await verifyAccountDeleteCode();
    expect(window.sb.functions.invoke).not.toHaveBeenCalled();
    expect(document.getElementById('del-acc-code-error').classList.contains('hidden')).toBe(false);
    expect(state.isLoggedIn).toBe(true);
  });

  it('si la Edge Function falla, muestra un toast de error y NO cierra sesión (la cuenta no se borró)', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.isLoggedIn = true;
    window.sb = makeMockSb();
    window.sb.functions.invoke = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
    await verifyAccountDeleteCode();
    expect(window.showToast).toHaveBeenCalledWith('No se pudo eliminar la cuenta. Intenta nuevamente o contáctanos.', 'error');
    expect(window.closeModal).not.toHaveBeenCalled();
    expect(state.isLoggedIn).toBe(true);
  });
});
