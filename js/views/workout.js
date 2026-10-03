/* =========================================================================
   SÉANCE GUIDÉE — plein écran, un exercice à la fois.
   Chaque série se valide d'un geste ; un minuteur de repos s'enchaîne
   automatiquement (vibration et bip à la fin). Les exercices en secondes
   ont leur compte à rebours. L'écran reste allumé, et la progression est
   mémorisée : fermer l'application ne fait rien perdre.
   Chaque exercice terminé est enregistré aussitôt dans le journal ; en
   fin de séance, seuls les exercices réellement faits sont comptés.
   ========================================================================= */
import { html, ic, actionsFor, readNum, $ } from "../ui/dom.js";
import { ring } from "../ui/charts.js";
import { toast } from "../ui/toast.js";
import { confirmDialog } from "../ui/sheet.js";
import { go, rerender } from "../ui/router.js";
import { local, store } from "../core/store.js";
import { fmtDuration, fmtInt, fmtKg, todayKey, vibrate, clamp } from "../core/util.js";
import { dayPlan } from "../engine/stats.js";
import {
  exerciseById, exercisePhotos, exerciseTarget, restSeconds, exercicePeutEtreCharge, derniereCharge, exerciseEntryFor,
} from "../engine/training.js";
import { GROUP_LABELS, GROUP_ICONS } from "../engine/labels.js";
import { validateExercise, finishSession } from "../domain.js";
import { keepAwake, nudgeReload } from "../services/pwa.js";
import { openExercise } from "../sheets/exercise.js";
import { stepper } from "../sheets/validate.js";

const KEY = "carnet.workout.v1";
let ws = null;      /* état de la séance en cours */
let loop = null;    /* minuterie d'affichage */
let audio = null;

const save = () => local.set(KEY, ws);
const ex = () => exerciseById(ws.ids[ws.index]);
const done = (id) => (ws.sets[id] || []).length;
/* Objectif de séries, augmenté des séries supplémentaires demandées. */
const targetSets = (e) => exerciseTarget(e, store.state.profile, ws.dk).sets + ((ws.extra || {})[e.id] || 0);

function load(dk) {
  const day = dayPlan(dk).workout;
  if (!day || !day.training) return null;
  const ids = day.exercises.map((e) => e.id);
  const saved = local.get(KEY);
  if (saved && saved.dk === dk && saved.ids.join() === ids.join()) return saved;
  /* Nouvelle séance : les exercices déjà validés depuis la liste sont
     repris tels quels. */
  const sets = {};
  for (const id of ids) {
    const e = exerciseEntryFor(dk, id);
    if (e) sets[id] = Array.from({ length: e.sets }, () => ({ reps: e.reps, load: e.load || 0 }));
  }
  const first = ids.findIndex((id) => !sets[id]);
  return { dk, label: day.label, ids, index: first < 0 ? 0 : first, sets, extra: {}, startedAt: Date.now(), rest: null, timed: null, phase: "work" };
}

/* ---------- Son et vibration ---------- */
function unlockAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
  } catch (e) { audio = null; }
}
function beep(times = 2) {
  vibrate([200, 100, 200]);
  if (!audio) return;
  try {
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator(), g = audio.createGain();
      const t0 = audio.currentTime + i * 0.22;
      o.frequency.value = i === times - 1 ? 1046 : 880;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(audio.destination);
      o.start(t0); o.stop(t0 + 0.2);
    }
  } catch (e) { /* son indisponible */ }
}

/* ---------- Enchaînement ---------- */
async function completeExercise(id) {
  const list = ws.sets[id] || [];
  if (!list.length) return;
  const reps = Math.round(list.reduce((s, x) => s + x.reps, 0) / list.length);
  const kg = list.reduce((m, x) => Math.max(m, x.load || 0), 0);
  await validateExercise(ws.dk, id, list.length, reps, kg);
}

function startRest(seconds, after) {
  ws.rest = { end: Date.now() + seconds * 1000, total: seconds, after };
  save();
  rerender();
}
async function endRest() {
  if (!ws || !ws.rest) return;
  const after = ws.rest.after;
  ws.rest = null;
  if (after === "next") ws.index = Math.min(ws.ids.length - 1, ws.index + 1);
  save();
  rerender();
}

