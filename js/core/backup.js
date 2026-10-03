/* =========================================================================
   SAUVEGARDE AUTOMATIQUE — coffre local (IndexedDB)
   Après chaque modification, un instantané complet est écrit dans le
   stockage interne du navigateur, quelques secondes plus tard pour ne pas
   empiler une copie à chaque frappe. Les 20 plus récents sont conservés.
   Comme le localStorage, ce coffre est lié à l'origine du site : l'export
   manuel et la synchronisation restent les chemins fiables entre appareils.
   ========================================================================= */
import { store } from "./store.js";
import { on, emit } from "./events.js";

const DB_NAME = "carnetEntrainementBackups";
const STORE = "backups";
const MAX_BACKUPS = 20;
let dbPromise = null;
export const backupState = { lastSignature: null, lastAt: null, lastError: null };

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB indisponible")); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
async function getAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/* Signature légère : évite d'empiler des instantanés identiques. */
function signature(payload) {
  const s = JSON.stringify(payload.state);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return s.length + ":" + h;
}

export const exportPayload = () => ({ app: "carnet-entrainement", version: 1, exportedAt: new Date().toISOString(), state: store.state });

export async function createBackupNow(reason = "auto") {
  if (!store.state || !store.state.profile) return false;
  let payload, sig;
  try { payload = exportPayload(); sig = signature(payload); } catch (e) { return false; }
  if (sig === backupState.lastSignature) return false;
  const now = new Date();
  const entry = {
    id: "b_" + now.getTime() + "_" + Math.random().toString(36).slice(2, 7),
    createdAt: now.toISOString(), reason, signature: sig,
    size: JSON.stringify(payload).length, payload,
  };
  try {
    await run("readwrite", (s) => { s.put(entry); });
    Object.assign(backupState, { lastSignature: sig, lastAt: entry.createdAt, lastError: null });
    await prune();
    emit("backups-changed");
    return true;
  } catch (err) {
    backupState.lastError = String(err && err.message ? err.message : err);
    return false;
  }
}

async function prune() {
  try {
    const all = await getAll();
    if (all.length <= MAX_BACKUPS) return;
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const old = all.slice(MAX_BACKUPS);
    await run("readwrite", (s) => old.forEach((b) => s.delete(b.id)));
  } catch (e) { /* le coffre reste utilisable */ }
}

export async function listBackups() {
  try {
    const all = await getAll();
    return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch (e) { return []; }
}

export async function deleteBackup(id) {
  try { await run("readwrite", (s) => { s.delete(id); }); } catch (e) { /* déjà absent */ }
  emit("backups-changed");
}

export async function findBackup(id) {
  return (await listBackups()).find((b) => b.id === id) || null;
}

let timer = null;
export function initAutoBackup() {
  on("saved", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; createBackupNow("auto"); }, 4000);
  });
}
