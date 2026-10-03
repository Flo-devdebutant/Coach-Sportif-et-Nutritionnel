/* =========================================================================
   MOTEUR NUTRITIONNEL
   Besoins (Mifflin-St Jeor + ajustement selon l'objectif), choix des plats
   de la semaine, remplacements, repères de cuisson, répertoire d'aliments
   et liste de courses. Le tirage des menus est repris à l'identique.
   ========================================================================= */
import { MEALS } from "../data/meals.js";
import { COOKING_NOTES } from "../data/cooking.js";
import { FOOD_REF, FOOD_CATS } from "../data/foods.js";
import { store } from "../core/store.js";
import { addDays, dateKey, hashStr, mulberry32, normTxt } from "../core/util.js";

export { FOOD_CATS };

/* ---------- Besoins quotidiens ----------
   Métabolisme de base : Mifflin-St Jeor. L'écart à la maintenance est un
   POURCENTAGE de la dépense, borné : −500 kcal pèsent bien plus pour un
   petit gabarit que pour un grand. Repères : perte ≈ −20 % (0,5 à 1 % du
   poids par semaine), recomposition ≈ −10 %, prise ≈ +10 % (surplus
   modéré pour limiter la prise de gras).
   Protéines (ISSN 2017) : 1,6 à 2,2 g/kg, rapportées à un poids de
   référence plafonné à un IMC de 27 pour ne pas surestimer les besoins
   en cas de surpoids. Lipides : au moins 0,7 g/kg de référence. */
const ACTIVITY_FACTORS = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725 };
const GOAL_PARAMS = {
  perte: { pct: -0.20, min: -750, max: -300, proteinPerKg: 2.0, fatPct: 0.28 },
  prise: { pct: 0.10, min: 200, max: 450, proteinPerKg: 1.8, fatPct: 0.25 },
  tonification: { pct: -0.10, min: -350, max: -150, proteinPerKg: 2.0, fatPct: 0.27 },
  maintien: { pct: 0, min: 0, max: 0, proteinPerKg: 1.6, fatPct: 0.30 },
};
const SEX_FLOOR = { H: 1500, F: 1300 };

export function computeBmr(p) {
  return p.sex === "H"
    ? 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + 5
    : 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age - 161;
}
export const formulaTdee = (p) => computeBmr(p) * (ACTIVITY_FACTORS[p.activity] || 1.375);
/* Poids de référence pour les besoins en protéines et en lipides. */
export const referenceWeight = (p) => Math.min(p.weightKg, 27 * (p.heightCm / 100) ** 2);

/* opts.tdee : dépense observée (métabolisme adaptatif) à la place de la
   formule. */
export function computeTargets(p, opts = {}) {
  const bmr = computeBmr(p);
  const formula = formulaTdee(p);
  const tdee = opts.tdee > 0 ? opts.tdee : formula;
  const gp = GOAL_PARAMS[p.goal] || GOAL_PARAMS.maintien;
  const adjust = gp.pct ? Math.max(gp.min, Math.min(gp.max, gp.pct * tdee)) : 0;
  let kcal = tdee + adjust;
  /* Plancher : jamais sous le métabolisme de base ni sous le minimum
     usuel (1500 / 1300 kcal), sauf si la maintenance elle-même est plus
     basse. */
  const floor = Math.min(Math.max(SEX_FLOOR[p.sex] || 1300, bmr), Math.max(tdee, SEX_FLOOR[p.sex] || 1300));
  let floorApplied = false;
  if (kcal < floor) { kcal = floor; floorApplied = true; }
  const ref = referenceWeight(p);
  const proteinG = gp.proteinPerKg * ref;
  const fatKcal = Math.max(kcal * gp.fatPct, 0.7 * ref * 9);
  const carbKcal = Math.max(0, kcal - proteinG * 4 - fatKcal);
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), formulaTdee: Math.round(formula), kcal: Math.round(kcal),
    adjust: Math.round(kcal - tdee), floor: Math.round(floor), minKcal: SEX_FLOOR[p.sex] || 1300,
    proteinG: Math.round(proteinG), fatG: Math.round(fatKcal / 9), carbG: Math.round(carbKcal / 4),
    floorApplied, adaptive: opts.tdee > 0,
  };
}