async function logSet(reps, kg) {
  const e = ex();
  (ws.sets[e.id] = ws.sets[e.id] || []).push({ reps, load: kg || 0 });
  ws.timed = null;
  save();
  const rest = restSeconds(e, store.state.profile, ws.dk);
  if (done(e.id) < targetSets(e)) { startRest(rest, "same"); return; }
  await completeExercise(e.id);
  const allDone = ws.ids.every((id) => done(id) >= targetSets(exerciseById(id)));
  if (allDone || ws.index >= ws.ids.length - 1) {
    ws.phase = "summary";
    ws.endedAt = Date.now();
    save();
    rerender();
    return;
  }
  startRest(rest, "next");
}

/* ---------- Rendu ---------- */
function segments() {
  return html`<div class="player__segments">${ws.ids.map((id, i) => {
    const e = exerciseById(id);
    const pct = clamp(done(id) / targetSets(e), 0, 1);
    return html`<button type="button" class="seg${i === ws.index && ws.phase === "work" ? " is-current" : ""}" data-action="wo-goto" data-i="${i}" aria-label="${e.name}"><i style="width:${(pct * 100).toFixed(0)}%"></i></button>`;
  })}</div>`;
}

function media(e) {
  const photos = exercisePhotos(e.id);
  if (!photos.length) return html`<div class="player__media is-empty">${ic(GROUP_ICONS[e.group] || "dumbbell", "icon-xl")}</div>`;
  return html`<div class="player__media exo-media${photos.length > 1 ? " is-loop" : ""}">
    ${photos.map((src, i) => html`<img src="${src}" alt="" class="exo-media__img is-${i + 1}" decoding="async">`)}
  </div>`;
}

function restView() {
  const r = ws.rest;
  const left = Math.max(0, Math.ceil((r.end - Date.now()) / 1000));
  const nextEx = r.after === "next" ? exerciseById(ws.ids[Math.min(ws.ids.length - 1, ws.index + 1)]) : ex();
  const nextSet = done(nextEx.id) + 1;
  return html`<div class="rest">
    <p class="eyebrow">Récupération</p>
    <div class="rest__ring">
      <span id="woRestRing">${ring(left / r.total, { size: 220, stroke: 14, color: "var(--accent-strong)" })}</span>
      <span class="rest__time num" id="woRestTime">${fmtDuration(left)}</span>
    </div>
    <div class="row rest__adjust">
      <button type="button" class="btn btn-secondary" data-action="wo-rest-adj" data-d="-15">−15 s</button>
      <button type="button" class="btn btn-secondary" data-action="wo-rest-adj" data-d="15">+15 s</button>
    </div>
    <div class="rest__next">
      <span class="faint">Ensuite</span>
      <b>${nextEx.name}</b>
      <span class="muted">Série ${nextSet} sur ${targetSets(nextEx)}</span>
    </div>
    <button type="button" class="btn btn-primary btn-lg btn-block" data-action="wo-rest-skip">${ic("skip-forward")}Passer le repos</button>
  </div>`;
}

