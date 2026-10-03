/* =========================================================================
   SERVICE WORKER — Carnet
   - Hors ligne : l'application complète (pages, styles, scripts, données,
     polices, icônes) est conservée dans un cache « coquille » versionné ;
     les photos d'exercices dans un cache média.
   - À jour : sur demande de la page (toutes les 5 min, au retour sur
     l'application, au retour du réseau), on compare l'empreinte HTTP
     (ETag / Last-Modified) de fichiers témoins publiés avec celle de la
     copie locale. Si elle a changé, une nouvelle coquille complète est
     téléchargée, puis remplace l'ancienne d'un seul coup : la page n'est
     jamais servie avec un mélange d'anciens et de nouveaux fichiers.
   La liste des fichiers et l'identifiant de version (entre les marqueurs
   @build) sont régénérés par `node tools/build.mjs`. Un fichier ajouté
   plus tard sans relancer l'outil reste servi : il est mis en cache à la
   première demande.
   ========================================================================= */

/* @build:start */
const BUILD = "4613997917";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/base.css",
  "./css/components.css",
  "./css/tokens.css",
  "./css/views.css",
  "./js/app.js",
  "./js/core/backup.js",
  "./js/core/events.js",
  "./js/core/store.js",
  "./js/core/util.js",
  "./js/data/cooking.js",
  "./js/data/exercise-guides.js",
  "./js/data/exercise-photos.js",
  "./js/data/exercises.js",
  "./js/data/firebase-config.js",
  "./js/data/foods.js",
  "./js/data/meals.js",
  "./js/data/muscles.js",
  "./js/domain.js",
  "./js/engine/coach.js",
  "./js/engine/labels.js",
  "./js/engine/nutrition.js",
  "./js/engine/stats.js",
  "./js/engine/training.js",
  "./js/services/pwa.js",
  "./js/services/sync.js",
  "./js/services/theme.js",
  "./js/sheets/data.js",
  "./js/sheets/exercise.js",
  "./js/sheets/log.js",
  "./js/sheets/recipe.js",
  "./js/sheets/settings.js",
  "./js/sheets/shopping.js",
  "./js/sheets/validate.js",
  "./js/ui/charts.js",
  "./js/ui/components.js",
  "./js/ui/dom.js",
  "./js/ui/forms.js",
  "./js/ui/icons.js",
  "./js/ui/router.js",
  "./js/ui/sheet.js",
  "./js/ui/state.js",
  "./js/ui/toast.js",
  "./js/views/nutrition.js",
  "./js/views/onboarding.js",
  "./js/views/profile.js",
  "./js/views/progress.js",
  "./js/views/today.js",
  "./js/views/training.js",
  "./js/views/workout.js",
  "./assets/fonts/inter-latin.woff2",
  "./assets/fonts/outfit-latin.woff2",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/icon-maskable.svg",
  "./assets/icons/icon.svg",
  "./version.json"
];
const MEDIA = ["./assets/exercises/a1-1.webp","./assets/exercises/a1-2.webp","./assets/exercises/a2-1.webp","./assets/exercises/a2-2.webp","./assets/exercises/a3-1.webp","./assets/exercises/a3-2.webp","./assets/exercises/a4-1.webp","./assets/exercises/a4-2.webp","./assets/exercises/a5-1.webp","./assets/exercises/a5-2.webp","./assets/exercises/a6-1.webp","./assets/exercises/a6-2.webp","./assets/exercises/a7-1.webp","./assets/exercises/a7-2.webp","./assets/exercises/a8-1.webp","./assets/exercises/a8-2.webp","./assets/exercises/b1-1.webp","./assets/exercises/b1-2.webp","./assets/exercises/b2-1.webp","./assets/exercises/b2-2.webp","./assets/exercises/b3-1.webp","./assets/exercises/b3-2.webp","./assets/exercises/b4-1.webp","./assets/exercises/b4-2.webp","./assets/exercises/b5-1.webp","./assets/exercises/b5-2.webp","./assets/exercises/b6-1.webp","./assets/exercises/b6-2.webp","./assets/exercises/b7-1.webp","./assets/exercises/b7-2.webp","./assets/exercises/b8-1.webp","./assets/exercises/b8-2.webp","./assets/exercises/c4-1.webp","./assets/exercises/c4-2.webp","./assets/exercises/c5-1.webp","./assets/exercises/c5-2.webp","./assets/exercises/c6-1.webp","./assets/exercises/c6-2.webp","./assets/exercises/d1-1.webp","./assets/exercises/d1-2.webp","./assets/exercises/d2-1.webp","./assets/exercises/d2-2.webp","./assets/exercises/d3-1.webp","./assets/exercises/d3-2.webp","./assets/exercises/d4-1.webp","./assets/exercises/d4-2.webp","./assets/exercises/d5-1.webp","./assets/exercises/d5-2.webp","./assets/exercises/d6-1.webp","./assets/exercises/d6-2.webp","./assets/exercises/d7-1.webp","./assets/exercises/d7-2.webp","./assets/exercises/d8-1.webp","./assets/exercises/d8-2.webp","./assets/exercises/e1-1.webp","./assets/exercises/e1-2.webp","./assets/exercises/e10-1.webp","./assets/exercises/e10-2.webp","./assets/exercises/e13-1.webp","./assets/exercises/e13-2.webp","./assets/exercises/e2-1.webp","./assets/exercises/e2-2.webp","./assets/exercises/e3-1.webp","./assets/exercises/e3-2.webp","./assets/exercises/e4-1.webp","./assets/exercises/e4-2.webp","./assets/exercises/e5-1.webp","./assets/exercises/e5-2.webp","./assets/exercises/e6-1.webp","./assets/exercises/e6-2.webp","./assets/exercises/e9-1.webp","./assets/exercises/f1-1.webp","./assets/exercises/f1-2.webp","./assets/exercises/f12-1.webp","./assets/exercises/f12-2.webp","./assets/exercises/f2-1.webp","./assets/exercises/f2-2.webp","./assets/exercises/f3-1.webp","./assets/exercises/f3-2.webp","./assets/exercises/f4-1.webp","./assets/exercises/f4-2.webp","./assets/exercises/f5-1.webp","./assets/exercises/f5-2.webp","./assets/exercises/f6-1.webp","./assets/exercises/f6-2.webp","./assets/exercises/f9-1.webp","./assets/exercises/f9-2.webp","./assets/exercises/j1-1.webp","./assets/exercises/j1-2.webp","./assets/exercises/j10-1.webp","./assets/exercises/j10-2.webp","./assets/exercises/j13-1.webp","./assets/exercises/j14-1.webp","./assets/exercises/j14-2.webp","./assets/exercises/j2-1.webp","./assets/exercises/j2-2.webp","./assets/exercises/j20-1.webp","./assets/exercises/j20-2.webp","./assets/exercises/j3-1.webp","./assets/exercises/j3-2.webp","./assets/exercises/j4-1.webp","./assets/exercises/j4-2.webp","./assets/exercises/j5-1.webp","./assets/exercises/j5-2.webp","./assets/exercises/j6-1.webp","./assets/exercises/j6-2.webp","./assets/exercises/j7-1.webp","./assets/exercises/j7-2.webp","./assets/exercises/j8-1.webp","./assets/exercises/j8-2.webp","./assets/exercises/j9-1.webp","./assets/exercises/j9-2.webp","./assets/exercises/p1-1.webp","./assets/exercises/p1-2.webp","./assets/exercises/p2-1.webp","./assets/exercises/p2-2.webp","./assets/exercises/p3-1.webp","./assets/exercises/p3-2.webp","./assets/exercises/p4-1.webp","./assets/exercises/p4-2.webp","./assets/exercises/p5-1.webp","./assets/exercises/p5-2.webp","./assets/exercises/p6-1.webp","./assets/exercises/p6-2.webp","./assets/exercises/p7-1.webp","./assets/exercises/p7-2.webp"];
/* @build:end */

