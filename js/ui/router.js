/* =========================================================================
   NAVIGATION — routes en fragment d'URL (#/today, #/training…)
   Le bouton retour du navigateur fonctionne entre les onglets, et un lien
   direct ouvre la bonne page. Seule la vue affichée est calculée.
   ========================================================================= */
import { on } from "../core/events.js";
import { closeAllSheets } from "./sheet.js";

const views = new Map();
let current = { name: null, params: [] };
let currentView = null;
let rafPending = false;

let guard = null;

export function defineView(name, view) { views.set(name, view); }
/* guard(nom) renvoie la route à afficher à la place, ou null. */
export function setGuard(fn) { guard = fn; }
export const currentRoute = () => current;

export function parseHash() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [name, ...params] = h.split("/").filter(Boolean);
  return { name: name && views.has(name) ? name : "today", params };
}

/* Navigation depuis le code : referme d'abord les feuilles ouvertes pour
   que l'historique reste cohérent. */
export async function go(hash) {
  await closeAllSheets();
  if (location.hash === hash) render(true);
  else location.hash = hash;
}

export function render(entering = false) {
  const { name, params } = parseHash();
  const redirect = guard && guard(name);
  if (redirect && redirect !== name) { location.replace("#/" + redirect); return; }
  const view = views.get(name);
  const root = document.getElementById("view");
  const changed = name !== current.name || params.join("/") !== current.params.join("/");
  current = { name, params };
  if (currentView && currentView !== view && currentView.unmount) currentView.unmount();
  currentView = view;
  document.body.classList.toggle("is-immersive", !!view.immersive);
  document.body.dataset.route = name;
  root.innerHTML = String(view.render(params));
  const title = typeof view.title === "function" ? view.title(params) : view.title;
  document.title = title ? `${title} · Carnet` : "Carnet";
  const bar = document.getElementById("appbarTitle");
  if (bar) bar.textContent = title || "";
  for (const a of document.querySelectorAll("[data-nav]")) {
    if (a.dataset.nav === (view.nav || name)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (entering && changed) {
    window.scrollTo(0, 0);
    root.classList.remove("is-entering");
    void root.offsetWidth;
    root.classList.add("is-entering");
    setTimeout(() => root.classList.remove("is-entering"), 1200);
  }
  if (view.mounted) view.mounted(root, params);
}

/* Redessine après une modification, une fois par image au plus. */
export function rerender() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => { rafPending = false; render(false); });
}

export function initRouter() {
  window.addEventListener("hashchange", () => render(true));
  on("change", rerender);
  /* Barre compacte au défilement. */
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      document.body.classList.toggle("is-scrolled", window.scrollY > 64);
    });
  }, { passive: true });
  render(true);
}
