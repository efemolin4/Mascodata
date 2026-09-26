import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeMockSb } from '../test/mockSupabase.js';
import '../js/utils.js';
// isPremium()/isDemoUser() (llamadas dentro de openDeleteAccountModal y
// verifyAccountDeleteCode) leen `state` del scope léxico de js/app.js — hay
// que mutar ese mismo objeto, no reemplazar window.state (ver el mismo
// patrón ya documentado en finance.test.js/app.test.js).
import { state, getCaptchaToken, withCaptcha, isCaptchaError, MIN_PASSWORD_LENGTH } from '../js/app.js';
import { openDeleteAccountModal, sendAccountDeleteCode, verifyAccountDeleteCode, signInWithGoogle, sendForgotEmail, viewForgot, viewRegister, openForgot, goRegisterWithEmail, retryForgot, login, register, handleResetPassword, viewResetPassword, resendConfirmation, retryRegister } from './auth.js';

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
    expect(html).toContain('tutor/a de Greta');
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

  it('un usuario con un plan pago real sí ve la mención a su plan', () => {
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

  // Un error de una Edge Function trae el cuerpo de la respuesta en error.context.
  const edgeError = (error, status = 429) => ({ message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => ({ error }) } });

  it('para un usuario real, pide el código a la función propia (no a Supabase Auth) y avanza al paso 2', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    await sendAccountDeleteCode();
    expect(window.sb.functions.invoke).toHaveBeenCalledWith('verification-codes', { body: { action: 'send', purpose: 'delete_account' } });
    expect(window.sb.auth.signInWithOtp).not.toHaveBeenCalled();
    expect(document.getElementById('del-acc-step-1').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('del-acc-step-2').classList.contains('hidden')).toBe(false);
  });

  it('no pide CAPTCHA para este envío: la función ya exige sesión y limita los envíos', async () => {
    window.MASCODATA_TURNSTILE_KEY = 'k';
    window.turnstile = { render: vi.fn(), remove: vi.fn() };
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    await sendAccountDeleteCode();
    expect(window.turnstile.render).not.toHaveBeenCalled();
    window.MASCODATA_TURNSTILE_KEY = ''; delete window.turnstile;
  });

  it.each([
    ['too_soon', 'Espera un minuto antes de pedir otro código'],
    ['too_many', 'Pediste demasiados códigos. Inténtalo de nuevo en una hora'],
    ['send_failed', 'No se pudo enviar el correo. Inténtalo de nuevo'],
  ])('si la función responde %s, lo explica y no avanza al paso 2', async (code, message) => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    window.sb.functions.invoke = vi.fn(async () => ({ data: null, error: edgeError(code) }));
    await sendAccountDeleteCode();
    expect(window.showToast).toHaveBeenCalledWith(message, 'error');
    expect(document.getElementById('del-acc-step-2').classList.contains('hidden')).toBe(true);
  });

  it('un error desconocido muestra el aviso genérico y no avanza', async () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    window.sb = makeMockSb();
    window.sb.functions.invoke = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
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

  const edgeError = (error, status = 403) => ({ message: 'Edge Function returned a non-2xx status code', context: { status, json: async () => ({ error }) } });
  const setup = () => {
    state.user = { id: 'user-1', plan: 'free', email: 'felipe@mqlab.io' };
    state.isLoggedIn = true;
    window.sb = makeMockSb();
  };

  it('para un usuario real, manda el código a delete-account (el servidor lo comprueba) y cierra sesión', async () => {
    setup();
    await verifyAccountDeleteCode();
    expect(window.sb.functions.invoke).toHaveBeenCalledWith('delete-account', { body: { code: '123456' } });
    expect(window.sb.auth.verifyOtp).not.toHaveBeenCalled(); // ya no se comprueba en el navegador
    expect(window.showToast).toHaveBeenCalledWith('Cuenta eliminada', 'success');
    expect(state.isLoggedIn).toBe(false);
  });

  it('código incorrecto: el servidor lo rechaza, se marca el campo y NO se cierra sesión', async () => {
    setup();
    window.sb.functions.invoke = vi.fn(async () => ({ data: null, error: edgeError('code_invalid') }));
    await verifyAccountDeleteCode();
    expect(document.getElementById('del-acc-code-error').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('del-acc-code-error').textContent).toBe('Código incorrecto. Intenta nuevamente.');
    expect(window.closeModal).not.toHaveBeenCalled();
    expect(state.isLoggedIn).toBe(true);
  });

  it.each([
    ['code_expired', 'El código venció. Pide uno nuevo.'],
    ['code_locked', 'Demasiados intentos. Pide un código nuevo.'],
  ])('%s se explica con su propio mensaje', async (code, message) => {
    setup();
    window.sb.functions.invoke = vi.fn(async () => ({ data: null, error: edgeError(code) }));
    await verifyAccountDeleteCode();
    expect(document.getElementById('del-acc-code-error').textContent).toBe(message);
    expect(state.isLoggedIn).toBe(true);
  });

  it('si la Edge Function falla por otra razón, muestra un toast de error y NO cierra sesión (la cuenta no se borró)', async () => {
    setup();
    window.sb.functions.invoke = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
    await verifyAccountDeleteCode();
    expect(window.showToast).toHaveBeenCalledWith('No se pudo eliminar la cuenta. Intenta nuevamente o contáctanos.', 'error');
    expect(window.closeModal).not.toHaveBeenCalled();
    expect(state.isLoggedIn).toBe(true);
  });
});

