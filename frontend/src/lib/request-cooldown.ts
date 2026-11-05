export const REQUEST_COOLDOWN_MS = 5000;
const storageKey = 'brewlite-request-cooldowns';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function createCooldownStore(storage?: StorageLike, now: () => number = Date.now) {
  let deadlines: Record<string, number> = {};
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [key, value] of Object.entries(saved)) if (typeof value === 'number' && Number.isFinite(value)) deadlines[key] = value;
    }
  } catch { /* Memory fallback when browser storage is unavailable. */ }
  function save() {
    const time = now();
    deadlines = Object.fromEntries(Object.entries(deadlines).filter(([, deadline]) => deadline > time).slice(-256));
    try { storage?.setItem(storageKey, JSON.stringify(deadlines)); } catch { /* Keep the in-memory limit. */ }
  }
  return {
    remaining(key: string) { return Math.max(0, Math.ceil(((deadlines[key] || 0) - now()) / 1000)); },
    start(key: string) {
      if ((deadlines[key] || 0) > now()) return false;
      deadlines[key] = now() + REQUEST_COOLDOWN_MS;
      save();
      return true;
    },
    block(key: string, seconds: number) {
      deadlines[key] = Math.max(deadlines[key] || 0, now() + Math.max(1, seconds) * 1000);
      save();
    },
  };
}

export function requestAction(method: string, endpoint: string) {
  const path = endpoint.split('?')[0].replace(/\/$/, '')
    .replace(/^\/admin\/recipes\/ingredients\/[^/]+$/, '/admin/recipes/ingredients/:id')
    .replace(/^\/admin\/recipes\/[^/]+\/[SML]$/, '/admin/recipes/:productId/:size')
    .replace(/^\/admin\/users\/[^/]+\/role$/, '/admin/users/:id/role')
    .replace(/^\/orders\/[^/]+\/cancel$/, '/orders/:id/cancel')
    .replace(/^\/orders\/(?!me$)[^/]+$/, '/orders/:id')
    .replace(/^\/payments\/zalopay\/[^/]+\/sync$/, '/payments/zalopay/:id/sync')
    .replace(/^\/admin\/payments\/(?!summary$)[^/]+$/, '/admin/payments/:id')
    .replace(/^\/products\/[^/]+$/, '/products/:id');
  return `${method.toUpperCase()}:${path}`;
}

let store: ReturnType<typeof createCooldownStore> | undefined;
function currentStore() {
  if (!store) {
    let storage: StorageLike | undefined;
    try { if (typeof window !== 'undefined') storage = window.sessionStorage; } catch { /* Use memory. */ }
    store = createCooldownStore(storage);
  }
  return store;
}
function scopedAction(method: string, endpoint: string) {
  let scope = 'anonymous';
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const user = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof user.sub === 'string') scope = user.sub;
    }
  } catch { /* Backend remains the authority for authenticated identities. */ }
  return `${scope}:${requestAction(method, endpoint)}`;
}
function notify() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('request-cooldown-changed')); }
export function cooldownRemaining(method: string, endpoint: string) { return currentStore().remaining(scopedAction(method, endpoint)); }
export function startRequestCooldown(method: string, endpoint: string) {
  const started = currentStore().start(scopedAction(method, endpoint));
  notify();
  return started;
}
export function blockRequestCooldown(method: string, endpoint: string, seconds: number) {
  currentStore().block(scopedAction(method, endpoint), seconds);
  notify();
}
