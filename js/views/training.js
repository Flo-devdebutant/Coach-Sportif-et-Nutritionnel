/* =========================================================================
   ENTRAÎNEMENT — programme de la semaine, séance du jour sélectionné,
   et bibliothèque de tous les exercices.
   ========================================================================= */
import { html, ic, actionsFor, inputsFor, $ } from "../ui/dom.js";
import { pageHead, weekStrip, exerciseRow, emptyState, disclaimer } from "../ui/components.js";
import { store } from "../core/store.js";
import { ui } from "../ui/state.js";
import { todayKey, parseDateOnly, relativeDay, fmtInt, DAY_NAMES, fmtDuration, normTxt } from "../core/util.js";
import { dayPlan, weekPlan, dayStats } from "../engine/stats.js";
import {
  sessionEstimate, sessionProgress, sessionDoneOn, materielPossible, filtreMateriel, filtreMaterielRestreint, EXERCISES, levelRank,
} from "../engine/training.js";
import { GROUP_LABELS, EQUIP_LABELS, LEVEL_LABELS } from "../engine/labels.js";
import { setEquipFilter, finishSession, reopenSession } from "../domain.js";
import { confirmDialog } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { weekMarks } from "./today.js";

function equipBar() {
  const possible = materielPossible();
  if (possible.length < 2) return "";
  const actifs = filtreMateriel();
  return html`<div class="equip">
    <span class="equip__label">${ic("dumbbell", "icon-xs")}Matériel du moment</span>
    <div class="chips-scroll">
      ${possible.map((e) => html`<button type="button" class="choice" aria-pressed="${actifs.includes(e)}" data-action="equip-toggle" data-v="${e}">${EQUIP_LABELS[e]}</button>`)}
      ${filtreMaterielRestreint() ? html`<button type="button" class="choice" data-action="equip-all">${ic("rotate-ccw")}Tout</button>` : ""}
    </div>
  </div>`;
}

function sessionHeader(day) {
  const p = store.state.profile;
  const est = sessionEstimate(day, p);
  const prog = sessionProgress(day);
  const done = sessionDoneOn(day.dateKey);
  const log = store.state.sessionLog.find((s) => s.dateKey === day.dateKey);
  return html`<section class="hero session-hero${done ? " is-done" : ""}">
    <div class="row-between">
      <p class="eyebrow">${relativeDay(day.dateKey)}</p>
      ${done ? html`<span class="chip is-success">${ic("circle-check")}Terminée${log && log.durationSec ? ` · ${fmtDuration(log.durationSec)}` : ""}</span>` : prog.done ? html`<span class="chip is-accent">${prog.done}/${prog.total} validés</span>` : ""}
    </div>
    <h2 class="session-hero__title">${day.label}</h2>
    <div class="session-hero__stats">
      <div><b class="num">${day.exercises.length}</b><span>exercices</span></div>
      <div><b class="num">~${est.minutes}</b><span>minutes</span></div>
      <div><b class="num">~${fmtInt(est.kcal)}</b><span>kcal</span></div>
    </div>
    <div class="bar is-thin mt-16"><i style="width:${(prog.pct * 100).toFixed(0)}%"></i></div>
    <div class="session-hero__actions">
      ${done
        ? html`<button type="button" class="btn btn-secondary" data-action="session-reopen" data-dk="${day.dateKey}">${ic("rotate-ccw")}Rouvrir</button>`
        : html`<a class="btn btn-primary" href="#/workout/${day.dateKey}">${ic("play")}${prog.done ? "Continuer" : "Démarrer"}</a>
               <button type="button" class="btn btn-secondary" data-action="session-finish" data-dk="${day.dateKey}">${ic("check")}Tout valider</button>`}
    </div>
  </section>`;
}

