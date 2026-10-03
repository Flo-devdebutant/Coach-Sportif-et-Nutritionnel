/* =========================================================================
   FORMULAIRES DE PROFIL — options partagées entre l'inscription et
   l'édition du profil. Un conteneur [data-form="nom"] porte les valeurs ;
   les boutons d'option les modifient sans redessiner la page.
   ========================================================================= */
import { html, ic, actionsFor } from "./dom.js";

export const SEX_OPTIONS = [
  { value: "F", label: "Femme" },
  { value: "H", label: "Homme" },
];
export const GOAL_OPTIONS = [
  { value: "perte", label: "Perdre du poids", sub: "Déficit modéré, protéines élevées pour préserver le muscle", icon: "flame" },
  { value: "tonification", label: "Me tonifier", sub: "Calories presque stables, priorité au renforcement", icon: "zap" },
  { value: "prise", label: "Prendre du muscle", sub: "Léger surplus, focus force et volume", icon: "chart-line" },
  { value: "maintien", label: "Garder la forme", sub: "Maintenir ta condition actuelle", icon: "shield-check" },
];
export const ACTIVITY_OPTIONS = [
  { value: "sedentaire", label: "Sédentaire", sub: "Travail assis, peu de marche", icon: "bed" },
  { value: "leger", label: "Légèrement actif", sub: "Debout ou en marche de temps en temps", icon: "footprints" },
  { value: "modere", label: "Modérément actif", sub: "Souvent debout, marche fréquente", icon: "person-standing" },
  { value: "actif", label: "Très actif", sub: "Métier physique ou très mobile", icon: "zap" },
];
export const LEVEL_OPTIONS = [
  { value: "debutant", label: "Débutant", sub: "Peu ou pas d'expérience en renforcement", icon: "sparkles" },
  { value: "intermediaire", label: "Intermédiaire", sub: "Entraînement régulier depuis environ 6 mois", icon: "dumbbell" },
  { value: "avance", label: "Avancé", sub: "Plusieurs années de pratique régulière", icon: "trophy" },
];
export const EQUIP_OPTIONS = [
  { value: "halteres", label: "Haltères", icon: "dumbbell" },
  { value: "elastiques", label: "Élastiques", icon: "activity" },
  { value: "machines", label: "Machines de salle", icon: "settings" },
];
export const ZONE_OPTIONS = [
  ["jambes", "Jambes"], ["fessiers", "Fessiers"], ["dos", "Dos"], ["poitrine", "Poitrine"],
  ["epaules", "Épaules"], ["bras", "Bras"], ["abdos", "Abdos"], ["cardio", "Cardio"],
].map(([value, label]) => ({ value, label }));
export const SESSION_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }));
export const DIET_OPTIONS = [
  { value: "omnivore", label: "Omnivore", sub: "Aucune restriction", icon: "utensils" },
  { value: "vegetarien", label: "Végétarien", sub: "Sans viande ni poisson", icon: "egg" },
  { value: "vegan", label: "Vegan", sub: "Sans aucun produit animal", icon: "leaf" },
];
export const ALLERGEN_OPTIONS = [
  ["gluten", "Gluten"], ["lactose", "Lactose"], ["oeufs", "Œufs"], ["fruits_a_coque", "Fruits à coque"],
  ["arachide", "Arachide"], ["poisson", "Poisson"], ["crustaces", "Crustacés"], ["soja", "Soja"], ["porc", "Porc"],
].map(([value, label]) => ({ value, label }));

const forms = new Map();
export function createForm(name, values) { forms.set(name, values); return values; }
export const formValues = (name) => forms.get(name);

const isOn = (val, v, multi) => (multi ? (val || []).includes(v) : val === v);

/* Grandes options (une ligne chacune, icône + description). */
export function optionList(field, opts, val, { multi = false } = {}) {
  return html`<div class="options" role="${multi ? "group" : "radiogroup"}">${opts.map((o) => html`
    <button type="button" class="option" aria-pressed="${isOn(val, o.value, multi)}" data-action="form-pick" data-field="${field}" data-value="${o.value}" data-multi="${multi ? 1 : ""}">
      ${o.icon ? html`<span class="option__icon">${ic(o.icon)}</span>` : ""}
      <span class="option__body"><span class="option__title">${o.label}</span>${o.sub ? html`<span class="option__sub">${o.sub}</span>` : ""}</span>
      <span class="option__check">${ic("check")}</span>
    </button>`)}</div>`;
}

/* Pastilles compactes (zones, allergènes, nombre de séances). */
export function choiceList(field, opts, val, { multi = false, cls = "" } = {}) {
  return html`<div class="choices ${cls}" role="${multi ? "group" : "radiogroup"}">${opts.map((o) => html`
    <button type="button" class="choice" aria-pressed="${isOn(val, o.value, multi)}" data-action="form-pick" data-field="${field}" data-value="${o.value}" data-multi="${multi ? 1 : ""}">${o.icon ? ic(o.icon) : ""}${o.label}</button>`)}</div>`;
}

const listeners = new Map();
/* Rappel facultatif à chaque changement (ex. réactiver le bouton Continuer). */
export function onFormChange(name, fn) { listeners.set(name, fn); }

actionsFor({
  "form-pick": (el) => {
    const scope = el.closest("[data-form]");
    if (!scope) return;
    const values = forms.get(scope.dataset.form);
    if (!values) return;
    const field = el.dataset.field, v = el.dataset.value, multi = !!el.dataset.multi;
    if (multi) {
      const arr = (values[field] = (values[field] || []).slice());
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      el.setAttribute("aria-pressed", String(i < 0));
    } else {
      values[field] = v;
      for (const b of scope.querySelectorAll(`[data-action="form-pick"][data-field="${field}"]`)) b.setAttribute("aria-pressed", String(b.dataset.value === v));
    }
    const fn = listeners.get(scope.dataset.form);
    if (fn) fn(field, values);
  },
});
