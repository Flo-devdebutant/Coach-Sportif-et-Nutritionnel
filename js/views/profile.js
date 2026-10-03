/* =========================================================================
   PROFIL & RÉGLAGES
   ========================================================================= */
import { html, ic, raw, actionsFor } from "../ui/dom.js";
import { segmented } from "../ui/components.js";
import { store, persistenceMode } from "../core/store.js";
import { fmtInt, fmtNum1, timeAgo } from "../core/util.js";
import { targets, burnTarget } from "../engine/stats.js";
import { computeBMI } from "../engine/nutrition.js";
import { GOAL_LABELS, LEVEL_LABELS, DIET_LABELS, ACTIVITY_LABELS, EQUIP_LABELS } from "../engine/labels.js";
import { getTheme, setTheme } from "../services/theme.js";
import { pwa, isStandalone, isApple, promptInstall, checkForUpdate } from "../services/pwa.js";
import { sync } from "../services/sync.js";
import { SYNC_STATUS } from "../sheets/data.js";
import { backupState } from "../core/backup.js";
import { rerender } from "../ui/router.js";

function row({ icon, title, sub = "", value = "", action = "", attrs = "", tone = "", href = "" }) {
  const inner = html`
    <span class="list-row__icon ${tone}">${ic(icon)}</span>
    <span class="list-row__body"><span class="list-row__title">${title}</span>${sub ? html`<span class="list-row__sub">${sub}</span>` : ""}</span>
    ${value}
    ${ic("chevron-right", "list-row__chev")}`;
  if (href) return html`<a class="list-row" href="${href}">${inner}</a>`;
  return html`<button type="button" class="list-row" data-action="${action}" ${raw(attrs)}>${inner}</button>`;
}

