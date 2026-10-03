/* =========================================================================
   AUJOURD'HUI — le tableau de bord du jour sélectionné :
   bilan en anneaux, séance prévue, repas à cocher, journal du jour.
   ========================================================================= */
import { html, ic } from "../ui/dom.js";
import { rings } from "../ui/charts.js";
import { pageHead, weekStrip, mealCard, exerciseThumb, emptyState } from "../ui/components.js";
import { store } from "../core/store.js";
import { ui } from "../ui/state.js";
import { todayKey, parseDateOnly, fmtDateLong, relativeDay, fmtInt, DAY_NAMES, addDays, dateKey, fmtKg } from "../core/util.js";
import { targets, burnTarget, baseDailyBurn, dayPlan, dayStats, consumedOn, proteinOn, burnedFromLog, lastWeighIn, daysSince } from "../engine/stats.js";
import { mealSlots } from "../engine/nutrition.js";
import { sessionEstimate, sessionProgress, sessionDoneOn } from "../engine/training.js";
import { GROUP_LABELS, ACTIVITY_ICONS, CARDIO_LABELS, INTENSITY_LABELS } from "../engine/labels.js";

function greeting() {
  const h = new Date().getHours();
  const name = store.state.profile.name ? `, ${store.state.profile.name}` : "";
  if (h < 5) return `Bonne nuit${name}`;
  if (h < 12) return `Bonjour${name}`;
  if (h < 18) return `Bon après-midi${name}`;
  return `Bonsoir${name}`;
}

export function weekMarks(dk) {
  const plan = dayPlan(dk).workout;
  const st = dayStats(dk);
  const m = [];
  if (st.ses) m.push("is-done"); else if (plan && plan.training) m.push("is-train");
  if (st.food) m.push("is-food");
  return m;
}

function summaryCard(dk) {
  const t = targets();
  const eaten = consumedOn(dk), burned = burnedFromLog(dk), prot = proteinOn(dk), bt = burnTarget();
  const left = t.kcal - eaten;
  const center = eaten === 0
    ? html`<b class="num">${fmtInt(t.kcal)}</b><span>kcal à manger</span>`
    : left >= 0 ? html`<b class="num">${fmtInt(left)}</b><span>kcal restantes</span>`
                : html`<b class="num is-over">+${fmtInt(-left)}</b><span>kcal au-delà</span>`;
  const rows = [
    { label: "Apport", color: "var(--intake)", v: eaten, max: t.kcal, unit: "kcal" },
    { label: "Activité", color: "var(--burn)", v: burned, max: bt, unit: "kcal" },
    { label: "Protéines", color: "var(--protein)", v: prot, max: t.proteinG, unit: "g" },
  ];
  return html`<section class="hero summary" aria-label="Bilan du jour">
    <div class="summary__rings">
      ${rings(rows.map((r) => ({ value: r.v, max: r.max, color: r.color })), { size: 156, stroke: 14, gap: 5, label: "Apport, activité et protéines" })}
      <div class="summary__center">${center}</div>
    </div>
    <div class="summary__legend">
      ${rows.map((r) => html`<div class="summary__row">
        <span class="summary__label"><i class="dot" style="background:${r.color}"></i>${r.label}</span>
        <span class="summary__val"><b class="num">${fmtInt(r.v)}</b><small> / ${fmtInt(r.max)} ${r.unit}</small></span>
      </div>`)}
      <p class="summary__foot">Dépense estimée <b class="num">${fmtInt(baseDailyBurn() + burned)} kcal</b></p>
    </div>
  </section>`;
}

