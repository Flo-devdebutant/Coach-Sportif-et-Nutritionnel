/* =========================================================================
   OUTILS D'INTERFACE
   - html`` : gabarits dont chaque valeur interpolée est échappée par
     défaut (les données saisies ou synchronisées ne peuvent pas injecter
     de HTML) ; raw() marque un fragment déjà sûr.
   - Délégation : un seul écouteur par type d'évènement ; les éléments
     déclarent leur action via data-action / data-input / data-change.
   ========================================================================= */
import { esc } from "../core/util.js";
import { icon } from "./icons.js";

class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(String(s));
function part(v) {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(part).join("");
  return esc(v);
}
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new Raw(out);
}
export const ic = (name, cls, label) => raw(icon(name, cls, label));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function setHTML(el, h) { el.innerHTML = String(h); }

const actions = new Map();
const inputs = new Map();
/* Enregistre des gestionnaires : { nom: (élément, évènement) => … }. */
export function actionsFor(map) { for (const [k, fn] of Object.entries(map)) actions.set(k, fn); }
export function inputsFor(map) { for (const [k, fn] of Object.entries(map)) inputs.set(k, fn); }

export function initDelegation() {
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    const fn = actions.get(el.dataset.action);
    if (!fn) return;
    if (el.tagName === "A" || el.type === "submit") e.preventDefault();
    fn(el, e);
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-input]");
    if (el && inputs.has(el.dataset.input)) inputs.get(el.dataset.input)(el, e);
  });
  document.addEventListener("change", (e) => {
    const el = e.target.closest("[data-change]");
    if (el && actions.has(el.dataset.change)) actions.get(el.dataset.change)(el, e);
  });
  /* Entrée valide un formulaire de feuille sans avoir à viser le bouton. */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const input = e.target.closest("input:not([type=checkbox]):not([type=radio])");
    if (!input) return;
    const scope = input.closest("[data-submit-scope]");
    const submit = scope && scope.querySelector("[data-submit]");
    if (submit && !submit.disabled) { e.preventDefault(); submit.click(); }
  });
}

/* Petit état d'attente sur un bouton pendant une opération réseau. */
export async function busy(btn, fn) {
  btn.classList.add("is-busy");
  btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove("is-busy"); btn.disabled = false; }
}

/* Lecture d'un nombre saisi (virgule française acceptée). */
export function readNum(el) {
  if (!el) return NaN;
  const v = String(el.value).trim().replace(",", ".");
  return v === "" ? NaN : Number(v);
}