/* Cyclage calorique : un peu plus les jours d'entraînement, un peu moins
   les jours de repos, sans changer la moyenne de la semaine. Le surplus
   passe par les glucides, qui alimentent l'effort ; protéines et lipides
   restent fixes. */
export function cyclingFactors(trainingDays) {
  const t = trainingDays;
  if (t <= 0 || t >= 7) return null;
  const up = Math.min(0.07, (0.10 * (7 - t)) / t);
  return { up, down: (up * t) / (7 - t) };
}
export function dayKcal(base, training, factors) {
  if (!factors) return { ...base, cycle: null };
  const k = Math.round(base.kcal * (training ? 1 + factors.up : 1 - factors.down));
  return { ...base, kcal: k, carbG: Math.max(0, Math.round(base.carbG + (k - base.kcal) / 4)), cycle: training ? "up" : "down" };
}

/* Idées pour combler un manque de protéines, selon le régime et les
   intolérances (≈ 20 g chacune). */
const PROTEIN_IDEAS = [
  { label: "un skyr ou un fromage blanc (200 g)", diet: "vegetarien", allergen: "lactose" },
  { label: "3 œufs durs", diet: "vegetarien", allergen: "oeufs" },
  { label: "une boîte de thon au naturel", diet: "omnivore", allergen: "poisson" },
  { label: "100 g de blanc de poulet", diet: "omnivore", allergen: null },
  { label: "150 g de tofu ferme", diet: "vegan", allergen: "soja" },
  { label: "250 g de lentilles ou pois chiches cuits", diet: "vegan", allergen: null },
  { label: "40 g de graines de courge et une poignée d'amandes", diet: "vegan", allergen: "fruits_a_coque" },
];
const DIET_RANK = { vegan: 0, vegetarien: 1, omnivore: 2 };
export function proteinIdeas(profile, n = 2) {
  const r = DIET_RANK[profile.diet] ?? 2;
  const allergens = profile.allergens || [];
  return PROTEIN_IDEAS.filter((i) => DIET_RANK[i.diet] <= r && !allergens.includes(i.allergen)).slice(0, n).map((i) => i.label);
}

const BMI_CATS = [
  { max: 18.5, label: "Insuffisance pondérale", cls: "warn" },
  { max: 25, label: "Corpulence normale", cls: "ok" },
  { max: 30, label: "Surpoids", cls: "warn" },
  { max: 999, label: "Obésité", cls: "alert" },
];
export function computeBMI(p) {
  const m = p.heightCm / 100;
  const v = p.weightKg / (m * m);
  const cat = BMI_CATS.find((c) => v < c.max) || BMI_CATS[BMI_CATS.length - 1];
  return { value: Math.round(v * 10) / 10, label: cat.label, cls: cat.cls };
}

/* Objectif de dépense PAR L'ACTIVITÉ (hors métabolisme de base). L'OMS
   recommande 150 à 300 min d'activité modérée par semaine : à 4 MET,
   225 min médianes coûtent environ 4,5 kcal par kilo et par jour. Ajusté
   selon l'objectif et la corpulence, borné entre 150 et 700 kcal. */
const BURN_GOAL_FACTOR = { perte: 1.5, tonification: 1.25, maintien: 1.0, prise: 0.7 };
export function computeBurnTarget(p) {
  const base = p.weightKg * 4.5;
  const gf = BURN_GOAL_FACTOR[p.goal] || 1;
  const bmi = computeBMI(p).value;
  const bf = bmi >= 30 ? 1.30 : bmi >= 25 ? 1.15 : bmi < 18.5 ? 0.75 : 1;
  return Math.round(Math.max(150, Math.min(700, base * gf * bf)) / 10) * 10;
}

