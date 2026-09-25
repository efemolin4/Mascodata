import { vi } from 'vitest';

// Imita el query builder "thenable" de supabase-js v2: cada método
// (select/insert/update/upsert/delete/eq/in/order/single/match) se puede
// encadenar y devuelve el mismo objeto, y solo al await-earlo (en cualquier
// punto de la cadena) se resuelve al resultado configurado — igual que la
// librería real, donde nada se envía hasta que se awaitea la cadena.
function makeChain(result) {
  const chain = {};
  ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'single', 'match', 'limit', 'or']
    .forEach(method => { chain[method] = vi.fn(() => chain); });
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  chain.catch = (reject) => Promise.resolve(result).catch(reject);
  return chain;
}

// `routes` mapea nombre de tabla -> { data, error } que debe devolver
// cualquier cadena que empiece con `sb.from(esaTabla)`. Alternativamente,
// puede ser una función (table) => resultado, para casos donde el resultado
// depende de qué tabla se pide. Las llamadas quedan registradas en
// `sb.from.mock.calls` (arg[0] es el nombre de tabla) para poder assertar
// cuántas veces y en qué orden se llamó a cada tabla.
export function makeMockSb(routes = {}) {
  const from = vi.fn((table) => {
    const result = typeof routes === 'function' ? routes(table) : (routes[table] ?? { data: null, error: null });
    return makeChain(result);
  });
  return {
    from,
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      signOut: vi.fn(async () => ({ error: null })),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
      signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
      signUp: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    },
    functions: {
      invoke: vi.fn(async () => ({ data: { ok: true }, error: null })),
    },
  };
}
