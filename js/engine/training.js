/* =========================================================================
   MOTEUR D'ENTRAÎNEMENT
   Construction du programme hebdomadaire (tirage déterministe : une même
   semaine propose toujours les mêmes exercices), prescription selon
   l'objectif, progression automatique d'une séance à l'autre, dépense
   nette des activités, remplacement d'exercice, report de séance et
   volume hebdomadaire par groupe musculaire.
   ========================================================================= */
import { EXERCISES } from "../data/exercises.js";
import { EXERCISE_PHOTOS } from "../data/exercise-photos.js";
import { EXERCISE_MUSCLES } from "../data/muscles.js";
import { EXERCISE_ILLUSTRATIONS } from "../data/exercise-illustrations.js";
const ILLUSTRATED = new Set(EXERCISE_ILLUSTRATIONS);
import { store } from "../core/store.js";
import { on } from "../core/events.js";
import { addDays, dateKey, weekIndex, genId, hashStr, mulberry32, seededShuffle, fmtKg, fmtDateFr, parseDateOnly, todayKey, startOfWeek } from "../core/util.js";
import { GROUP_LABELS } from "./labels.js";

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));
/* Index par groupe : le tirage ne parcourt plus tout le catalogue. L'ordre
   du catalogue est conservé, le tirage reste donc déterministe. */
const BY_GROUP = new Map();
for (const e of EXERCISES) { if (!BY_GROUP.has(e.group)) BY_GROUP.set(e.group, []); BY_GROUP.get(e.group).push(e); }

/* Caches recalculés à chaque modification des données. */
const cache = new Map();
on("change", () => cache.clear());
function memo(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}
export const exerciseById = (id) => BY_ID.get(id) || null;
/* Ressemblance des muscles principaux de deux exercices (0 à 1). */
function muscleOverlap(a, b) {
  const pa = new Set(((EXERCISE_MUSCLES[a.id] || {}).p || []).map((r) => r.replace(/_[lr]$/, "")));
  const pb = new Set(((EXERCISE_MUSCLES[b.id] || {}).p || []).map((r) => r.replace(/_[lr]$/, "")));
  if (!pa.size || !pb.size) return 0;
  let inter = 0;
  for (const r of pa) if (pb.has(r)) inter++;
  return inter / (pa.size + pb.size - inter);
}
export { EXERCISES };
export const weekKeyOf = (dk) => dateKey(startOfWeek(parseDateOnly(dk)));

/* Démonstration : photos (départ, travail) ou, à défaut, illustrations
   dessinées dans le même format. */
export function exercisePhotos(id) {
  const n = EXERCISE_PHOTOS[id] || 0;
  if (n) return Array.from({ length: n }, (_, i) => `assets/exercises/${id}-${i + 1}.webp`);
  return ILLUSTRATED.has(id) ? [`assets/exercises/${id}-1.svg`, `assets/exercises/${id}-2.svg`] : [];
}

/* =========================================================================
   DÉPENSE DES ACTIVITÉS LIBRES
   Toutes les dépenses sont NETTES : la part du métabolisme de repos
   (1 MET) est retirée, puisqu'elle est déjà comptée dans la dépense de base
   de la journée — une heure de marche n'est plus comptée deux fois.
   Quand la distance est connue, elle prime sur la durée : le coût de la
   course (~1 kcal/kg/km) et de la marche (~0,5 kcal/kg/km net) dépend de
   la distance bien plus que de l'allure.
   ========================================================================= */
export const INTENSITY_MET = { legere: 3.5, moderee: 5.0, intense: 7.0 };
export const CARDIO_MET = { marche: 3.8, course: 9.0, velo: 7.5, natation: 7.0 };
const netMet = (met) => Math.max(0, met - 1);
function veloMet(kmh) {
  if (kmh < 16) return 6.0;
  if (kmh < 19) return 8.0;
  if (kmh < 22) return 10.0;
  return 12.0;
}

