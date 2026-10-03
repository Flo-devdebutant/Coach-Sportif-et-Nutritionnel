/* =========================================================================
   COACH
   Croise l'entraînement, la nutrition et le poids pour proposer, chaque
   jour, les quelques conseils qui comptent vraiment. Chaque conseil est
   actionnable (un bouton fait le geste) ou peut être écarté pour la
   journée. Les conseils sont triés par importance.
   ========================================================================= */
import { store, local } from "../core/store.js";
import { addDays, dateKey, parseDateOnly, todayKey, fmtInt, fmtKg, fmtDateFr } from "../core/util.js";
import { weekPlan, dayPlan, targets, metabolism, weightProjection, weightTrend, dayStats, currentStreak } from "./stats.js";
import { moveSuggestion, prescription, sessionDoneOn } from "./training.js";
import { proteinIdeas } from "./nutrition.js";

const DISMISS_KEY = "carnet.coach.dismissed";
const dayName = (dk) => fmtDateFr(parseDateOnly(dk)).toLowerCase();
const fmtRate = (kg) => `${kg > 0 ? "+" : "−"}${String(Math.abs(Math.round(kg * 100) / 100)).replace(".", ",")} kg`;

function dismissed() {
  const d = local.get(DISMISS_KEY);
  return d && d.day === todayKey() ? d.ids : [];
}
export function dismissInsight(id) {
  local.set(DISMISS_KEY, { day: todayKey(), ids: [...dismissed(), id] });
}

/* Séance manquée cette semaine : la reporter. */
function missedSession() {
  const sug = moveSuggestion(weekPlan(new Date()).workout);
  if (!sug) return null;
  const when = sug.to === todayKey() ? "aujourd'hui" : dayName(sug.to);
  return {
    id: "move:" + sug.from.dateKey, priority: 90, tone: "warn", icon: "calendar",
    title: `Séance du ${dayName(sug.from.dateKey)} manquée`,
    text: `« ${sug.from.label} » peut encore être faite ${when === "aujourd'hui" ? "aujourd'hui" : "le " + when}, un jour de repos : ton programme de la semaine reste complet.`,
    action: { label: `Reporter ${when === "aujourd'hui" ? "à aujourd'hui" : "au " + when}`, name: "session-move", data: { from: sug.from.dateKey, to: sug.to } },
  };
}

/* Exercices du jour en progression. */
function progressionToday() {
  const dk = todayKey();
  const day = dayPlan(dk).workout;
  if (!day || !day.training || sessionDoneOn(dk)) return null;
  const p = store.state.profile;
  const rx = day.exercises.map((ex) => [ex, prescription(ex, p, dk)]);
  const up = rx.filter(([, r]) => r.trend === "up" || r.trend === "load" || r.trend === "variant");
  if (!up.length) return null;
  const load = up.filter(([, r]) => r.trend === "load");
  const ex = (load[0] || up[0]);
  return {
    id: "progress:" + dk, priority: 55, tone: "success", icon: "trending-up",
    title: `${up.length} exercice${up.length > 1 ? "s" : ""} en progression aujourd'hui`,
    text: `Tes dernières séances le permettent : objectifs relevés. ${ex[0].name} : ${ex[1].note}`,
    action: { label: "Voir la séance", href: "#/training" },
  };
}