/* ---------- Mise à l'échelle des plats ---------- */
/* Répartit les calories restantes (après protéines) entre glucides et
   lipides selon le profil du plat. */
const PROFILE_FAT_SHARE = { carb_heavy: 0.25, balanced: 0.35, protein_fat: 0.45 };
function deriveMacros(kcal, protein, profile) {
  const remaining = Math.max(0, kcal - protein * 4);
  const fatKcal = remaining * (PROFILE_FAT_SHARE[profile] || 0.35);
  return { fat: fatKcal / 9, carbs: (remaining - fatKcal) / 4 };
}
/* Le plat est mis à l'échelle de l'objectif calorique de son créneau : les
   quantités affichées correspondent à la portion réelle de la personne. */
export function scaleMeal(meal, targetKcal) {
  const factor = targetKcal / meal.kcal;
  const macros = deriveMacros(meal.kcal, meal.protein, meal.profile);
  return {
    id: meal.id, name: meal.name, scale: factor, kcal: targetKcal,
    protein: Math.round(meal.protein * factor),
    carbs: Math.round(macros.carbs * factor),
    fat: Math.round(macros.fat * factor),
    ingredients: meal.ingredients, steps: meal.steps,
    vegetarian: meal.vegetarian, vegan: meal.vegan, allergens: meal.allergens,
  };
}

/* Au-delà de ce besoin quotidien, tenir l'apport en trois repas oblige à
   des assiettes démesurées : c'est là que les collations se justifient. */
export const SNACK_THRESHOLD_KCAL = 2600;
export function snacksAvailable(profile) {
  try { return computeTargets(profile).kcal >= SNACK_THRESHOLD_KCAL; } catch (e) { return false; }
}
export const snacksOn = (profile) => snacksAvailable(profile) && profile.useSnacks !== false;
function mealPlanShares(profile) {
  return snacksOn(profile)
    ? { petit_dejeuner: 0.22, dejeuner: 0.28, diner: 0.30, collation: 0.10 }
    : { petit_dejeuner: 0.25, dejeuner: 0.35, diner: 0.40 };
}

/* ---------- Régime, allergènes, préférences ---------- */
function mealFitsDiet(meal, diet) {
  if (diet === "vegan") return !!meal.vegan;
  if (diet === "vegetarien") return !!meal.vegetarian;
  return true;
}
const mealHasNoAllergen = (meal, allergens) => !allergens.some((a) => meal.allergens.includes(a));
/* Repli progressif pour ne jamais se retrouver sans proposition : régime +
   allergènes, puis régime seul, puis tout le vivier. */
function filterMealsForProfile(pool, profile) {
  const diet = (profile && profile.diet) || "omnivore";
  const allergens = (profile && profile.allergens) || [];
  const strict = pool.filter((m) => mealFitsDiet(m, diet) && mealHasNoAllergen(m, allergens));
  if (strict.length) return strict;
  const dietOnly = pool.filter((m) => mealFitsDiet(m, diet));
  return dietOnly.length ? dietOnly : pool;
}

/* Chaque plat est étiqueté automatiquement à partir de ses ingrédients
   (source de protéines, coût) : les plats ajoutés plus tard seront classés
   sans intervention. */