const SHELL_PREFIX = "carnet-shell-";
const MEDIA_CACHE = "carnet-media-v1";
const RUNTIME_CACHE = "carnet-runtime-v1";
const CDN_CACHE = "carnet-cdn-v1";
const META_CACHE = "carnet-meta";
/* Fichiers dont l'empreinte révèle une nouvelle publication. */
const SENTINELS = ["./version.json", "./index.html"];
/* Sans eux l'application ne démarre pas : un échec annule la mise à jour. */
const CRITICAL = new Set(["./", "./index.html", "./js/app.js"]);

let currentShell = null;
let refreshing = null;

async function getCurrentShell() {
  if (currentShell) return currentShell;
  const meta = await caches.open(META_CACHE);
  const r = await meta.match("current-shell");
  currentShell = r ? await r.text() : null;
  return currentShell;
}
async function setCurrentShell(name) {
  currentShell = name;
  const meta = await caches.open(META_CACHE);
  await meta.put("current-shell", new Response(name));
}

/* Télécharge toute la coquille dans un nouveau cache, en contournant le
   cache HTTP du navigateur. Un fichier disparu (404) non essentiel est
   simplement ignoré. */
async function fillShell(name) {
  const cache = await caches.open(name);
  await Promise.all(SHELL.map(async (url) => {
    const res = await fetch(new Request(url, { cache: "reload" }));
    if (res.ok) return cache.put(url, res);
    if (res.status === 404 && !CRITICAL.has(url)) return undefined;
    throw new Error(`${url} : ${res.status}`);
  }));
}

async function warmMedia(revalidate = false) {
  const cache = await caches.open(MEDIA_CACHE);
  for (const url of MEDIA) {
    try {
      if (!revalidate && (await cache.match(url))) continue;
      const res = await fetch(new Request(url, { cache: revalidate ? "no-cache" : "default" }));
      if (res.ok) await cache.put(url, res);
    } catch (e) { return; /* hors ligne : on reprendra plus tard */ }
  }
}

