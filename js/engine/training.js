/* =========================================================================
   MOTEUR D'ENTRAÎNEMENT
   Construction du programme hebdomadaire, objectifs par exercice, calcul
   des calories et suivi de la charge. La logique de tirage est reprise à
   l'identique : une même semaine propose toujours les mêmes exercices.
   ========================================================================= */
import { EXERCISES } from "../data/exercises.js";
import { EXERCISE_PHOTOS } from "../data/exercise-photos.js";
import { store } from "../core/store.js";
import { addDays, dateKey, weekIndex, genId, hashStr, mulberry32, seededShuffle, fmtKg, fmtDateFr, parseDateOnly } from "../core/util.js";
import { GROUP_LABELS } from "./labels.js";

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
export const exerciseById = (id) => BY_ID.get(id) || null;
export { EXERCISES };

export function exercisePhotos(id) {
  const n = EXERCISE_PHOTOS[id] || 0;
  return Array.from({ length: n }, (_, i) => `assets/exercises/${id}-${i + 1}.webp`);
}

/* Fourchettes conseillées selon le niveau, affichées dans la fiche. Les
   maintiens isométriques se prescrivent en durée de tenue ; les mouvements
   continus non cardio (ciseaux, cercles de bras) en secondes. */
export const LEVEL_SETSREPS = { debutant: "2–3 séries × 10–12 reps", intermediaire: "3–4 séries × 8–12 reps", avance: "4–5 séries × 6–10 reps" };
export const LEVEL_SETSREPS_CARDIO = { debutant: "3 × 30–40 s", intermediaire: "4 × 40–50 s", avance: "5 × 45–60 s" };
export const LEVEL_SETSREPS_HOLD = { debutant: "2–3 × 20–30 s de tenue", intermediaire: "3 × 30–45 s de tenue", avance: "3–4 × 45–60 s de tenue" };
export const LEVEL_SETSREPS_TIMED = { debutant: "2–3 × 30–40 s", intermediaire: "3 × 40–50 s", avance: "3–4 × 50–60 s" };
export function rangeLabel(ex, level) {
  const t = ex.hold ? LEVEL_SETSREPS_HOLD : ex.cardio ? LEVEL_SETSREPS_CARDIO : ex.timed ? LEVEL_SETSREPS_TIMED : LEVEL_SETSREPS;
  return t[level] || t.debutant;
}

/* Équivalents METs approximatifs (Compendium of Physical Activities) pour
   les activités ajoutées à la main. kcal = MET × poids (kg) × durée (h).
   Pour les pas : ~0,0005 kcal/pas/kg (≈100 kcal pour 2000 pas à 75 kg). */
export const INTENSITY_MET = { legere: 3.5, moderee: 5.0, intense: 7.0 };
export const CARDIO_MET = { marche: 3.8, course: 9.0, velo: 7.5, natation: 7.0 };
const STEPS_KCAL_PER_STEP_PER_KG = 0.0005;

export function activityKcal(entry, weightKg) {
  if (entry.type === "exercice") return Math.round((INTENSITY_MET[entry.intensity] || 5.0) * weightKg * (entry.durationMin / 60));
  if (CARDIO_MET[entry.type]) return Math.round(CARDIO_MET[entry.type] * weightKg * (entry.durationMin / 60));
  if (entry.type === "pas") return Math.round(entry.steps * weightKg * STEPS_KCAL_PER_STEP_PER_KG);
  return 0;
}

/* Le niveau ne fixe pas le nombre de séances : il joue sur la difficulté
   des exercices (minLevel) et sur les séries/répétitions. Le nombre de
   séances et les zones prioritaires sont choisis par la personne. Le cardio
   n'apparaît que s'il est explicitement choisi. */
export const ALL_ZONES = ["jambes", "fessiers", "dos", "poitrine", "epaules", "bras", "abdos", "cardio"];
const DAY_SPREAD = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };
export function activeZones(profile) {
  let z = profile.focusZones && profile.focusZones.length ? profile.focusZones.slice() : ALL_ZONES.slice();
  z = z.filter((x) => ALL_ZONES.includes(x));
  /* Un profil importé ou ancien peut porter des zones devenues invalides :
     mieux vaut tout proposer qu'un programme vide. */
  return z.length ? z : ALL_ZONES.slice();
}

