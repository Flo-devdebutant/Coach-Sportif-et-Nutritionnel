/* =========================================================================
   COMPOSANTS PARTAGÉS ENTRE LES VUES
   ========================================================================= */
import { html, ic, raw } from "./dom.js";
import { store } from "../core/store.js";
import { addDays, dateKey, parseDateOnly, startOfWeek, todayKey, DOW_LETTERS, fmtInt, MONTH_NAMES, fmtKg } from "../core/util.js";
import { SLOT_LABELS, SLOT_ICONS, GROUP_LABELS, EQUIP_LABELS, GROUP_ICONS } from "../engine/labels.js";
import { exercisePhotos, exerciseTarget, targetLabel, exerciseEntryFor } from "../engine/training.js";
import { isOverridden } from "../engine/nutrition.js";
import { ui } from "./state.js";

export function avatarButton() {
  const p = store.state.profile;
  const initial = p && p.name ? p.name.trim().charAt(0).toUpperCase() : "";
  return html`<a class="avatar" href="#/profile" aria-label="Mon profil">${initial || ic("user")}</a>`;
}

export function pageHead({ eyebrow = "", title, sub = "", actions = "" }) {
  return html`<header class="page-head">
    <div class="page-head__text">
      ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ""}
      <h1 class="page-title">${title}</h1>
      ${sub ? html`<p class="page-sub">${sub}</p>` : ""}
    </div>
    <div class="page-head__actions">${actions}${avatarButton()}</div>
  </header>`;
}

/* Bande des 7 jours de la semaine du jour sélectionné. mark(dk) renvoie
   les pastilles à afficher sous la date. */
