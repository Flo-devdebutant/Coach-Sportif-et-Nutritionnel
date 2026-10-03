/* Fiche exercice : démonstration, muscles, objectif personnalisé,
   minuteur de maintien, progression de la charge et guide d'exécution.
   Navigation précédent / suivant dans la séance ou la liste d'origine. */
import { html, ic, actionsFor } from "../ui/dom.js";
import { openSheet } from "../ui/sheet.js";
import { muscleMap, sparkline, ring } from "../ui/charts.js";
import { segmented } from "../ui/components.js";
import { store } from "../core/store.js";
import { on } from "../core/events.js";
import { EXERCISE_GUIDE, EXERCISE_DESC } from "../data/exercise-guides.js";
import {
  exerciseById, exercisePhotos, exerciseTarget, rangeLabel, restSeconds, exerciseKind,
  historiqueCharge, exercicePeutEtreCharge, exerciseEntryFor, formatCharge,
} from "../engine/training.js";
import { GROUP_LABELS, EQUIP_LABELS, LEVEL_BY_RANK, GROUP_ICONS } from "../engine/labels.js";
import { fmtDayMonth, fmtDuration, vibrate } from "../core/util.js";
import { openValidate } from "./validate.js";

let ctx = null; /* { ctrl, ids, index, dk, tab } */
let timer = null; /* { duree, restant, series, serie, actif, fini, iv } */

function stopTimer() {
  if (timer && timer.iv) { clearInterval(timer.iv); timer.iv = null; }
  if (timer) timer.actif = false;
}
function resetTimer(ex) {
  stopTimer();
  const t = exerciseTarget(ex, store.state.profile);
  timer = { duree: t.reps, restant: t.reps, series: t.sets, serie: 1, actif: false, fini: false, iv: null };
}
function timerHtml() {
  const s = timer;
  return html`<div class="timer">
    <div class="timer__ring">${ring(s.duree ? s.restant / s.duree : 0, { size: 104, stroke: 9, color: s.fini ? "var(--success)" : "var(--accent-strong)" })}
      <span class="timer__val num">${fmtDuration(s.restant)}</span></div>
    <div class="timer__side">
      <p class="timer__set">${s.fini ? "Séries terminées" : `Série ${s.serie} sur ${s.series}`}</p>
      <p class="timer__note">${s.fini ? "Tu peux valider l'exercice." : `Tenue conseillée : ${s.duree} secondes`}</p>
      <div class="row mt-8">
        ${s.fini ? "" : html`<button type="button" class="btn btn-primary btn-sm" data-action="exo-timer" data-op="${s.actif ? "pause" : "start"}">${ic(s.actif ? "pause" : "play")}${s.actif ? "Pause" : "Démarrer"}</button>`}
        <button type="button" class="btn btn-secondary btn-sm" data-action="exo-timer" data-op="reset">${ic("rotate-ccw")}Réinitialiser</button>
      </div>
    </div>
  </div>`;
}
function paintTimer() {
  const host = ctx && ctx.ctrl.body.querySelector("[data-timer-host]");
  if (host) host.innerHTML = String(timerHtml());
}
function tick() {
  if (!timer) return;
  timer.restant--;
  if (timer.restant <= 0) {
    /* Fin d'une tenue : vibration, puis série suivante sans relance
       automatique (le temps de se remettre en place). */
    vibrate([180, 80, 180]);
    stopTimer();
    if (timer.serie >= timer.series) { timer.fini = true; timer.restant = 0; }
    else { timer.serie++; timer.restant = timer.duree; }
  }
  paintTimer();
}

function guideHtml(ex) {
  const g = EXERCISE_GUIDE[ex.id];
  if (!g) return EXERCISE_DESC[ex.id] ? html`<h3 class="sub-title">Exécution</h3><p class="guide-p">${EXERCISE_DESC[ex.id]}</p>` : "";
  return html`
    <h3 class="sub-title">Position de départ</h3>
    <p class="guide-p">${g.d}</p>
    <h3 class="sub-title">Exécution</h3>
    <ol class="steps">${g.e.map((s) => html`<li>${s}</li>`)}</ol>
    ${g.v && g.v.length ? html`<h3 class="sub-title">Points de vigilance</h3>
      <div class="guide-warn">${g.v.map((s) => html`<p>${ic("triangle-alert", "icon-sm")}<span>${s}</span></p>`)}</div>` : ""}
    ${g.r ? html`<h3 class="sub-title">Respiration</h3><p class="guide-breath">${ic("waves", "icon-sm")}<span>${g.r}</span></p>` : ""}`;
}