export function activityKcal(entry, weightKg, heightCm = 170) {
  const h = (entry.durationMin || 0) / 60;
  const km = entry.distanceKm > 0 ? entry.distanceKm : 0;
  switch (entry.type) {
    case "exercice": return Math.round(netMet(INTENSITY_MET[entry.intensity] || 5.0) * weightKg * h);
    case "course": return Math.round((km ? 0.95 * km : netMet(CARDIO_MET.course) * h) * weightKg);
    case "marche": return Math.round((km ? 0.5 * km : netMet(CARDIO_MET.marche) * h) * weightKg);
    case "velo": return Math.round(netMet(km && h ? veloMet(km / h) : CARDIO_MET.velo) * weightKg * h);
    case "natation": return Math.round(netMet(CARDIO_MET.natation) * weightKg * h);
    case "pas": {
      /* Foulée ≈ 41,5 % de la taille, marche ≈ 0,5 kcal/kg/km net. */
      const dist = (entry.steps * heightCm * 0.415) / 100000;
      return Math.round(0.5 * weightKg * dist);
    }
    default: return 0;
  }
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
    let pool = (BY_GROUP.get(g) || []).filter((e) => {
      if (e.minLevel > lvl || !eq[e.equip]) return false;
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
      pool = (BY_GROUP.get(g) || []).filter((e) => {
        if (e.minLevel > lvl || !eq[e.equip]) return false;
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
      days.push({ date: d, dateKey: dateKey(d), training: true, label: s.label, groups: s.groups, chain: s.chain, exercises: exs });
    } else {
      /* La mémoire de la dernière séance traverse les jours de repos. */
      days.push({ date: d, dateKey: dateKey(d), training: false, label: "Repos", exercises: [] });
    }
  }
  applyMoves(days);
  applySwaps(days);
  return days;
}

/* ---------- Séance déplacée ----------
   Une séance manquée en début de semaine peut être reportée sur un jour de
   repos : le programme garde les mêmes exercices, simplement décalés. */
function applyMoves(days) {
  const moves = store.state.sessionMoves || {};
  for (const [from, to] of Object.entries(moves)) {
    const i = days.findIndex((d) => d.dateKey === from);
    const j = days.findIndex((d) => d.dateKey === to);
    if (i < 0 || j < 0 || !days[i].training || days[j].training) continue;
    const src = days[i];
    days[j] = { ...src, date: days[j].date, dateKey: to, movedFrom: from };
    days[i] = { date: src.date, dateKey: from, training: false, label: "Repos", exercises: [], movedTo: to };
  }
}

/* ---------- Exercice remplacé ----------
   Un exercice écarté (matériel occupé, gêne, envie de changer) est mémorisé
   pour ce jour-là ; le remplaçant garde la place de l'original. */
function applySwaps(days) {
  const swaps = store.state.exerciseSwaps || {};
  for (const d of days) {
    if (!d.training) continue;
    d.exercises = d.exercises.map((ex) => {
      const alt = exerciseById(swaps[d.dateKey + "|" + ex.id]);
      return alt ? Object.assign(Object.create(alt), { swappedFrom: ex.id }) : ex;
    });
  }
}

/* Remplaçants possibles : même groupe musculaire, matériel disponible,
   niveau accessible, même chaîne pour les jambes ; les mouvements de même
   nature (polyarticulaire / isolation) et illustrés passent en premier. */
export function swapCandidates(day, ex) {
  const profile = store.state.profile;
  const lvl = levelRank(profile.level);
  const eq = equipmentSetFor(profile);
  const actifs = filtreMateriel();
  const used = new Set(day.exercises.map((e) => e.id));
  const origin = ex.swappedFrom ? exerciseById(ex.swappedFrom) : ex;
  return (BY_GROUP.get(ex.group) || [])
    .filter((e) => !used.has(e.id) && e.minLevel <= lvl && eq[e.equip] && (!origin.chain || !e.chain || e.chain === origin.chain))
    .map((e) => ({ e, score: 6 * muscleOverlap(e, origin) + (!!e.poly === !!origin.poly ? 3 : 0) + (actifs.includes(e.equip) ? 2 : 0) + ((EXERCISE_PHOTOS[e.id] || 0) ? 1 : 0) + (e.minLevel === origin.minLevel ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name, "fr"))
    .slice(0, 8)
    .map((x) => x.e);
}

/* Séances prévues avant ce jour dans la semaine, ni faites ni commencées. */
export function missedSessions(week, dk = todayKey()) {
  return week.filter((d) => d.training && d.dateKey < dk && !d.movedFrom
    && !store.state.sessionLog.some((s) => s.dateKey === d.dateKey)
    && !store.state.activityLog.some((e) => e.dateKey === d.dateKey && e.exId));
}
export function canMoveSession(week, from, to) {
  const a = week.find((d) => d.dateKey === from);
  const b = week.find((d) => d.dateKey === to);
  return !!(a && b && a.training && !b.training && from < to && missedSessions(week, to).some((d) => d.dateKey === from));
}

/* Proposition de report : la plus ancienne séance manquée de la semaine
   vers le premier jour de repos à venir (aujourd'hui compris). */
export function moveSuggestion(week, dk = todayKey()) {
  const missed = missedSessions(week, dk);
  if (!missed.length) return null;
  const target = week.find((d) => !d.training && d.dateKey >= dk);
  return target ? { from: missed[0], to: target.dateKey } : null;
}

/* =========================================================================
   VOLUME HEBDOMADAIRE PAR GROUPE MUSCULAIRE
   Repère de séries effectives par groupe et par semaine (Schoenfeld 2017,
   ACSM) : 6 à 10 pour débuter, 10 à 16 puis 12 à 20 avec l'expérience.
   ========================================================================= */
const VOLUME_RANGE = { debutant: [6, 10], intermediaire: [10, 16], avance: [12, 20] };
export function weeklyVolume(week) {
  const profile = store.state.profile;
  const [lo, hi] = VOLUME_RANGE[profile.level] || VOLUME_RANGE.debutant;
  const zones = activeZones(profile).filter((g) => g !== "cardio");
  const rows = zones.map((g) => ({ group: g, planned: 0, done: 0, lo, hi }));
  const byGroup = new Map(rows.map((r) => [r.group, r]));
  for (const d of week) {
    for (const ex of d.exercises || []) {
      const r = byGroup.get(ex.group);
      if (!r) continue;
      r.planned += prescription(ex, profile, d.dateKey).sets;
      const entry = store.state.activityLog.find((e) => e.dateKey === d.dateKey && e.exId === ex.id);
      if (entry) r.done += entry.sets;
    }
  }
  for (const r of rows) r.status = r.planned < lo ? "low" : r.planned > hi ? "high" : "ok";
  return rows;
}

/* =========================================================================
   VALIDATION EXERCICE PAR EXERCICE
   Chaque exercice validé produit une entrée du journal d'activité. Les
   valeurs MET (effort léger ~3,5, modéré ~5, vigoureux ~6) incluent déjà
   les temps de repos entre séries.
   ========================================================================= */
/* ---------- Prescription selon l'objectif ----------
   La fourchette de répétitions dépend de l'objectif (ACSM) : charges
   lourdes et repos longs pour la prise de muscle, séries plus longues et
   repos courts pour la perte de poids. Le niveau règle le nombre de séries.
   Les exercices en secondes gardent leur barème par niveau. */
const GOAL_REPS = {
  prise: { poly: [6, 10], iso: [8, 12], rest: { poly: 120, iso: 75 } },
  maintien: { poly: [8, 12], iso: [10, 12], rest: { poly: 90, iso: 60 } },
  tonification: { poly: [8, 12], iso: [12, 15], rest: { poly: 75, iso: 60 } },
  perte: { poly: [10, 15], iso: [12, 15], rest: { poly: 60, iso: 45 } },
};
const LEVEL_SETS = { debutant: { poly: 3, iso: 2 }, intermediaire: { poly: 4, iso: 3 }, avance: { poly: 5, iso: 4 } };
const LEVEL_TARGETS_CARDIO = { debutant: { sets: 3, reps: 35 }, intermediaire: { sets: 4, reps: 45 }, avance: { sets: 5, reps: 55 } };
const LEVEL_TARGETS_HOLD = { debutant: { sets: 3, reps: 25 }, intermediaire: { sets: 3, reps: 38 }, avance: { sets: 4, reps: 50 } };
const LEVEL_TARGETS_TIMED = { debutant: { sets: 3, reps: 35 }, intermediaire: { sets: 3, reps: 45 }, avance: { sets: 4, reps: 55 } };
/* Paliers de charge : 2 kg par haltère, 5 kg sur machine. */
const loadStep = (ex) => (ex.equip === "machines" ? 5 : 2);
const roundLoad = (kg, step) => Math.max(0, Math.round(kg / step) * step);

function basePrescription(ex, profile) {
  const timed = !!(ex.cardio || ex.hold || ex.timed);
  const kind = ex.poly ? "poly" : "iso";
  let sets, lo, hi, rest;
  if (timed) {
    const bareme = ex.hold ? LEVEL_TARGETS_HOLD : ex.cardio ? LEVEL_TARGETS_CARDIO : LEVEL_TARGETS_TIMED;
    const b = bareme[profile.level] || bareme.debutant;
    sets = b.sets; lo = b.reps; hi = b.reps + 15;
    if (ex.cardio && profile.goal === "perte") { lo += 5; hi += 5; }
    rest = ex.hold ? 45 : 30;
  } else {
    const g = GOAL_REPS[profile.goal] || GOAL_REPS.maintien;
    [lo, hi] = g[kind];
    sets = (LEVEL_SETS[profile.level] || LEVEL_SETS.debutant)[kind];
    rest = g.rest[kind] + (profile.level === "avance" && kind === "poly" ? 15 : 0);
  }
  return {
    sets, reps: timed ? lo : Math.round((lo + hi) / 2), lo, hi, rest, load: 0,
    cardio: !!ex.cardio, hold: !!ex.hold, timed: !!ex.timed, enSecondes: timed,
    trend: "start", note: "",
  };
}

/* Dernière performance enregistrée AVANT ce jour. */
function lastPerformance(exId, dk) {
  const list = memo("perf:" + exId, () => store.state.activityLog
    .filter((e) => e.exId === exId && e.sets > 0 && e.reps > 0)
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)));
  return list.find((e) => e.dateKey < dk) || null;
}

/* Variante plus difficile pour un mouvement au poids du corps maîtrisé :
   même groupe, même matériel, même nature, niveau supérieur ; le nom en
   commun (« Pompes … ») départage. */
export function harderVariant(ex) {
  const word = ex.name.split(/[\s«(]/)[0].toLowerCase();
  const lvl = levelRank(store.state.profile.level);
  const candidates = (BY_GROUP.get(ex.group) || [])
    .filter((e) => e.id !== ex.id && e.equip === ex.equip && !!e.poly === !!ex.poly && !!e.hold === !!ex.hold
      && e.minLevel > ex.minLevel && e.minLevel <= lvl && (!ex.chain || !e.chain || e.chain === ex.chain))
    .map((e) => ({ e, overlap: muscleOverlap(e, ex), sameWord: e.name.toLowerCase().startsWith(word) }))
    /* Même muscle principal exigé : une variante doit travailler la même
       chose, plus fort. */
    .filter((x) => x.overlap >= 0.5 || x.sameWord)
    .sort((a, b) => (b.sameWord - a.sameWord) || (b.overlap - a.overlap) || (a.e.minLevel - b.e.minLevel));
  return candidates.length ? candidates[0].e : null;
}

/* =========================================================================
   PROGRESSION AUTOMATIQUE (double progression)
   À partir de la dernière séance de l'exercice :
   — objectif atteint sous le haut de la fourchette : +1 répétition ;
   — haut de la fourchette atteint : charge augmentée d'un palier et retour
     au bas de la fourchette (ou variante plus difficile au poids du corps) ;
   — objectif presque atteint (80–99 %) : on consolide ;
   — nettement manqué (< 80 %) : charge allégée de 10 % ;
   — plus de 3 semaines sans le faire : reprise à -10 %.
   ========================================================================= */
export function prescription(ex, profile, dk = null) {
  return memo(`rx:${ex.id}|${dk || ""}|${profile.goal}|${profile.level}`, () => {
    const rx = basePrescription(ex, profile);
    if (!dk) return rx;
    const chargeable = exercicePeutEtreCharge(ex);
    const last = lastPerformance(ex.id, dk);
    if (!last) {
      rx.note = rx.enSecondes ? "Première fois : tiens la durée indiquée, sans forcer."
        : chargeable ? "Première fois : choisis une charge qui laisse 2 répétitions en réserve."
        : "Première fois : garde 2 répétitions en réserve sur chaque série.";
      return rx;
    }
    const lastLoad = last.load > 0 ? last.load : 0;
    const completion = typeof last.completion === "number" ? last.completion : 100;
    const gapDays = Math.round((parseDateOnly(dk) - parseDateOnly(last.dateKey)) / 86400000);
    rx.last = { dateKey: last.dateKey, sets: last.sets, reps: last.reps, load: lastLoad, completion };
    rx.load = lastLoad;
    if (gapDays > 21) {
      rx.reps = Math.max(rx.lo, Math.min(rx.hi, last.reps));
      if (lastLoad) rx.load = roundLoad(lastLoad * 0.9, loadStep(ex) / 2);
      rx.trend = "down";
      rx.note = `Reprise après ${Math.round(gapDays / 7)} semaines : on repart un peu plus léger.`;
      return rx;
    }
    if (rx.enSecondes) {
      if (completion >= 100 && last.reps >= rx.hi) { rx.reps = rx.hi; rx.sets += 1; rx.trend = "up"; rx.note = "Durée maximale atteinte : une série de plus."; }
      else if (completion >= 100) { rx.reps = Math.min(rx.hi, last.reps + 5); rx.trend = "up"; rx.note = "+5 secondes par série par rapport à la dernière fois."; }
      else if (completion >= 80) { rx.reps = Math.max(rx.lo, last.reps); rx.trend = "same"; rx.note = "Consolide : même durée que la dernière fois."; }
      else { rx.reps = Math.max(rx.lo - 10, last.reps - 5); rx.trend = "down"; rx.note = "Durée réduite pour finir toutes tes séries."; }
      return rx;
    }
    if (completion >= 100 && last.reps >= rx.hi) {
      if (chargeable) {
        rx.load = lastLoad ? roundLoad(lastLoad + loadStep(ex), 0.5) : 0;
        rx.reps = rx.lo;
        rx.trend = "load";
        rx.note = lastLoad ? `Haut de la fourchette atteint : passe à ${fmtKg(rx.load)} et reprends à ${rx.lo} répétitions.`
          : "Haut de la fourchette atteint : augmente la charge et note-la.";
      } else {
        const v = harderVariant(ex);
        rx.reps = rx.hi;
        rx.trend = "variant";
        rx.variant = v ? v.id : null;
        rx.note = v ? `Tu maîtrises ce mouvement : essaie « ${v.name} ».` : "Tu maîtrises ce mouvement : ralentis la descente (3 secondes).";
      }
    } else if (completion >= 100) {
      rx.reps = Math.min(rx.hi, Math.max(rx.lo, last.reps + 1));
      rx.trend = "up";
      rx.note = `+1 répétition par série par rapport à la dernière fois${lastLoad ? ` à ${fmtKg(lastLoad)}` : ""}.`;
    } else if (completion >= 80) {
      rx.reps = Math.max(rx.lo, Math.min(rx.hi, last.reps));
      rx.trend = "same";
      rx.note = "Presque ! Même objectif que la dernière fois.";
    } else {
      rx.reps = Math.max(rx.lo, Math.min(rx.hi, last.reps));
      if (chargeable && lastLoad) rx.load = roundLoad(lastLoad * 0.9, loadStep(ex) / 2);
      rx.trend = "down";
      rx.note = chargeable && lastLoad ? `Allège à ${fmtKg(rx.load)} pour finir toutes tes séries.` : "Objectif ajusté pour finir toutes tes séries.";
    }
    return rx;
  });
}
/* Compatibilité : l'objectif d'un exercice, personnalisé si le jour est connu. */
export const exerciseTarget = (ex, profile, dk = null) => prescription(ex, profile, dk);

export function targetLabel(ex, profile, dk = null) {
  const t = prescription(ex, profile, dk);
  return `${t.sets} × ${t.reps}${t.enSecondes ? " s" : ""}`;
}
export function rangeLabel(ex, profile) {
  const t = basePrescription(ex, profile);
  return t.enSecondes ? `${t.lo}–${t.hi} s par série` : `${t.lo}–${t.hi} répétitions`;
}
export const restSeconds = (ex, profile, dk = null) => prescription(ex, profile, dk).rest;

/* Durée réelle : travail (≈ 3 s par répétition) + repos entre séries +
   une minute de mise en place. */
export function exerciseMinutes(ex, sets, reps, rest = 60) {
  const workSec = ex.cardio || ex.hold || ex.timed ? reps : reps * 3;
  return (sets * workSec + Math.max(0, sets - 1) * rest + 60) / 60;
}
/* MET du Compendium (repos inclus) : renforcement vigoureux ~5–6,
   isolation ~3,5, circuit cardio ~8, gainage ~3,8. Dépense nette. */
function exerciseMet(ex, profile) {
  const base = ex.cardio || ex.group === "cardio" ? 8.0 : ex.hold ? 3.8 : ex.poly ? 5.0 : 3.5;
  return base * ({ debutant: 0.9, intermediaire: 1.0, avance: 1.1 }[profile.level] || 1);
}
export function exerciseKcal(ex, sets, reps, profile, rest) {
  const r = rest || basePrescription(ex, profile).rest;
  return Math.max(1, Math.round((netMet(exerciseMet(ex, profile)) * profile.weightKg * exerciseMinutes(ex, sets, reps, r)) / 60));
}

/* Estimation d'une séance complète, pour l'annoncer avant de la démarrer. */
export function sessionEstimate(day, profile) {
  let min = 0, kcal = 0;
  for (const ex of day.exercises || []) {
    const t = prescription(ex, profile, day.dateKey);
    min += exerciseMinutes(ex, t.sets, t.reps, t.rest);
    kcal += exerciseKcal(ex, t.sets, t.reps, profile, t.rest);
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
  const t = prescription(ex, profile, dk);
  const completion = Math.round((100 * (sets * reps)) / Math.max(1, t.sets * t.reps));
  return {
    id: genId("act"), dateKey: dk, type: "exercice", exId: ex.id, name: ex.name,
    durationMin: Math.max(1, Math.round(exerciseMinutes(ex, sets, reps, t.rest))),
    intensity: ex.minLevel >= 3 ? "intense" : ex.minLevel === 2 ? "moderee" : "legere",
    kcal: exerciseKcal(ex, sets, reps, profile, t.rest), auto: true, sets, reps, completion,
    /* L'objectif du jour est conservé : la progression suivante s'appuie
       sur ce qui était demandé, pas seulement sur ce qui a été fait. */
    targetSets: t.sets, targetReps: t.reps,
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
      const t = prescription(ex, state.profile, dk);
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
export function exercicePeutEtreCharge(ex) { return ex.equip === "halteres" || ex.equip === "machines" || ex.id === "j4" || ex.id === "f3"; }
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