async function broadcast(msg) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of clients) c.postMessage(msg);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await fillShell(SHELL_PREFIX + BUILD);
    /* Activation immédiate : la page décide elle-même du bon moment pour
       se recharger. */
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const name = SHELL_PREFIX + BUILD;
    await setCurrentShell(name);
    for (const k of await caches.keys()) {
      if (k.startsWith(SHELL_PREFIX) && k !== name) await caches.delete(k);
    }
    await caches.delete(RUNTIME_CACHE);
    await self.clients.claim();
    await broadcast({ type: "OFFLINE_READY" });
    /* Les photos se téléchargent ensuite, sans retarder l'activation. */
    warmMedia(false);
  })());
});

/* ---------- Détection d'une nouvelle publication ---------- */
const fingerprint = (res) => {
  const etag = res.headers.get("etag");
  if (etag) return etag.replace(/^W\//, "").replace(/"/g, "").replace(/-+gzip$/, "");
  return res.headers.get("last-modified");
};

async function checkDeploy() {
  const name = await getCurrentShell();
  if (!name) return false;
  const cache = await caches.open(name);
  for (const url of SENTINELS) {
    const cached = await cache.match(url);
    if (!cached) continue;
    const before = fingerprint(cached);
    if (!before) continue;
    /* Paramètre unique : contourne aussi les caches intermédiaires. */
    const probe = new URL(url, self.location.href);
    probe.searchParams.set("__v", Date.now().toString(36));
    let res = await fetch(probe.href, { method: "HEAD", cache: "no-store" });
    if (res.status === 405 || res.status === 501) res = await fetch(probe.href, { cache: "no-store" });
    if (!res.ok) continue;
    const after = fingerprint(res);
    if (!after) continue;
    return after !== before;
  }
  return false;
}

function refreshShell() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const name = `${SHELL_PREFIX}${BUILD}-${Date.now().toString(36)}`;
    try {
      await fillShell(name);
    } catch (e) {
      await caches.delete(name);
      throw e;
    }
    const old = await getCurrentShell();
    await setCurrentShell(name);
    if (old && old !== name) await caches.delete(old);
    await caches.delete(RUNTIME_CACHE);
    await broadcast({ type: "SHELL_UPDATED" });
    warmMedia(true);
  })().finally(() => { refreshing = null; });
  return refreshing;
}

async function info() {
  const name = await getCurrentShell();
  let version = null, published = null;
  if (name) {
    const cache = await caches.open(name);
    const v = await cache.match("./version.json");
    if (v) { try { version = (await v.clone().json()).version || null; } catch (e) { /* fichier absent ou illisible */ } }
    const idx = await cache.match("./index.html");
    if (idx) published = idx.headers.get("last-modified");
  }
  return { build: BUILD, version, published, shell: name };
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  const port = event.ports && event.ports[0];
  const reply = (data) => port && port.postMessage(data);
  if (msg.type === "CHECK_DEPLOY") {
    event.waitUntil((async () => {
      try {
        if (await checkDeploy()) { await refreshShell(); reply({ status: "updated" }); }
        else reply({ status: "uptodate" });
      } catch (e) {
        reply({ status: "error", message: String(e && e.message ? e.message : e) });
      }
    })());
  } else if (msg.type === "GET_INFO") {
    event.waitUntil(info().then(reply));
  }
});

/* ---------- Réponses aux requêtes ---------- */
async function fromShell(request) {
  const name = await getCurrentShell();
  if (!name) return null;
  const cache = await caches.open(name);
  return cache.match(request, { ignoreSearch: true });
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(request);
  const net = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

const OFFLINE_PAGE = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hors ligne</title><body style="font-family:system-ui;background:#090B0F;color:#F2F4F8;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">
<div><h1 style="font-size:22px">Hors ligne</h1><p style="color:#A3ABBA">Ouvre l'application une première fois avec une connexion pour qu'elle fonctionne ensuite sans réseau.</p></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.searchParams.has("__v")) return; /* vérifications de version : réseau direct */
    if (req.mode === "navigate") {
      event.respondWith((async () => {
        const hit = await fromShell("./index.html");
        if (hit) return hit;
        try { return await fetch(req); } catch (e) { return new Response(OFFLINE_PAGE, { headers: { "Content-Type": "text/html; charset=utf-8" } }); }
      })());
      return;
    }
    if (url.pathname.includes("/assets/exercises/")) {
      event.respondWith(cacheFirst(req, MEDIA_CACHE));
      return;
    }
    event.respondWith((async () => (await fromShell(req)) || networkFirst(req))());
    return;
  }

  /* Bibliothèque Firebase (synchronisation) : disponible hors ligne après
     un premier chargement. Les échanges avec Firestore ne passent pas ici. */
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
