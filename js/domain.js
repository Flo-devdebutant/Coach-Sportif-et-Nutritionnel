/* =========================================================================
   OPÉRATIONS MÉTIER
   Toutes les modifications de données passent par ici : les vues et les
   feuilles décrivent l'intention, ce module l'applique, enregistre, et
   annonce le résultat.
   ========================================================================= */
import { store, commit } from "./core/store.js";
import { genId, todayKey, fmtInt, fmtKg } from "./core/util.js";
import { dayPlan, targets, sortedWeights } from "./engine/stats.js";
import { applyValidation, applyUnvalidation, applySessionDone, exerciseById, activityKcal } from "./engine/training.js";
import { chooseSwap, pruneOverrides, pruneShopping } from "./engine/nutrition.js";
import { SLOT_LABELS } from "./engine/labels.js";
import { toast } from "./ui/toast.js";

/* ---------- Repas du programme ---------- */
export async function toggleEaten(dk, slot) {
  const key = dk + "|" + slot;
  const existing = store.state.intakeLog.find((e) => e.slot === key);
  if (existing) {
    await commit((s) => { s.intakeLog = s.intakeLog.filter((e) => e.id !== existing.id); });
    toast(`${SLOT_LABELS[slot]} retiré de ton journal.`, { type: "info" });
    return false;
  }
  const meal = dayPlan(dk).meals[slot];
  if (!meal) return false;
  await commit((s) => {
    s.intakeLog.push({ id: genId("in"), dateKey: dk, label: meal.name, kcal: meal.kcal, protein: meal.protein, slot: key, mealId: meal.id });
  });
  toast(`${SLOT_LABELS[slot]} ajouté · ${fmtInt(meal.kcal)} kcal`);
  return true;
}

export async function swapMeal(dk, slot) {
  const day = dayPlan(dk).meals;
  const choisi = chooseSwap(day, slot, targets().kcal);
  if (!choisi) { toast("Aucun autre plat ne correspond à tes critères.", { type: "error" }); return false; }
  await commit((s) => {
    s.mealOverrides[dk + "|" + slot] = choisi.id;
    pruneOverrides(s);
  });
  syncEatenWithPlan(dk, slot);
  toast("Plat remplacé.");
  return true;
}
export async function resetMeal(dk, slot) {
  await commit((s) => { delete s.mealOverrides[dk + "|" + slot]; });
  syncEatenWithPlan(dk, slot);
  toast("Plat d'origine rétabli.");
}
/* Un repas déjà coché suit le plat qui le remplace. */
function syncEatenWithPlan(dk, slot) {
  const e = store.state.intakeLog.find((x) => x.slot === dk + "|" + slot);
  const meal = dayPlan(dk).meals[slot];
  if (!e || !meal || e.mealId === meal.id) return;
  commit(() => Object.assign(e, { label: meal.name, kcal: meal.kcal, protein: meal.protein, mealId: meal.id }));
}

/* ---------- Journal libre ---------- */
export async function addIntake({ dk, label, kcal, protein }) {
  await commit((s) => { s.intakeLog.push({ id: genId("in"), dateKey: dk, label: label || "Apport calorique", kcal, protein: protein || 0 }); });
  toast(`${label || "Apport"} ajouté · ${fmtInt(kcal)} kcal`);
}

export async function addActivity(entry) {
  const e = { id: genId("act"), ...entry };
  e.kcal = activityKcal(e, store.state.profile.weightKg);
  await commit((s) => { s.activityLog.push(e); });
  toast(`Activité enregistrée · ${fmtInt(e.kcal)} kcal`);
  return e;
}

/* Le poids le plus récent devient le poids du profil : les besoins
   caloriques se recalculent seuls. */
