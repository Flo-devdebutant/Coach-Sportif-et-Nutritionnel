/* =========================================================================
   DÉMARRAGE DE L'APPLICATION
   ========================================================================= */
import { SPRITE } from "./ui/icons.js";
import { initDelegation, actionsFor, html, ic } from "./ui/dom.js";
import { defineView, setGuard, initRouter, rerender, currentRoute } from "./ui/router.js";
import { anySheetOpen, confirmDialog } from "./ui/sheet.js";
import { ui, refreshDay } from "./ui/state.js";
import { store, loadState, persistenceMode } from "./core/store.js";
import { on } from "./core/events.js";
import { initAutoBackup } from "./core/backup.js";
import { addDays, dateKey, parseDateOnly } from "./core/util.js";
import { loadSyncSettings, initSync, setSyncConfirm } from "./services/sync.js";
import { initPwa, pwa } from "./services/pwa.js";
import { applyTheme } from "./services/theme.js";
import { toggleEaten, deleteEntry } from "./domain.js";

import { todayView } from "./views/today.js";
import { trainingView, libraryView } from "./views/training.js";
import { nutritionView } from "./views/nutrition.js";
import { progressView } from "./views/progress.js";
import { profileView } from "./views/profile.js";
import { onboardingView } from "./views/onboarding.js";
import { workoutView } from "./views/workout.js";

import { openRecipe } from "./sheets/recipe.js";
import { openExercise } from "./sheets/exercise.js";
import { openValidate } from "./sheets/validate.js";
import { openIntake, openActivity, openWeight, openQuickAdd } from "./sheets/log.js";
import { openShopping } from "./sheets/shopping.js";
import { openProfileSection } from "./sheets/settings.js";
import "./sheets/data.js";

/* ---------- Actions communes à plusieurs vues ---------- */
actionsFor({
  "select-day": (el) => { ui.date = el.dataset.dk; rerender(); },
  "shift-week": (el) => { ui.date = dateKey(addDays(parseDateOnly(ui.date), 7 * Number(el.dataset.dir))); rerender(); },
  "toggle-eaten": (el) => toggleEaten(el.dataset.dk, el.dataset.slot),
  "open-recipe": (el) => openRecipe(el.dataset.dk, el.dataset.slot),
  "open-exercise": (el) => openExercise(el.dataset.ex, { dk: el.dataset.dk, ids: el.dataset.list ? el.dataset.list.split(",") : null, index: Number(el.dataset.index) || 0 }),
  "validate-exercise": (el) => openValidate(el.dataset.ex, el.dataset.dk),
  "delete-entry": (el) => deleteEntry(el.dataset.kind, el.dataset.id),
  "add-intake": () => openIntake(),
  "add-activity": () => openActivity(),
  "add-weight": () => openWeight(),
  "quick-add": () => openQuickAdd(),
  "open-shopping": () => openShopping(),
  "edit-profile": (el) => openProfileSection(el.dataset.section || "personal"),
  "dismiss-banner": (el) => el.closest(".banner")?.remove(),
});

/* L'application est « occupée » quand un rechargement interromprait la
   personne : fenêtre ouverte, séance guidée, inscription, saisie en cours. */
function isBusy() {
  if (anySheetOpen()) return true;
  const r = currentRoute().name;
  if (r === "workout" || r === "welcome") return true;
  const a = document.activeElement;
  return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

function netPill() {
  let pill = document.getElementById("netPill");
  if (pwa.online) { if (pill) pill.remove(); return; }
  if (pill) return;
  pill = document.createElement("div");
  pill.id = "netPill";
  pill.className = "net-pill";
  pill.setAttribute("role", "status");
  pill.innerHTML = String(html`${ic("wifi-off", "icon-sm")}Hors ligne · tout reste utilisable`);
  document.body.appendChild(pill);
}

async function boot() {
  applyTheme();
  document.body.insertAdjacentHTML("afterbegin", SPRITE);
  initDelegation();
  await loadState();
  await loadSyncSettings();
  initAutoBackup();
  setSyncConfirm(confirmDialog);

  defineView("today", todayView);
  defineView("training", trainingView);
  defineView("library", libraryView);
  defineView("nutrition", nutritionView);
  defineView("progress", progressView);
  defineView("profile", profileView);
  defineView("workout", workoutView);
  defineView("welcome", onboardingView);
  /* Sans profil, seule l'inscription est accessible ; avec un profil, elle
     ne l'est plus (un profil reçu par synchronisation y fait sortir). */
  setGuard((name) => {
    if (!store.state.profile) return name === "welcome" ? null : "welcome";
    return name === "welcome" ? "today" : null;
  });
  initRouter();

  const splash = document.getElementById("splash");
  if (splash) { splash.classList.add("is-hidden"); setTimeout(() => splash.remove(), 400); }

  if (persistenceMode === "none") {
    document.body.insertAdjacentHTML("beforeend", String(html`<div class="banner" role="alert">${ic("triangle-alert")}
      <div class="grow"><b>Tes données ne seront pas conservées</b>Ce navigateur bloque le stockage local : tout sera perdu à la fermeture. Exporte une sauvegarde ou active la synchronisation depuis ton profil.</div>
      <button type="button" class="btn btn-sm btn-dark" data-action="dismiss-banner">OK</button></div>`));
  }

  initSync();
  on("pwa", () => {
    netPill();
    if (currentRoute().name === "profile") rerender();
  });
  on("sync", () => { if (currentRoute().name === "profile") rerender(); });
  initPwa({ busy: isBusy });
  netPill();

  /* Retour sur l'application un autre jour : on revient sur aujourd'hui. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && refreshDay()) rerender();
  });
}

boot().catch((err) => {
  console.error(err);
  const v = document.getElementById("view");
  if (v) v.innerHTML = `<div class="empty"><p class="empty__title">Démarrage impossible</p><p class="empty__text">${String(err && err.message ? err.message : err).replace(/</g, "&lt;")}</p></div>`;
  document.getElementById("splash")?.remove();
});
