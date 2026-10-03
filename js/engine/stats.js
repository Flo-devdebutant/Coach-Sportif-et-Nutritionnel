/* =========================================================================
   STATISTIQUES ET PLAN DE LA SEMAINE
   Tout ce qui se déduit de l'état est recalculé à la demande puis mis en
   cache jusqu'à la prochaine modification : seules les vues affichées
   paient le calcul, et une seule fois.
   ========================================================================= */
import { store } from "../core/store.js";
import { on } from "../core/events.js";
import { addDays, dateKey, parseDateOnly, startOfWeek, todayKey } from "../core/util.js";
import { computeTargets, computeBurnTarget, generateWeekMeals, formulaTdee, cyclingFactors, dayKcal } from "./nutrition.js";
import { generateWeekWorkout } from "./training.js";

const cache = new Map();
on("change", () => cache.clear());
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/* Objectifs de base (moyenne quotidienne de la semaine). Avec le
   métabolisme adaptatif activé, la dépense observée remplace la formule. */
export const targets = () => memo("targets", () => {
  const p = store.state.profile;
  const m = p.adaptive ? metabolism() : null;
  return computeTargets(p, { tdee: m && m.usable ? m.blended : null });
});
export const burnTarget = () => memo("burnTarget", () => computeBurnTarget(store.state.profile));
/* Dépense de base (métabolisme + mouvements courants), distincte des
   activités enregistrées pour éviter un double comptage. */
export const baseDailyBurn = () => memo("baseBurn", () => Math.round(targets().bmr * 1.1));

function cycleFor(workout) {
  const p = store.state.profile;
  if (p.calorieCycling === false) return null;
  const f = cyclingFactors(workout.filter((d) => d.training).length);
  /* Pas de cyclage si le jour de repos passait sous le minimum usuel. */
  if (f && Math.round(targets().kcal * (1 - f.down)) < targets().minKcal) return null;
  return f;
}
export function weekPlan(date) {
  const monday = startOfWeek(date);
  const mk = dateKey(monday);
  return memo("week:" + mk, () => {
    const workout = generateWeekWorkout(monday, store.state.profile);
    const f = cycleFor(workout);
    const kcalFor = (dk) => dayKcal(targets(), !!(workout.find((d) => d.dateKey === dk) || {}).training, f).kcal;
    return { monday, mondayKey: mk, workout, cycle: f, meals: generateWeekMeals(monday, kcalFor, store.state.profile) };
  });
}
/* Objectifs d'un jour précis : cyclage calorique compris. */
export function dayTargets(dk) {
  return memo("dayT:" + dk, () => {
    const w = weekPlan(parseDateOnly(dk));
    const day = w.workout.find((d) => d.dateKey === dk);
    return dayKcal(targets(), !!(day && day.training), w.cycle);
  });
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

/* =========================================================================
   TENDANCE DU POIDS
   Régression linéaire sur les pesées des 28 derniers jours : une pesée
   isolée varie de ±1 kg (eau, sel, digestion), la pente, elle, est fiable.
   ========================================================================= */
function regression(points) {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p[0], 0) / n;
  const my = points.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of points) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  const slope = den ? num / den : 0;
  return { slope, at: (x) => my + slope * (x - mx) };
}
const dayNum = (dk) => Math.round(parseDateOnly(dk).getTime() / 86400000);

export function weightTrend(days = 28) {
  return memo("trend:" + days, () => {
    const today = dayNum(todayKey());
    const pts = sortedWeights().filter((w) => today - dayNum(w.dateKey) <= days).map((w) => [dayNum(w.dateKey), w.weightKg]);
    if (pts.length < 3) return null;
    const span = pts[pts.length - 1][0] - pts[0][0];
    if (span < 10) return null;
    const r = regression(pts);
    return {
      perWeek: r.slope * 7, perDay: r.slope, current: r.at(today), span, count: pts.length,
      pctPerWeek: (100 * r.slope * 7) / r.at(today),
    };
  });
}

/* =========================================================================
   MÉTABOLISME ADAPTATIF
   Dépense réelle = apports moyens − variation du poids × 7700 kcal/kg.
   Calculée sur 28 jours, seulement avec des journées vraisemblablement
   complètes (au moins la moitié de l'objectif saisie), au moins 10 jours
   d'apports et 3 pesées sur 10 jours. Le résultat est mêlé à la formule
   en proportion de la confiance, et écarté s'il est invraisemblable
   (saisies incomplètes le plus souvent).
   ========================================================================= */
export function metabolism() {
  return memo("metabolism", () => {
    const p = store.state.profile;
    const formula = Math.round(formulaTdee(p));
    const ref = computeTargets(p).kcal;
    const out = { formula, observed: null, blended: formula, confidence: null, days: 0, usable: false, reason: "" };
    const today = parseDateOnly(todayKey());
    const intakes = [];
    for (let i = 1; i <= 28; i++) {
      const d = dayStats(dateKey(addDays(today, -i)));
      if (d.eat >= ref * 0.5) intakes.push(d.eat);
    }
    out.days = intakes.length;
    const trend = weightTrend(28);
    if (intakes.length < 10) { out.reason = "intake"; return out; }
    if (!trend) { out.reason = "weight"; return out; }
    const avg = intakes.reduce((a, b) => a + b, 0) / intakes.length;
    const observed = avg - trend.perDay * 7700;
    const ratio = observed / formula;
    out.observed = Math.round(observed / 10) * 10;
    out.avgIntake = Math.round(avg);
    if (ratio < 0.7 || ratio > 1.3) { out.reason = "implausible"; return out; }
    out.confidence = intakes.length >= 21 && trend.count >= 6 ? "high" : intakes.length >= 14 && trend.count >= 4 ? "medium" : "low";
    const w = { high: 0.8, medium: 0.55, low: 0.3 }[out.confidence];
    out.blended = Math.round((formula + w * (observed - formula)) / 10) * 10;
    out.usable = true;
    return out;
  });
}

/* =========================================================================
   OBJECTIF DE POIDS
   Rythme prévu (déficit ou surplus ÷ 7700) et rythme observé (tendance).
   ========================================================================= */
export function weightProjection() {
  return memo("projection", () => {
    const p = store.state.profile;
    const t = targets();
    const trend = weightTrend(28);
    const current = trend ? trend.current : p.weightKg;
    const goal = p.targetWeightKg > 0 ? p.targetWeightKg : null;
    const plannedPerWeek = (t.adjust * 7) / 7700;
    const res = { goal, current, plannedPerWeek, trend, status: "none", etaWeeks: null, plannedWeeks: null };
    if (!goal) return res;
    const remaining = goal - current;
    if (Math.abs(remaining) < 0.3) { res.status = "reached"; return res; }
    const dir = Math.sign(remaining);
    if (plannedPerWeek && Math.sign(plannedPerWeek) === dir) res.plannedWeeks = Math.ceil(remaining / plannedPerWeek);
    if (!trend) { res.status = "nodata"; return res; }
    const rate = trend.perWeek;
    if (Math.abs(rate) < 0.1) res.status = trend.span >= 14 ? "stalled" : "nodata";
    else if (Math.sign(rate) !== dir) res.status = "wrongway";
    else {
      res.etaWeeks = Math.ceil(remaining / rate);
      res.status = dir < 0 && trend.pctPerWeek < -1 ? "toofast" : dir > 0 && trend.pctPerWeek > 0.5 ? "toofast" : "ontrack";
    }
    return res;
  });
}