function sessionCard(dk) {
  const day = dayPlan(dk).workout;
  if (!day || !day.training) {
    /* Prochaine séance : on la cherche dans les 7 jours suivants. */
    let next = null;
    for (let i = 1; i <= 7 && !next; i++) {
      const w = dayPlan(dateKey(addDays(parseDateOnly(dk), i))).workout;
      if (w && w.training) next = w;
    }
    return html`<article class="rest-card">
      <div class="rest-card__icon">${ic("bed")}</div>
      <div class="grow">
        <h3 class="card-title">Jour de récupération</h3>
        <p class="card-sub">Tes muscles se renforcent pendant le repos. Une marche ou quelques étirements restent bienvenus.</p>
        ${next ? html`<p class="rest-card__next">${ic("calendar", "icon-xs")}Prochaine séance : <b>${DAY_NAMES[(next.date.getDay() + 6) % 7].toLowerCase()} — ${next.label}</b></p>` : ""}
        <button type="button" class="btn btn-secondary btn-sm mt-12" data-action="add-activity">${ic("plus")}Ajouter une activité</button>
      </div>
    </article>`;
  }
  const p = store.state.profile;
  const est = sessionEstimate(day, p);
  const prog = sessionProgress(day);
  const done = sessionDoneOn(dk);
  const future = dk > todayKey();
  const cta = done
    ? html`<a class="btn btn-success btn-block" href="#/training">${ic("circle-check")}Séance terminée · voir le détail</a>`
    : html`<a class="btn btn-primary btn-block btn-lg" href="#/workout/${dk}">${ic("play")}${prog.done ? "Continuer la séance" : future ? "Aperçu de la séance" : "Démarrer la séance"}</a>`;
  return html`<article class="session-card${done ? " is-done" : ""}">
    <div class="session-card__media">
      ${day.exercises.slice(0, 3).map((ex) => exerciseThumb(ex, "is-cover"))}
    </div>
    <div class="session-card__body">
      <p class="session-card__meta">${ic("dumbbell", "icon-xs")}${day.exercises.length} exercices · ~${est.minutes} min · ~${fmtInt(est.kcal)} kcal</p>
      <h3 class="session-card__title">${day.label}</h3>
      <div class="chips">${(day.groups || []).map((g) => html`<span class="chip">${GROUP_LABELS[g]}</span>`)}</div>
      <div class="session-card__progress">
        <div class="bar is-thin"><i style="width:${(prog.pct * 100).toFixed(0)}%"></i></div>
        <span class="faint">${prog.done}/${prog.total}</span>
      </div>
      ${cta}
    </div>
  </article>`;
}

function mealsSection(dk) {
  const day = dayPlan(dk).meals;
  const slots = mealSlots(day);
  const eatenPlanned = store.state.intakeLog.filter((e) => e.dateKey === dk && e.slot).length;
  return html`<section class="section">
    <div class="section-head">
      <h2 class="section-title">Repas</h2>
      <span class="faint">${eatenPlanned}/${slots.length} cochés · ${fmtInt(day.total)} kcal prévues</span>
    </div>
    <div class="meals">${slots.map(([slot, meal]) => mealCard(dk, slot, meal, { compact: true }))}</div>
    <button type="button" class="btn btn-secondary btn-block mt-12" data-action="add-intake">${ic("plus")}Ajouter un aliment hors programme</button>
  </section>`;
}

export function activityTitle(e) {
  if (e.type === "exercice") return e.name;
  if (CARDIO_LABELS[e.type]) return CARDIO_LABELS[e.type];
  if (e.type === "pas") return `${fmtInt(e.steps)} pas`;
  return "Activité";
}
export function activitySub(e) {
  if (e.type === "exercice" && e.auto) return `Programme · ${e.sets} × ${e.reps}${e.load > 0 ? " · " + fmtKg(e.load) : ""}`;
  if (e.type === "exercice") return `${e.durationMin} min · ${INTENSITY_LABELS[e.intensity] || ""}`;
  if (CARDIO_LABELS[e.type]) return `${e.durationMin} min${e.distanceKm ? " · " + String(e.distanceKm).replace(".", ",") + " km" : ""}`;
  return "Marche quotidienne";
}

