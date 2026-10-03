/* =========================================================================
   ÉTAT ET STOCKAGE PERSISTANT
   La clé et la forme de l'état sont inchangées depuis la version
   précédente : les données déjà enregistrées sur l'appareil sont reprises
   telles quelles après la mise à jour.

   Trois niveaux de stockage, du plus durable au plus fragile :
   1. window.storage  -> disponible uniquement dans l'aperçu de l'application ;
   2. localStorage    -> le cas normal dans un navigateur ;
   3. mémoire vive    -> dernier recours, PERDU au rafraîchissement de la page.
   On teste réellement localStorage : en navigation privée stricte ou avec
   un stockage bloqué, l'écriture peut être refusée.
   ========================================================================= */
import { emit } from "./events.js";

export const STORAGE_KEY = "carnet-entrainement.state.v1";

const storageOk = !!(window.storage && typeof window.storage.get === "function");
const localOk = (() => {
  try {
    const k = "__carnet_probe__";
    localStorage.setItem(k, "1");
    const v = localStorage.getItem(k);
    localStorage.removeItem(k);
    return v === "1";
  } catch (e) { return false; }
})();
export const persistenceMode = storageOk ? "app" : localOk ? "local" : "none";
const memoryFallback = {};

export async function storageGet(key) {
  if (storageOk) {
    try { const r = await window.storage.get(key, false); if (r) return r.value; } catch (e) { /* repli */ }
  }
  if (localOk) {
    try { const v = localStorage.getItem(key); if (v !== null) return v; } catch (e) { /* repli */ }
  }
  return Object.prototype.hasOwnProperty.call(memoryFallback, key) ? memoryFallback[key] : null;
}

export async function storageSet(key, value) {
  let saved = false;
  if (storageOk) {
    try { await window.storage.set(key, value, false); saved = true; } catch (e) { /* repli */ }
  }
  if (localOk) {
    try { localStorage.setItem(key, value); saved = true; } catch (e) { /* repli */ }
  }
  memoryFallback[key] = value;
  return saved;
}

/* Préférences propres à l'appareil (thème, séance en cours…) : jamais
   synchronisées, jamais incluses dans les sauvegardes. */
export const local = {
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* stockage indisponible */ }
  },
};

export function defaultState() {
  return {
    profile: null, weightLog: [], sessionLog: [], activityLog: [], intakeLog: [],
    mealOverrides: {}, shopping: {}, __syncMeta: null,
  };
}

export const store = { state: defaultState() };

/* Complète un état ancien ou importé avec les champs apparus depuis. */
export function normalizeState(raw) {
  const s = Object.assign(defaultState(), raw || {});
  for (const k of ["weightLog", "sessionLog", "activityLog", "intakeLog"]) if (!Array.isArray(s[k])) s[k] = [];
  if (!s.mealOverrides || typeof s.mealOverrides !== "object") s.mealOverrides = {};
  if (!s.shopping || typeof s.shopping !== "object") s.shopping = {};
  const p = s.profile;
  if (p) {
    if (!p.sessionsPerWeek) p.sessionsPerWeek = { debutant: 3, intermediaire: 4, avance: 5 }[p.level] || 3;
    if (!Array.isArray(p.focusZones)) p.focusZones = [];
    if (!Array.isArray(p.equipment)) p.equipment = [];
    if (!Array.isArray(p.allergens)) p.allergens = [];
    if (!Array.isArray(p.proteinPrefs)) p.proteinPrefs = [];
    if (typeof p.lowBudget !== "boolean") p.lowBudget = false;
    if (typeof p.useSnacks !== "boolean") p.useSnacks = true;
    if (!p.diet) p.diet = "omnivore";
    if (typeof p.name !== "string") p.name = "";
  }
  return s;
}

export async function loadState() {
  const raw = await storageGet(STORAGE_KEY);
  try { store.state = normalizeState(raw ? JSON.parse(raw) : null); }
  catch (e) { store.state = defaultState(); }
  return store.state;
}

/* skipSync évite de republier immédiatement un état qui vient tout juste
   d'être reçu depuis le cloud. */
export async function saveState({ skipSync = false } = {}) {
  const ok = await storageSet(STORAGE_KEY, JSON.stringify(store.state));
  emit("saved", { ok, skipSync });
  return ok;
}

/* Point d'entrée unique des modifications : applique, enregistre, puis
   prévient l'interface qui se redessine. */
export async function commit(mutator, opts) {
  mutator(store.state);
  const ok = await saveState(opts);
  emit("change");
  return ok;
}

export async function replaceState(incoming, opts) {
  store.state = normalizeState(incoming);
  const ok = await saveState(opts);
  emit("change");
  return ok;
}