/* =========================================================================
   CONSTRUCTION DES SÉANCES
   — séparer haut et bas du corps plutôt que de tout mélanger chaque fois,
     ce qui laisse 48 h de récupération à chaque zone ;
   — au-delà de trois séances, distinguer chaîne postérieure (ischios,
     fessiers) et chaîne antérieure (quadriceps), qui ne récupèrent pas
     ensemble, et garder un rappel corps entier hebdomadaire.
   Jours : 0 = lundi … 6 = dimanche. Deux séances de jambes sont toujours
   séparées d'au moins deux jours.
   ========================================================================= */
const FULL = ["jambes", "fessiers", "dos", "poitrine", "epaules", "bras", "abdos"];
const SPLIT_PLANS = {
  1: { jours: [0], seances: [{ label: "Corps entier", groups: FULL, per: 1 }] },
  2: { jours: [0, 3], seances: [
    { label: "Bas du corps", groups: ["jambes", "fessiers", "abdos"], per: 2 },
    { label: "Haut du corps", groups: ["dos", "poitrine", "epaules", "bras"], per: 2 }] },
  3: { jours: [0, 2, 4], seances: [
    { label: "Bas du corps", groups: ["jambes", "fessiers", "abdos"], per: 2 },
    { label: "Haut du corps", groups: ["dos", "poitrine", "epaules", "bras"], per: 2 },
    { label: "Corps entier — rappel", groups: FULL, per: 1 }] },
  /* La poitrine rejoint la séance de poussée : sans séance corps entier,
     elle ne serait jamais travaillée. */
  4: { jours: [0, 1, 3, 4], seances: [
    { label: "Ischios / fessiers", groups: ["jambes", "fessiers"], per: 3, chain: "post" },
    { label: "Dos / abdos", groups: ["dos", "abdos"], per: 3 },
    { label: "Quadriceps / fessiers", groups: ["jambes", "fessiers"], per: 3, chain: "ant" },
    { label: "Poitrine / épaules / bras", groups: ["poitrine", "epaules", "bras"], per: 2 }] },
  5: { jours: [0, 1, 3, 4, 6], seances: [
    { label: "Ischios / fessiers", groups: ["jambes", "fessiers"], per: 3, chain: "post" },
    { label: "Dos / abdos", groups: ["dos", "abdos"], per: 3 },
    { label: "Quadriceps / fessiers", groups: ["jambes", "fessiers"], per: 3, chain: "ant" },
    { label: "Poitrine / épaules / bras", groups: ["poitrine", "epaules", "bras"], per: 2 },
    { label: "Corps entier — rappel", groups: FULL, per: 1 }] },
  6: { jours: [0, 1, 2, 3, 4, 6], seances: [
    { label: "Ischios / fessiers", groups: ["jambes", "fessiers"], per: 3, chain: "post" },
    { label: "Dos / abdos", groups: ["dos", "abdos"], per: 3 },
    { label: "Poitrine / bras", groups: ["poitrine", "bras"], per: 3 },
    { label: "Quadriceps / fessiers", groups: ["jambes", "fessiers"], per: 3, chain: "ant" },
    { label: "Épaules / dos", groups: ["epaules", "dos"], per: 3 },
    { label: "Corps entier — rappel", groups: FULL, per: 1 }] },
};

export function buildSessions(profile) {
  const zones = activeZones(profile);
  const n = Math.max(1, Math.min(6, profile.sessionsPerWeek || 3));
  /* Le découpage haut/bas n'a de sens que si la personne travaille
     effectivement l'ensemble du corps. Avec des zones ciblées, on garde la
     répartition par zones choisies. */
  const couvertureLarge = FULL.filter((g) => zones.includes(g)).length >= 5;
  let sessions = [], joursPlan = null;
  if (couvertureLarge) {
    const plan = SPLIT_PLANS[n] || SPLIT_PLANS[3];
    joursPlan = plan.jours;
    sessions = plan.seances.map((s) => {
      let gr = s.groups.filter((g) => zones.includes(g));
      if (!gr.length) gr = s.groups.slice();
      return { label: s.label, groups: gr, per: s.per, chain: s.chain };
    });
  } else if (n <= 3 || zones.length <= 2) {
    for (let i = 0; i < n; i++) {
      sessions.push({
        groups: zones.slice(), per: zones.length <= 2 ? 3 : zones.length <= 4 ? 2 : 1,
        label: zones.length <= 2 ? zones.map((g) => GROUP_LABELS[g]).join(" / ") : "Corps entier " + String.fromCharCode(65 + i),
      });
    }
  } else {
    const chunks = Array.from({ length: n }, () => []);
    zones.forEach((z, idx) => chunks[idx % n].push(z));
    chunks.forEach((cz, i) => {
      if (!cz.length) cz.push(zones[i % zones.length]);
      sessions.push({ groups: cz.slice(), per: cz.length <= 2 ? 3 : 2, label: cz.map((g) => GROUP_LABELS[g]).join(" / ") });
    });
  }
  const days = joursPlan || DAY_SPREAD[n] || DAY_SPREAD[3];
  sessions.forEach((s, i) => { s.day = days[i]; });
  return sessions;
}