describe('signInWithGoogle', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
  });

  it('pide a Supabase el OAuth de Google apuntando de vuelta al origen actual', async () => {
    window.sb = makeMockSb();
    await signInWithGoogle();
    expect(window.sb.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    expect(window.showToast).not.toHaveBeenCalled();
  });

  it('si Supabase no puede iniciar el flujo (ej. red caída), avisa con un toast', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signInWithOAuth = vi.fn(async () => ({ error: { message: 'boom' } }));
    await signInWithGoogle();
    expect(window.showToast).toHaveBeenCalledWith('No se pudo iniciar sesión con Google', 'error');
  });
});

// Recuperar contraseña: Supabase responde "enviado" aunque el correo no tenga cuenta (para no revelar quién es
// usuario), así que la pantalla no afirma nada: explica y ofrece salidas.
describe('recuperar contraseña', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.track = vi.fn();
    window.navigate = vi.fn();
    document.body.innerHTML = '<input id="f-email" value="  Ana@Correo.CL " /><input id="l-email" value="ana@login.cl" />';
    delete state.forgotSent; delete state.forgotEmail; delete state.registerPrefill;
  });

  it('pide el enlace con el correo normalizado y muestra "Revisa tu correo" sin afirmar que exista la cuenta', async () => {
    window.sb = makeMockSb();
    await sendForgotEmail();
    expect(window.sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@correo.cl', { redirectTo: `${window.location.origin}?reset=true` });
    expect(state.forgotSent).toBe(true);
    expect(state.forgotEmail).toBe('ana@correo.cl');
    const html = viewForgot();
    expect(html).toContain('Revisa tu correo');
    expect(html).toContain('Si <strong class="text-gray-700">ana@correo.cl</strong> tiene una cuenta');
    expect(html).not.toMatch(/no está registrado|no existe/i);
  });

  it('ofrece las salidas: crear cuenta con ese correo, entrar con Google y reenviar', async () => {
    window.sb = makeMockSb();
    await sendForgotEmail();
    const html = viewForgot();
    expect(html).toContain('Crear una cuenta con este correo');
    expect(html).toContain('signInWithGoogle()');
    expect(html).toContain('retryForgot()');
    expect(html).toContain('Si te registraste con Google');
  });

  it('"Crear una cuenta con este correo" abre el registro con el correo ya escrito', async () => {
    window.sb = makeMockSb();
    await sendForgotEmail();
    goRegisterWithEmail();
    expect(window.navigate).toHaveBeenCalledWith('register');
    expect(state.forgotSent).toBe(false);
    expect(viewRegister()).toContain('value="ana@correo.cl"');
  });

  it('no se queda con la pantalla de "Revisa tu correo" al volver a abrir el formulario desde el login', async () => {
    window.sb = makeMockSb();
    await sendForgotEmail();
    document.getElementById('l-email').remove(); // ya no estamos en la pantalla de login
    openForgot();
    expect(state.forgotSent).toBe(false);
    expect(window.navigate).toHaveBeenCalledWith('forgot');
    expect(viewForgot()).toContain('Enviar enlace');
    expect(viewForgot()).toContain('value="ana@correo.cl"');
  });

  it('desde el login se lleva el correo que ya estaba escrito', () => {
    openForgot();
    expect(state.forgotEmail).toBe('ana@login.cl');
  });

  it('"Usar otro correo o enviar de nuevo" vuelve al formulario', async () => {
    window.sb = makeMockSb();
    await sendForgotEmail();
    retryForgot();
    expect(state.forgotSent).toBe(false);
    expect(window.render).toHaveBeenCalled();
  });

  it('sin correo escrito no llama a Supabase', async () => {
    document.getElementById('f-email').value = '';
    window.sb = makeMockSb();
    await sendForgotEmail();
    expect(window.sb.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    expect(window.showToast).toHaveBeenCalledWith('Ingresa tu email', 'error');
  });

  it('un error de Supabase se avisa y no cambia de pantalla; el límite de envíos se explica en español', async () => {
    window.sb = makeMockSb();
    window.sb.auth.resetPasswordForEmail = vi.fn(async () => ({ error: { status: 429, message: 'For security purposes, you can only request this once every 60 seconds' } }));
    await sendForgotEmail();
    expect(window.showToast).toHaveBeenCalledWith('Espera un minuto antes de pedir otro enlace', 'error');
    expect(state.forgotSent).toBeFalsy();
    window.sb.auth.resetPasswordForEmail = vi.fn(async () => ({ error: { message: 'boom' } }));
    await sendForgotEmail();
    expect(window.showToast).toHaveBeenCalledWith('boom', 'error');
  });

  it('escapa el correo mostrado', async () => {
    document.getElementById('f-email').value = '"><img src=x onerror=1>@a.cl';
    window.sb = makeMockSb();
    await sendForgotEmail();
    expect(viewForgot()).not.toContain('<img src=x');
  });
});

