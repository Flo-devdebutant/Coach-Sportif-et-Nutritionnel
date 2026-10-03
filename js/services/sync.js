/* =========================================================================
   SYNCHRONISATION — Firebase / Firestore
   Un code à 8 caractères identifie une « salle » Firestore partagée par
   les appareils reliés. Le protocole (collection, compression, étiquette
   d'application) est inchangé : un appareil resté sur l'ancienne version
   continue de se synchroniser avec celui-ci.
   ========================================================================= */
import { store, storageGet, storageSet, saveState, normalizeState } from "../core/store.js";
import { on, emit } from "../core/events.js";
import { genId } from "../core/util.js";
import { EMBEDDED_FIREBASE_CONFIG } from "../data/firebase-config.js";

const FIREBASE_SDK_VERSION = "10.13.2";
const SETTINGS_KEY = "carnet.sync.v1";
const DEVICE_ID_KEY = "carnet.deviceId";
const APP_TAG = "carnet-sportif";
const DOC_LIMIT = 1048576; /* 1 Mio, plafond imposé par Firestore */
export const SYNC_WARN_RATIO = 0.7;

export const sync = {
  config: null,      /* projet personnalisé (mode avancé) ; null = projet embarqué */
  code: null,
  status: "off",     /* off | connecting | on | error */
  lastError: null,
  lastPushAt: null,
  lastPullAt: null,
  payloadBytes: null,
};
let firebaseApp = null, db = null, activeSig = null, unsub = null;
let applyingRemote = false, pushTimer = null, deviceId = null, pendingWipe = false;
/* Fonction de confirmation fournie par l'interface (évite une dépendance
   circulaire entre service et vues). */
let confirmFn = async () => true;
export const setSyncConfirm = (fn) => { confirmFn = fn; };

const activeConfig = () => sync.config || EMBEDDED_FIREBASE_CONFIG;
function setStatus(s) { sync.status = s; emit("sync"); }
export const usageRatio = () => (sync.payloadBytes === null ? null : sync.payloadBytes / DOC_LIMIT);

/* ---------- Compression gzip (si le navigateur la propose) ---------- */
const compressionSupported = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";
function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  return btoa(bin);
}
function base64ToBytes(b64) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function gzipToBase64(str) {
  if (!compressionSupported()) return null;
  try {
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
    return bytesToBase64(new Uint8Array(await new Response(stream).arrayBuffer()));
  } catch (e) { return null; }
}
async function ungzipFromBase64(b64) {
  if (!compressionSupported()) return null;
  try {
    const stream = new Blob([base64ToBytes(b64)]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  } catch (e) { return null; }
}
async function readCloudState(data) {
  if (!data) return null;
  if (data.stateZ) {
    const json = await ungzipFromBase64(data.stateZ);
    try { return json ? JSON.parse(json) : null; } catch (e) { return null; }
  }
  return data.state || null;
}

export function describeSyncError(err) {
  const code = String((err && err.code) || "");
  const msg = String((err && err.message) || err || "");
  if (code.includes("permission-denied") || /Missing or insufficient permissions/i.test(msg))
    return "Firestore refuse l'accès. Vérifie les règles de sécurité de ton projet Firebase.";
  if (code.includes("unauthenticated")) return "Authentification refusée. Active la connexion « Anonyme » dans Firebase → Authentication.";
  if (code.includes("unavailable") || /offline|network|Échec de chargement/i.test(msg)) return "Pas de connexion au serveur. Vérifie ton accès à Internet.";
  if (code.includes("not-found") || /database.*does not exist/i.test(msg)) return "Aucune base Firestore trouvée. Crée-la dans Firebase → Firestore Database.";
  if (code.includes("failed-precondition")) return "Base indisponible : vérifie que Firestore est en mode natif.";
  if (code.includes("invalid-argument") || /longer than.*bytes|maximum size|too large/i.test(msg))
    return "Tes données dépassent la taille maximale d'un document Firebase (1 Mio). Exporte une sauvegarde, puis allège ton historique le plus ancien.";
  return msg || code || "Erreur inconnue lors de la synchronisation.";
}

function getDeviceId() {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) { deviceId = genId("dev"); localStorage.setItem(DEVICE_ID_KEY, deviceId); }
  } catch (e) { deviceId = genId("dev"); }
  return deviceId;
}