/* Un polyarticulaire sollicite plusieurs muscles : le placer en fin de
   séance revient à l'aborder fatigué. L'isolation vient donc après, puis
   le cardio. */
function rangExercice(e) {
  if (e.group === "cardio") return 3;
  if (e.poly) return 0;
  if (e.iso) return 2;
  return 1;
}
const ordonnerSeance = (liste) => liste.slice().sort((a, b) => rangExercice(a) - rangExercice(b));
export const levelRank = (l) => ({ debutant: 1, intermediaire: 2, avance: 3 }[l] || 1);

/* Le profil déclare ce qu'on possède ; ce filtre dit ce qu'on utilise
   aujourd'hui. Il vit dans l'état, pas dans le profil : changer de salle
   ne devrait pas obliger à modifier son profil. */
export const materielPossible = () => ["poids_du_corps", ...(store.state.profile.equipment || [])];
export function filtreMateriel() {
  const possible = materielPossible();
  const f = (store.state.equipFilter || []).filter((e) => possible.includes(e));
  return f.length ? f : possible.slice(); /* rien de coché = tout */
}
export const filtreMaterielRestreint = () => filtreMateriel().length < materielPossible().length;

function equipmentSetFor(profile) {
  const set = { poids_du_corps: true };
  (profile.equipment || []).forEach((e) => { set[e] = true; });
  return set;
}

function pickExercisesForSession(split, profile, wIdx, avoidIds) {
  const eq = equipmentSetFor(profile);
  const lvl = levelRank(profile.level);
  const avoid = avoidIds || [];
  let chosen = [];
  split.groups.forEach((g) => {
    const autorise = filtreMateriel();
    let pool = EXERCISES.filter((e) => {
      if (e.group !== g || e.minLevel > lvl || !eq[e.equip]) return false;
      if (!autorise.includes(e.equip)) return false;
      /* Sur une séance ciblée ischios ou quadriceps, on ne retient que les
         mouvements de la chaîne concernée. */
      if (split.chain && g === "jambes" && e.chain && e.chain !== split.chain) return false;
      return true;
    });
    if (!pool.length) return;
    /* On écarte ce qui a été fait à la séance précédente, sauf si le choix
       devient trop maigre : mieux vaut répéter que ne rien proposer. */
    const fresh = pool.filter((e) => !avoid.includes(e.id));
    if (fresh.length >= split.per) pool = fresh;
    if (!pool.length) {
      pool = EXERCISES.filter((e) => {
        if (e.group !== g || e.minLevel > lvl || !eq[e.equip]) return false;
        if (split.chain && g === "jambes" && e.chain && e.chain !== split.chain) return false;
        return true;
      });
    }
    const rnd = mulberry32(hashStr(wIdx + "|" + split.day + "|" + g));
    /* On garantit une majorité de polyarticulaires dès la sélection, et on
       complète avec de l'isolation. */
    const polys = seededShuffle(pool.filter((e) => e.poly), rnd);
    const autres = seededShuffle(pool.filter((e) => !e.poly), rnd);
    const quotaPoly = Math.min(polys.length, Math.max(1, Math.ceil(split.per * 0.6)));
    let lot = polys.slice(0, quotaPoly);
    lot = lot.concat(autres.slice(0, split.per - lot.length));
    if (lot.length < split.per) lot = lot.concat(polys.slice(quotaPoly, quotaPoly + (split.per - lot.length)));
    chosen = chosen.concat(lot);
  });
  return ordonnerSeance(chosen);
}