function workView() {
  const e = ex();
  const p = store.state.profile;
  const t = exerciseTarget(e, p, ws.dk);
  const n = done(e.id);
  const goal = targetSets(e);
  const finished = n >= goal;
  const last = (ws.sets[e.id] || [])[n - 1];
  const chargeable = exercicePeutEtreCharge(e);
  const prevLoad = last ? last.load : t.load || (derniereCharge(e.id, ws.dk) || {}).load || 0;
  const dots = Math.max(goal, n);
  let controls;
  if (finished) {
    controls = html`<div class="player__done">${ic("circle-check", "icon-xl")}<b>Exercice terminé</b>
      <span class="muted">${n} série${n > 1 ? "s" : ""}${last && last.load ? " · " + fmtKg(last.load) : ""}</span></div>`;
  } else if (t.enSecondes) {
    const tm = ws.timed;
    const left = tm ? (tm.running ? Math.max(0, Math.ceil((tm.end - Date.now()) / 1000)) : tm.remaining) : t.reps;
    controls = html`<div class="player__timer">
      <span id="woTimedRing">${ring(left / t.reps, { size: 168, stroke: 12, color: "var(--burn)" })}</span>
      <span class="player__timer-val num" id="woTimedVal">${fmtDuration(left)}</span>
    </div>`;
  } else {
    controls = html`<div class="fields-2 player__steppers">
      ${stepper({ id: "woReps", value: last ? last.reps : t.reps, min: 1, max: 100, label: "Répétitions" })}
      ${chargeable ? stepper({ id: "woLoad", value: String(prevLoad || 0).replace(".", ","), step: 2.5, min: 0, max: 500, unit: "kg", label: "Charge", decimal: true }) : html`<div class="player__bodyweight"><span class="faint">Charge</span><b>Poids du corps</b></div>`}
    </div>`;
  }
  let primary;
  if (finished) primary = ws.index < ws.ids.length - 1
    ? html`<button type="button" class="btn btn-primary btn-lg grow" data-action="wo-next">Exercice suivant${ic("arrow-right")}</button>`
    : html`<button type="button" class="btn btn-primary btn-lg grow" data-action="wo-summary">${ic("trophy")}Terminer</button>`;
  else if (t.enSecondes) {
    const running = ws.timed && ws.timed.running;
    primary = html`<button type="button" class="btn btn-primary btn-lg grow" data-action="wo-timed">${ic(running ? "pause" : "play")}${running ? "Pause" : ws.timed ? "Reprendre" : "Démarrer"}</button>`;
  } else primary = html`<button type="button" class="btn btn-primary btn-lg grow" data-action="wo-set-done">${ic("check")}Série ${n + 1} terminée</button>`;

  return html`
    ${media(e)}
    <div class="player__info">
      <p class="eyebrow">Exercice ${ws.index + 1} sur ${ws.ids.length} · ${GROUP_LABELS[e.group]}</p>
      <h1 class="player__name">${e.name}</h1>
      <div class="set-dots" aria-label="${n} séries sur ${goal}">${Array.from({ length: dots }, (_, k) => html`<i class="${k < n ? "is-done" : k === n && !finished ? "is-current" : ""}"></i>`)}</div>
      <p class="player__target">${finished ? "Objectif atteint" : `Série ${n + 1} sur ${goal} · objectif ${t.reps}${t.enSecondes ? " secondes" : " répétitions"}${t.load ? " à " + fmtKg(t.load) : ""}`}</p>
      ${n === 0 && t.note ? html`<p class="player__note">${ic(t.trend === "down" ? "trending-down" : t.trend === "start" ? "lightbulb" : "trending-up")}${t.note}</p>` : ""}
    </div>
    <div class="player__controls">${controls}</div>
    <footer class="player__foot">
      <button type="button" class="icon-btn" data-action="wo-prev" aria-label="Exercice précédent" ${ws.index > 0 ? "" : "disabled"}>${ic("skip-back")}</button>
      ${primary}
      ${finished ? html`<button type="button" class="icon-btn" data-action="wo-extra" aria-label="Série supplémentaire">${ic("plus")}</button>`
        : html`<button type="button" class="icon-btn" data-action="wo-skip" aria-label="Passer l'exercice">${ic("skip-forward")}</button>`}
    </footer>`;
}

/* Mieux que la dernière fois : plus de travail total (répétitions × charge,
   ou répétitions seules au poids du corps). */
function beatLast(id) {
  const sets = ws.sets[id] || [];
  const e = exerciseById(id);
  const last = e && exerciseTarget(e, store.state.profile, ws.dk).last;
  if (!sets.length || !last) return false;
  const work = (n, reps, kg) => n * reps * (kg > 0 ? kg : 1);
  const now = sets.reduce((a, x) => a + x.reps * (x.load > 0 ? x.load : 1), 0);
  return now > work(last.sets, last.reps, last.load);
}