// CAPTCHA (Cloudflare Turnstile) y largo mínimo de contraseña.
describe('CAPTCHA', () => {
  const setKey = k => { window.MASCODATA_TURNSTILE_KEY = k; };
  afterEach(() => { setKey(''); delete window.turnstile; document.getElementById('captcha-floating')?.remove(); });

  it('withCaptcha solo agrega el token si existe (sin CAPTCHA las llamadas quedan como antes)', () => {
    expect(withCaptcha({ a: 1 }, undefined)).toEqual({ a: 1 });
    expect(withCaptcha({ a: 1 }, 'tok')).toEqual({ a: 1, captchaToken: 'tok' });
  });

  it('isCaptchaError reconoce el rechazo de Supabase', () => {
    expect(isCaptchaError({ message: 'captcha verification process failed' })).toBe(true);
    expect(isCaptchaError({ message: 'Invalid login credentials' })).toBe(false);
    expect(isCaptchaError(null)).toBe(false);
  });

  it('sin clave configurada no pide nada: el CAPTCHA está apagado', async () => {
    setKey('');
    expect(await getCaptchaToken()).toBeUndefined();
  });

  it('con clave, muestra el widget solo si hace falta (interaction-only), devuelve el token y limpia', async () => {
    setKey('clave-publica');
    let opts;
    window.turnstile = { render: vi.fn((el, o) => { opts = o; setTimeout(() => o.callback('token-123'), 0); return 'w1'; }), remove: vi.fn() };
    const token = await getCaptchaToken();
    expect(token).toBe('token-123');
    expect(opts).toMatchObject({ sitekey: 'clave-publica', appearance: 'interaction-only' });
    expect(window.turnstile.remove).toHaveBeenCalledWith('w1');
    expect(document.getElementById('captcha-floating')).toBeNull();
  });

  it('si Cloudflare falla o vence, devuelve undefined en vez de colgar la pantalla', async () => {
    setKey('clave-publica');
    window.turnstile = { render: vi.fn((el, o) => { setTimeout(() => o['error-callback'](), 0); return 'w1'; }), remove: vi.fn() };
    expect(await getCaptchaToken()).toBeUndefined();
    window.turnstile = { render: vi.fn(() => { throw new Error('boom'); }), remove: vi.fn() };
    expect(await getCaptchaToken()).toBeUndefined();
    expect(document.getElementById('captcha-floating')).toBeNull();
  });
});

