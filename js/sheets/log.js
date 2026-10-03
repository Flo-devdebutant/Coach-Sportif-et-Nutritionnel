/* =========================================================================
   SAISIES RAPIDES — aliment, activité, pesée, et le menu « + »
   ========================================================================= */
import { html, ic, actionsFor, inputsFor, readNum, $ } from "../ui/dom.js";
import { openSheet, closeSheet, closeAllSheets } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { store } from "../core/store.js";
import { todayKey, fmtInt, fmtKg, relativeDay, parseDateOnly, fmtDateFr } from "../core/util.js";
import { searchFoods, recentFoods, FOOD_CATS } from "../engine/nutrition.js";
import { activityKcal, EXERCISES } from "../engine/training.js";
import { CARDIO_LABELS } from "../engine/labels.js";
import { lastWeighIn, dayPlan } from "../engine/stats.js";
import { addIntake, addActivity, saveWeight } from "../domain.js";
import { ui } from "../ui/state.js";
import { stepper } from "./validate.js";

const touch = () => window.matchMedia("(pointer: coarse)").matches;
function dateField(id, dk) {
  return html`<div class="field mt-16">
    <label class="field__label" for="${id}">Date</label>
    <input class="input" type="date" id="${id}" value="${dk}" max="${todayKey()}">
  </div>`;
}

/* ---------- Aliment ---------- */
let food = null; /* { ctrl, cat, sel, mult } */

function foodRow(f, i) {
  return html`<button type="button" class="food-row" data-action="food-pick" data-i="${i}">
    <span class="food-row__body"><span class="food-row__name">${f.n}</span>${f.u ? html`<span class="food-row__sub">${f.u}${f.c ? " · " + f.c : ""}</span>` : html`<span class="food-row__sub">Saisi récemment</span>`}</span>
    <span class="food-row__val"><b>${fmtInt(f.k)}</b> kcal${f.p > 0 ? html`<small>${f.p} g prot.</small>` : ""}</span>
  </button>`;
}
function renderFoodResults() {
  if (!food) return;
  const b = food.ctrl.body;
  const q = $("#foodQ", b).value;
  const host = $("#foodResults", b);
  let list;
  if (!q.trim() && !food.cat) {
    list = recentFoods();
    food.list = list;
    host.innerHTML = String(list.length
      ? html`<p class="list-caption">${ic("history", "icon-xs")}Récents</p><div class="food-list">${list.map(foodRow)}</div>`
      : html`<p class="field-hint">Cherche un plat, un aliment ou une boisson — par exemple « pizza », « croissant », « riz ». Tu peux aussi parcourir les catégories.</p>`);
    return;
  }
  list = searchFoods(q, food.cat);
  food.list = list;
  host.innerHTML = String(list.length
    ? html`<div class="food-list">${list.map(foodRow)}</div>`
    : html`<p class="field-hint">Aucun résultat. Saisis directement les valeurs ci-dessous si tu les connais.</p>`);
}
function renderFoodSelection() {
  const host = $("#foodSel", food.ctrl.body);
  if (!food.sel) { host.innerHTML = ""; return; }
  const k = Math.round(food.sel.k * food.mult), p = Math.round(food.sel.p * food.mult);
  host.innerHTML = String(html`<div class="food-sel">
    <div class="row-between"><b>${food.sel.n}</b><button type="button" class="icon-btn is-sm is-plain" data-action="food-unpick" aria-label="Retirer">${ic("x")}</button></div>
    <p class="muted">${food.sel.u || "Portion"} · <b class="num">${fmtInt(k)} kcal</b>${p > 0 ? ` · ${p} g de protéines` : ""}</p>
    <div class="choices mt-8">${[0.5, 1, 1.5, 2, 3].map((m) => html`<button type="button" class="choice" aria-pressed="${food.mult === m}" data-action="food-mult" data-m="${m}">× ${String(m).replace(".", ",")}</button>`)}</div>
  </div>`);
  $("#intakeLabel", food.ctrl.body).value = food.sel.n;
  $("#intakeKcal", food.ctrl.body).value = k;
  $("#intakeProt", food.ctrl.body).value = p;
}

