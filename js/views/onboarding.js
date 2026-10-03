/* =========================================================================
   INSCRIPTION — une question par écran, avec barre de progression.
   Les personnes qui ont déjà des données peuvent les récupérer dès
   l'accueil (fichier, code de synchronisation, sauvegarde automatique).
   ========================================================================= */
import { html, ic, actionsFor, $ } from "../ui/dom.js";
import { rings } from "../ui/charts.js";
import { toast } from "../ui/toast.js";
import { openSheet, closeAllSheets } from "../ui/sheet.js";
import { commit, defaultState } from "../core/store.js";
import { genId, todayKey, fmtInt } from "../core/util.js";
import {
  createForm, onFormChange, optionList, choiceList, SEX_OPTIONS, GOAL_OPTIONS, ACTIVITY_OPTIONS, LEVEL_OPTIONS,
  EQUIP_OPTIONS, ZONE_OPTIONS, SESSION_OPTIONS, DIET_OPTIONS, ALLERGEN_OPTIONS,
} from "../ui/forms.js";
import { bodyFields, readBody } from "../sheets/settings.js";
import { computeTargets, computeBurnTarget } from "../engine/nutrition.js";
import { buildSessions } from "../engine/training.js";
import { GOAL_LABELS } from "../engine/labels.js";
import { openSync, openBackups, importData } from "../sheets/data.js";
import { rerender } from "../ui/router.js";

let step = 0;
const values = createForm("ob", {
  name: "", sex: null, age: null, heightCm: null, weightKg: null, goal: null, activity: null, level: null,
  sessionsPerWeek: "3", focusZones: [], equipment: [], diet: "omnivore", allergens: [],
});

const STEPS = [
  null,
  { eyebrow: "Faisons connaissance", title: "Comment t'appelles-tu ?", ok: (v) => !!v.sex,
    body: (v) => html`
      <div class="field"><label class="field__label" for="obName">Prénom <span class="faint">(facultatif)</span></label>
        <input class="input input-lg" id="obName" value="${v.name}" placeholder="Ton prénom" autocomplete="given-name" maxlength="30"></div>
      <div class="field mt-24"><span class="field__label">Tu es</span>${choiceList("sex", SEX_OPTIONS, v.sex, { cls: "is-large" })}</div>
      <p class="field-hint">Le sexe intervient dans le calcul du métabolisme de base.</p>`,
    read: (root, v) => { v.name = $("#obName", root).value.trim().slice(0, 30); return null; } },
  { eyebrow: "Tes mensurations", title: "Quelques mesures", ok: () => true,
    body: (v) => html`${bodyFields(v)}<p class="field-hint mt-12">Elles servent à estimer tes besoins énergétiques. Tu pourras les modifier à tout moment.</p>`,
    read: (root, v) => readBody(root, v) },
  { eyebrow: "Ton objectif", title: "Que veux-tu accomplir ?", ok: (v) => !!v.goal, body: (v) => optionList("goal", GOAL_OPTIONS, v.goal) },
  { eyebrow: "Ton quotidien", title: "Hors sport, tu es plutôt…", ok: (v) => !!v.activity, body: (v) => optionList("activity", ACTIVITY_OPTIONS, v.activity) },
  { eyebrow: "Ton expérience", title: "Ton niveau en renforcement", ok: (v) => !!v.level,
    body: (v) => html`${optionList("level", LEVEL_OPTIONS, v.level)}<p class="field-hint mt-12">Il règle la difficulté des exercices et le nombre de séries.</p>` },
  { eyebrow: "Ton programme", title: "Combien de séances par semaine ?", ok: (v) => !!v.sessionsPerWeek,
    body: (v) => html`
      ${choiceList("sessionsPerWeek", SESSION_OPTIONS, v.sessionsPerWeek, { cls: "is-numbers" })}
      <p class="field-hint">3 séances suffisent pour progresser ; la régularité compte plus que le volume.</p>
      <h3 class="sub-title">Zones à travailler en priorité</h3>
      ${choiceList("focusZones", ZONE_OPTIONS, v.focusZones, { multi: true })}
      <p class="field-hint">Aucune sélection = tout le corps, avec une répartition haut / bas.</p>` },
  { eyebrow: "Ton matériel", title: "Avec quoi t'entraînes-tu ?", ok: () => true,
    body: (v) => html`${optionList("equipment", EQUIP_OPTIONS, v.equipment, { multi: true })}
      <p class="field-hint mt-12">Rien de tout ça ? Continue simplement : les exercices au poids du corps sont toujours inclus.</p>` },
  { eyebrow: "Ton alimentation", title: "Ton régime alimentaire", ok: (v) => !!v.diet,
    body: (v) => html`${optionList("diet", DIET_OPTIONS, v.diet)}
      <h3 class="sub-title">Allergènes et intolérances</h3>
      ${choiceList("allergens", ALLERGEN_OPTIONS, v.allergens, { multi: true })}
      <p class="field-hint">Les menus proposés excluront ces ingrédients.</p>` },
  { eyebrow: "C'est prêt", title: "Ton programme sur mesure", ok: () => true, body: () => summary() },
];
const LAST = STEPS.length - 1;