const SRC_KEYWORDS = {
  viande: ["poulet", "dinde", "boeuf", "bœuf", "veau", "agneau", "jambon", "porc", "lardon", "chorizo",
    "saucisse", "steak", "viande", "canard", "bacon", "merguez", "rillette"],
  poisson: ["saumon", "thon", "cabillaud", "colin", "sardine", "maquereau", "truite", "merlu", "poisson",
    "anchois", "crevette", "gambas", "crabe", "moule", "lieu noir"],
  oeufs: ["œuf", "oeuf"],
};
const INGREDIENTS_CHERS = ["saumon", "crevette", "gambas", "crabe", "agneau", "boeuf", "bœuf", "steak",
  "canard", "magret", "avocat", "amande", "noix", "noisette", "pignon", "pistache", "cajou", "mangue",
  "myrtille", "framboise", "fruits rouges", "quinoa", "chia", "parmesan", "chèvre", "mozzarella",
  "sirop d'érable", "purée de sésame", "lait de coco", "pignons"];
const PROTEIN_SOURCES = ["viande", "poisson", "oeufs", "vegan"];
const CATEGORIES = ["petit_dejeuner", "dejeuner", "diner", "collation"];
for (const cat of CATEGORIES) {
  for (const m of MEALS[cat]) {
    /* La muscade contient « noix » sans être un ingrédient coûteux. */
    const texte = (m.name + " " + m.ingredients.map((i) => i[0]).join(" ")).toLowerCase().split("noix de muscade").join("muscade");
    m._src = Object.keys(SRC_KEYWORDS).filter((src) => SRC_KEYWORDS[src].some((k) => texte.includes(k)));
    m._cheap = !INGREDIENTS_CHERS.some((k) => texte.includes(k));
  }
}
/* Options proposées selon le régime : un végétalien n'a rien à arbitrer. */
export function sourceChoicesFor(diet) {
  if (diet === "vegan") return [];
  if (diet === "vegetarien") return ["oeufs", "vegan"];
  return PROTEIN_SOURCES.slice();
}

/* ---------- Adaptation des menus à l'objectif ----------
   Le moteur choisit les plats dont la composition sert l'objectif, puis
   n'ajuste les portions qu'à la marge. pMin/pIdeal : grammes de protéines
   pour 100 kcal ; favor/avoid : profil du plat. */
const GOAL_MEAL_PREFS = {
  perte: { pMin: 5.0, pIdeal: 7.5, favor: ["protein_fat", "balanced"], avoid: ["carb_heavy"] },
  tonification: { pMin: 5.5, pIdeal: 8.0, favor: ["protein_fat", "balanced"], avoid: [] },
  prise: { pMin: 3.0, pIdeal: 5.5, favor: ["carb_heavy", "balanced"], avoid: [] },
  maintien: { pMin: 4.0, pIdeal: 6.5, favor: ["balanced", "protein_fat"], avoid: [] },
};
export const GOAL_MEAL_NOTE = {
  perte: "Priorité aux plats rassasiants et riches en protéines, à densité calorique modérée.",
  prise: "Priorité aux plats denses en énergie et en glucides, pour atteindre l'apport sans portions démesurées.",
  tonification: "Priorité à la densité en protéines la plus élevée, avec des glucides mesurés.",
  maintien: "Menus équilibrés entre protéines, glucides et lipides.",
};
const proteinDensity = (m) => (m.protein / Math.max(1, m.kcal)) * 100;
function goalWeight(m, goal) {
  const g = GOAL_MEAL_PREFS[goal] || GOAL_MEAL_PREFS.maintien;
  const d = proteinDensity(m);
  let w = d >= g.pIdeal ? 3.2 : d >= g.pMin ? 1.8 : 0.6;
  if (g.favor.includes(m.profile)) w *= 1.5;
  if (g.avoid.includes(m.profile)) w *= 0.55;
  return w;
}
/* En prise de masse, agrandir les assiettes est attendu ; en perte de
   poids, il faut partir de plats déjà proches de la cible. */