export function generateWeekWorkout(monday, profile) {
  const wIdx = weekIndex(monday);
  const byDay = {};
  buildSessions(profile).forEach((s) => { byDay[s.day] = s; });
  const days = [];
  let prevIds = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const s = byDay[i];
    if (s) {
      const exs = pickExercisesForSession(s, profile, wIdx, prevIds);
      prevIds = exs.map((e) => e.id);
      days.push({ date: d, dateKey: dateKey(d), training: true, label: s.label, groups: s.groups, exercises: exs });
    } else {
      /* La mémoire de la dernière séance traverse les jours de repos. */
      days.push({ date: d, dateKey: dateKey(d), training: false, label: "Repos", exercises: [] });
    }
  }
  return days;
}

/* =========================================================================
   VALIDATION EXERCICE PAR EXERCICE
   Chaque exercice validé produit une entrée du journal d'activité. Les
   valeurs MET (effort léger ~3,5, modéré ~5, vigoureux ~6) incluent déjà
   les temps de repos entre séries.
   ========================================================================= */
const EXO_MET_BY_LEVEL = { 1: 3.5, 2: 5.0, 3: 6.0 };
const LEVEL_TARGETS = { debutant: { sets: 3, reps: 12 }, intermediaire: { sets: 4, reps: 12 }, avance: { sets: 5, reps: 10 } };
const LEVEL_TARGETS_CARDIO = { debutant: { sets: 3, reps: 35 }, intermediaire: { sets: 4, reps: 45 }, avance: { sets: 5, reps: 55 } };
const LEVEL_TARGETS_HOLD = { debutant: { sets: 3, reps: 25 }, intermediaire: { sets: 3, reps: 38 }, avance: { sets: 4, reps: 50 } };
const LEVEL_TARGETS_TIMED = { debutant: { sets: 3, reps: 35 }, intermediaire: { sets: 3, reps: 45 }, avance: { sets: 4, reps: 55 } };

export function exerciseTarget(ex, profile) {
  const bareme = ex.hold ? LEVEL_TARGETS_HOLD : ex.cardio ? LEVEL_TARGETS_CARDIO : ex.timed ? LEVEL_TARGETS_TIMED : LEVEL_TARGETS;
  const t = bareme[profile.level] || { sets: 3, reps: 12 };
  /* enSecondes couvre les cas où l'unité n'est pas la répétition. */
  return { sets: t.sets, reps: t.reps, cardio: !!ex.cardio, hold: !!ex.hold, timed: !!ex.timed, enSecondes: !!(ex.cardio || ex.hold || ex.timed) };
}
export function targetLabel(ex, profile) {
  const t = exerciseTarget(ex, profile);
  return t.enSecondes ? `${t.sets} × ${t.reps} s` : `${t.sets} × ${t.reps}`;
}

/* Récupération entre séries : plus longue sur les polyarticulaires et pour
   les niveaux avancés, qui travaillent plus lourd. */
export function restSeconds(ex, profile) {
  if (ex.cardio || ex.timed) return 30;
  const base = { debutant: 60, intermediaire: 75, avance: 90 }[profile.level] || 60;
  return ex.poly ? base : Math.max(45, base - 15);
}

export function exerciseMinutes(ex, sets, reps) {
  const workSec = ex.cardio || ex.hold || ex.timed ? reps : reps * 3;
  return sets * (workSec / 60 + 1.5);
}
export function exerciseKcal(ex, sets, reps, profile) {
  const met = (EXO_MET_BY_LEVEL[ex.minLevel] || 4.0) + (ex.cardio ? 1.5 : ex.hold ? 0.5 : 0);
  return Math.max(1, Math.round((met * profile.weightKg * exerciseMinutes(ex, sets, reps)) / 60));
}

/* Estimation d'une séance complète, pour l'annoncer avant de la démarrer. */
export function sessionEstimate(day, profile) {
  let min = 0, kcal = 0;
  for (const ex of day.exercises || []) {
    const t = exerciseTarget(ex, profile);
    min += exerciseMinutes(ex, t.sets, t.reps);
    kcal += exerciseKcal(ex, t.sets, t.reps, profile);
  }
  return { minutes: Math.round(min), kcal };
}

