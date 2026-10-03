/* =========================================================================
   PROGRÈS — activité (séries, records, calendrier), calories
   (jour / semaine / mois) et poids (courbe, IMC, historique).
   ========================================================================= */
import { html, ic, actionsFor } from "../ui/dom.js";
import { rerender } from "../ui/router.js";
import { rings, groupedBars, lineChart, bindLineChart, stackBar } from "../ui/charts.js";
import { pageHead, segmented, emptyState } from "../ui/components.js";
import { store } from "../core/store.js";
import { ui } from "../ui/state.js";
import {
  todayKey, parseDateOnly, dateKey, addDays, startOfWeek, fmtInt, fmtNum1, fmtKg, fmtDateFr, fmtDayMonth,
  MONTH_NAMES, DOW_LETTERS, DAY_NAMES_SHORT, pad2, fmtDuration, relativeDay,
} from "../core/util.js";
import {
  targets, dayTargets, burnTarget, baseDailyBurn, dayStats, currentStreak, bestStreak, bestDay, weekComparison, weekSummary,
  sortedWeights, burnedTotal, consumedOn, weightTrend, weightProjection,
} from "../engine/stats.js";
import { computeBMI } from "../engine/nutrition.js";
import { journal } from "./today.js";

const TABS = [["activity", "Activité", "flame"], ["calories", "Calories", "chart-no-axes-column"], ["weight", "Poids", "weight"]];

/* ---------- Activité ---------- */
/* neutral : une variation sans connotation (calories saisies). */
function deltaChip(cur, prev, unit, neutral = false) {
  if (!prev) return html`<span class="delta-flat">—</span>`;
  const d = cur - prev;
  const pct = Math.round((100 * d) / prev);
  const cls = neutral ? "muted" : d > 0 ? "delta-up" : d < 0 ? "delta-down" : "delta-flat";
  return html`<span class="${cls} num">${d > 0 ? "+" : ""}${fmtInt(d)}${unit ? " " + unit : ""} (${d > 0 ? "+" : ""}${pct} %)</span>`;
}