const SCALE_WINDOW = {
  perte: { ideal: [0.70, 1.30], ok: [0.50, 1.55] },
  tonification: { ideal: [0.75, 1.35], ok: [0.55, 1.60] },
  maintien: { ideal: [0.80, 1.45], ok: [0.60, 1.75] },
  prise: { ideal: [1.00, 1.60], ok: [0.80, 2.00] },
};
function scaleRealism(m, targetKcal, goal) {
  if (!targetKcal) return 1;
  const w = SCALE_WINDOW[goal] || SCALE_WINDOW.maintien;
  const s = targetKcal / Math.max(1, m.kcal);
  if (s >= w.ideal[0] && s <= w.ideal[1]) return 2.2;
  if (s >= w.ok[0] && s <= w.ok[1]) return 1.0;
  return 0.15;
}
/* Tirage pondéré : aucun plat n'est exclu, seulement plus ou moins
   probable. La variété est préservée. */
function pickWeighted(list, goal, targetKcal, rnd) {
  if (list.length === 1) return list[0];
  const poids = list.map((m) => goalWeight(m, goal) * scaleRealism(m, targetKcal, goal));
  const total = poids.reduce((a, b) => a + b, 0);
  if (total <= 0) return list[Math.floor(rnd() * list.length)];
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++) { r -= poids[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}
function mealMatchesPrefs(m, prefs) {
  if (!prefs || !prefs.length) return true;
  return prefs.some((p) => (p === "vegan" ? m.vegan : (m._src || []).includes(p)));
}
/* Au petit-déjeuner, imposer viande ou poisson n'aurait aucun sens : la
   part y est faible, sauf pour les œufs ou le végétalien. */
function prefRatio(type, prefs) {
  if (!prefs || !prefs.length) return 1;
  if (type !== "petit_dejeuner") return 0.8;
  return prefs.some((x) => x === "oeufs" || x === "vegan") ? 0.7 : 0.25;
}
function pickMealForDay(type, dk, recentIds, profile, targetKcal) {
  const pool = filterMealsForProfile(MEALS[type], profile);
  if (!pool.length) return MEALS[type][0];
  const prefs = profile.diet === "vegan" ? [] : profile.proteinPrefs || [];
  let suivis = prefs.length ? pool.filter((m) => mealMatchesPrefs(m, prefs)) : pool;
  let autres = prefs.length ? pool.filter((m) => !mealMatchesPrefs(m, prefs)) : [];
  if (profile.lowBudget) {
    const sc = suivis.filter((m) => m._cheap);
    if (sc.length >= 3) suivis = sc;
    const ac = autres.filter((m) => m._cheap);
    if (ac.length >= 2) autres = ac;
  }
  if (!suivis.length) suivis = pool;
  let ratio = prefRatio(type, prefs);
  if (suivis.length < 3) ratio = Math.min(ratio, suivis.length * 0.12);
  let fallback = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const rnd = mulberry32(hashStr(dk + "#" + type + "#" + attempt));
    let liste = rnd() < ratio || !autres.length ? suivis : autres;
    if (!liste.length) liste = pool;
    const m = pickWeighted(liste, profile.goal, targetKcal, rnd);
    if (!fallback) fallback = m;
    if (!recentIds.includes(m.id)) return m;
  }
  return fallback;
}

/* ---------- Remplacement d'un plat ----------
   Un plat écarté est mémorisé par créneau (date + moment du repas) ; il
   survit au changement de semaine, à la synchronisation et au
   rechargement. Les remplacements de plus de 3 semaines sont purgés. */
export const SLOT_CATEGORY = { breakfast: "petit_dejeuner", lunch: "dejeuner", dinner: "diner", snack1: "collation", snack2: "collation" };
export const SLOT_ORDER = ["breakfast", "snack1", "lunch", "snack2", "dinner"];
export function mealById(cat, id) {
  return (MEALS[cat] || []).find((m) => m.id === id) || null;
}
function overrideFor(dk, slot) {
  const id = (store.state.mealOverrides || {})[dk + "|" + slot];
  return id ? mealById(SLOT_CATEGORY[slot], id) : null;
}
export const isOverridden = (dk, slot) => !!(store.state.mealOverrides || {})[dk + "|" + slot];