export function exerciseEntryFor(dk, exId) {
  return store.state.activityLog.find((e) => e.dateKey === dk && e.exId === exId) || null;
}
export function sessionProgress(day) {
  const ex = day.exercises || [];
  const done = ex.filter((e) => exerciseEntryFor(day.dateKey, e.id)).length;
  return { done, total: ex.length, pct: ex.length ? done / ex.length : 0 };
}
export const sessionDoneOn = (dk) => store.state.sessionLog.some((s) => s.dateKey === dk);

export function buildExerciseEntry(dk, ex, sets, reps) {
  const profile = store.state.profile;
  const t = exerciseTarget(ex, profile);
  const completion = Math.round((100 * (sets * reps)) / Math.max(1, t.sets * t.reps));
  return {
    id: genId("act"), dateKey: dk, type: "exercice", exId: ex.id, name: ex.name,
    durationMin: Math.max(1, Math.round(exerciseMinutes(ex, sets, reps))),
    intensity: ex.minLevel >= 3 ? "intense" : ex.minLevel === 2 ? "moderee" : "legere",
    kcal: exerciseKcal(ex, sets, reps, profile), auto: true, sets, reps, completion,
  };
}

/* Applique la validation dans l'état (sans enregistrer : l'appelant passe
   par commit()). */
export function applyValidation(state, dk, ex, sets, reps, load) {
  const entry = buildExerciseEntry(dk, ex, sets, reps);
  if (load > 0) entry.load = load;
  const i = state.activityLog.findIndex((e) => e.dateKey === dk && e.exId === ex.id);
  if (i >= 0) { entry.id = state.activityLog[i].id; state.activityLog[i] = entry; }
  else state.activityLog.push(entry);
  return entry;
}
export function applyUnvalidation(state, dk, exId) {
  state.activityLog = state.activityLog.filter((e) => !(e.dateKey === dk && e.exId === exId));
}
/* Terminer la séance : fillRemaining valide intégralement ce qui ne l'était
   pas encore (bouton « Tout valider ») ; le lecteur de séance, lui, ne
   compte que ce qui a réellement été fait. */
export function applySessionDone(state, dk, label, exercises, { fillRemaining = true, durationSec } = {}) {
  if (state.sessionLog.some((s) => s.dateKey === dk)) return false;
  const entry = { id: genId("s"), dateKey: dk, label };
  if (durationSec) entry.durationSec = Math.round(durationSec);
  state.sessionLog.push(entry);
  if (fillRemaining) {
    for (const ex of exercises || []) {
      if (state.activityLog.some((e) => e.dateKey === dk && e.exId === ex.id)) continue;
      const t = exerciseTarget(ex, state.profile);
      state.activityLog.push(buildExerciseEntry(dk, ex, t.sets, t.reps));
    }
  }
  return true;
}

/* =========================================================================
   SUIVI DE LA CHARGE
   Sans la charge utilisée, deux séances identiques en séries et
   répétitions sont indistinguables alors que l'une peut représenter une
   nette progression. La dernière valeur est rappelée à la saisie suivante.
   ========================================================================= */
export function historiqueCharge(exId, sauf) {
  return store.state.activityLog
    .filter((e) => e.exId === exId && e.load > 0 && e.dateKey !== sauf)
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}
export const derniereCharge = (exId, sauf) => historiqueCharge(exId, sauf)[0] || null;
/* La charge n'a de sens que sur un mouvement chargé. */
export const exercicePeutEtreCharge = (ex) => ex.equip === "halteres" || ex.equip === "machines" || ex.id === "j4" || ex.id === "f3";
export const formatCharge = fmtKg;
export function rappelCharge(ex, dk) {
  if (!exercicePeutEtreCharge(ex)) return "";
  const d = derniereCharge(ex.id, dk);
  if (!d) return "Première fois : note la charge pour comparer la prochaine fois.";
  return `Dernière fois : ${fmtKg(d.load)} · ${d.sets}×${d.reps} (${fmtDateFr(parseDateOnly(d.dateKey)).toLowerCase()})`;
}

export function exerciseKind(ex) {
  if (ex.group === "cardio" || ex.cardio) return "Cardio";
  if (ex.poly) return "Polyarticulaire";
  if (ex.iso) return "Isolation";
  return "Mouvement";
}