/* Journal : activités et apports libres du jour, supprimables (avec
   annulation possible). Les repas cochés sont déjà visibles plus haut. */
export function journal(dk, { title = "Journal du jour", includeSlots = false, showActivity = true } = {}) {
  const acts = showActivity ? store.state.activityLog.filter((e) => e.dateKey === dk) : [];
  const foods = store.state.intakeLog.filter((e) => e.dateKey === dk && (includeSlots || !e.slot));
  if (!acts.length && !foods.length) return "";
  return html`<section class="section">
    <div class="section-head"><h2 class="section-title">${title}</h2></div>
    <div class="card is-flush">
      ${acts.map((e) => html`<div class="list-row">
        <span class="list-row__icon is-burn">${ic(e.exId ? "dumbbell" : ACTIVITY_ICONS[e.type] || "flame")}</span>
        <span class="list-row__body"><span class="list-row__title">${activityTitle(e)}</span><span class="list-row__sub">${activitySub(e)}</span></span>
        <span class="list-row__value is-burn">−${fmtInt(e.kcal)}<small>kcal</small></span>
        <button type="button" class="icon-btn is-sm is-plain" data-action="delete-entry" data-kind="activityLog" data-id="${e.id}" aria-label="Supprimer">${ic("trash-2")}</button>
      </div>`)}
      ${foods.map((e) => html`<div class="list-row">
        <span class="list-row__icon is-intake">${ic("utensils")}</span>
        <span class="list-row__body"><span class="list-row__title">${e.label || "Apport calorique"}</span><span class="list-row__sub">${e.slot ? "Repas du programme" : "Hors programme"}${e.protein ? ` · ${e.protein} g de protéines` : ""}</span></span>
        <span class="list-row__value is-intake">+${fmtInt(e.kcal)}<small>kcal</small></span>
        <button type="button" class="icon-btn is-sm is-plain" data-action="delete-entry" data-kind="intakeLog" data-id="${e.id}" aria-label="Supprimer">${ic("trash-2")}</button>
      </div>`)}
    </div>
  </section>`;
}

function weighNudge() {
  const last = lastWeighIn();
  const since = last ? daysSince(last.dateKey) : 99;
  if (since < 7) return "";
  return html`<button type="button" class="nudge" data-action="add-weight">
    <span class="nudge__icon">${ic("weight")}</span>
    <span class="grow"><b>${last ? "Pense à ta pesée" : "Première pesée"}</b><span>${last ? `Dernière il y a ${since} jours (${fmtKg(last.weightKg)}).` : "Pour suivre ton évolution."} Tes objectifs s'ajustent à ton poids.</span></span>
    ${ic("chevron-right", "list-row__chev")}
  </button>`;
}

export const todayView = {
  nav: "today",
  title: () => (ui.date === todayKey() ? "Aujourd'hui" : relativeDay(ui.date)),
  render() {
    const dk = ui.date;
    const isToday = dk === todayKey();
    const d = parseDateOnly(dk);
    return html`
      ${pageHead({ eyebrow: fmtDateLong(d), title: isToday ? greeting() : relativeDay(dk) })}
      ${weekStrip(weekMarks)}
      <div class="cols mt-16">
        <div>
          ${summaryCard(dk)}
          ${isToday ? weighNudge() : ""}
          <section class="section">
            <div class="section-head"><h2 class="section-title">${isToday ? "Séance du jour" : "Séance"}</h2><a class="link" href="#/training">Programme${ic("chevron-right")}</a></div>
            ${sessionCard(dk)}
          </section>
        </div>
        <div>
          ${mealsSection(dk)}
          ${journal(dk) || (isToday ? html`<section class="section">${emptyState({ icon: "list-checks", title: "Ton journal est vide", text: "Coche tes repas, ajoute une activité ou un aliment : ton bilan se met à jour instantanément." })}</section>` : "")}
        </div>
      </div>`;
  },
};
