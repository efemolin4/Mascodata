import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // La Edge Function importa desde el especificador de Deno; en los tests se reemplaza por un stub.
    alias: { 'npm:@supabase/supabase-js@2': new URL('./test/supabaseStub.js', import.meta.url).pathname },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    exclude: ['**/node_modules/**', '.claude/**'],
  },
});