describe('login, registro y recuperación con CAPTCHA', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.track = vi.fn();
    window.navigate = vi.fn();
    window.saveState = vi.fn();
    window.MASCODATA_TURNSTILE_KEY = 'k';
    window.turnstile = { render: vi.fn((el, o) => { setTimeout(() => o.callback('tok-1'), 0); return 'w'; }), remove: vi.fn() };
    document.body.innerHTML = '<input id="l-email" value="a@b.cl" /><input id="l-pass" value="secreto12" /><input id="f-email" value="a@b.cl" />'
      + '<input id="r-name" value="Ana" /><input id="r-email" value="a@b.cl" /><input id="r-pass" value="12345678" /><input id="r-pass2" value="12345678" />';
  });
  afterEach(() => { window.MASCODATA_TURNSTILE_KEY = ''; delete window.turnstile; });

  it('el login manda el token al iniciar sesión', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signInWithPassword = vi.fn(async () => ({ data: { user: { id: 'u', user_metadata: {} } }, error: null }));
    window.loadDataFromSupabase = vi.fn();
    await login().catch(() => {});
    expect(window.sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.cl', password: 'secreto12', captchaToken: 'tok-1' });
  });

  it('sin CAPTCHA configurado el login llama a Supabase exactamente como antes', async () => {
    window.MASCODATA_TURNSTILE_KEY = '';
    window.sb = makeMockSb();
    window.sb.auth.signInWithPassword = vi.fn(async () => ({ data: null, error: { message: 'Invalid login credentials' } }));
    await login();
    expect(window.sb.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.cl', password: 'secreto12' });
    expect(window.showToast).toHaveBeenCalledWith('Email o contraseña incorrectos', 'error');
  });

  it('si Supabase rechaza por el CAPTCHA, lo explica en español', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signInWithPassword = vi.fn(async () => ({ data: null, error: { message: 'captcha verification process failed' } }));
    await login();
    expect(window.showToast).toHaveBeenCalledWith('No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo', 'error');
  });

  it('recuperar contraseña manda el token junto con la redirección', async () => {
    window.sb = makeMockSb();
    await sendForgotEmail();
    expect(window.sb.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.cl', { redirectTo: `${window.location.origin}?reset=true`, captchaToken: 'tok-1' });
  });

  it('el registro manda el token dentro de options, junto al nombre', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signUp = vi.fn(async () => ({ data: null, error: { message: 'boom' } }));
    await register();
    expect(window.sb.auth.signUp).toHaveBeenCalledWith({ email: 'a@b.cl', password: '12345678', options: { data: { name: 'Ana' }, emailRedirectTo: window.location.origin, captchaToken: 'tok-1' } });
  });
});