export function weekStrip(mark = () => []) {
  const sel = ui.date;
  const monday = startOfWeek(parseDateOnly(sel));
  const today = todayKey();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i);
    const dk = dateKey(d);
    const marks = mark(dk);
    days.push(html`<button type="button" class="wday${dk === today ? " is-today" : ""}${dk > today ? " is-future" : ""}"
      role="tab" aria-selected="${dk === sel}" data-action="select-day" data-dk="${dk}"
      aria-label="${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}">
      <span class="wday__l">${DOW_LETTERS[i]}</span>
      <span class="wday__n">${d.getDate()}</span>
      <span class="wday__mark">${marks.map((m) => html`<i class="${m}"></i>`)}</span>
    </button>`);
  }
  const sameWeek = dateKey(startOfWeek(new Date())) === dateKey(monday);
  const sunday = addDays(monday, 6);
  const label = sameWeek ? "Cette semaine"
    : monday.getMonth() === sunday.getMonth()
      ? `${monday.getDate()} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()].toLowerCase()}`
      : `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()].slice(0, 4).toLowerCase()}. – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()].slice(0, 4).toLowerCase()}.`;
  return html`<div class="week-block">
    <div class="week-meta">
      <span class="week-meta__label">${label}</span>
      ${sel !== today ? html`<button type="button" class="chip is-accent" data-action="select-day" data-dk="${today}">${ic("rotate-ccw")}Aujourd'hui</button>` : ""}
    </div>
    <div class="week" role="tablist" aria-label="Jours de la semaine">
      <button type="button" class="week__nav" data-action="shift-week" data-dir="-1" aria-label="Semaine précédente">${ic("chevron-left")}</button>
      <div class="week__days">${days}</div>
      <button type="button" class="week__nav" data-action="shift-week" data-dir="1" aria-label="Semaine suivante">${ic("chevron-right")}</button>
    </div>
  </div>`;
}

export function emptyState({ icon: name = "sparkles", title, text = "", action = "" }) {
  return html`<div class="empty">
    <div class="empty__icon">${ic(name)}</div>
    <p class="empty__title">${title}</p>
    ${text ? html`<p class="empty__text">${text}</p>` : ""}
    ${action}
  </div>`;
}

export function metricBar({ label, color, value, max, unit = "kcal", cls = "" }) {
  const pct = max > 0 ? Math.min(100, (100 * value) / max) : 0;
  const over = max > 0 && value > max * 1.05;
  return html`<div class="metric">
    <div class="metric__head">
      <span class="metric__label"><i class="dot" style="background:${raw(color)}"></i>${label}</span>
      <span><b>${fmtInt(value)}</b> / ${fmtInt(max)} ${unit}</span>
    </div>
    <div class="bar ${cls}${over ? " is-over" : ""}"><i style="width:${pct.toFixed(1)}%"></i></div>
  </div>`;
}

export function segmented(items, current, actionName, extra = "") {
  return html`<div class="segmented" role="tablist" ${raw(extra)}>
    ${items.map(([value, label, iconName]) => html`<button type="button" role="tab" aria-selected="${value === current}" data-action="${actionName}" data-value="${value}">${iconName ? ic(iconName) : ""}${label}</button>`)}
  </div>`;
}

/* ---------- Repas ---------- */
export function eatenEntry(dk, slot) {
  return store.state.intakeLog.find((e) => e.slot === dk + "|" + slot) || null;
}
export function mealCard(dk, slot, meal, { compact = false } = {}) {
  const eaten = eatenEntry(dk, slot);
  const chosen = isOverridden(dk, slot);
  return html`<article class="meal${eaten ? " is-eaten" : ""}${compact ? " is-compact" : ""}">
    <button type="button" class="meal__main" data-action="open-recipe" data-dk="${dk}" data-slot="${slot}">
      <span class="meal__icon">${ic(SLOT_ICONS[slot])}</span>
      <span class="meal__body">
        <span class="meal__slot">${SLOT_LABELS[slot]}${chosen ? html` · <em>choisi par toi</em>` : ""}</span>
        <span class="meal__name">${meal.name}</span>
        <span class="meal__macros">
          <b>${fmtInt(meal.kcal)} kcal</b>
          <span><i class="dot" style="background:var(--protein)"></i>${meal.protein} g</span>
          ${compact ? "" : html`<span><i class="dot" style="background:var(--carbs)"></i>${meal.carbs} g</span><span><i class="dot" style="background:var(--fat)"></i>${meal.fat} g</span>`}
        </span>
      </span>
    </button>
    ${dk > todayKey() ? "" : html`<button type="button" class="check${eaten ? " is-on" : ""}" data-action="toggle-eaten" data-dk="${dk}" data-slot="${slot}"
      aria-pressed="${!!eaten}" aria-label="${eaten ? "Marquer comme non mangé" : "Marquer comme mangé"}">${ic("check")}</button>`}
  </article>`;
}

/* ---------- Exercices ---------- */
export function exerciseThumb(ex, cls = "") {
  const photos = exercisePhotos(ex.id);
  return photos.length
    ? html`<span class="thumb ${cls}"><img src="${photos[photos.length > 1 ? 1 : 0]}" alt="" loading="lazy" decoding="async"></span>`
    : html`<span class="thumb is-icon ${cls}">${ic(GROUP_ICONS[ex.group] || "dumbbell")}</span>`;
}

export function exerciseRow(ex, dk, { list = "", index = 0, validate = true } = {}) {
  const p = store.state.profile;
  const entry = dk ? exerciseEntryFor(dk, ex.id) : null;
  const t = exerciseTarget(ex, p);
  let sub = `${GROUP_LABELS[ex.group]} · ${EQUIP_LABELS[ex.equip]}`;
  if (entry) {
    sub = `${entry.sets} × ${entry.reps}${t.enSecondes ? " s" : ""}${entry.load > 0 ? " · " + fmtKg(entry.load) : ""} · ${entry.kcal} kcal`;
    if (entry.completion < 100) sub += ` · ${entry.completion} %`;
  }
  return html`<article class="exo${entry ? " is-done" : ""}">
    <button type="button" class="exo__main" data-action="open-exercise" data-ex="${ex.id}" data-dk="${dk || ""}" data-list="${list}" data-index="${index}">
      ${exerciseThumb(ex)}
      <span class="exo__body">
        <span class="exo__name">${ex.name}</span>
        <span class="exo__sub">${sub}</span>
      </span>
      ${entry ? "" : html`<span class="exo__target">${targetLabel(ex, p)}</span>`}
    </button>
    ${validate && dk ? html`<button type="button" class="check is-accent${entry ? " is-on" : ""}" data-action="validate-exercise" data-ex="${ex.id}" data-dk="${dk}"
      aria-label="${entry ? "Modifier la validation" : "Valider l'exercice"}">${ic("check")}</button>` : ""}
  </article>`;
}

export function disclaimer(text) {
  return html`<div class="note mt-24">${ic("info")}<p>${text}</p></div>`;
}