function slotTargets(profile, targetKcal) {
  const sh = mealPlanShares(profile);
  const avec = snacksOn(profile);
  const b = Math.round(targetKcal * sh.petit_dejeuner);
  const l = Math.round(targetKcal * sh.dejeuner);
  const c = avec ? Math.round(targetKcal * sh.collation) : 0;
  /* Le dîner absorbe l'arrondi pour que la somme tombe juste. */
  return { breakfast: b, lunch: l, snack1: c, snack2: c, dinner: targetKcal - b - l - (avec ? c * 2 : 0) };
}

/* Le vivier de remplacement applique les mêmes règles que la génération :
   régime, intolérances, préférences et budget. */
function swapPoolFor(slot) {
  const p = store.state.profile;
  let pool = filterMealsForProfile(MEALS[SLOT_CATEGORY[slot]], p);
  const prefs = p.diet === "vegan" ? [] : p.proteinPrefs || [];
  if (prefs.length) {
    const s = pool.filter((m) => mealMatchesPrefs(m, prefs));
    if (s.length >= 3) pool = s;
  }
  if (p.lowBudget) {
    const c = pool.filter((m) => m._cheap);
    if (c.length >= 3) pool = c;
  }
  return pool;
}
/* Choisit un plat de remplacement ; renvoie null s'il n'existe aucune
   autre option compatible. */
export function chooseSwap(day, slot, targetKcal) {
  const pool = swapPoolFor(slot);
  const dejaUtilises = mealSlots(day).map(([, m]) => m.id);
  let candidats = pool.filter((m) => !dejaUtilises.includes(m.id));
  if (!candidats.length) candidats = pool.filter((m) => m.id !== day[slot].id);
  if (!candidats.length) return null;
  const cible = slotTargets(store.state.profile, targetKcal)[slot];
  return pickWeighted(candidats, store.state.profile.goal, cible, Math.random);
}
export function pruneOverrides(state) {
  const limite = dateKey(addDays(new Date(), -21));
  for (const k of Object.keys(state.mealOverrides || {})) if (k.split("|")[0] < limite) delete state.mealOverrides[k];
}

/* kcalFor : objectif du jour (nombre, ou fonction du jour pour le cyclage
   calorique). */
export function generateWeekMeals(monday, kcalFor, profile) {
  const avecCollations = snacksOn(profile);
  const kcalOf = typeof kcalFor === "function" ? kcalFor : () => kcalFor;
  const recent = { petit_dejeuner: [], dejeuner: [], diner: [], collation: [] };
  const memoriser = (cle, id) => { recent[cle].push(id); if (recent[cle].length > 4) recent[cle].shift(); };
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const dk = dateKey(d);
    const t = slotTargets(profile, kcalOf(dk));
    const b = overrideFor(dk, "breakfast") || pickMealForDay("petit_dejeuner", dk, recent.petit_dejeuner, profile, t.breakfast);
    const l = overrideFor(dk, "lunch") || pickMealForDay("dejeuner", dk, recent.dejeuner, profile, t.lunch);
    const din = overrideFor(dk, "dinner") || pickMealForDay("diner", dk, recent.diner, profile, t.dinner);
    const jour = { date: d, dateKey: dk, breakfast: scaleMeal(b, t.breakfast), lunch: scaleMeal(l, t.lunch), dinner: scaleMeal(din, t.dinner) };
    memoriser("petit_dejeuner", b.id); memoriser("dejeuner", l.id); memoriser("diner", din.id);
    if (avecCollations) {
      const s1 = overrideFor(dk, "snack1") || pickMealForDay("collation", dk + "#a", recent.collation, profile, t.snack1);
      memoriser("collation", s1.id);
      const s2 = overrideFor(dk, "snack2") || pickMealForDay("collation", dk + "#b", recent.collation, profile, t.snack2);
      memoriser("collation", s2.id);
      jour.snack1 = scaleMeal(s1, t.snack1);
      jour.snack2 = scaleMeal(s2, t.snack2);
    }
    jour.total = mealSlots(jour).reduce((s, [, m]) => s + m.kcal, 0);
    days.push(jour);
  }
  return days;
}

