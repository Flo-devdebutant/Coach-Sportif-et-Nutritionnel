/* =========================================================================
   ÉDITION DU PROFIL — trois sections ciblées plutôt qu'un formulaire
   unique de douze champs. Chaque enregistrement fusionne les changements
   dans le profil existant.
   ========================================================================= */
import { html, ic, actionsFor, readNum, $ } from "../ui/dom.js";
import { openSheet, closeSheet } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { store } from "../core/store.js";
import {
  createForm, onFormChange, optionList, choiceList, SEX_OPTIONS, GOAL_OPTIONS, ACTIVITY_OPTIONS, LEVEL_OPTIONS,
  EQUIP_OPTIONS, ZONE_OPTIONS, SESSION_OPTIONS, DIET_OPTIONS, ALLERGEN_OPTIONS,
} from "../ui/forms.js";
import { sourceChoicesFor, snacksAvailable, SNACK_THRESHOLD_KCAL, GOAL_MEAL_NOTE } from "../engine/nutrition.js";
import { SOURCE_LABELS, GOAL_LABELS } from "../engine/labels.js";
import { updateProfile } from "../domain.js";

let current = null; /* { ctrl, section } */

export function bodyFields(values) {
  return html`
    <div class="fields-3">
      <div class="field"><label class="field__label" for="pfAge">Âge</label>
        <div class="input-wrap"><input class="input" id="pfAge" inputmode="numeric" value="${values.age || ""}" placeholder="30"><span class="input-wrap__suffix">ans</span></div></div>
      <div class="field"><label class="field__label" for="pfHeight">Taille</label>
        <div class="input-wrap"><input class="input" id="pfHeight" inputmode="numeric" value="${values.heightCm || ""}" placeholder="170"><span class="input-wrap__suffix">cm</span></div></div>
      <div class="field"><label class="field__label" for="pfWeight">Poids</label>
        <div class="input-wrap"><input class="input" id="pfWeight" inputmode="decimal" value="${values.weightKg ? String(values.weightKg).replace(".", ",") : ""}" placeholder="70"><span class="input-wrap__suffix">kg</span></div></div>
    </div>`;
}
/* Lit et vérifie âge / taille / poids ; renvoie un message d'erreur ou null. */
export function readBody(root, values) {
  const age = Math.round(readNum($("#pfAge", root)));
  const h = Math.round(readNum($("#pfHeight", root)));
  const w = Math.round(readNum($("#pfWeight", root)) * 10) / 10;
  if (!(age >= 14 && age <= 90)) return "L'âge doit être compris entre 14 et 90 ans.";
  if (!(h >= 120 && h <= 230)) return "La taille doit être comprise entre 120 et 230 cm.";
  if (!(w >= 30 && w <= 250)) return "Le poids doit être compris entre 30 et 250 kg.";
  Object.assign(values, { age, heightCm: h, weightKg: w });
  return null;
}

function prefsHtml(p, values) {
  const sources = sourceChoicesFor(values.diet);
  return html`
    ${sources.length ? html`<h3 class="sub-title">Sources de protéines préférées</h3>
      ${choiceList("proteinPrefs", sources.map((s) => ({ value: s, label: SOURCE_LABELS[s] })), values.proteinPrefs, { multi: true })}
      <p class="field-hint">Une grande majorité des déjeuners et dîners suivra ta préférence ; les petits-déjeuners restent variés. Aucune sélection = menus libres.</p>` : ""}
    ${snacksAvailable(p) ? html`<h3 class="sub-title">Répartition des repas</h3>
      ${choiceList("useSnacks", [{ value: "1", label: "3 repas + 2 collations" }, { value: "0", label: "3 repas copieux" }], values.useSnacks)}
      <p class="field-hint">Ton besoin dépasse ${SNACK_THRESHOLD_KCAL} kcal : sur trois repas seulement, les assiettes deviennent très copieuses. Les collations gardent des portions normales.</p>` : ""}
    <div class="setting-row mt-16">
      <div class="grow"><b>Petit budget</b><p class="field-hint" style="margin:2px 0 0">Privilégie les plats à base d'ingrédients peu coûteux.</p></div>
      <label class="switch"><input type="checkbox" id="pfBudget" ${values.lowBudget ? "checked" : ""} aria-label="Petit budget"><span></span></label>
    </div>
    <p class="note mt-16">${ic("info")}<span><b>Objectif ${GOAL_LABELS[p.goal].toLowerCase()}</b> — ${GOAL_MEAL_NOTE[p.goal]}</span></p>`;
}