function draftProfile() {
  return {
    name: values.name, sex: values.sex, age: values.age, weightKg: values.weightKg, heightCm: values.heightCm,
    level: values.level, equipment: values.equipment.slice(), goal: values.goal, activity: values.activity,
    diet: values.diet, allergens: values.allergens.slice(),
    sessionsPerWeek: parseInt(values.sessionsPerWeek, 10) || 3, focusZones: values.focusZones.slice(),
    proteinPrefs: [], lowBudget: false, useSnacks: true,
  };
}

function summary() {
  const p = draftProfile();
  const t = computeTargets(p);
  const burn = computeBurnTarget(p);
  const sessions = buildSessions(p);
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  return html`
    <div class="ob-summary">
      <div class="ob-summary__rings">${rings([{ value: 1, max: 1, color: "var(--intake)" }, { value: 1, max: 1, color: "var(--burn)" }, { value: 1, max: 1, color: "var(--protein)" }], { size: 132, stroke: 12, gap: 4 })}</div>
      <div class="stack-sm">
        <p><i class="dot" style="background:var(--intake)"></i> <b class="num">${fmtInt(t.kcal)} kcal</b> par jour</p>
        <p><i class="dot" style="background:var(--burn)"></i> <b class="num">${fmtInt(burn)} kcal</b> à dépenser en bougeant</p>
        <p><i class="dot" style="background:var(--protein)"></i> <b class="num">${t.proteinG} g</b> de protéines</p>
      </div>
    </div>
    <div class="card mt-16">
      <p class="card-title">${sessions.length} séance${sessions.length > 1 ? "s" : ""} par semaine</p>
      <div class="ob-week mt-12">${sessions.slice().sort((a, b) => a.day - b.day).map((s) => html`<div class="ob-week__day"><b>${days[s.day]}</b><span>${s.label}</span></div>`)}</div>
      <p class="ob-week__rest">Repos : ${days.filter((_, i) => !sessions.some((s) => s.day === i)).map((d) => d.toLowerCase()).join(", ")}</p>
    </div>
    <p class="field-hint mt-12">Objectif : ${GOAL_LABELS[p.goal].toLowerCase()}. ${t.floorApplied ? "Un plancher calorique de sécurité est appliqué. " : ""}Tout reste modifiable depuis ton profil.</p>`;
}

function welcome() {
  return html`<div class="ob-welcome">
    <img class="ob-welcome__logo" src="assets/icons/icon-192.png" alt="" width="84" height="84">
    <p class="eyebrow">Carnet</p>
    <h1 class="ob-welcome__title">Ton coach sportif<br>et nutritionnel</h1>
    <ul class="ob-features">
      <li><span class="ob-features__icon is-accent">${ic("dumbbell")}</span><span><b>Un programme qui s'adapte</b>à ton niveau, ton matériel et tes objectifs, avec une séance guidée pas à pas.</span></li>
      <li><span class="ob-features__icon is-intake">${ic("salad")}</span><span><b>Des menus sur mesure</b>calculés pour tes besoins, avec recettes, portions et liste de courses.</span></li>
      <li><span class="ob-features__icon is-burn">${ic("chart-line")}</span><span><b>Un suivi motivant</b>de tes calories, de ton poids et de tes séries d'activité.</span></li>
    </ul>
    <div class="ob-welcome__actions">
      <button type="button" class="btn btn-primary btn-lg btn-block" data-action="ob-next">Commencer${ic("arrow-right")}</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="ob-restore">J'ai déjà des données</button>
    </div>
    <p class="ob-welcome__privacy">${ic("shield-check", "icon-xs")}Tes données restent sur ton appareil. Aucun compte requis.</p>
  </div>`;
}