function updateLine() {
  const i = pwa.info || {};
  const states = {
    checking: "Recherche en cours…",
    downloading: "Téléchargement de la nouvelle version…",
    reloading: "Nouvelle version prête, redémarrage…",
    error: "Vérification impossible pour le moment",
    uptodate: pwa.lastCheck ? `À jour · vérifié ${timeAgo(pwa.lastCheck)}` : "À jour",
    idle: "Vérification automatique toutes les 5 minutes",
  };
  let published = "";
  if (i.published) {
    const d = new Date(i.published);
    if (!isNaN(d)) published = ` · publiée le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return { title: i.version ? `Version ${i.version}` : "Mises à jour", sub: (states[pwa.state] || states.idle) + published };
}

export const profileView = {
  nav: "profile",
  title: "Profil",
  render() {
    const p = store.state.profile;
    const t = targets();
    const bmi = computeBMI(p);
    const st = SYNC_STATUS[sync.code ? sync.status : "off"];
    const up = updateLine();
    const initial = p.name ? p.name.trim().charAt(0).toUpperCase() : "";
    const zones = p.focusZones && p.focusZones.length ? `${p.focusZones.length} zone${p.focusZones.length > 1 ? "s" : ""} ciblée${p.focusZones.length > 1 ? "s" : ""}` : "tout le corps";
    const equip = p.equipment && p.equipment.length ? p.equipment.map((e) => EQUIP_LABELS[e].toLowerCase()).join(", ") : "sans matériel";
    return html`
      <header class="page-head"><div class="page-head__text"><p class="eyebrow">Réglages</p><h1 class="page-title">Profil</h1></div></header>

      <section class="hero profile-card">
        <div class="avatar is-lg">${initial || ic("user", "icon-lg")}</div>
        <div class="grow">
          <h2 class="profile-card__name">${p.name || "Ton profil"}</h2>
          <p class="muted">${p.sex === "H" ? "Homme" : "Femme"} · ${p.age} ans · ${p.heightCm} cm · ${fmtNum1(p.weightKg)} kg</p>
          <div class="chips mt-8"><span class="chip is-accent">${GOAL_LABELS[p.goal]}</span><span class="chip">${LEVEL_LABELS[p.level]}</span></div>
        </div>
      </section>

      <div class="grid-2 mt-12">
        <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--intake)"></i>Calories / jour</p><p class="stat__value">${fmtInt(t.kcal)}<small>kcal</small></p></div>
        <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--protein)"></i>Protéines</p><p class="stat__value">${t.proteinG}<small>g / jour</small></p></div>
        <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--burn)"></i>Activité visée</p><p class="stat__value">${fmtInt(burnTarget())}<small>kcal / jour</small></p></div>
        <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--weight)"></i>IMC</p><p class="stat__value">${fmtNum1(bmi.value)}<small>${bmi.label.toLowerCase()}</small></p></div>
      </div>

      <div class="cols">
        <div>
          <p class="group-label">Mon profil</p>
          <div class="card is-flush">
            ${row({ icon: "user", title: "Informations personnelles", sub: `${p.age} ans · ${p.heightCm} cm · ${ACTIVITY_LABELS[p.activity].toLowerCase()}`, action: "edit-profile", attrs: 'data-section="personal"' })}
            ${row({ icon: "target", title: "Objectif & entraînement", sub: `${GOAL_LABELS[p.goal]} · ${p.sessionsPerWeek} séances · ${zones} · ${equip}`, action: "edit-profile", attrs: 'data-section="training"', tone: "is-accent" })}
            ${row({ icon: "utensils", title: "Alimentation", sub: `${DIET_LABELS[p.diet] || "Omnivore"}${p.allergens.length ? ` · ${p.allergens.length} allergène${p.allergens.length > 1 ? "s" : ""} exclu${p.allergens.length > 1 ? "s" : ""}` : ""}${p.lowBudget ? " · petit budget" : ""}`, action: "edit-profile", attrs: 'data-section="food"', tone: "is-intake" })}
          </div>

          <p class="group-label">Apparence</p>
          <div class="card">
            ${segmented([["auto", "Automatique", "sun-moon"], ["light", "Clair", "sun"], ["dark", "Sombre", "moon"]], getTheme(), "set-theme")}
          </div>
        </div>
        <div>
          <p class="group-label">Données</p>
          <div class="card is-flush">
            ${row({ icon: "cloud", title: "Synchronisation", sub: sync.code ? `Code ${sync.code}` : "Utilise l'app sur plusieurs appareils", value: html`<span class="chip ${st.cls}">${st.label}</span>`, action: "open-sync", tone: "is-weight" })}
            ${row({ icon: "history", title: "Sauvegardes automatiques", sub: backupState.lastAt ? `Dernière : ${timeAgo(new Date(backupState.lastAt).getTime())}` : "Instantanés conservés sur cet appareil", action: "open-backups" })}
            ${row({ icon: "download", title: "Exporter mes données", sub: "Fichier .json à conserver", action: "export-data" })}
            ${row({ icon: "upload", title: "Importer une sauvegarde", sub: "Remplace les données actuelles", action: "import-data" })}
          </div>
          ${persistenceMode === "none" ? html`<p class="note is-warn mt-12">${ic("triangle-alert")}<span>Ce navigateur bloque le stockage local : tes données seront perdues à la fermeture. Exporte-les ou active la synchronisation.</span></p>` : ""}

          <p class="group-label">Application</p>
          <div class="card is-flush">
            ${!isStandalone() && pwa.installEvent ? row({ icon: "smartphone", title: "Installer l'application", sub: "Plein écran, depuis ton écran d'accueil", action: "install-app", tone: "is-accent" }) : ""}
            ${!isStandalone() && !pwa.installEvent && isApple() ? html`<div class="list-row"><span class="list-row__icon is-accent">${ic("smartphone")}</span><span class="list-row__body"><span class="list-row__title">Ajouter à l'écran d'accueil</span><span class="list-row__sub">Dans Safari : bouton Partager, puis « Sur l'écran d'accueil ».</span></span></div>` : ""}
            <button type="button" class="list-row" data-action="check-update">
              <span class="list-row__icon">${ic(pwa.state === "checking" || pwa.state === "downloading" ? "refresh-cw" : "sparkles")}</span>
              <span class="list-row__body"><span class="list-row__title">${up.title}</span><span class="list-row__sub">${up.sub}</span></span>
              <span class="link">Vérifier</span>
            </button>
            <div class="list-row">
              <span class="list-row__icon ${pwa.offlineReady ? "is-intake" : ""}">${ic(pwa.offlineReady ? "shield-check" : pwa.online ? "cloud" : "wifi-off")}</span>
              <span class="list-row__body"><span class="list-row__title">Mode hors ligne</span>
                <span class="list-row__sub">${pwa.offlineReady ? "Prêt : l'application fonctionne sans connexion." : pwa.supported ? "Préparation…" : "Disponible une fois l'application publiée en ligne (https)."}</span></span>
            </div>
          </div>

          <p class="group-label">À propos</p>
          <details class="disclosure">
            <summary>${ic("info")}Avertissement santé${ic("chevron-down")}</summary>
            <div class="disclosure__body">Cette application propose des repères généraux d'entraînement et de nutrition à visée éducative. Elle ne remplace pas l'avis d'un médecin, d'un kinésithérapeute ou d'un diététicien-nutritionniste. Consulte un professionnel avant de démarrer un nouveau programme, en particulier en cas de blessure, de pathologie, de grossesse ou d'allergie sévère. Besoins : équation de Mifflin-St Jeor ; activité : recommandations OMS 2020 et ACSM ; dépenses : Compendium of Physical Activities.</div>
          </details>
          <details class="disclosure mt-8">
            <summary>${ic("heart")}Crédits${ic("chevron-down")}</summary>
            <div class="disclosure__body">Icônes Lucide (licence ISC). Polices Inter et Outfit (SIL Open Font License). Synchronisation via Firebase.</div>
          </details>

          <p class="group-label">Zone sensible</p>
          <div class="card is-flush">
            <button type="button" class="list-row is-danger" data-action="reset-all"><span class="list-row__icon">${ic("trash-2")}</span><span class="list-row__body"><span class="list-row__title">Réinitialiser toutes les données</span><span class="list-row__sub">Profil et historique, sur cet appareil</span></span></button>
          </div>
        </div>
      </div>`;
  },
};

actionsFor({
  "set-theme": (el) => { setTheme(el.dataset.value); rerender(); },
  "install-app": async () => { await promptInstall(); rerender(); },
  "check-update": () => checkForUpdate({ manual: true }),
});
