/* Validation d'un exercice : tout l'objectif en un geste, ou ce qui a
   réellement été fait (séries, répétitions ou secondes, charge). */
import { html, ic, actionsFor, inputsFor, readNum } from "../ui/dom.js";
import { openSheet, closeSheet } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { store } from "../core/store.js";
import { exerciseById, exerciseTarget, exerciseEntryFor, exercicePeutEtreCharge, derniereCharge, rappelCharge, exerciseKcal } from "../engine/training.js";
import { validateExercise, unvalidateExercise } from "../domain.js";
import { clamp, fmtInt, fmtKg } from "../core/util.js";
import { trendChip } from "../ui/components.js";

let ctx = null;

export function stepper({ id, value, step = 1, min = 0, max = 999, unit = "", label, decimal = false }) {
  return html`<div class="field">
    <label class="field__label" for="${id}">${label}</label>
    <div class="stepper">
      <button type="button" data-action="step" data-target="${id}" data-delta="${-step}" data-min="${min}" data-max="${max}" aria-label="Diminuer">${ic("minus")}</button>
      <input id="${id}" type="text" inputmode="${decimal ? "decimal" : "numeric"}" value="${value}" data-input="validate-calc" autocomplete="off">
      ${unit ? html`<span class="stepper__unit">${unit}</span>` : ""}
      <button type="button" data-action="step" data-target="${id}" data-delta="${step}" data-min="${min}" data-max="${max}" aria-label="Augmenter">${ic("plus")}</button>
    </div>
  </div>`;
}

function estimate() {
  if (!ctx) return;
  const b = ctx.ctrl.body;
  const s = Math.max(0, readNum(b.querySelector("#valSets")) || 0);
  const r = Math.max(0, readNum(b.querySelector("#valReps")) || 0);
  const t = ctx.target;
  const pct = Math.round((100 * s * r) / Math.max(1, t.sets * t.reps));
  const kcal = s > 0 && r > 0 ? exerciseKcal(ctx.ex, s, r, store.state.profile, t.rest) : 0;
  b.querySelector("#valEstimate").innerHTML = String(html`<b>${pct} %</b> de l'objectif · environ <b>${fmtInt(kcal)} kcal</b>`);
}

export function openValidate(exId, dk) {
  const ex = exerciseById(exId);
  if (!ex) return;
  const p = store.state.profile;
  const t = exerciseTarget(ex, p, dk);
  const existing = exerciseEntryFor(dk, exId);
  const chargeable = exercicePeutEtreCharge(ex);
  const last = derniereCharge(ex.id, dk);
  const unit = t.enSecondes ? "s" : "";
  const ctrl = openSheet({
    id: "validate", title: ex.name,
    sub: `Objectif : ${t.sets} × ${t.reps}${t.enSecondes ? " secondes" : " répétitions"}${t.load ? " à " + fmtKg(t.load) : ""}`,
    onClose: () => { ctx = null; },
  });
  ctx = { ctrl, ex, dk, target: t, existing };
  ctrl.setBody(html`
    ${existing ? "" : html`<div class="rx-wrap">${trendChip(t)}</div>`}
    <button type="button" class="btn btn-primary btn-block btn-lg" data-action="validate-full">${ic("check")}Objectif atteint : ${t.sets} × ${t.reps}${t.enSecondes ? " s" : ""}</button>
    <p class="divider-label"><span>ou ajuste ce que tu as fait</span></p>
    <div class="fields-2">
      ${stepper({ id: "valSets", value: existing ? existing.sets : t.sets, min: 0, max: 20, label: "Séries" })}
      ${stepper({ id: "valReps", value: existing ? existing.reps : t.reps, step: t.enSecondes ? 5 : 1, min: 0, max: 600, unit, label: t.enSecondes ? (t.hold ? "Secondes tenues" : "Secondes") : "Répétitions" })}
    </div>
    ${chargeable ? html`<div class="mt-16">${stepper({ id: "valLoad", value: String(existing && existing.load ? existing.load : t.load || (last ? last.load : 0)).replace(".", ","), step: 2.5, min: 0, max: 500, unit: "kg", label: "Charge utilisée", decimal: true })}
      <p class="field-hint">${rappelCharge(ex, dk)}</p></div>` : ""}
    <p class="estimate" id="valEstimate"></p>
  `);
  ctrl.setFoot(html`
    ${existing ? html`<button type="button" class="btn btn-danger" data-action="validate-clear">${ic("rotate-ccw")}Annuler</button>` : ""}
    <button type="button" class="btn btn-secondary" data-action="validate-save" data-submit>Enregistrer</button>
  `);
  estimate();
}

inputsFor({ "validate-calc": () => estimate() });

actionsFor({
  /* Boutons +/- génériques de toutes les feuilles. */
  step: (el) => {
    const input = document.getElementById(el.dataset.target);
    if (!input) return;
    const delta = Number(el.dataset.delta);
    const cur = readNum(input) || 0;
    const dec = String(delta).includes(".") || String(cur).includes(".");
    let v = clamp(Math.round((cur + delta) * 10) / 10, Number(el.dataset.min), Number(el.dataset.max));
    input.value = dec ? String(v).replace(".", ",") : String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  },
  "validate-full": async () => {
    if (!ctx) return;
    const { ex, dk, target: t, ctrl } = ctx;
    const loadInput = ctrl.body.querySelector("#valLoad");
    const load = loadInput ? Math.max(0, readNum(loadInput) || 0) : 0;
    await validateExercise(dk, ex.id, t.sets, t.reps, load);
    closeSheet(ctrl);
    toast(`${ex.name} validé.`);
  },
  "validate-save": async () => {
    if (!ctx) return;
    const { ex, dk, ctrl } = ctx;
    const s = Math.round(readNum(ctrl.body.querySelector("#valSets")));
    const r = Math.round(readNum(ctrl.body.querySelector("#valReps")));
    if (!(s > 0) || !(r > 0)) { toast("Indique au moins une série et une répétition.", { type: "error" }); return; }
    const loadInput = ctrl.body.querySelector("#valLoad");
    const load = loadInput ? Math.max(0, readNum(loadInput) || 0) : 0;
    await validateExercise(dk, ex.id, s, r, load);
    closeSheet(ctrl);
    toast("Exercice enregistré.");
  },
  "validate-clear": async () => {
    if (!ctx) return;
    const { ex, dk, ctrl } = ctx;
    await unvalidateExercise(dk, ex.id);
    closeSheet(ctrl);
    toast("Validation annulée.", { type: "info" });
  },
});