export const onboardingView = {
  immersive: true,
  nav: "",
  title: "Bienvenue",
  render() {
    if (step === 0) return welcome();
    const s = STEPS[step];
    return html`<div class="ob" data-form="ob" data-submit-scope>
      <header class="ob__top">
        <button type="button" class="icon-btn" data-action="ob-back" aria-label="Retour">${ic("arrow-left")}</button>
        <div class="ob__progress" role="progressbar" aria-valuemin="1" aria-valuemax="${LAST}" aria-valuenow="${step}"><i style="width:${((100 * step) / LAST).toFixed(1)}%"></i></div>
        <span class="ob__count num">${step}/${LAST}</span>
      </header>
      <div class="ob__content" id="obContent">
        <p class="eyebrow">${s.eyebrow}</p>
        <h1 class="ob__title">${s.title}</h1>
        <div class="ob__body">${s.body(values)}</div>
      </div>
      <footer class="ob__foot">
        <button type="button" class="btn btn-primary btn-lg btn-block" data-action="ob-next" data-submit ${s.ok(values) ? "" : "disabled"}>
          ${step === LAST ? html`${ic("sparkles")}Créer mon programme` : html`Continuer${ic("arrow-right")}`}
        </button>
      </footer>
    </div>`;
  },
  mounted(root) {
    const first = root.querySelector(".ob__body input");
    if (first && !window.matchMedia("(pointer: coarse)").matches) first.focus();
  },
};

/* Le bouton Continuer s'active dès que la réponse attendue est donnée. */
onFormChange("ob", () => {
  const btn = document.querySelector(".ob__foot [data-action=ob-next]");
  if (btn && STEPS[step]) btn.disabled = !STEPS[step].ok(values);
});

async function finish() {
  const profile = draftProfile();
  await commit((s) => {
    Object.assign(s, defaultState());
    s.profile = profile;
    s.weightLog.push({ id: genId("w"), dateKey: todayKey(), weightKg: profile.weightKg });
  });
  step = 0;
  location.replace("#/today");
  toast(profile.name ? `Bienvenue ${profile.name} ! Ton programme est prêt.` : "Bienvenue ! Ton programme est prêt.");
}

actionsFor({
  "ob-next": async () => {
    if (step > 0) {
      const s = STEPS[step];
      const root = document.getElementById("obContent");
      const err = s.read ? s.read(root, values) : null;
      if (err) { toast(err, { type: "error" }); return; }
      if (!s.ok(values)) return;
      if (step === LAST) { await finish(); return; }
    }
    step++;
    rerender();
    window.scrollTo(0, 0);
  },
  "ob-back": () => {
    const s = STEPS[step];
    if (s && s.read) s.read(document.getElementById("obContent"), values);
    step = Math.max(0, step - 1);
    rerender();
  },
  "ob-restore": () => {
    const ctrl = openSheet({ id: "restore", title: "Récupérer mes données", sub: "Retrouve ton profil et ton historique sans rien ressaisir." });
    ctrl.setBody(html`<div class="card is-flush">
      <button type="button" class="list-row" data-action="ob-restore-go" data-v="sync"><span class="list-row__icon is-weight">${ic("cloud")}</span><span class="list-row__body"><span class="list-row__title">Code de synchronisation</span><span class="list-row__sub">Depuis un autre appareil déjà relié</span></span>${ic("chevron-right", "list-row__chev")}</button>
      <button type="button" class="list-row" data-action="ob-restore-go" data-v="file"><span class="list-row__icon">${ic("upload")}</span><span class="list-row__body"><span class="list-row__title">Fichier de sauvegarde</span><span class="list-row__sub">Un export .json</span></span>${ic("chevron-right", "list-row__chev")}</button>
      <button type="button" class="list-row" data-action="ob-restore-go" data-v="auto"><span class="list-row__icon">${ic("history")}</span><span class="list-row__body"><span class="list-row__title">Sauvegarde automatique</span><span class="list-row__sub">Instantanés enregistrés sur cet appareil</span></span>${ic("chevron-right", "list-row__chev")}</button>
    </div>`);
  },
  "ob-restore-go": async (el) => {
    await closeAllSheets();
    if (el.dataset.v === "sync") openSync();
    else if (el.dataset.v === "file") importData();
    else openBackups();
  },
});

export const resetOnboarding = () => { step = 0; };