function fill() {
  const { ctrl, ids, index, dk, tab } = ctx;
  const ex = exerciseById(ids[index]);
  if (!ex) return;
  const p = store.state.profile;
  const t = exerciseTarget(ex, p);
  const photos = exercisePhotos(ex.id);
  const mm = muscleMap(ex);
  const entry = dk ? exerciseEntryFor(dk, ex.id) : null;
  const histo = exercicePeutEtreCharge(ex) ? historiqueCharge(ex.id, null).slice(0, 8) : [];
  const timed = ex.hold || ex.cardio || ex.timed;
  if (timed && (!timer || timer.exId !== ex.id)) { resetTimer(ex); timer.exId = ex.id; }
  if (!timed) { stopTimer(); timer = null; }

  ctrl.setTitle(ex.name, ids.length > 1 ? `Exercice ${index + 1} sur ${ids.length}` : `${GROUP_LABELS[ex.group]} · ${EQUIP_LABELS[ex.equip]}`);
  const media = tab === "muscles"
    ? html`<div class="exo-muscles">${mm.svg}
        <div class="legend"><span><i class="dot" style="background:var(--burn)"></i>Principal</span>${mm.secondary.length ? html`<span><i class="dot" style="background:var(--carbs)"></i>Secondaire</span>` : ""}</div>
      </div>`
    : photos.length
      ? html`<div class="exo-media${photos.length > 1 ? " is-loop" : ""}">
          ${photos.map((src, i) => html`<img src="${src}" alt="${i === 0 ? "Position de départ" : "Position de travail"}" class="exo-media__img is-${i + 1}" decoding="async">`)}
          ${photos.length > 1 ? html`<span class="exo-media__tag">Départ · Travail</span>` : ""}
        </div>`
      : html`<div class="exo-media is-empty">${ic(GROUP_ICONS[ex.group] || "dumbbell", "icon-xl")}<p>Pas de photo pour cet exercice : suis le guide ci-dessous.</p></div>`;

  ctrl.setBody(html`
    ${segmented([["demo", "Démonstration", "image"], ["muscles", "Muscles", "target"]], tab, "exo-tab")}
    <div class="mt-12">${media}</div>

    <div class="chips mt-16">
      <span class="chip">${ic(GROUP_ICONS[ex.group] || "dumbbell")}${GROUP_LABELS[ex.group]}</span>
      <span class="chip">${ic("dumbbell")}${EQUIP_LABELS[ex.equip]}</span>
      <span class="chip ${ex.poly ? "is-accent" : ""}">${exerciseKind(ex)}</span>
      <span class="chip">${ic("gauge")}${LEVEL_BY_RANK[ex.minLevel] || "Débutant"}</span>
    </div>

    <div class="target-card mt-16">
      <div><span class="faint">Ton objectif</span><b class="num">${t.sets} × ${t.reps}${t.enSecondes ? " s" : ""}</b></div>
      <div><span class="faint">Repos</span><b class="num">${restSeconds(ex, p)} s</b></div>
      <div><span class="faint">Fourchette</span><span class="target-card__range">${rangeLabel(ex, p.level)}</span></div>
    </div>
    ${entry ? html`<p class="done-line">${ic("circle-check")}Validé : ${entry.sets} × ${entry.reps}${t.enSecondes ? " s" : ""}${entry.load > 0 ? " · " + formatCharge(entry.load) : ""} · ${entry.kcal} kcal</p>` : ""}

    ${timed ? html`<div data-timer-host class="mt-16">${timerHtml()}</div>` : ""}

    ${mm.primary.length ? html`<div class="muscle-lists">
      <p><span class="faint">${mm.primary.length > 1 ? "Muscles principaux" : "Muscle principal"}</span><b style="color:var(--burn)">${mm.primary.join(" · ")}</b></p>
      ${mm.secondary.length ? html`<p><span class="faint">Également sollicités</span><b>${mm.secondary.join(" · ")}</b></p>` : ""}
    </div>` : ""}

    ${histo.length ? html`<h3 class="sub-title">Progression de la charge</h3>
      <div class="load-history">
        ${histo.length > 1 ? html`<div class="load-history__spark">${sparkline(histo.slice().reverse().map((e) => e.load), { w: 260, h: 44 })}</div>` : ""}
        ${histo.map((e) => html`<div class="row-between"><span class="muted">${fmtDayMonth(e.dateKey)} · ${e.sets}×${e.reps}</span><b class="num">${formatCharge(e.load)}</b></div>`)}
      </div>` : ""}

    ${guideHtml(ex)}
  `);
  ctrl.setFoot(html`
    <button type="button" class="icon-btn" data-action="exo-step" data-dir="-1" aria-label="Exercice précédent" ${index > 0 ? "" : "disabled"} style="${index > 0 ? "" : "opacity:.35"}">${ic("chevron-left")}</button>
    ${dk ? html`<button type="button" class="btn ${entry ? "btn-success" : "btn-primary"}" data-action="exo-validate">${ic("check")}${entry ? "Modifier la validation" : "Valider l'exercice"}</button>`
         : html`<button type="button" class="btn btn-secondary" data-sheet-dismiss>Fermer</button>`}
    <button type="button" class="icon-btn" data-action="exo-step" data-dir="1" aria-label="Exercice suivant" ${index < ids.length - 1 ? "" : "disabled"} style="${index < ids.length - 1 ? "" : "opacity:.35"}">${ic("chevron-right")}</button>
  `);
}

export function openExercise(exId, { dk = "", ids = null, index = 0 } = {}) {
  const list = ids && ids.length ? ids : [exId];
  const ctrl = openSheet({ id: "exercise", size: "full", onClose: () => { stopTimer(); timer = null; ctx = null; } });
  ctx = { ctrl, ids: list, index: Math.max(0, list.indexOf(exId)), dk, tab: "demo" };
  if (list.indexOf(exId) < 0) ctx.index = index;
  fill();
}

on("change", () => { if (ctx && !ctx.ctrl.closed) requestAnimationFrame(() => ctx && fill()); });

actionsFor({
  "exo-tab": (el) => { if (!ctx) return; ctx.tab = el.dataset.value; fill(); },
  "exo-step": (el) => {
    if (!ctx) return;
    const n = ctx.index + Number(el.dataset.dir);
    if (n < 0 || n >= ctx.ids.length) return;
    ctx.index = n; ctx.tab = "demo";
    fill();
    ctx.ctrl.body.scrollTo({ top: 0 });
  },
  "exo-validate": () => { if (ctx) openValidate(ctx.ids[ctx.index], ctx.dk); },
  "exo-timer": (el) => {
    if (!timer) return;
    const op = el.dataset.op;
    if (op === "start") { timer.actif = true; timer.iv = setInterval(tick, 1000); }
    else if (op === "pause") stopTimer();
    else { const ex = exerciseById(ctx.ids[ctx.index]); resetTimer(ex); timer.exId = ex.id; }
    paintTimer();
  },
});