function weekOverview() {
  const w = weekPlan(parseDateOnly(ui.date));
  const today = todayKey();
  return html`<section class="section">
    <div class="section-head"><h2 class="section-title">Ta semaine</h2><span class="faint">${w.workout.filter((d) => dayStats(d.dateKey).ses).length}/${w.workout.filter((d) => d.training).length} séances</span></div>
    <div class="card is-flush">
      ${w.workout.map((d) => {
        const done = sessionDoneOn(d.dateKey);
        const prog = d.training ? sessionProgress(d) : null;
        return html`<button type="button" class="list-row week-row${d.dateKey === ui.date ? " is-current" : ""}" data-action="select-day" data-dk="${d.dateKey}">
          <span class="week-row__day${d.dateKey === today ? " is-today" : ""}"><b>${DAY_NAMES[(d.date.getDay() + 6) % 7].slice(0, 3)}</b><span>${d.date.getDate()}</span></span>
          <span class="list-row__body"><span class="list-row__title">${d.training ? d.label : "Repos"}</span>
            <span class="list-row__sub">${d.training ? `${d.exercises.length} exercices${prog.done && !done ? ` · ${prog.done} validés` : ""}` : "Récupération, marche, étirements"}</span></span>
          ${done ? html`<span class="chip is-success">${ic("check")}Fait</span>` : d.training ? (d.dateKey < today ? html`<span class="chip">Manquée</span>` : html`<span class="chip is-accent">Prévue</span>`) : ""}
        </button>`;
      })}
    </div>
  </section>`;
}

export const trainingView = {
  nav: "training",
  title: "Entraînement",
  render() {
    const p = store.state.profile;
    const day = dayPlan(ui.date).workout;
    const ids = day && day.training ? day.exercises.map((e) => e.id).join(",") : "";
    return html`
      ${pageHead({
        eyebrow: `${LEVEL_LABELS[p.level]} · ${p.sessionsPerWeek} séance${p.sessionsPerWeek > 1 ? "s" : ""} par semaine`,
        title: "Entraînement",
        actions: html`<a class="icon-btn" href="#/library" aria-label="Bibliothèque d'exercices">${ic("book-open")}</a>`,
      })}
      ${weekStrip(weekMarks)}
      ${equipBar()}
      <div class="cols mt-16">
        <div>
          ${day && day.training ? html`
            ${sessionHeader(day)}
            <section class="section">
              <div class="section-head"><h2 class="section-title">Exercices</h2><span class="faint">Touche pour le détail</span></div>
              <div class="exos">${day.exercises.map((ex, i) => exerciseRow(ex, day.dateKey, { list: ids, index: i }))}</div>
            </section>` : html`
            <section class="hero">
              ${emptyState({ icon: "bed", title: `Repos ${ui.date === todayKey() ? "aujourd'hui" : relativeDay(ui.date).toLowerCase()}`, text: "La récupération fait partie du programme : c'est là que le muscle se reconstruit. Une activité douce reste possible.",
                action: html`<button type="button" class="btn btn-secondary" data-action="add-activity">${ic("plus")}Ajouter une activité</button>` })}
            </section>`}
        </div>
        <div>
          ${weekOverview()}
          <a class="card card-link library-cta mt-16" href="#/library">
            <span class="library-cta__icon">${ic("book-open")}</span>
            <span class="grow"><b>Bibliothèque d'exercices</b><span>${EXERCISES.length} mouvements expliqués, avec photos et muscles sollicités</span></span>
            ${ic("chevron-right", "list-row__chev")}
          </a>
          ${disclaimer("La régularité prime sur la complexité : travailler chaque grand groupe musculaire au moins deux fois par semaine compte plus qu'un programme parfait. Échauffe-toi 5 à 10 minutes avant chaque séance et arrête-toi en cas de douleur.")}
        </div>
      </div>`;
  },
};

actionsFor({
  "equip-toggle": (el) => {
    const cur = filtreMateriel().slice();
    const i = cur.indexOf(el.dataset.v);
    if (i < 0) cur.push(el.dataset.v);
    else {
      /* Au moins un matériel reste actif : un programme sans matériel du
         tout n'existe pas. */
      if (cur.length === 1) { toast("Garde au moins un type de matériel.", { type: "info" }); return; }
      cur.splice(i, 1);
    }
    setEquipFilter(cur);
  },
  "equip-all": () => setEquipFilter(materielPossible()),
  "session-finish": async (el) => {
    const dk = el.dataset.dk;
    const prog = sessionProgress(dayPlan(dk).workout);
    if (prog.done < prog.total) {
      const ok = await confirmDialog({
        title: "Tout valider ?",
        body: `Les ${prog.total - prog.done} exercice${prog.total - prog.done > 1 ? "s" : ""} non validé${prog.total - prog.done > 1 ? "s" : ""} seront comptés comme réalisés selon ton objectif.`,
        okLabel: "Valider la séance",
      });
      if (!ok) return;
    }
    if (await finishSession(dk)) toast("Séance validée. Bravo !");
  },
  "session-reopen": async (el) => { await reopenSession(el.dataset.dk); toast("Séance rouverte.", { type: "info" }); },
});