export function openIntake({ dk = ui.date } = {}) {
  if (dk > todayKey()) dk = todayKey();
  const ctrl = openSheet({ id: "intake", size: "full", title: "Ajouter un aliment", sub: "Repas pris hors programme, collation, boisson…", onClose: () => { food = null; } });
  food = { ctrl, cat: "", sel: null, mult: 1, list: [] };
  ctrl.setBody(html`
    <div class="input-wrap has-icon">
      <span class="input-wrap__icon">${ic("search")}</span>
      <input class="input" id="foodQ" type="search" placeholder="Pizza, yaourt, banane…" autocomplete="off" data-input="food-search" ${touch() ? "" : "autofocus"} enterkeyhint="search">
    </div>
    <div class="chips-scroll mt-12">${FOOD_CATS.map((c) => html`<button type="button" class="choice" aria-pressed="false" data-action="food-cat" data-cat="${c}">${c}</button>`)}</div>
    <div id="foodResults" class="mt-12"></div>
    <div id="foodSel" class="mt-12"></div>
    <h3 class="sub-title">Détails</h3>
    <div class="field">
      <label class="field__label" for="intakeLabel">Description</label>
      <input class="input" id="intakeLabel" placeholder="Ex. Déjeuner au restaurant" autocomplete="off">
    </div>
    <div class="fields-2 mt-16">
      <div class="field"><label class="field__label" for="intakeKcal">Calories</label>
        <div class="input-wrap"><input class="input" id="intakeKcal" inputmode="numeric" placeholder="0"><span class="input-wrap__suffix">kcal</span></div></div>
      <div class="field"><label class="field__label" for="intakeProt">Protéines</label>
        <div class="input-wrap"><input class="input" id="intakeProt" inputmode="numeric" placeholder="0"><span class="input-wrap__suffix">g</span></div></div>
    </div>
    ${dateField("intakeDate", dk)}
    <p class="field-hint">Valeurs indicatives pour une portion courante : ajuste-les si tu connais les tiennes.</p>
  `);
  ctrl.setFoot(html`<button type="button" class="btn btn-primary" data-action="intake-save" data-submit>${ic("plus")}Ajouter au journal</button>`);
  renderFoodResults();
}

