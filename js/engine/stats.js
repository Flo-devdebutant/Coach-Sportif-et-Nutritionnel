/* =========================================================================
   STATISTIQUES ET PLAN DE LA SEMAINE
   Tout ce qui se déduit de l'état est recalculé à la demande puis mis en
   cache jusqu'à la prochaine modification : seules les vues affichées
   paient le calcul, et une seule fois.
   ========================================================================= */
import { store } from "../core/store.js";
import { on } from "../core/events.js";
import { addDays, dateKey, parseDateOnly, startOfWeek, todayKey } from "../core/util.js";
import { computeTargets, computeBurnTarget, generateWeekMeals } from "./nutrition.js";
import { generateWeekWorkout } from "./training.js";

const cache = new Map();
on("change", () => cache.clear());
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

export const targets = () => memo("targets", () => computeTargets(store.state.profile));
export const burnTarget = () => memo("burnTarget", () => computeBurnTarget(store.state.profile));
/* Dépense de base (métabolisme + mouvements courants), distincte des
   activités enregistrées pour éviter un double comptage. */
export const baseDailyBurn = () => memo("baseBurn", () => Math.round(targets().bmr * 1.1));

export function weekPlan(date) {
  const monday = startOfWeek(date);
  const mk = dateKey(monday);
  return memo("week:" + mk, () => ({
    monday, mondayKey: mk,
    workout: generateWeekWorkout(monday, store.state.profile),
    meals: generateWeekMeals(monday, targets().kcal, store.state.profile),
  }));
}
export function dayPlan(dk) {
  const w = weekPlan(parseDateOnly(dk));
  return { workout: w.workout.find((d) => d.dateKey === dk), meals: w.meals.find((d) => d.dateKey === dk) };
}

/* Index par jour de tout le journal : une seule passe sur les entrées. */
function index() {
  return memo("index", () => {
    const m = new Map();
    const get = (dk) => {
      if (!m.has(dk)) m.set(dk, { burn: 0, eat: 0, protein: 0, act: false, food: false, ses: false, wei: false });
      return m.get(dk);
    };
    const s = store.state;
    for (const e of s.activityLog) { const d = get(e.dateKey); d.burn += e.kcal || 0; d.act = true; }
    for (const e of s.intakeLog) { const d = get(e.dateKey); d.eat += e.kcal || 0; d.protein += e.protein || 0; d.food = true; }
    for (const e of s.sessionLog) get(e.dateKey).ses = true;
    for (const e of s.weightLog) get(e.dateKey).wei = true;
    return m;
  });
}
const EMPTY = { burn: 0, eat: 0, protein: 0, act: false, food: false, ses: false, wei: false };
export const dayStats = (dk) => index().get(dk) || EMPTY;
export const burnedFromLog = (dk) => dayStats(dk).burn;
export const consumedOn = (dk) => dayStats(dk).eat;
/* Les apports saisis avant l'ajout du champ protéines valent 0 : la jauge
   ne compte que ce qui a réellement été renseigné. */
export const proteinOn = (dk) => dayStats(dk).protein;
export const burnedTotal = (dk) => baseDailyBurn() + burnedFromLog(dk);

/* Une journée compte comme active dès qu'une activité ou une séance y a
   été enregistrée. */
const jourActif = (dk) => { const d = dayStats(dk); return d.act || d.ses; };

export function currentStreak() {
  let n = 0, d = new Date();
  /* Si rien n'est encore enregistré aujourd'hui, la série court jusqu'à
     hier : la journée n'est pas finie, elle n'est pas rompue. */
  if (!jourActif(dateKey(d))) d = addDays(d, -1);
  while (jourActif(dateKey(d)) && n < 1000) { n++; d = addDays(d, -1); }
  return n;
}
export function bestStreak() {
  return memo("bestStreak", () => {
    const jours = [...index().entries()].filter(([, v]) => v.act || v.ses).map(([k]) => k).sort();
    if (!jours.length) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < jours.length; i++) {
      cur = dateKey(addDays(parseDateOnly(jours[i]), -1)) === jours[i - 1] ? cur + 1 : 1;
      if (cur > best) best = cur;
    }
    return best;
  });
}
export function bestDay() {
  let bestK = null, bestV = 0;
  for (const [k, v] of index()) if (v.burn > bestV) { bestV = v.burn; bestK = k; }
  return bestK ? { dateKey: bestK, kcal: bestV } : null;
}

/* Comparaison avec la semaine précédente, sur les jours déjà écoulés
   uniquement — comparer 7 jours à 3 n'aurait aucun sens. */
export function weekComparison() {
  const lundi = startOfWeek(new Date());
  const jours = Math.min(7, Math.floor((new Date() - lundi) / 86400000) + 1);
  const cumul = (depart) => {
    let act = 0, eat = 0, ses = 0;
    for (let i = 0; i < jours; i++) {
      const d = dayStats(dateKey(addDays(depart, i)));
      act += d.burn; eat += d.eat; if (d.ses) ses++;
    }
    return { act, eat, ses };
  };
  return { courante: cumul(lundi), precedente: cumul(addDays(lundi, -7)), jours };
}

export function weekSummary(date = new Date()) {
  const w = weekPlan(date);
  const planned = w.workout.filter((d) => d.training).length;
  const done = w.workout.filter((d) => dayStats(d.dateKey).ses).length;
  let burn = 0;
  for (const d of w.workout) burn += dayStats(d.dateKey).burn;
  return { planned, done, burn };
}

export function sortedWeights() {
  return memo("weights", () => store.state.weightLog.slice().sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1)));
}
export function lastWeighIn() {
  const w = sortedWeights();
  return w[w.length - 1] || null;
}
export const daysSince = (dk) => Math.round((parseDateOnly(todayKey()) - parseDateOnly(dk)) / 86400000);