export async function loadSyncSettings() {
  try {
    const raw = await storageGet(SETTINGS_KEY);
    if (raw) { const p = JSON.parse(raw); sync.config = p.config || null; sync.code = p.code || null; }
  } catch (e) { /* réglages illisibles : synchronisation désactivée */ }
}
const saveSyncSettings = () => storageSet(SETTINGS_KEY, JSON.stringify({ config: sync.config, code: sync.code }));

export function parseFirebaseConfig(text) {
  const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "measurementId", "databaseURL"];
  const cfg = {};
  for (const k of keys) {
    const m = text.match(new RegExp(k + "\\s*:\\s*[\"']([^\"']+)[\"']"));
    if (m) cfg[k] = m[1];
  }
  return cfg.apiKey && cfg.projectId ? cfg : null;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Échec de chargement : " + src));
    document.head.appendChild(s);
  });
}
async function ensureFirebaseLoaded() {
  if (window.firebase) return;
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/`;
  await loadScript(base + "firebase-app-compat.js");
  await loadScript(base + "firebase-auth-compat.js");
  await loadScript(base + "firebase-firestore-compat.js");
}
async function ensureFirebaseReady() {
  const cfg = activeConfig();
  const sig = cfg.projectId + "|" + cfg.apiKey;
  await ensureFirebaseLoaded();
  if (firebaseApp && activeSig !== sig) {
    await firebaseApp.delete();
    firebaseApp = null; db = null; unsub = null;
  }
  if (!firebaseApp) {
    firebaseApp = window.firebase.initializeApp(cfg);
    db = window.firebase.firestore();
    activeSig = sig;
    try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* déjà active */ }
  }
  return window.firebase.auth().signInAnonymously();
}
const room = (code) => db.collection("syncRooms").doc(code);

function randomCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
async function uniqueCode(tries = 6) {
  const c = randomCode();
  const doc = await room(c).get();
  if (!doc.exists) return c;
  if (tries <= 1) throw new Error("Impossible de générer un code unique pour l'instant. Réessaie.");
  return uniqueCode(tries - 1);
}

export async function connectSync() {
  if (!sync.code) throw new Error("Aucun code de synchronisation.");
  setStatus("connecting");
  try {
    await ensureFirebaseReady();
    attachListener();
    setStatus("on");
    await seedCloudIfNeeded();
  } catch (err) {
    console.error("Sync :", err);
    sync.lastError = describeSyncError(err);
    setStatus("error");
    throw err;
  }
}

/* Crée une nouvelle salle et s'y connecte ; renvoie le code. */
export async function createRoom() {
  await ensureFirebaseReady();
  sync.code = await uniqueCode();
  await saveSyncSettings();
  await connectSync();
  return sync.code;
}

/* Rejoint une salle existante. Renvoie un message d'erreur lisible, ou
   null en cas de succès. */
export async function joinRoom(code) {
  await ensureFirebaseReady();
  const doc = await room(code).get();
  if (!doc.exists) return "Ce code n'existe pas. Vérifie la saisie, ou crée un nouveau code.";
  const data = doc.data();
  if (data && data.app && data.app !== APP_TAG) return "Ce code correspond à une autre application.";
  sync.code = code;
  await saveSyncSettings();
  await connectSync();
  return null;
}

export async function setCustomProject(cfg) {
  sync.config = cfg;
  await saveSyncSettings();
}

async function seedCloudIfNeeded() {
  if (!db || !sync.code) return;
  try {
    const doc = await room(sync.code).get();
    const data = doc.exists ? doc.data() || {} : null;
    const localUpdatedAt = store.state.__syncMeta ? store.state.__syncMeta.updatedAt : 0;
    if (!data || (!data.state && !data.stateZ)) { pushStateToCloud(true); return; }
    if (!data.updatedAt || localUpdatedAt > data.updatedAt) pushStateToCloud(true);
  } catch (err) {
    sync.lastError = describeSyncError(err);
    setStatus("error");
  }
}

function attachListener() {
  if (unsub) { unsub(); unsub = null; }
  unsub = room(sync.code).onSnapshot(async (doc) => {
    if (!doc.exists) return;
    const data = doc.data();
    if (!data || (!data.state && !data.stateZ)) return;
    if (data.updatedBy === getDeviceId()) return; /* écho de notre propre écriture */
    if (data.app && data.app !== APP_TAG) {
      sync.lastError = "Ce code correspond à une autre application. Utilise un code différent.";
      setStatus("error");
      return;
    }
    const incoming = await readCloudState(data);
    if (!incoming) return;
    if (!incoming.profile && store.state.profile) {
      if (pendingWipe) return;
      pendingWipe = true;
      const ok = await confirmFn({
        title: "Écraser tes données locales ?",
        body: "L'appareil relié n'a pas encore de profil. « Écraser » repart à zéro ici ; « Garder les miennes » envoie tes données actuelles vers l'autre appareil.",
        okLabel: "Écraser mes données", cancelLabel: "Garder les miennes", danger: true,
      });
      pendingWipe = false;
      if (ok) applyRemoteState(incoming, data.updatedAt); else pushStateToCloud(true);
      return;
    }
    applyRemoteState(incoming, data.updatedAt);
  }, (err) => {
    sync.lastError = describeSyncError(err);
    setStatus("error");
  });
}

async function applyRemoteState(incoming, updatedAt) {
  applyingRemote = true;
  const s = store.state;
  const next = normalizeState({
    ...s,
    profile: incoming.profile && typeof incoming.profile === "object" ? incoming.profile : null,
    weightLog: Array.isArray(incoming.weightLog) ? incoming.weightLog : [],
    sessionLog: Array.isArray(incoming.sessionLog) ? incoming.sessionLog : [],
    activityLog: Array.isArray(incoming.activityLog) ? incoming.activityLog : [],
    intakeLog: Array.isArray(incoming.intakeLog) ? incoming.intakeLog : [],
    /* Les plats remplacés voyagent désormais aussi ; un appareil resté sur
       l'ancienne version ne les envoie pas, on garde alors les nôtres. */
    mealOverrides: incoming.mealOverrides && typeof incoming.mealOverrides === "object" ? incoming.mealOverrides : s.mealOverrides,
    __syncMeta: { updatedAt },
  });
  store.state = next;
  await saveState({ skipSync: true });
  applyingRemote = false;
  sync.lastPullAt = Date.now();
  emit("change");
  emit("remote-applied");
}

export function pushStateToCloud(immediat) {
  if (sync.status !== "on" && sync.status !== "connecting") return;
  if (!db || !sync.code || applyingRemote) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    const now = Date.now();
    store.state.__syncMeta = { updatedAt: now };
    const s = store.state;
    const brut = { profile: s.profile, weightLog: s.weightLog, sessionLog: s.sessionLog, activityLog: s.activityLog, intakeLog: s.intakeLog, mealOverrides: s.mealOverrides };
    try {
      const comprime = await gzipToBase64(JSON.stringify(brut));
      const payload = comprime
        ? { app: APP_TAG, stateZ: comprime, v: 2, updatedAt: now, updatedBy: getDeviceId() }
        : { app: APP_TAG, state: brut, updatedAt: now, updatedBy: getDeviceId() };
      sync.payloadBytes = JSON.stringify(payload).length;
      await room(sync.code).set(payload);
      sync.lastError = null;
      sync.lastPushAt = now;
      if (sync.status !== "on") setStatus("on"); else emit("sync");
    } catch (err) {
      sync.lastError = describeSyncError(err);
      setStatus("error");
    }
  }, immediat ? 0 : 700);
}

export async function disconnectSync() {
  if (unsub) { unsub(); unsub = null; }
  sync.config = null; sync.code = null; sync.lastError = null;
  await saveSyncSettings();
  setStatus("off");
}

export function initSync() {
  on("saved", ({ skipSync }) => { if (!skipSync) pushStateToCloud(); });
  /* Retour du réseau : on retente une connexion tombée en erreur. */
  window.addEventListener("online", () => {
    if (sync.code && sync.status === "error") connectSync().catch(() => {});
  });
  if (sync.code) connectSync().catch(() => { /* état « erreur » affiché, relance possible */ });
}