function heatCalendar() {
  const ref = ui.calMonth ? parseDateOnly(ui.calMonth) : new Date();
  const y = ref.getFullYear(), mo = ref.getMonth();
  const first = new Date(y, mo, 1);
  const offset = (first.getDay() + 6) % 7;
  const nb = new Date(y, mo + 1, 0).getDate();
  const today = todayKey();
  const bt = burnTarget();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(html`<span></span>`);
  for (let j = 1; j <= nb; j++) {
    const dk = dateKey(new Date(y, mo, j));
    const st = dayStats(dk);
    /* Intensité de la case : part de l'objectif d'activité atteinte. */
    const lvl = !st.act && !st.ses ? 0 : Math.min(4, 1 + Math.floor((st.burn / Math.max(1, bt)) * 3));
    cells.push(html`<button type="button" class="heat__cell lvl-${lvl}${dk === today ? " is-today" : ""}${dk > today ? " is-future" : ""}" data-action="cal-day" data-dk="${dk}"
      aria-label="${fmtDateFr(parseDateOnly(dk))}${st.burn ? ` : ${fmtInt(st.burn)} kcal d'activité` : ""}">
      <span>${j}</span>${st.ses ? html`<i></i>` : ""}</button>`);
  }
  return html`<div class="card heat">
    <div class="row-between">
      <button type="button" class="icon-btn is-sm is-plain" data-action="cal-move" data-dir="-1" aria-label="Mois précédent">${ic("chevron-left")}</button>
      <b class="heat__title">${MONTH_NAMES[mo]} ${y}</b>
      <button type="button" class="icon-btn is-sm is-plain" data-action="cal-move" data-dir="1" aria-label="Mois suivant">${ic("chevron-right")}</button>
    </div>
    <div class="heat__grid">${DOW_LETTERS.map((l) => html`<span class="heat__dow">${l}</span>`)}${cells}</div>
    <div class="heat__legend"><span>Moins</span>${[0, 1, 2, 3, 4].map((l) => html`<i class="heat__cell lvl-${l}"></i>`)}<span>Plus</span><span class="heat__sep"></span><i class="heat__ses"></i><span>Séance</span></div>
  </div>`;
}

function activityTab() {
  const streak = currentStreak(), best = bestStreak();
  const ws = weekSummary();
  const cmp = weekComparison();
  const bd = bestDay();
  const activeDays = (() => {
    let n = 0;
    const mon = startOfWeek(new Date());
    for (let i = 0; i < 7; i++) { const st = dayStats(dateKey(addDays(mon, i))); if (st.act || st.ses) n++; }
    return n;
  })();
  const sessions = store.state.sessionLog.slice().sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)).slice(0, 8);
  return html`<div class="cols"><div>
    <section class="hero streak">
      <div class="streak__flame${streak ? " is-lit" : ""}">${ic("flame", "icon-xl")}</div>
      <div class="grow">
        <p class="streak__value"><b class="num">${streak}</b> jour${streak > 1 ? "s" : ""}</p>
        <p class="muted">${streak === 0 ? "Enregistre une activité pour lancer ta série." : streak >= best && streak > 1 ? "C'est ta meilleure série à ce jour !" : `Série en cours · record : ${best} jour${best > 1 ? "s" : ""}`}</p>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">Cette semaine</h2></div>
      <div class="grid-3">
        <div class="stat"><p class="stat__label">${ic("dumbbell")}Séances</p><p class="stat__value">${ws.done}<small>/ ${ws.planned}</small></p></div>
        <div class="stat"><p class="stat__label">${ic("flame")}Activité</p><p class="stat__value">${fmtInt(ws.burn)}<small>kcal</small></p></div>
        <div class="stat"><p class="stat__label">${ic("calendar-days")}Jours actifs</p><p class="stat__value">${activeDays}<small>/ 7</small></p></div>
      </div>
      <div class="card mt-12">
        <p class="card-title">Face à la semaine dernière</p>
        <p class="card-sub">Sur les ${cmp.jours} premier${cmp.jours > 1 ? "s" : ""} jour${cmp.jours > 1 ? "s" : ""} de chaque semaine, pour comparer ce qui est comparable.</p>
        <div class="kv mt-12">
          <div><span>Dépense par l'activité</span>${deltaChip(cmp.courante.act, cmp.precedente.act, "kcal")}</div>
          <div><span>Séances réalisées</span>${deltaChip(cmp.courante.ses, cmp.precedente.ses, "")}</div>
          <div><span>Calories saisies</span>${deltaChip(cmp.courante.eat, cmp.precedente.eat, "kcal", true)}</div>
        </div>
      </div>
    </section>
    </div><div>

    <section class="section">
      <div class="section-head"><h2 class="section-title">Calendrier</h2><span class="faint">Touche un jour pour son bilan</span></div>
      ${heatCalendar()}
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">Records</h2></div>
      <div class="grid-2">
        <div class="stat"><p class="stat__label">${ic("trophy")}Plus longue série</p><p class="stat__value">${best}<small>jour${best > 1 ? "s" : ""}</small></p></div>
        <div class="stat"><p class="stat__label">${ic("zap")}Meilleure journée</p><p class="stat__value">${bd ? fmtInt(bd.kcal) : "—"}<small>${bd ? "kcal · " + fmtDayMonth(bd.dateKey) : ""}</small></p></div>
        <div class="stat"><p class="stat__label">${ic("medal")}Séances terminées</p><p class="stat__value">${store.state.sessionLog.length}</p></div>
        <div class="stat"><p class="stat__label">${ic("activity")}Activités</p><p class="stat__value">${store.state.activityLog.length}</p></div>
      </div>
    </section>

    ${sessions.length ? html`<section class="section">
      <div class="section-head"><h2 class="section-title">Dernières séances</h2></div>
      <div class="card is-flush">${sessions.map((s) => html`<div class="list-row">
        <span class="list-row__icon is-accent">${ic("dumbbell")}</span>
        <span class="list-row__body"><span class="list-row__title">${s.label}</span><span class="list-row__sub">${relativeDay(s.dateKey)}</span></span>
        ${s.durationSec ? html`<span class="list-row__value">${fmtDuration(s.durationSec)}</span>` : ""}
      </div>`)}</div>
    </section>` : ""}
  </div></div>`;
}

/* ---------- Calories ---------- */
function periodLabel() {
  const d = parseDateOnly(ui.historyDate);
  if (ui.historyMode === "jour") return relativeDay(ui.historyDate);
  if (ui.historyMode === "semaine") {
    const mon = startOfWeek(d), sun = addDays(mon, 6);
    return `${pad2(mon.getDate())}/${pad2(mon.getMonth() + 1)} – ${pad2(sun.getDate())}/${pad2(sun.getMonth() + 1)}`;
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/* Moyennes plutôt que totaux : sur un mois en cours, un total brut
   comparerait des périodes de longueurs différentes. */
function periodTotals(dep, con) {
  const filled = con.filter((v) => v > 0).length;
  const moyDep = Math.round(dep.reduce((a, b) => a + b, 0) / dep.length);
  const moyCon = filled ? Math.round(con.reduce((a, b) => a + b, 0) / filled) : 0;
  const solde = moyDep - moyCon;
  return html`<div class="grid-2">
      <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--burn)"></i>Dépense / jour</p><p class="stat__value">${fmtInt(moyDep)}<small>kcal</small></p></div>
      <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--intake)"></i>Apport / jour</p><p class="stat__value">${fmtInt(moyCon)}<small>kcal</small></p></div>
    </div>
    <p class="field-hint">${filled
      ? html`Sur les ${filled} jour${filled > 1 ? "s" : ""} où tu as saisi tes repas, l'écart moyen est de <b>${solde >= 0 ? `${fmtInt(solde)} kcal de déficit` : `${fmtInt(-solde)} kcal d'excédent`}</b> par jour.`
      : "Aucun apport saisi sur cette période : la comparaison apport / dépense n'est pas disponible."}</p>`;
}

function caloriesTab() {
  const t = targets();
  const base = baseDailyBurn();
  const bt = burnTarget();
  let content, side = "";
  if (ui.historyMode === "jour") {
    const dk = ui.historyDate;
    const st = dayStats(dk);
    const dep = base + st.burn;
    const td = dayTargets(dk);
    content = html`<div class="card">
      <div class="duo-rings">
        <div class="duo-rings__item">
          ${rings([{ value: dep, max: base + bt, color: "var(--burn)" }], { size: 128, stroke: 12 })}
          <div class="duo-rings__center"><b class="num">${fmtInt(dep)}</b><span>sur ${fmtInt(base + bt)}</span></div>
          <p><i class="dot" style="background:var(--burn)"></i>Dépense</p>
        </div>
        <div class="duo-rings__item">
          ${rings([{ value: st.eat, max: td.kcal, color: "var(--intake)" }], { size: 128, stroke: 12 })}
          <div class="duo-rings__center"><b class="num">${fmtInt(st.eat)}</b><span>sur ${fmtInt(td.kcal)}</span></div>
          <p><i class="dot" style="background:var(--intake)"></i>Apport</p>
        </div>
      </div>
      <p class="sub-title mt-16">Composition de la dépense</p>
      ${stackBar([{ name: "Métabolisme", value: base, color: "var(--surface-3)" }, { name: "Activité", value: st.burn, color: "var(--burn)" }])}
      <div class="legend" style="justify-content:flex-start"><span><i class="dot" style="background:var(--surface-3)"></i>Métabolisme de base ${fmtInt(base)} kcal</span><span><i class="dot" style="background:var(--burn)"></i>Activité ${fmtInt(st.burn)} kcal</span></div>
    </div>
    `;
    side = journal(dk, { title: "Détail de la journée", includeSlots: true }) || html`<section class="section">${emptyState({ icon: "calendar", title: "Rien d'enregistré ce jour-là" })}</section>`;
  } else {
    const labels = [], dep = [], con = [];
    if (ui.historyMode === "semaine") {
      const mon = startOfWeek(parseDateOnly(ui.historyDate));
      for (let i = 0; i < 7; i++) { const dk = dateKey(addDays(mon, i)); labels.push(DAY_NAMES_SHORT[i]); dep.push(burnedTotal(dk)); con.push(consumedOn(dk)); }
    } else {
      const d = parseDateOnly(ui.historyDate);
      const nb = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      for (let j = 1; j <= nb; j++) { const dk = dateKey(new Date(d.getFullYear(), d.getMonth(), j)); labels.push(String(j)); dep.push(burnedTotal(dk)); con.push(consumedOn(dk)); }
    }
    content = html`<div class="card">
      ${groupedBars(labels, [{ name: "Dépense", color: "var(--burn)", values: dep }, { name: "Apport", color: "var(--intake)", values: con }], { target: t.kcal })}
    </div>`;
    side = html`<section class="section period-side">${periodTotals(dep, con)}</section>`;
  }
  return html`<div class="cols"><div>
    ${segmented([["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]], ui.historyMode, "hist-mode")}
    <div class="period-nav mt-12">
      <button type="button" class="icon-btn is-sm" data-action="hist-step" data-dir="-1" aria-label="Période précédente">${ic("chevron-left")}</button>
      <b>${periodLabel()}</b>
      <button type="button" class="icon-btn is-sm" data-action="hist-step" data-dir="1" aria-label="Période suivante">${ic("chevron-right")}</button>
    </div>
    <div class="mt-12">${content}</div>
  </div><div>${side}</div></div>`;
}

/* ---------- Poids ---------- */
const RANGES = [["1m", "1 mois", 31], ["3m", "3 mois", 92], ["1a", "1 an", 366], ["all", "Tout", 99999]];
function bmiGauge(bmi) {
  /* Échelle visuelle de 15 à 40. */
  const pos = Math.max(0, Math.min(1, (bmi.value - 15) / 25)) * 100;
  return html`<div class="bmi">
    <div class="bmi__bar"><i style="left:${pos.toFixed(1)}%"></i></div>
    <div class="bmi__scale"><span>15</span><span style="left:14%">18,5</span><span style="left:40%">25</span><span style="left:60%">30</span><span>40</span></div>
  </div>`;
}

/* Objectif de poids : progression, rythme réel et date estimée. */
function goalCard(all) {
  const proj = weightProjection();
  const trend = weightTrend(28);
  const rate = (kg) => `${kg > 0 ? "+" : kg < 0 ? "−" : ""}${fmtNum1(Math.abs(kg))} kg / sem.`;
  if (!proj.goal) {
    return html`<section class="section">
      <div class="section-head"><h2 class="section-title">Objectif de poids</h2></div>
      <button type="button" class="card card-link goal-cta" data-action="edit-profile" data-section="training">
        <span class="library-cta__icon is-weight">${ic("flag")}</span>
        <span class="grow"><b>Fixer un poids visé</b><span>${trend ? `Tendance actuelle : ${rate(trend.perWeek)}. ` : ""}Carnet estime la date d'arrivée et surveille ton rythme.</span></span>
        ${ic("chevron-right", "list-row__chev")}
      </button>
    </section>`;
  }
  const start = all.length ? all[0].weightKg : proj.current;
  const total = proj.goal - start;
  const doneKg = proj.current - start;
  const pct = total ? Math.max(0, Math.min(1, doneKg / total)) : 1;
  const left = proj.goal - proj.current;
  const STATUS = {
    reached: ["is-success", "Objectif atteint"],
    ontrack: ["is-success", "Dans les temps"],
    toofast: ["is-warn", "Rythme trop rapide"],
    stalled: ["is-warn", "À l'arrêt"],
    wrongway: ["is-warn", "À contre-sens"],
    nodata: ["", "Tendance en cours de calcul"],
  };
  const [cls, label] = STATUS[proj.status] || STATUS.nodata;
  const eta = proj.etaWeeks ? addDays(new Date(), proj.etaWeeks * 7) : null;
  return html`<section class="section">
    <div class="section-head"><h2 class="section-title">Objectif de poids</h2><button type="button" class="link" data-action="edit-profile" data-section="training">Modifier</button></div>
    <div class="card goal">
      <div class="row-between"><span class="goal__target">${ic("flag")}<b class="num">${fmtKg(proj.goal)}</b></span><span class="chip ${cls}">${label}</span></div>
      <div class="bar mt-12"><i style="width:${(pct * 100).toFixed(1)}%;background:var(--weight)"></i></div>
      <div class="row-between goal__ends"><span>${fmtKg(start)}</span><span>${proj.status === "reached" ? "Bravo !" : `encore ${fmtNum1(Math.abs(left))} kg`}</span></div>
      <div class="goal__stats">
        <div><span class="faint">Tendance</span><b class="num">${trend ? rate(trend.perWeek) : "—"}</b></div>
        <div><span class="faint">Rythme prévu</span><b class="num">${proj.plannedPerWeek ? rate(proj.plannedPerWeek) : "stable"}</b></div>
        <div><span class="faint">Arrivée estimée</span><b>${eta ? eta.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: eta.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined }) : proj.plannedWeeks ? `~${proj.plannedWeeks} sem.` : "—"}</b></div>
      </div>
      <p class="field-hint">${proj.status === "toofast" ? "Plus de 1 % du poids par semaine : une partie de la perte vient du muscle. Mange un peu plus, surtout de protéines."
        : proj.status === "stalled" ? "Ton poids ne bouge plus depuis plusieurs semaines : vérifie tes saisies, ou active la dépense réelle dans Nutrition pour recaler tes objectifs."
        : proj.status === "wrongway" ? "Ton poids évolue dans le sens opposé à ton objectif. Vérifie que ton objectif (perte, prise…) correspond bien à ton poids visé."
        : "La tendance est calculée sur tes pesées des 4 dernières semaines : une pesée isolée peut varier de ±1 kg sans signification."}</p>
    </div>
  </section>`;
}

function weightTab() {
  const p = store.state.profile;
  const all = sortedWeights();
  const latest = all[all.length - 1], first = all[0];
  const bmi = computeBMI(p);
  const range = RANGES.find((r) => r[0] === ui.weightRange) || RANGES[1];
  const limit = dateKey(addDays(new Date(), -range[2]));
  const pts = all.filter((e) => e.dateKey >= limit).map((e) => ({ v: e.weightKg, dk: e.dateKey, t: parseDateOnly(e.dateKey).getTime() }));
  const month = all.filter((e) => e.dateKey >= dateKey(addDays(new Date(), -30)));
  const d30 = month.length >= 2 ? month[month.length - 1].weightKg - month[0].weightKg : null;
  const dAll = latest && first && latest !== first ? latest.weightKg - first.weightKg : null;
  const fmtD = (d) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${fmtNum1(Math.abs(d))} kg`;
  const bmiCls = bmi.cls === "ok" ? "is-success" : bmi.cls === "alert" ? "is-burn" : "is-warn";
  return html`<div class="cols"><div>
    <section class="hero weight-hero">
      <div class="grow">
        <p class="eyebrow">Poids actuel</p>
        <p class="weight-hero__value"><b class="num">${fmtNum1(latest ? latest.weightKg : p.weightKg)}</b><span>kg</span></p>
        <div class="chips mt-8">
          ${dAll !== null ? html`<span class="chip">${ic("history")}${fmtD(dAll)} depuis le début</span>` : ""}
          ${d30 !== null ? html`<span class="chip">${ic("calendar")}${fmtD(d30)} sur 30 j</span>` : ""}
          ${weightTrend(28) ? html`<span class="chip">${ic(weightTrend(28).perWeek < 0 ? "trending-down" : "trending-up")}${fmtD(weightTrend(28).perWeek)} / sem.</span>` : ""}
        </div>
      </div>
      <button type="button" class="btn btn-primary" data-action="add-weight">${ic("plus")}Pesée</button>
    </section>

    <section class="section">
      <div class="section-head"><h2 class="section-title">Évolution</h2></div>
      ${segmented(RANGES.map(([v, l]) => [v, l]), ui.weightRange, "weight-range")}
      <div class="card mt-12">
        ${pts.length >= 2 ? lineChart(pts, { id: "wchart", unit: "kg" })
          : emptyState({ icon: "chart-line", title: all.length < 2 ? "Encore une pesée" : "Pas assez de pesées sur cette période", text: all.length < 2 ? "Ta courbe apparaît dès la deuxième pesée." : "Choisis une période plus longue." })}
        ${pts.length >= 2 ? html`<div class="legend"><span><i class="dot" style="background:var(--weight)"></i>Pesées</span><span><i class="dot" style="background:var(--text-3)"></i>Tendance lissée</span></div>` : ""}
      </div>
    </section>
    </div><div>

    ${goalCard(all)}

    <section class="section">
      <div class="section-head"><h2 class="section-title">Indice de masse corporelle</h2></div>
      <div class="card">
        <div class="row-between"><b class="bmi__value num">${fmtNum1(bmi.value)}</b><span class="chip ${bmiCls}">${bmi.label}</span></div>
        ${bmiGauge(bmi)}
        <p class="field-hint">Calculé avec ta taille (${p.heightCm} cm). Les seuils de l'OMS ne tiennent pas compte de la masse musculaire : un sportif musclé peut dépasser 25 sans excès de graisse.</p>
      </div>
    </section>

    ${all.length ? html`<section class="section">
      <div class="section-head"><h2 class="section-title">Historique</h2><span class="faint">${all.length} pesée${all.length > 1 ? "s" : ""}</span></div>
      <div class="card is-flush">${all.slice().reverse().slice(0, 20).map((e, i, arr) => {
        const prev = arr[i + 1];
        const d = prev ? e.weightKg - prev.weightKg : 0;
        return html`<div class="list-row">
          <span class="list-row__icon is-weight">${ic("weight")}</span>
          <span class="list-row__body"><span class="list-row__title num">${fmtKg(e.weightKg)}</span><span class="list-row__sub">${fmtDateFr(parseDateOnly(e.dateKey))}</span></span>
          ${prev && d !== 0 ? html`<span class="list-row__value is-muted">${fmtD(d)}</span>` : ""}
          <button type="button" class="icon-btn is-sm is-plain" data-action="delete-entry" data-kind="weightLog" data-id="${e.id}" aria-label="Supprimer">${ic("trash-2")}</button>
        </div>`;
      })}</div>
    </section>` : ""}
  </div></div>`;
}

export const progressView = {
  nav: "progress",
  title: "Progrès",
  render(params) {
    if (params[0] && TABS.some((t) => t[0] === params[0])) ui.progressTab = params[0];
    const tab = ui.progressTab;
    return html`
      ${pageHead({ eyebrow: "Ton suivi", title: "Progrès" })}
      ${segmented(TABS, tab, "progress-tab", 'aria-label="Sections"')}
      <div class="mt-16">${tab === "calories" ? caloriesTab() : tab === "weight" ? weightTab() : activityTab()}</div>`;
  },
  mounted(root) { bindLineChart(root); },
};

actionsFor({
  "progress-tab": (el) => { location.hash = `#/progress/${el.dataset.value}`; },
  "hist-mode": (el) => { ui.historyMode = el.dataset.value; rerender(); },
  "hist-step": (el) => {
    const dir = Number(el.dataset.dir);
    const d = parseDateOnly(ui.historyDate);
    if (ui.historyMode === "jour") d.setDate(d.getDate() + dir);
    else if (ui.historyMode === "semaine") d.setDate(d.getDate() + dir * 7);
    else { d.setDate(1); d.setMonth(d.getMonth() + dir); }
    ui.historyDate = dateKey(d);
    rerender();
  },
  "cal-move": (el) => {
    const ref = ui.calMonth ? parseDateOnly(ui.calMonth) : new Date();
    ui.calMonth = dateKey(new Date(ref.getFullYear(), ref.getMonth() + Number(el.dataset.dir), 1));
    rerender();
  },
  "cal-day": (el) => {
    ui.historyDate = el.dataset.dk;
    ui.historyMode = "jour";
    location.hash = "#/progress/calories";
  },
  "weight-range": (el) => { ui.weightRange = el.dataset.value; rerender(); },
});