inputsFor({ "food-search": () => renderFoodResults() });
actionsFor({
  "food-cat": (el) => {
    if (!food) return;
    food.cat = food.cat === el.dataset.cat ? "" : el.dataset.cat;
    for (const b of food.ctrl.body.querySelectorAll("[data-action=food-cat]")) b.setAttribute("aria-pressed", String(b.dataset.cat === food.cat));
    renderFoodResults();
  },
  "food-pick": (el) => {
    if (!food) return;
    const f = food.list[Number(el.dataset.i)];
    if (!f) return;
    food.sel = f; food.mult = 1;
    renderFoodSelection();
    $("#foodSel", food.ctrl.body).scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
  "food-unpick": () => { if (food) { food.sel = null; renderFoodSelection(); } },
  "food-mult": (el) => { if (food) { food.mult = Number(el.dataset.m); renderFoodSelection(); } },
  "intake-save": async () => {
    if (!food) return;
    const b = food.ctrl.body;
    const kcal = Math.round(readNum($("#intakeKcal", b)));
    if (!(kcal > 0) || kcal > 10000) { toast("Indique un nombre de calories valide.", { type: "error" }); $("#intakeKcal", b).focus(); return; }
    const prot = Math.max(0, Math.round(readNum($("#intakeProt", b)) || 0));
    const dk = $("#intakeDate", b).value || todayKey();
    const ctrl = food.ctrl;
    await addIntake({ dk, label: $("#intakeLabel", b).value.trim(), kcal, protein: prot });
    closeSheet(ctrl);
  },
});

/* ---------- Activité ---------- */
let act = null; /* { ctrl, type, intensity, cardio } */
const CARDIO_ICONS = { marche: "footprints", course: "zap", velo: "bike", natation: "waves" };

function activityEntry() {
  const b = act.ctrl.body;
  const dk = $("#actDate", b).value || todayKey();
  if (act.type === "exercice") {
    return { dateKey: dk, type: "exercice", name: $("#actName", b).value.trim(), durationMin: Math.round(readNum($("#actDur", b))), intensity: act.intensity };
  }
  if (act.type === "cardio") {
    const e = { dateKey: dk, type: act.cardio, durationMin: Math.round(readNum($("#actDur", b))) };
    const dist = readNum($("#actDist", b));
    if (dist > 0) e.distanceKm = dist;
    return e;
  }
  return { dateKey: dk, type: "pas", steps: Math.round(readNum($("#actSteps", b))) };
}
function activityEstimate() {
  if (!act) return;
  const e = activityEntry();
  const ok = e.type === "pas" ? e.steps > 0 : e.durationMin > 0;
  $("#actEstimate", act.ctrl.body).innerHTML = ok
    ? String(html`${ic("flame", "icon-sm")}Environ <b>${fmtInt(activityKcal(e, store.state.profile.weightKg, store.state.profile.heightCm))} kcal</b> dépensées en plus de ta dépense de base`)
    : "";
}
function renderActivity() {
  const dk = act.ctrl.body.querySelector("#actDate")?.value || act.dk;
  const durChips = (vals) => html`<div class="choices mt-8">${vals.map((v) => html`<button type="button" class="choice" data-action="act-quick" data-target="actDur" data-v="${v}">${v} min</button>`)}</div>`;
  let fields;
  if (act.type === "exercice") {
    fields = html`
      <div class="field"><label class="field__label" for="actName">Exercice ou sport</label>
        <input class="input" id="actName" list="exoNames" placeholder="Ex. Yoga, tennis, squats…" autocomplete="off">
        <datalist id="exoNames">${EXERCISES.map((e) => html`<option value="${e.name}">`)}</datalist></div>
      <div class="field"><label class="field__label" for="actDur">Durée</label>
        <div class="input-wrap"><input class="input" id="actDur" inputmode="numeric" placeholder="30" data-input="act-calc"><span class="input-wrap__suffix">min</span></div>
        ${durChips([15, 30, 45, 60])}</div>
      <div class="field"><span class="field__label">Intensité ressentie</span>
        <div class="segmented">${[["legere", "Légère"], ["moderee", "Modérée"], ["intense", "Intense"]].map(([v, l]) => html`<button type="button" aria-selected="${act.intensity === v}" data-action="act-intensity" data-v="${v}">${l}</button>`)}</div></div>`;
  } else if (act.type === "cardio") {
    fields = html`
      <div class="options-grid is-4">${Object.entries(CARDIO_LABELS).map(([v, l]) => html`<button type="button" class="option is-tile" aria-pressed="${act.cardio === v}" data-action="act-cardio" data-v="${v}">
        <span class="option__icon">${ic(CARDIO_ICONS[v])}</span><span class="option__title">${l}</span></button>`)}</div>
      <div class="fields-2 mt-16">
        <div class="field"><label class="field__label" for="actDur">Durée</label>
          <div class="input-wrap"><input class="input" id="actDur" inputmode="numeric" placeholder="30" data-input="act-calc"><span class="input-wrap__suffix">min</span></div></div>
        <div class="field"><label class="field__label" for="actDist">Distance</label>
          <div class="input-wrap"><input class="input" id="actDist" inputmode="decimal" placeholder="—"><span class="input-wrap__suffix">km</span></div></div>
      </div>
      ${durChips([20, 30, 45, 60])}`;
  } else {
    fields = html`
      <div class="field"><label class="field__label" for="actSteps">Nombre de pas</label>
        <div class="input-wrap"><input class="input" id="actSteps" inputmode="numeric" placeholder="8000" data-input="act-calc"><span class="input-wrap__suffix">pas</span></div>
        <div class="choices mt-8">${[3000, 6000, 8000, 10000].map((v) => html`<button type="button" class="choice" data-action="act-quick" data-target="actSteps" data-v="${v}">${fmtInt(v)}</button>`)}</div></div>
      <p class="field-hint">Ajoute les pas de ta journée relevés sur ton téléphone ou ta montre.</p>`;
  }
  act.ctrl.setBody(html`
    <div class="segmented">${[["exercice", "Exercice", "dumbbell"], ["cardio", "Cardio", "activity"], ["pas", "Pas", "footprints"]].map(([v, l, i]) => html`<button type="button" aria-selected="${act.type === v}" data-action="act-type" data-v="${v}">${ic(i)}${l}</button>`)}</div>
    <div class="stack mt-16">${fields}</div>
    ${dateField("actDate", dk)}
    <p class="estimate" id="actEstimate"></p>
  `);
  activityEstimate();
}

export function openActivity({ dk = ui.date } = {}) {
  if (dk > todayKey()) dk = todayKey();
  const ctrl = openSheet({ id: "activity", title: "Ajouter une activité", sub: "Elle s'ajoute à ta dépense du jour.", onClose: () => { act = null; } });
  act = { ctrl, dk, type: "exercice", intensity: "moderee", cardio: "marche" };
  renderActivity();
  ctrl.setFoot(html`<button type="button" class="btn btn-primary" data-action="act-save" data-submit>Enregistrer l'activité</button>`);
}

inputsFor({ "act-calc": () => activityEstimate() });
actionsFor({
  "act-type": (el) => { if (act) { act.type = el.dataset.v; renderActivity(); } },
  "act-intensity": (el) => {
    if (!act) return;
    act.intensity = el.dataset.v;
    for (const b of act.ctrl.body.querySelectorAll("[data-action=act-intensity]")) b.setAttribute("aria-selected", String(b.dataset.v === act.intensity));
    activityEstimate();
  },
  "act-cardio": (el) => {
    if (!act) return;
    act.cardio = el.dataset.v;
    for (const b of act.ctrl.body.querySelectorAll("[data-action=act-cardio]")) b.setAttribute("aria-pressed", String(b.dataset.v === act.cardio));
    activityEstimate();
  },
  "act-quick": (el) => {
    const input = document.getElementById(el.dataset.target);
    if (input) { input.value = el.dataset.v; activityEstimate(); }
  },
  "act-save": async () => {
    if (!act) return;
    const e = activityEntry();
    if (e.type === "exercice" && !e.name) { toast("Indique le nom de l'activité.", { type: "error" }); return; }
    if (e.type === "pas" ? !(e.steps > 0) : !(e.durationMin > 0)) { toast(e.type === "pas" ? "Indique un nombre de pas valide." : "Indique une durée valide.", { type: "error" }); return; }
    const ctrl = act.ctrl;
    await addActivity(e);
    closeSheet(ctrl);
  },
});

/* ---------- Pesée ---------- */
let weightCtrl = null;
export function openWeight() {
  const last = lastWeighIn();
  const value = last ? last.weightKg : store.state.profile.weightKg;
  weightCtrl = openSheet({ id: "weight", title: "Nouvelle pesée", sub: "Ton objectif calorique s'ajuste automatiquement à ton poids.", onClose: () => { weightCtrl = null; } });
  weightCtrl.setBody(html`
    <div class="weight-input">
      ${stepper({ id: "wVal", value: String(value).replace(".", ","), step: 0.1, min: 30, max: 250, unit: "kg", label: "Poids", decimal: true })}
    </div>
    ${last ? html`<p class="field-hint">Dernière pesée : ${fmtKg(last.weightKg)} · ${fmtDateFr(parseDateOnly(last.dateKey)).toLowerCase()}</p>` : ""}
    ${dateField("wDate", todayKey())}
    <p class="field-hint">Conseil : pèse-toi le matin, à jeun, dans les mêmes conditions — la tendance compte plus qu'une mesure isolée.</p>
  `);
  weightCtrl.setFoot(html`<button type="button" class="btn btn-primary" data-action="weight-save" data-submit>Enregistrer</button>`);
}
actionsFor({
  "weight-save": async () => {
    if (!weightCtrl) return;
    const b = weightCtrl.body;
    const kg = Math.round(readNum($("#wVal", b)) * 10) / 10;
    if (!(kg >= 30 && kg <= 250)) { toast("Entre un poids entre 30 et 250 kg.", { type: "error" }); return; }
    const ctrl = weightCtrl;
    await saveWeight($("#wDate", b).value || todayKey(), kg);
    closeSheet(ctrl);
  },
});

/* ---------- Menu « + » ---------- */
export function openQuickAdd() {
  const dk = ui.date > todayKey() ? todayKey() : ui.date;
  const plan = dayPlan(todayKey());
  const w = plan.workout;
  const ctrl = openSheet({ id: "quick", title: "Ajouter", sub: dk === todayKey() ? "Pour aujourd'hui" : `Pour ${relativeDay(dk).toLowerCase()}` });
  ctrl.setBody(html`<div class="quick-grid">
    <button type="button" class="quick" data-action="quick-go" data-to="intake"><span class="quick__icon is-intake">${ic("utensils")}</span><b>Aliment</b><span>Repas, collation, boisson</span></button>
    <button type="button" class="quick" data-action="quick-go" data-to="activity"><span class="quick__icon is-burn">${ic("flame")}</span><b>Activité</b><span>Sport, cardio, pas</span></button>
    <button type="button" class="quick" data-action="quick-go" data-to="weight"><span class="quick__icon is-weight">${ic("weight")}</span><b>Pesée</b><span>Suivre ton poids</span></button>
    ${w && w.training
      ? html`<button type="button" class="quick" data-action="quick-go" data-to="workout"><span class="quick__icon is-accent">${ic("play")}</span><b>Séance</b><span>${w.label}</span></button>`
      : html`<button type="button" class="quick" data-action="quick-go" data-to="library"><span class="quick__icon is-accent">${ic("book-open")}</span><b>Exercices</b><span>Parcourir la bibliothèque</span></button>`}
  </div>`);
}
actionsFor({
  "quick-go": async (el) => {
    const to = el.dataset.to;
    const dk = ui.date > todayKey() ? todayKey() : ui.date;
    await closeAllSheets();
    if (to === "intake") openIntake({ dk });
    else if (to === "activity") openActivity({ dk });
    else if (to === "weight") openWeight();
    else if (to === "workout") location.hash = `#/workout/${todayKey()}`;
    else if (to === "library") location.hash = "#/library";
  },
});

