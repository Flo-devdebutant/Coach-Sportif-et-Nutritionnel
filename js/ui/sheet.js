/* =========================================================================
   FEUILLES ET DIALOGUES
   Chaque feuille ouverte ajoute une entrée à l'historique : le bouton (ou
   le geste) retour du téléphone la referme au lieu de quitter la page.
   Fermeture aussi par la croix, le fond, la touche Échap, ou en tirant la
   poignée vers le bas.
   ========================================================================= */
import { html, ic } from "./dom.js";

const stack = [];
let backPending = 0;
let waiters = [];

function settle() {
  if (backPending === 0) { waiters.forEach((r) => r()); waiters = []; }
}
export const whenHistorySettled = () => (backPending ? new Promise((r) => waiters.push(r)) : Promise.resolve());

window.addEventListener("popstate", () => {
  if (backPending > 0) { backPending--; settle(); return; }
  /* Retour demandé par la personne : on referme la feuille du dessus. */
  if (stack.length) hide(stack[stack.length - 1]);
});

function syncBody() {
  document.body.classList.toggle("is-sheet-open", stack.length > 0);
}

/* Ouvre une feuille. options :
   id, title, sub, body (html), foot (html), size ("auto" | "full"),
   dialog (petite fenêtre centrée), onClose(result), onMount(ctrl). */
export function openSheet(opts) {
  const { id = "sheet", dialog = false, size = "auto" } = opts;
  const layer = document.createElement("div");
  layer.className = "sheet-layer" + (dialog ? " is-dialog" : "");
  layer.dataset.sheet = id;
  layer.innerHTML = String(html`
    <div class="sheet-scrim" data-sheet-dismiss></div>
    <section class="sheet${size === "full" ? " is-full" : ""}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" tabindex="-1">
      ${dialog ? "" : html`<div class="sheet__grab" aria-hidden="true"></div>`}
      <header class="sheet__head">
        <div class="sheet__titles">
          <h2 class="sheet__title" id="${id}-title"></h2>
          <p class="sheet__sub" hidden></p>
        </div>
        ${dialog ? "" : html`<button type="button" class="icon-btn is-sm" data-sheet-dismiss aria-label="Fermer">${ic("x")}</button>`}
      </header>
      <div class="sheet__body" data-submit-scope></div>
      <footer class="sheet__foot" hidden></footer>
    </section>`);
  const sheet = layer.querySelector(".sheet");
  const ctrl = {
    id, el: layer, sheet,
    body: layer.querySelector(".sheet__body"),
    foot: layer.querySelector(".sheet__foot"),
    opener: document.activeElement,
    onClose: opts.onClose,
    closed: false,
    setTitle(t, sub) {
      layer.querySelector(".sheet__title").textContent = t || "";
      const s = layer.querySelector(".sheet__sub");
      s.textContent = sub || "";
      s.hidden = !sub;
    },
    setBody(h) { this.body.innerHTML = String(h); },
    setFoot(h, stacked = false) {
      this.foot.innerHTML = h ? String(h) : "";
      this.foot.hidden = !h;
      this.foot.classList.toggle("is-stacked", stacked);
      /* Le bouton principal du pied valide aussi à la touche Entrée. */
      this.body.dataset.submitScope = "";
    },
    close(result) { closeSheet(ctrl, result); },
  };
  ctrl.setTitle(opts.title, opts.sub);
  if (opts.body) ctrl.setBody(opts.body);
  ctrl.setFoot(opts.foot, opts.stackedFoot);
  /* Le pied fait partie de la zone « Entrée = valider ». */
  layer.querySelector(".sheet").setAttribute("data-submit-scope", "");
  layer.addEventListener("click", (e) => {
    if (e.target.closest("[data-sheet-dismiss]")) closeSheet(ctrl, undefined);
  });
  document.body.appendChild(layer);
  stack.push(ctrl);
  syncBody();
  whenHistorySettled().then(() => {
    if (!ctrl.closed) history.pushState({ sheet: id }, "");
    else { /* refermée avant même d'être inscrite : rien à défaire */ }
    ctrl.pushed = !ctrl.closed;
  });
  requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add("is-open")));
  if (opts.onMount) opts.onMount(ctrl);
  setTimeout(() => {
    if (ctrl.closed) return;
    const auto = sheet.querySelector("[autofocus]");
    (auto || sheet).focus({ preventScroll: true });
  }, 60);
  return ctrl;
}