/* Rythme de poids : trop rapide, à l'arrêt, à contre-sens, ou atteint. */
function weightPace() {
  const p = store.state.profile;
  const proj = weightProjection();
  const trend = weightTrend(28);
  if (proj.goal && proj.status === "reached") {
    return {
      id: "reached", priority: 85, tone: "success", icon: "party-popper",
      title: `Objectif atteint : ${fmtKg(proj.goal)} !`,
      text: "Pour consolider, passe à l'objectif « maintien » : les calories remontent progressivement à ta dépense.",
      action: { label: "Changer d'objectif", name: "edit-profile", data: { section: "training" } },
    };
  }
  if (!trend || trend.span < 14) return null;
  const dir = proj.goal ? Math.sign(proj.goal - proj.current) : p.goal === "perte" ? -1 : p.goal === "prise" ? 1 : 0;
  if (!dir) return null;
  const rate = trend.perWeek;
  if (dir < 0 && trend.pctPerWeek < -1) {
    return {
      id: "toofast", priority: 80, tone: "warn", icon: "triangle-alert",
      title: `Perte rapide : ${fmtRate(rate)} par semaine`,
      text: "Au-delà de 1 % du poids par semaine, une partie de la perte vient du muscle. Ajoute environ 150 à 200 kcal par jour, surtout en protéines.",
    };
  }
  if (Math.abs(rate) < 0.1 || Math.sign(rate) !== dir) {
    const m = metabolism();
    const adaptiveHelps = !p.adaptive && m.usable;
    return {
      id: "stall", priority: 70, tone: "info", icon: "gauge",
      title: Math.abs(rate) < 0.1 ? "Poids stable depuis plusieurs semaines" : `Ton poids évolue à contre-sens (${fmtRate(rate)} / sem.)`,
      text: adaptiveHelps
        ? `D'après ton journal, ta dépense réelle est d'environ ${fmtInt(m.observed)} kcal (formule : ${fmtInt(m.formula)}). Ajuster tes objectifs dessus relance la progression.`
        : "Vérifie que tous tes repas sont saisis (huiles, sauces, boissons comptent). Si c'est le cas, ajuste ton objectif d'environ 150 kcal.",
      action: adaptiveHelps ? { label: "Utiliser ma dépense réelle", name: "coach-adaptive" } : null,
    };
  }
  if (proj.goal && proj.etaWeeks) {
    const eta = addDays(parseDateOnly(todayKey()), proj.etaWeeks * 7);
    return {
      id: "eta", priority: 30, tone: "success", icon: "flag",
      title: `${fmtKg(proj.goal)} vers le ${eta.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`,
      text: `À ton rythme actuel (${fmtRate(rate)} par semaine), il te reste environ ${proj.etaWeeks} semaine${proj.etaWeeks > 1 ? "s" : ""}.`,
    };
  }
  return null;
}

/* Dépense réelle nettement différente de la formule. */
function adaptiveHint() {
  const p = store.state.profile;
  if (p.adaptive) return null;
  const m = metabolism();
  if (!m.usable || Math.abs(m.observed - m.formula) < 150 || m.confidence === "low") return null;
  const diff = m.observed - m.formula;
  return {
    id: "adaptive", priority: 60, tone: "info", icon: "gauge",
    title: `Ta dépense réelle : ${diff > 0 ? "+" : "−"}${fmtInt(Math.abs(diff))} kcal par rapport à la formule`,
    text: `D'après ${m.days} jours de repas et tes pesées, tu dépenses environ ${fmtInt(m.observed)} kcal par jour. Tes objectifs peuvent s'y ajuster.`,
    action: { label: "Ajuster mes objectifs", name: "coach-adaptive" },
  };
}

/* Protéines insuffisantes sur les 7 derniers jours saisis. */
function proteinLow() {
  const t = targets();
  const today = parseDateOnly(todayKey());
  const vals = [];
  for (let i = 1; i <= 7; i++) {
    const d = dayStats(dateKey(addDays(today, -i)));
    if (d.food && d.protein > 0) vals.push(d.protein);
  }
  if (vals.length < 3) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= t.proteinG * 0.8) return null;
  const ideas = proteinIdeas(store.state.profile);
  return {
    id: "protein", priority: 50, tone: "info", icon: "egg",
    title: `Protéines : ${Math.round(avg)} g par jour sur ${t.proteinG} g visés`,
    text: `Elles protègent tes muscles${store.state.profile.goal === "perte" ? " pendant la perte de poids" : " et soutiennent ta progression"}.${ideas.length ? ` Idées simples : ${ideas.join(" ou ")}.` : ""}`,
  };
}

/* Encouragement : série de jours actifs. */
function streak() {
  const n = currentStreak();
  if (n < 3) return null;
  return {
    id: "streak:" + n, priority: 10, tone: "success", icon: "zap",
    title: `${n} jours actifs d'affilée`,
    text: n >= 14 ? "Une régularité remarquable : c'est elle qui fait les résultats." : "Continue : la régularité compte plus que l'intensité.",
  };
}

export function insights() {
  if (!store.state.profile) return [];
  const off = dismissed();
  return [missedSession, weightPace, adaptiveHint, progressionToday, proteinLow, streak]
    .map((f) => { try { return f(); } catch (e) { return null; } })
    .filter((x) => x && !off.includes(x.id))
    /* Un seul conseil pour la même proposition. */
    .filter((x, i, all) => !(x.id === "adaptive" && all.some((y) => y.id === "stall" && y.action)))
    .sort((a, b) => b.priority - a.priority);
}