describe('largo mínimo de contraseña', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.sb = makeMockSb();
    window.sb.auth.signUp = vi.fn();
    window.sb.auth.updateUser = vi.fn(async () => ({ error: null }));
  });

  it('el mínimo es 8', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('el registro rechaza una contraseña de 7 caracteres sin llamar a Supabase', async () => {
    document.body.innerHTML = '<input id="r-name" value="Ana" /><input id="r-email" value="a@b.cl" /><input id="r-pass" value="1234567" /><input id="r-pass2" value="1234567" />';
    await register();
    expect(window.showToast).toHaveBeenCalledWith('Mínimo 8 caracteres', 'error');
    expect(window.sb.auth.signUp).not.toHaveBeenCalled();
  });

  it('cambiar la contraseña tras recuperarla también exige 8', async () => {
    document.body.innerHTML = '<input id="rp-pass" value="1234567" /><input id="rp-pass2" value="1234567" />';
    await handleResetPassword();
    expect(window.showToast).toHaveBeenCalledWith('Mínimo 8 caracteres', 'error');
    expect(window.sb.auth.updateUser).not.toHaveBeenCalled();
  });

  it('los campos del registro y de la nueva contraseña piden 8 en el propio formulario', () => {
    expect(viewRegister()).toContain('minlength="8"');
    expect(viewRegister()).toContain('Mínimo 8 caracteres');
    expect(viewResetPassword()).toContain('minlength="8"');
  });

  it('el login NO valida el largo: las cuentas antiguas con contraseñas cortas siguen entrando', async () => {
    document.body.innerHTML = '<input id="l-email" value="a@b.cl" /><input id="l-pass" value="123456" />';
    window.showToast = vi.fn(); window.track = vi.fn(); window.navigate = vi.fn(); window.render = vi.fn();
    window.sb.auth.signInWithPassword = vi.fn(async () => ({ data: null, error: { message: 'Invalid login credentials' } }));
    await login();
    expect(window.sb.auth.signInWithPassword).toHaveBeenCalled();
    expect(window.showToast).not.toHaveBeenCalledWith('Mínimo 8 caracteres', 'error');
  });
});

