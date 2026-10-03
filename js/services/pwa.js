/* =========================================================================
   APPLICATION INSTALLABLE, HORS LIGNE ET À JOUR
   Mise à jour automatique, y compris application ouverte :
   1. toutes les 5 minutes (et à chaque retour sur l'application, ou au
      retour du réseau), on demande au service worker de vérifier si une
      nouvelle version a été publiée ;
   2. il compare l'empreinte (ETag / Last-Modified) des fichiers publiés à
      celle de sa copie locale. GitHub Pages renouvelle cette empreinte à
      chaque publication : un simple dépôt de fichiers sur GitHub suffit,
      sans étape de compilation ;
   3. s'il y a du nouveau, il télécharge la nouvelle version complète en
      arrière-plan, puis bascule d'un coup (jamais de mélange de versions) ;
   4. la page se recharge d'elle-même dès qu'elle n'interrompt rien : pas
      pendant une séance, une saisie ou une fenêtre ouverte — ou tout de
      suite si l'application est en arrière-plan.
   Un changement de sw.js lui-même passe par le cycle standard du
   navigateur (installation, activation immédiate), avec le même
   rechargement prudent.
   ========================================================================= */
import { emit } from "../core/events.js";
import { toast } from "../ui/toast.js";

const CHECK_EVERY = 5 * 60 * 1000;
const UPDATED_FLAG = "carnet.justUpdated";

export const pwa = {
  supported: "serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname)),
  offlineReady: false,
  state: "idle", /* idle | checking | downloading | reloading | uptodate | error */
  lastCheck: null,
  info: null,     /* { build, version, published } */
  online: navigator.onLine,
  installEvent: null,
};

let reg = null;
let hadController = false;
let reloadPending = false;
let isBusy = () => false;

const set = (patch) => { Object.assign(pwa, patch); emit("pwa"); };
export const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* Requête / réponse avec le service worker actif. */
function ask(type, timeout = 20000) {
  const ctl = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (!ctl) return Promise.resolve(null);
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    const t = setTimeout(() => resolve(null), timeout);
    ch.port1.onmessage = (e) => { clearTimeout(t); resolve(e.data); };
    ctl.postMessage({ type }, [ch.port2]);
  });
}

export async function refreshInfo() {
  const info = await ask("GET_INFO", 4000);
  if (info) set({ info });
}

export async function checkForUpdate({ manual = false } = {}) {
  if (!reg || reloadPending || pwa.state === "checking") return;
  if (!navigator.onLine) { if (manual) toast("Hors ligne : la recherche reprendra au retour du réseau.", { type: "info" }); return; }
  set({ state: "checking" });
  try {
    /* Nouveau sw.js ? Le navigateur l'installe et l'active seul. */
    await reg.update();
    /* Nouvelle publication des autres fichiers ? Le service worker vérifie
       et télécharge s'il le faut. */
    const res = await ask("CHECK_DEPLOY");
    set({ lastCheck: Date.now() });
    if (res && res.status === "updated") { scheduleReload(); return; }
    if (!reloadPending) set({ state: res && res.status === "error" ? "error" : "uptodate" });
    if (manual && !reloadPending) toast(res && res.status === "error" ? "Vérification impossible pour le moment." : "Tu as déjà la dernière version.", { type: res && res.status === "error" ? "error" : "info" });
  } catch (e) {
    set({ state: "error", lastCheck: Date.now() });
  }
}

function scheduleReload() {
  if (reloadPending) return;
  reloadPending = true;
  set({ state: "reloading" });
  tryReload();
}
function tryReload() {
  if (!reloadPending) return;
  if (document.visibilityState === "hidden") { doReload(); return; }
  if (isBusy()) { setTimeout(tryReload, 3000); return; }
  toast("Nouvelle version disponible · mise à jour…", { type: "info", duration: 1500 });
  setTimeout(() => (isBusy() ? setTimeout(tryReload, 3000) : doReload()), 1400);
}
function doReload() {
  try { sessionStorage.setItem(UPDATED_FLAG, "1"); } catch (e) { /* stockage de session indisponible */ }
  location.reload();
}

export async function promptInstall() {
  const e = pwa.installEvent;
  if (!e) return false;
  e.prompt();
  const choice = await e.userChoice;
  set({ installEvent: null });
  return choice && choice.outcome === "accepted";
}

/* Garde l'écran allumé pendant une séance guidée. */
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && "wakeLock" in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { wakeLock = null; }
}

export async function initPwa({ busy }) {
  isBusy = busy || isBusy;
  try {
    if (sessionStorage.getItem(UPDATED_FLAG)) {
      sessionStorage.removeItem(UPDATED_FLAG);
      setTimeout(() => toast("Application mise à jour."), 600);
    }
  } catch (e) { /* stockage de session indisponible */ }

  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); set({ installEvent: e }); });
  window.addEventListener("appinstalled", () => { set({ installEvent: null }); toast("Application installée."); });
  const net = () => { set({ online: navigator.onLine }); if (navigator.onLine) checkForUpdate(); };
  window.addEventListener("online", net);
  window.addEventListener("offline", net);

  /* Le stockage persistant réduit le risque que le navigateur efface les
     données de l'application quand l'appareil manque de place. */
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  if (!pwa.supported) return;
  hadController = !!navigator.serviceWorker.controller;
  try {
    reg = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
  } catch (e) {
    console.warn("Service worker non enregistré :", e);
    return;
  }
  reg.addEventListener("updatefound", () => { if (hadController) set({ state: "downloading" }); });
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    /* Première prise de contrôle : rien à recharger. Ensuite, c'est une
       nouvelle version du service worker qui vient de s'activer. */
    if (hadController) scheduleReload();
    hadController = true;
    refreshInfo();
  });
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "SHELL_UPDATED") scheduleReload();
    if (e.data && e.data.type === "OFFLINE_READY") { set({ offlineReady: true }); refreshInfo(); }
  });
  navigator.serviceWorker.ready.then(() => { set({ offlineReady: true }); refreshInfo(); });

  setTimeout(() => checkForUpdate(), 4000);
  setInterval(() => { if (document.visibilityState === "visible") checkForUpdate(); }, CHECK_EVERY);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { if (reloadPending) doReload(); return; }
    if (!pwa.lastCheck || Date.now() - pwa.lastCheck > 60 * 1000) checkForUpdate();
  });
}

/* Appelé quand l'interface se libère (feuille fermée, séance terminée). */
export function nudgeReload() { if (reloadPending) tryReload(); }