/* ---------- Bibliothèque ---------- */
function libraryResults() {
  const { q, group, equip } = ui.library;
  const lvl = levelRank(store.state.profile.level);
  const t = normTxt(q.trim());
  const list = EXERCISES.filter((e) =>
    (!group || e.group === group) && (!equip || e.equip === equip) &&
    (!t || normTxt(e.name + " " + GROUP_LABELS[e.group]).includes(t)));
  /* Les exercices accessibles au niveau de la personne d'abord. */
  list.sort((a, b) => (a.minLevel > lvl) - (b.minLevel > lvl) || a.name.localeCompare(b.name, "fr"));
  const ids = list.map((e) => e.id).join(",");
  return html`<p class="list-caption">${list.length} exercice${list.length > 1 ? "s" : ""}</p>
    ${list.length ? html`<div class="exos">${list.slice(0, 120).map((ex, i) => exerciseRow(ex, "", { list: ids, index: i, validate: false }))}</div>`
      : emptyState({ icon: "search", title: "Aucun exercice", text: "Essaie un autre mot ou retire un filtre." })}`;
}

export const libraryView = {
  nav: "training",
  title: "Bibliothèque",
  render() {
    const { q, group, equip } = ui.library;
    return html`
      <header class="page-head">
        <div class="page-head__text">
          <a class="back-link" href="#/training">${ic("chevron-left")}Entraînement</a>
          <h1 class="page-title">Bibliothèque</h1>
          <p class="page-sub">${EXERCISES.length} exercices détaillés, du débutant à l'avancé.</p>
        </div>
      </header>
      <div class="input-wrap has-icon">
        <span class="input-wrap__icon">${ic("search")}</span>
        <input class="input" type="search" placeholder="Squat, pompes, gainage…" value="${q}" data-input="library-q" autocomplete="off" enterkeyhint="search">
      </div>
      <div class="chips-scroll mt-12">
        <button type="button" class="choice" aria-pressed="${!group}" data-action="library-group" data-v="">Tous</button>
        ${Object.entries(GROUP_LABELS).map(([k, l]) => html`<button type="button" class="choice" aria-pressed="${group === k}" data-action="library-group" data-v="${k}">${l}</button>`)}
      </div>
      <div class="chips-scroll mt-8">
        <button type="button" class="choice is-sm" aria-pressed="${!equip}" data-action="library-equip" data-v="">Tout matériel</button>
        ${Object.entries(EQUIP_LABELS).map(([k, l]) => html`<button type="button" class="choice is-sm" aria-pressed="${equip === k}" data-action="library-equip" data-v="${k}">${l}</button>`)}
      </div>
      <div id="libResults" class="mt-16">${libraryResults()}</div>`;
  },
};

function refreshLibrary() {
  const host = $("#libResults");
  if (host) host.innerHTML = String(libraryResults());
}
inputsFor({ "library-q": (el) => { ui.library.q = el.value; refreshLibrary(); } });
actionsFor({
  "library-group": (el) => {
    ui.library.group = el.dataset.v;
    for (const b of document.querySelectorAll("[data-action=library-group]")) b.setAttribute("aria-pressed", String(b.dataset.v === ui.library.group));
    refreshLibrary();
  },
  "library-equip": (el) => {
    ui.library.equip = el.dataset.v;
    for (const b of document.querySelectorAll("[data-action=library-equip]")) b.setAttribute("aria-pressed", String(b.dataset.v === ui.library.equip));
    refreshLibrary();
  },
});