function hide(ctrl, result) {
  if (ctrl.closed) return;
  ctrl.closed = true;
  const i = stack.indexOf(ctrl);
  if (i >= 0) stack.splice(i, 1);
  ctrl.el.classList.remove("is-open");
  syncBody();
  setTimeout(() => ctrl.el.remove(), 420);
  if (ctrl.opener && ctrl.opener.focus && document.contains(ctrl.opener)) {
    try { ctrl.opener.focus({ preventScroll: true }); } catch (e) { /* élément disparu */ }
  }
  if (ctrl.onClose) ctrl.onClose(result);
}

export function closeSheet(ctrl, result) {
  if (!ctrl || ctrl.closed) return;
  const pushed = ctrl.pushed;
  hide(ctrl, result);
  if (pushed) { backPending++; history.back(); }
}

export function closeAllSheets() {
  [...stack].reverse().forEach((c) => closeSheet(c));
  return whenHistorySettled();
}
export const topSheet = () => stack[stack.length - 1] || null;
export const sheetOpen = (id) => stack.find((c) => c.id === id) || null;
export const anySheetOpen = () => stack.length > 0;

/* Confirmation : renvoie une promesse résolue à true/false. */
export function confirmDialog({ title, body, okLabel = "Confirmer", cancelLabel = "Annuler", danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const ctrl = openSheet({
      id: "confirm", dialog: true, title,
      body: html`<p class="muted" style="font-size:14.5px;line-height:1.55">${body}</p>`,
      foot: html`
        <button type="button" class="btn btn-secondary" data-confirm="0">${cancelLabel}</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" data-confirm="1" data-submit>${okLabel}</button>`,
      onClose: () => resolve(result),
    });
    ctrl.el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-confirm]");
      if (!b) return;
      result = b.dataset.confirm === "1";
      closeSheet(ctrl, result);
    });
  });
}

/* ---------- Clavier : Échap ferme, Tab reste dans la feuille ---------- */
document.addEventListener("keydown", (e) => {
  const top = topSheet();
  if (!top) return;
  if (e.key === "Escape") { e.preventDefault(); closeSheet(top); return; }
  if (e.key !== "Tab") return;
  const f = [...top.sheet.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

/* ---------- Fermeture par glissement de la poignée ----------
   La feuille suit le doigt, puis se ferme si la course dépasse un seuil ou
   si le geste est rapide ; sinon elle revient en place. La vitesse est
   mesurée sur au moins 60 ms pour éviter les valeurs aberrantes. */
(() => {
  let ctrl = null, startY = 0, dy = 0, refY = 0, refT = 0, vel = 0;
  const pointY = (e) => (e.touches && e.touches[0] ? e.touches[0].clientY : e.clientY);
  function down(e) {
    const grab = e.target.closest && e.target.closest(".sheet__grab, .sheet__head");
    if (!grab || e.target.closest("button, input, a")) return;
    const layer = grab.closest(".sheet-layer");
    if (!layer || layer.classList.contains("is-dialog") || window.matchMedia("(min-width: 720px)").matches) return;
    ctrl = stack.find((c) => c.el === layer) || null;
    if (!ctrl) return;
    startY = refY = pointY(e); refT = Date.now(); dy = 0; vel = 0;
    ctrl.sheet.classList.add("is-dragging");
  }
  function move(e) {
    if (!ctrl) return;
    const y = pointY(e), now = Date.now();
    dy = Math.max(0, y - startY);
    if (now - refT >= 60) { vel = (y - refY) / (now - refT); refY = y; refT = now; }
    ctrl.sheet.style.transform = `translateY(${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }
  function up() {
    if (!ctrl) return;
    const c = ctrl;
    ctrl = null;
    c.sheet.classList.remove("is-dragging");
    if (dy > 110 || (vel > 0.55 && dy > 40)) {
      c.sheet.style.transform = "";
      closeSheet(c);
    } else {
      c.sheet.style.transform = "";
    }
  }
  document.addEventListener("touchstart", down, { passive: true });
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", up);
  document.addEventListener("touchcancel", up);
})();
