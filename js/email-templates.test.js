import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Plantillas de los correos de autenticación de Supabase (supabase/email-templates/). Se pegan a mano en
// Authentication → Emails → Templates, así que estas pruebas cuidan lo que no se puede ver a simple vista.
const DIR = 'supabase/email-templates';
const read = name => readFileSync(`${DIR}/${name}`, 'utf8');
const files = readdirSync(DIR).filter(f => f.endsWith('.html'));

describe('plantillas de correo de Supabase', () => {
  it('están las cinco que usa la app', () => {
    expect(files.sort()).toEqual(['confirm-signup.html', 'email-change.html', 'magic-link.html', 'reauthentication.html', 'recovery.html']);
  });

  for (const f of files) {
    describe(f, () => {
      const html = read(f);

      it('es un documento completo en español con la marca', () => {
        expect(html).toContain('<!doctype html>');
        expect(html).toContain('lang="es"');
        expect(html).toContain('Mascodata');
        expect(html).toContain('#4C5FD7');
      });

      it('no inserta ningún dato que pueda escribir un usuario (evita mensajes falsos con nuestra marca)', () => {
        expect(html).not.toContain('.Data');
        expect(html).not.toContain('user_metadata');
        expect(html).not.toMatch(/\{\{\s*if/);
      });

      it('solo usa las variables de Supabase que existen', () => {
        const vars = [...html.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m => m[1]);
        const allowed = ['.ConfirmationURL', '.Token', '.NewEmail', '.Email', '.SiteURL'];
        vars.forEach(v => expect(allowed).toContain(v));
      });

      it('no carga nada externo salvo el logo de mascodata.cl, ni scripts', () => {
        expect(html).not.toMatch(/<script/i);
        const srcs = [...html.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
        srcs.forEach(s => expect(s).toMatch(/^https:\/\/mascodata\.cl\//));
        expect(html).not.toMatch(/<link[^>]+stylesheet/i);
      });

      it('las etiquetas de bloque están balanceadas', () => {
        for (const tag of ['table', 'tr', 'td', 'p', 'a', 'h1']) {
          const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
          const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
          expect(open, tag).toBe(close);
        }
      });
    });
  }

  it('los correos con enlace llevan el botón y el enlace de respaldo', () => {
    for (const f of ['confirm-signup.html', 'magic-link.html', 'recovery.html', 'email-change.html']) {
      const html = read(f);
      expect((html.match(/\{\{ \.ConfirmationURL \}\}/g) || []).length, f).toBeGreaterThanOrEqual(2);
      expect(html, f).toContain('Si el botón no funciona');
    }
  });

  it('los que llevan código lo muestran grande', () => {
    for (const f of ['magic-link.html', 'reauthentication.html']) {
      expect(read(f), f).toContain('{{ .Token }}');
    }
    expect(read('reauthentication.html')).not.toContain('.ConfirmationURL');
  });

  it('el cambio de correo dice a qué dirección se cambia', () => {
    expect(read('email-change.html')).toContain('{{ .NewEmail }}');
  });

  it('cada correo explica qué hacer si no fue la persona', () => {
    files.forEach(f => expect(read(f), f).toMatch(/Si no (fuiste tú|pediste)/));
  });
});