function summaryView() {
  const entries = store.state.activityLog.filter((e) => e.dateKey === ws.dk && ws.ids.includes(e.exId));
  const totalSets = ws.ids.reduce((s, id) => s + done(id), 0);
  const volume = ws.ids.reduce((s, id) => s + (ws.sets[id] || []).reduce((a, x) => a + (x.load ? x.load * x.reps : 0), 0), 0);
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  const dur = Math.round(((ws.endedAt || Date.now()) - ws.startedAt) / 1000);
  const nbDone = ws.ids.filter((id) => done(id)).length;
  const records = ws.ids.filter((id) => beatLast(id)).length;
  return html`<div class="summary-screen">
    <div class="summary-screen__badge">${ic("trophy", "icon-xl")}</div>
    <h1 class="summary-screen__title">${nbDone === ws.ids.length ? "Séance terminée !" : "Bien joué !"}</h1>
    <p class="muted">${ws.label}</p>
    ${records ? html`<p class="chip is-accent mt-12">${ic("trending-up")}${records} exercice${records > 1 ? "s" : ""} en progrès par rapport à la dernière fois</p>` : ""}
    <div class="grid-2 mt-24 summary-screen__stats">
      <div class="stat"><p class="stat__label">${ic("clock")}Durée</p><p class="stat__value">${fmtDuration(dur)}</p></div>
      <div class="stat"><p class="stat__label">${ic("flame")}Énergie</p><p class="stat__value">${fmtInt(kcal)}<small>kcal</small></p></div>
      <div class="stat"><p class="stat__label">${ic("list-checks")}Exercices</p><p class="stat__value">${nbDone}<small>/ ${ws.ids.length}</small></p></div>
      <div class="stat"><p class="stat__label">${ic("dumbbell")}${volume ? "Volume" : "Séries"}</p><p class="stat__value">${volume ? fmtInt(volume) : totalSets}<small>${volume ? "kg" : ""}</small></p></div>
    </div>
    <div class="stack mt-24">
      <button type="button" class="btn btn-primary btn-lg btn-block" data-action="wo-finish">${ic("check")}Enregistrer la séance</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="wo-resume">Revenir aux exercices</button>
    </div>
  </div>`;
}

export const workoutView = {
  immersive: true,
  nav: "training",
  title: "Séance",
  render(params) {
    const dk = params[0] || todayKey();
    if (!ws || ws.dk !== dk) ws = load(dk);
    if (!ws) return html`<div class="player"><div class="summary-screen">${ic("bed", "icon-xl")}<h1 class="summary-screen__title">Pas de séance ce jour-là</h1><a class="btn btn-primary mt-24" href="#/training">Retour au programme</a></div></div>`;
    save();
    const elapsed = Math.round(((ws.endedAt || Date.now()) - ws.startedAt) / 1000);
    return html`<div class="player${ws.rest ? " is-resting" : ""}">
      <header class="player__top">
        <button type="button" class="icon-btn is-plain" data-action="wo-exit" aria-label="Quitter la séance">${ic("x")}</button>
        <div class="player__heading"><b>${ws.label}</b><span class="num" id="woElapsed">${fmtDuration(elapsed)}</span></div>
        ${ws.phase === "work" ? html`<button type="button" class="icon-btn is-plain" data-action="wo-guide" aria-label="Guide de l'exercice">${ic("circle-help")}</button>` : html`<span style="width:42px"></span>`}
      </header>
      ${ws.phase === "work" ? segments() : ""}
      <div class="player__body">${ws.phase === "summary" ? summaryView() : ws.rest ? restView() : workView()}</div>
    </div>`;
  },
  mounted() {
    keepAwake(true);
    clearInterval(loop);
    loop = setInterval(tick, 250);
  },
  unmount() {
    clearInterval(loop);
    loop = null;
    keepAwake(false);
    nudgeReload();
  },
};

/* Rafraîchit les compteurs sans redessiner toute la page. */
function setRing(hostId, frac) {
  const bar = document.querySelector(`#${hostId} .ring__bar`);
  if (!bar) return;
  const len = parseFloat(bar.style.getPropertyValue("--len"));
  bar.style.strokeDashoffset = String(len * (1 - clamp(frac, 0, 1)));
  bar.style.opacity = frac > 0.004 ? "1" : "0";
}
function tick() {
  if (!ws) return;
  const el = document.getElementById("woElapsed");
  if (el && !ws.endedAt) el.textContent = fmtDuration((Date.now() - ws.startedAt) / 1000);
  if (ws.rest) {
    const left = Math.max(0, (ws.rest.end - Date.now()) / 1000);
    const t = document.getElementById("woRestTime");
    if (t) t.textContent = fmtDuration(Math.ceil(left));
    setRing("woRestRing", left / ws.rest.total);
    if (left <= 0) { beep(3); endRest(); }
  } else if (ws.timed && ws.timed.running) {
    const e = ex();
    const target = exerciseTarget(e, store.state.profile, ws.dk).reps;
    const left = Math.max(0, (ws.timed.end - Date.now()) / 1000);
    const v = document.getElementById("woTimedVal");
    if (v) v.textContent = fmtDuration(Math.ceil(left));
    setRing("woTimedRing", left / target);
    if (left <= 0) { beep(2); logSet(target, 0); }
  }
}