// Confirmar el correo al registrarse (Supabase → Authentication → Sign In / Providers → Confirm email).
describe('confirmar el correo al registrarse', () => {
  beforeEach(() => {
    window.showToast = vi.fn();
    window.render = vi.fn();
    window.track = vi.fn();
    window.navigate = vi.fn();
    window.saveState = vi.fn();
    window.loadDataFromSupabase = vi.fn();
    delete state.registerSent;
    state.isLoggedIn = false; state.user = null;
    document.body.innerHTML = '<input id="r-name" value="Ana" /><input id="r-email" value=" Ana@Correo.CL " /><input id="r-pass" value="12345678" /><input id="r-pass2" value="12345678" />'
      + '<input id="l-email" value="ana@correo.cl" /><input id="l-pass" value="secreto12" />';
  });

  it('sin sesión (Confirm email activado) muestra "Confirma tu correo" y no entra ni crea el perfil', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signUp = vi.fn(async () => ({ data: { user: { id: 'u1' }, session: null }, error: null }));
    await register();
    expect(state.registerSent).toEqual({ email: 'ana@correo.cl' });
    expect(state.isLoggedIn).toBe(false);
    expect(window.sb.from).not.toHaveBeenCalled(); // sin sesión no se puede escribir el perfil
    expect(window.loadDataFromSupabase).not.toHaveBeenCalled();
    expect(window.navigate).not.toHaveBeenCalledWith('dashboard', expect.anything(), expect.anything());
    const html = viewRegister();
    expect(html).toContain('Confirma tu correo');
    expect(html).toContain('ana@correo.cl');
    expect(html).toContain('resendConfirmation()');
  });

  it('con sesión inmediata (Confirm email apagado) sigue entrando directo, como antes', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signUp = vi.fn(async () => ({ data: { user: { id: 'u1' }, session: { access_token: 'x' } }, error: null }));
    await register();
    expect(state.registerSent).toBeUndefined();
    expect(state.isLoggedIn).toBe(true);
    expect(window.navigate).toHaveBeenCalledWith('dashboard', {}, { replace: true });
  });

  it('un correo que ya tenía cuenta recibe la misma pantalla: no se revela si existe', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signUp = vi.fn(async () => ({ data: { user: { id: 'u1', identities: [] }, session: null }, error: null }));
    await register();
    expect(viewRegister()).toContain('Si ya tenías una cuenta con este correo');
    expect(viewRegister()).not.toMatch(/ya está registrado|ya existe/i);
  });

  it('intentar entrar con una cuenta sin confirmar lleva a la pantalla de reenviar el correo', async () => {
    window.sb = makeMockSb();
    window.sb.auth.signInWithPassword = vi.fn(async () => ({ data: null, error: { message: 'Email not confirmed' } }));
    await login();
    expect(state.registerSent).toEqual({ email: 'ana@correo.cl' });
    expect(window.navigate).toHaveBeenCalledWith('register');
    expect(window.showToast).toHaveBeenCalledWith('Tu correo aún no está confirmado', 'error');
  });

  it('reenviar pide a Supabase un correo de confirmación con la dirección de retorno', async () => {
    window.sb = makeMockSb();
    window.sb.auth.resend = vi.fn(async () => ({ error: null }));
    state.registerSent = { email: 'ana@correo.cl' };
    await resendConfirmation();
    expect(window.sb.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'ana@correo.cl', options: { emailRedirectTo: window.location.origin } });
    expect(window.showToast).toHaveBeenCalledWith('Te enviamos el correo de nuevo', 'success');
  });

  it('el límite de reenvíos se explica en español y los demás errores se avisan', async () => {
    window.sb = makeMockSb();
    state.registerSent = { email: 'ana@correo.cl' };
    window.sb.auth.resend = vi.fn(async () => ({ error: { status: 429, message: 'For security purposes, you can only request this once every 60 seconds' } }));
    await resendConfirmation();
    expect(window.showToast).toHaveBeenCalledWith('Espera un minuto antes de pedir otro correo', 'error');
    window.sb.auth.resend = vi.fn(async () => ({ error: { message: 'boom' } }));
    await resendConfirmation();
    expect(window.showToast).toHaveBeenCalledWith('boom', 'error');
  });

  it('"Usar otro correo" vuelve al formulario de registro', () => {
    state.registerSent = { email: 'ana@correo.cl' };
    retryRegister();
    expect(state.registerSent).toBeNull();
    expect(viewRegister()).toContain('Crear cuenta gratuita');
  });

  it('sin correo pendiente no llama a Supabase al reenviar', async () => {
    window.sb = makeMockSb();
    window.sb.auth.resend = vi.fn();
    state.registerSent = null;
    await resendConfirmation();
    expect(window.sb.auth.resend).not.toHaveBeenCalled();
  });

  it('escapa el correo mostrado', () => {
    state.registerSent = { email: '"><img src=x onerror=1>@a.cl' };
    expect(viewRegister()).not.toContain('<img src=x');
  });
});

describe('aviso de invitación pendiente', () => {
  it('aparece en el login y el registro solo cuando llegó desde un enlace de invitación, sin revelar datos de ella', async () => {
    const { inviteNotice, viewLogin } = await import('./auth.js');
    state.registerSent = null; // otras pruebas dejan la pantalla "Confirma tu correo" activa
    state.inviteToken = null;
    expect(inviteNotice()).toBe('');
    expect(viewLogin()).not.toContain('invitación pendiente');
    expect(viewLogin()).toContain('Bienvenido de vuelta');
    state.inviteToken = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    expect(inviteNotice()).toContain('invitación pendiente');
    expect(viewLogin()).toContain('invitación pendiente');
    expect(viewRegister()).toContain('invitación pendiente');
    expect(viewLogin()).toContain('Te invitaron a Mascodata');
    expect(viewLogin()).not.toContain('Bienvenido de vuelta');
    expect(viewLogin()).not.toContain('a1b2c3d4');
    state.inviteToken = null;
  });
});