const SECTIONS = {
  personal: {
    title: "Informations personnelles",
    sub: "Elles servent à calculer tes besoins énergétiques.",
    values: (p) => ({ name: p.name || "", sex: p.sex, age: p.age, heightCm: p.heightCm, weightKg: p.weightKg, activity: p.activity }),
    body: (v) => html`
      <div class="field"><label class="field__label" for="pfName">Prénom <span class="faint">(facultatif)</span></label>
        <input class="input" id="pfName" value="${v.name}" placeholder="Ton prénom" autocomplete="given-name" maxlength="30"></div>
      <div class="field"><span class="field__label">Sexe</span>${choiceList("sex", SEX_OPTIONS, v.sex)}</div>
      <div class="field">${bodyFields(v)}</div>
      <h3 class="sub-title">Activité quotidienne <span class="faint">(hors sport)</span></h3>
      ${optionList("activity", ACTIVITY_OPTIONS, v.activity)}`,
    read(root, v) {
      const err = readBody(root, v);
      if (err) return err;
      v.name = $("#pfName", root).value.trim().slice(0, 30);
      return null;
    },
  },
  training: {
    title: "Objectif & entraînement",
    sub: "Ton programme se reconstruit aussitôt.",
    values: (p) => ({ goal: p.goal, level: p.level, sessionsPerWeek: String(p.sessionsPerWeek || 3), focusZones: (p.focusZones || []).slice(), equipment: (p.equipment || []).slice() }),
    body: (v) => html`
      <h3 class="sub-title mt-0">Objectif</h3>
      ${optionList("goal", GOAL_OPTIONS, v.goal)}
      <h3 class="sub-title">Niveau</h3>
      ${optionList("level", LEVEL_OPTIONS, v.level)}
      <h3 class="sub-title">Séances par semaine</h3>
      ${choiceList("sessionsPerWeek", SESSION_OPTIONS, v.sessionsPerWeek, { cls: "is-numbers" })}
      <p class="field-hint">Indépendant du niveau, qui ne règle que la difficulté des exercices.</p>
      <h3 class="sub-title">Zones prioritaires</h3>
      ${choiceList("focusZones", ZONE_OPTIONS, v.focusZones, { multi: true })}
      <p class="field-hint">Aucune sélection = tout le corps.</p>
      <h3 class="sub-title">Matériel disponible</h3>
      ${choiceList("equipment", EQUIP_OPTIONS, v.equipment, { multi: true })}
      <p class="field-hint">Les exercices au poids du corps sont toujours inclus.</p>`,
    read(root, v) { v.sessionsPerWeek = parseInt(v.sessionsPerWeek, 10) || 3; return null; },
  },
  food: {
    title: "Alimentation",
    sub: "Les menus respectent ton régime et excluent tes allergènes.",
    values: (p) => ({ diet: p.diet || "omnivore", allergens: (p.allergens || []).slice(), proteinPrefs: (p.proteinPrefs || []).slice(), useSnacks: p.useSnacks === false ? "0" : "1", lowBudget: !!p.lowBudget }),
    body: (v, p) => html`
      <h3 class="sub-title mt-0">Régime</h3>
      ${optionList("diet", DIET_OPTIONS, v.diet)}
      <h3 class="sub-title">Allergènes et intolérances</h3>
      ${choiceList("allergens", ALLERGEN_OPTIONS, v.allergens, { multi: true })}
      <p class="field-hint">Choisis « Gluten » pour un régime sans gluten. Vérifie toujours la fiche recette en cas d'allergie sévère.</p>
      <div data-prefs>${prefsHtml(p, v)}</div>`,
    read(root, v) {
      v.lowBudget = !!$("#pfBudget", root).checked;
      v.useSnacks = v.useSnacks !== "0";
      /* Une préférence devenue impossible avec le nouveau régime est retirée. */
      const allowed = sourceChoicesFor(v.diet);
      v.proteinPrefs = (v.proteinPrefs || []).filter((s) => allowed.includes(s));
      return null;
    },
  },
};

export function openProfileSection(section) {
  const def = SECTIONS[section];
  const p = store.state.profile;
  const values = createForm("profile-" + section, def.values(p));
  const ctrl = openSheet({ id: "profile-" + section, size: section === "personal" ? "auto" : "full", title: def.title, sub: def.sub, onClose: () => { current = null; } });
  current = { ctrl, section, values };
  ctrl.setBody(html`<div data-form="profile-${section}">${def.body(values, p)}</div>`);
  ctrl.setFoot(html`<button type="button" class="btn btn-primary" data-action="profile-save" data-submit>Enregistrer</button>`);
}

actionsFor({
  "profile-save": async () => {
    if (!current) return;
    const { ctrl, section, values } = current;
    const err = SECTIONS[section].read(ctrl.body, values);
    if (err) { toast(err, { type: "error" }); return; }
    await updateProfile({ ...values });
    closeSheet(ctrl);
  },
});

/* Le changement de régime met à jour les sources de protéines proposées. */
onFormChange("profile-food", (field, values) => {
  if (field !== "diet" || !current) return;
  values.lowBudget = !!$("#pfBudget", current.ctrl.body)?.checked;
  const host = current.ctrl.body.querySelector("[data-prefs]");
  if (host) host.innerHTML = String(prefsHtml(store.state.profile, values));
});