/* Les repas du jour dans l'ordre chronologique, collations comprises. */
export function mealSlots(day) {
  return SLOT_ORDER.filter((s) => day[s]).map((s) => [s, day[s]]);
}

/* ---------- Repères de cuisson ---------- */
export function cookingNotesFor(meal) {
  const txt = normTxt(meal.ingredients.map((i) => i[0]).join(" | ") + " " + meal.name);
  const vus = new Set();
  const out = [];
  for (const note of COOKING_NOTES) {
    const cle = note.f || note.t;
    if (vus.has(cle)) continue;
    if (note.k.some((k) => txt.includes(normTxt(k)))) { vus.add(cle); out.push(note); }
  }
  return out;
}
export function tempsRecette(meal, notes) {
  return {
    prep: Math.round(4 + meal.ingredients.length * 1.5),
    cuisson: notes.reduce((m, n) => Math.max(m, n.c), 0),
  };
}

/* ---------- Répertoire d'aliments ---------- */
export function searchFoods(q, cat) {
  const t = normTxt(q.trim());
  const base = cat ? FOOD_REF.filter((f) => f.c === cat) : FOOD_REF;
  if (!t) return cat ? base.slice(0, 80) : [];
  const mots = t.split(/\s+/);
  const res = base.filter((f) => {
    const cible = normTxt(f.n + " " + f.c);
    return mots.every((m) => cible.includes(m));
  });
  /* Les libellés commençant par la recherche remontent en tête. */
  res.sort((a, b) => {
    const pa = normTxt(a.n).indexOf(mots[0]), pb = normTxt(b.n).indexOf(mots[0]);
    return pa !== pb ? pa - pb : a.n.length - b.n.length;
  });
  return res.slice(0, 50);
}

/* Derniers aliments saisis, pour les ajouter à nouveau d'un geste. */
export function recentFoods(limit = 8) {
  const seen = new Set();
  const out = [];
  for (let i = store.state.intakeLog.length - 1; i >= 0 && out.length < limit; i--) {
    const e = store.state.intakeLog[i];
    if (e.slot) continue;
    const key = (e.label || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ n: e.label, k: e.kcal, p: e.protein || 0 });
  }
  return out;
}

/* ---------- Liste de courses ----------
   Additionne les ingrédients (portions réelles) des repas restant dans la
   semaine et les range par rayon, dans l'ordre d'un parcours en magasin. */
