/* Bus d'évènements minimal : découple la persistance, la synchronisation,
   les sauvegardes et l'interface sans dépendances circulaires. */
const listeners = new Map();

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name).delete(fn);
}

export function emit(name, payload) {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(payload); } catch (err) { console.error(`[${name}]`, err); }
  }
}