/* L'écran peut s'éteindre si l'application passe en arrière-plan : on
   redemande le maintien au retour. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && loop) keepAwake(true);
});

actionsFor({
  "wo-set-done": () => {
    unlockAudio();
    const reps = Math.round(readNum($("#woReps")));
    const kg = Math.max(0, readNum($("#woLoad")) || 0);
    if (!(reps > 0)) { toast("Indique le nombre de répétitions.", { type: "error" }); return; }
    logSet(reps, kg);
  },
  "wo-timed": () => {
    unlockAudio();
    const target = exerciseTarget(ex(), store.state.profile, ws.dk).reps;
    const tm = ws.timed;
    if (tm && tm.running) ws.timed = { running: false, remaining: Math.max(1, Math.ceil((tm.end - Date.now()) / 1000)) };
    else ws.timed = { running: true, end: Date.now() + (tm ? tm.remaining : target) * 1000 };
    save();
    rerender();
  },
  "wo-rest-adj": (el) => {
    if (!ws.rest) return;
    const d = Number(el.dataset.d);
    ws.rest.end = Math.max(Date.now() + 1000, ws.rest.end + d * 1000);
    ws.rest.total = Math.max(ws.rest.total + d, Math.ceil((ws.rest.end - Date.now()) / 1000));
    save();
    tick();
  },
  "wo-rest-skip": () => { unlockAudio(); endRest(); },
  "wo-next": () => { ws.index = Math.min(ws.ids.length - 1, ws.index + 1); ws.timed = null; save(); rerender(); },
  "wo-prev": () => { ws.index = Math.max(0, ws.index - 1); ws.timed = null; ws.rest = null; save(); rerender(); },
  "wo-goto": (el) => { ws.index = Number(el.dataset.i); ws.timed = null; ws.rest = null; ws.phase = "work"; save(); rerender(); },
  "wo-skip": async () => {
    const e = ex();
    if (done(e.id)) await completeExercise(e.id);
    ws.timed = null;
    if (ws.index >= ws.ids.length - 1) { ws.phase = "summary"; ws.endedAt = Date.now(); }
    else ws.index++;
    save();
    rerender();
  },
  "wo-extra": () => {
    const e = ex();
    ws.extra = ws.extra || {};
    ws.extra[e.id] = (ws.extra[e.id] || 0) + 1;
    save();
    rerender();
  },
  "wo-summary": () => { ws.phase = "summary"; ws.endedAt = Date.now(); save(); rerender(); },
  "wo-resume": () => { ws.phase = "work"; ws.endedAt = null; save(); rerender(); },
  "wo-guide": () => openExercise(ws.ids[ws.index], { ids: ws.ids }),
  "wo-exit": async () => {
    if (ws && ws.phase !== "summary" && Object.keys(ws.sets).length) {
      toast("Séance en pause : reprends-la quand tu veux.", { type: "info" });
    }
    go(`#/today`);
  },
  "wo-finish": async () => {
    const dur = Math.round(((ws.endedAt || Date.now()) - ws.startedAt) / 1000);
    const nbDone = ws.ids.filter((id) => done(id)).length;
    if (!nbDone) {
      const ok = await confirmDialog({ title: "Aucun exercice réalisé", body: "Enregistrer quand même la séance comme faite ?", okLabel: "Enregistrer" });
      if (!ok) return;
    }
    await finishSession(ws.dk, { fillRemaining: false, durationSec: dur });
    local.remove(KEY);
    ws = null;
    toast("Séance enregistrée. Bravo !");
    go("#/today");
  },
});