const AISLES = [
  /* Exceptions placées avant l'épicerie, dont « noix » ou « fruits » les
     capteraient sinon. */
  ["Viandes & poissons", ["saint-jacques", "saint jacques", "fruits de mer", "moule", "lotte", "bar", "dorade"]],
  ["Boulangerie & féculents", ["bagel", "blinis", "muffin", "crackers", "chapelure", "pate brisee", "pate feuilletee", "sarrasin", "millet", "vermicelle"]],
  ["Épicerie", ["fruits secs", "lait de coco", "lait d'amande", "lait de soja", "lait d'avoine", "lait de riz", "boisson vegetale", "beurre de cacahuete", "puree d'amande", "puree de sesame", "pois chiche", "lentille", "haricots rouges", "haricots blancs", "flageolet", "pois casses", "concentre", "tomates concassees", "coulis", "bouillon", "sauce", "huile", "vinaigre", "moutarde", "miel", "sirop", "sucre", "chocolat", "cacao", "confiture", "epice", "curry", "paprika", "cumin", "cannelle", "muscade", "sel", "poivre", "levure", "noix", "amande", "noisette", "cajou", "pistache", "pignon", "graines", "chia", "sesame", "datte", "raisins secs", "abricots secs", "whey", "proteine en poudre", "tahini", "olive", "capres", "cornichon", "mais", "conserve"]],
  ["Fruits & légumes", ["haricots verts", "pomme de terre", "patate douce", "banane", "pomme", "poire", "orange", "citron", "pamplemousse", "clementine", "fruits rouges", "myrtille", "framboise", "fraise", "kiwi", "mangue", "ananas", "raisin", "peche", "abricot", "melon", "pasteque", "grenade", "fruit", "avocat", "tomate", "epinard", "salade", "laitue", "roquette", "mache", "carotte", "courgette", "poivron", "oignon", "ail", "echalote", "brocoli", "chou", "champignon", "concombre", "aubergine", "poireau", "potiron", "courge", "celeri", "navet", "panais", "betterave", "petits pois", "radis", "fenouil", "asperge", "endive", "edamame", "persil", "basilic", "coriandre", "menthe", "ciboulette", "aneth", "thym", "romarin", "gingembre", "legume", "herbe", "crudite", "estragon"]],
  ["Viandes & poissons", ["poulet", "dinde", "boeuf", "bœuf", "veau", "porc", "jambon", "lardon", "bacon", "saumon", "thon", "cabillaud", "crevette", "gambas", "sardine", "maquereau", "truite", "merlu", "colin", "lieu", "poisson", "canard", "agneau", "steak", "viande", "chorizo", "saucisse", "merguez", "filet", "escalope"]],
  ["Crèmerie & frais", ["oeuf", "œuf", "lait", "yaourt", "yogourt", "skyr", "fromage", "feta", "mozzarella", "parmesan", "beurre", "creme", "chevre", "ricotta", "cottage", "emmental", "comte", "tofu", "tempeh", "houmous", "pate fraiche"]],
  ["Boulangerie & féculents", ["pain", "tortilla", "wrap", "pates", "spaghetti", "penne", "tagliatelle", "riz", "quinoa", "semoule", "boulgour", "flocons", "avoine", "granola", "muesli", "farine", "galette", "couscous", "nouilles", "pita", "baguette", "biscotte", "polenta", "cereales"]],
];
const AISLE_ORDER = ["Fruits & légumes", "Viandes & poissons", "Crèmerie & frais", "Boulangerie & féculents", "Épicerie"];
/* Correspondance par mot entier (pluriel toléré) : « volaille » ne doit pas
   tomber dans les légumes à cause de « ail », ni « laitue » en crèmerie. */
const AISLE_RULES = AISLES.map(([aisle, keys]) => [aisle, keys.map((k) => new RegExp(`(^|[^a-z])${normTxt(k)}(s|x)?($|[^a-z])`))]);
export function aisleFor(name) {
  const n = normTxt(name);
  for (const [aisle, rules] of AISLE_RULES) if (rules.some((r) => r.test(n))) return aisle;
  return "Épicerie";
}

export function shoppingList(mealDays, fromKey) {
  const items = new Map();
  for (const day of mealDays) {
    if (day.dateKey < fromKey) continue;
    for (const [, meal] of mealSlots(day)) {
      for (const [name, grams] of meal.ingredients) {
        if (/^eau\b/i.test(name.trim())) continue;
        const key = name.trim();
        const it = items.get(key) || { name: key, grams: 0, uses: 0, aisle: aisleFor(key) };
        it.grams += grams * meal.scale;
        it.uses += 1;
        items.set(key, it);
      }
    }
  }
  const groups = AISLE_ORDER.map((aisle) => ({
    aisle,
    items: [...items.values()].filter((i) => i.aisle === aisle).sort((a, b) => a.name.localeCompare(b.name, "fr")),
  })).filter((g) => g.items.length);
  return groups;
}
export function pruneShopping(state) {
  const limite = dateKey(addDays(new Date(), -21));
  for (const k of Object.keys(state.shopping || {})) if (k < limite) delete state.shopping[k];
}