function syncProfileWeight(s) {
  const latest = s.weightLog.slice().sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1)).pop();
  if (latest && s.profile) s.profile.weightKg = latest.weightKg;
}
export async function saveWeight(dk, kg) {
  const before = targets().kcal;
  await commit((s) => {
    const ex = s.weightLog.find((e) => e.dateKey === dk);
    if (ex) ex.weightKg = kg; else s.weightLog.push({ id: genId("w"), dateKey: dk, weightKg: kg });
    syncProfileWeight(s);
  });
  const after = targets().kcal;
  toast(after !== before ? `Pesée enregistrée · objectif ajusté à ${fmtInt(after)} kcal` : `Pesée enregistrée · ${fmtKg(kg)}`);
}

const DELETE_LABELS = { intakeLog: "Apport supprimé", activityLog: "Activité supprimée", weightLog: "Pesée supprimée" };
/* Suppression immédiate avec possibilité d'annuler : plus rapide qu'une
   confirmation, et sans risque de perte. */
export async function deleteEntry(kind, id) {
  const list = store.state[kind];
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  const item = list[idx];
  await commit((s) => {
    s[kind].splice(idx, 1);
    if (kind === "weightLog") syncProfileWeight(s);
  });
  toast(DELETE_LABELS[kind], {
    type: "info",
    action: {
      label: "Annuler",
      fn: () => commit((s) => {
        if (s[kind].some((e) => e.id === item.id)) return;
        s[kind].splice(Math.min(idx, s[kind].length), 0, item);
        if (kind === "weightLog") syncProfileWeight(s);
      }),
    },
  });
}

/* ---------- Entraînement ---------- */
export async function validateExercise(dk, exId, sets, reps, load) {
  const ex = exerciseById(exId);
  if (!ex) return;
  let entry;
  await commit((s) => { entry = applyValidation(s, dk, ex, sets, reps, load); });
  return entry;
}
export async function unvalidateExercise(dk, exId) {
  await commit((s) => applyUnvalidation(s, dk, exId));
}
export async function finishSession(dk, opts = {}) {
  const day = dayPlan(dk).workout;
  if (!day || !day.training) return false;
  let added = false;
  await commit((s) => { added = applySessionDone(s, dk, day.label, day.exercises, opts); });
  return added;
}
export async function reopenSession(dk) {
  await commit((s) => { s.sessionLog = s.sessionLog.filter((e) => e.dateKey !== dk); });
}

export async function setEquipFilter(list) {
  await commit((s) => { s.equipFilter = list.slice(); });
}

/* ---------- Liste de courses ---------- */
export async function toggleShoppingItem(weekKey, name) {
  await commit((s) => {
    const l = s.shopping[weekKey] || (s.shopping[weekKey] = []);
    const i = l.indexOf(name);
    if (i >= 0) l.splice(i, 1); else l.push(name);
    pruneShopping(s);
  }, { skipSync: true });
}
export async function clearShopping(weekKey) {
  await commit((s) => { delete s.shopping[weekKey]; }, { skipSync: true });
}

/* ---------- Profil ---------- */
/* Fusion et non remplacement : modifier une section ne doit jamais effacer
   les préférences réglées ailleurs (sources de protéines, budget…). */
export async function updateProfile(patch) {
  const before = targets().kcal;
  const weightChanged = patch.weightKg && patch.weightKg !== store.state.profile.weightKg;
  await commit((s) => {
    Object.assign(s.profile, patch);
    if (weightChanged) {
      const today = todayKey();
      const e = s.weightLog.find((w) => w.dateKey === today);
      if (e) e.weightKg = patch.weightKg; else s.weightLog.push({ id: genId("w"), dateKey: today, weightKg: patch.weightKg });
    }
  });
  const after = targets().kcal;
  toast(after !== before ? `Profil mis à jour · objectif ${fmtInt(after)} kcal/jour` : "Profil mis à jour.");
}

export const latestWeight = () => {
  const w = sortedWeights();
  return w.length ? w[w.length - 1].weightKg : store.state.profile.weightKg;
};
