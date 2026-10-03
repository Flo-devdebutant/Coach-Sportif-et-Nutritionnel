/* =========================================================================
   DONNÉES — synchronisation entre appareils, sauvegardes automatiques,
   export / import de fichier, réinitialisation.
   ========================================================================= */
import { html, ic, actionsFor, busy, $ } from "../ui/dom.js";
import { openSheet, closeSheet, confirmDialog } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { on } from "../core/events.js";
import { store, replaceState, defaultState } from "../core/store.js";
import { listBackups, deleteBackup, findBackup, exportPayload, createBackupNow } from "../core/backup.js";
import { DAY_NAMES_SHORT, pad2, todayKey, timeAgo } from "../core/util.js";
import { sync, createRoom, joinRoom, connectSync, disconnectSync, parseFirebaseConfig, setCustomProject, describeSyncError, usageRatio, SYNC_WARN_RATIO } from "../services/sync.js";

const fmtBackupDate = (iso) => {
  const d = new Date(iso);
  return `${DAY_NAMES_SHORT[(d.getDay() + 6) % 7]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} à ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/* ---------- Synchronisation ---------- */
export const SYNC_STATUS = {
  off: { label: "Désactivée", cls: "" },
  connecting: { label: "Connexion…", cls: "is-warn" },
  on: { label: "Synchronisé", cls: "is-success" },
  error: { label: "Erreur", cls: "is-burn" },
};

let syncCtrl = null;
function fillSync() {
  const c = syncCtrl;
  if (!c) return;
  if (!sync.code) {
    c.setTitle("Synchroniser tes appareils", "Profil, séances et repas à jour sur ton téléphone, ta tablette et ton ordinateur.");
    c.setBody(html`
      <ol class="how-to">
        <li><b>Sur ce premier appareil</b>, crée un code.</li>
        <li><b>Sur tes autres appareils</b>, saisis ce même code.</li>
        <li>Les modifications circulent ensuite automatiquement.</li>
      </ol>
      <button type="button" class="btn btn-primary btn-block" data-action="sync-create">${ic("sparkles")}Créer un nouveau code</button>
      <p class="divider-label"><span>ou rejoindre un code existant</span></p>
      <input class="input code-input" id="syncCode" placeholder="AB3D9F2K" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false">
      <p class="field-error" id="syncErr"></p>
      <button type="button" class="btn btn-secondary btn-block mt-12" data-action="sync-join" data-submit>Se connecter avec ce code</button>
      <button type="button" class="btn btn-ghost btn-block mt-16 btn-sm" data-action="sync-advanced">${ic("settings")}Utiliser mon propre projet Firebase</button>
    `);
    c.setFoot("");
    return;
  }
  const st = SYNC_STATUS[sync.status] || SYNC_STATUS.off;
  const r = usageRatio();
  c.setTitle("Synchronisation", "Tes données circulent entre les appareils reliés à ce code.");
  c.setBody(html`
    <div class="sync-code">
      <span class="faint">Ton code</span>
      <b class="num">${sync.code}</b>
      <button type="button" class="btn btn-secondary btn-sm" data-action="sync-copy">${ic("copy")}Copier</button>
    </div>
    <div class="card is-flush mt-16">
      <div class="list-row"><span class="list-row__body"><span class="list-row__title">État</span></span><span class="chip ${st.cls}">${st.label}</span></div>
      ${sync.lastPushAt ? html`<div class="list-row"><span class="list-row__body"><span class="list-row__title">Dernier envoi</span></span><span class="muted">${timeAgo(sync.lastPushAt)}</span></div>` : ""}
      ${sync.lastPullAt ? html`<div class="list-row"><span class="list-row__body"><span class="list-row__title">Dernière réception</span></span><span class="muted">${timeAgo(sync.lastPullAt)}</span></div>` : ""}
      ${sync.config ? html`<div class="list-row"><span class="list-row__body"><span class="list-row__title">Projet</span></span><span class="muted">${sync.config.projectId}</span></div>` : ""}
    </div>
    ${sync.lastError ? html`<p class="note is-warn mt-12">${ic("triangle-alert")}<span>${sync.lastError}</span></p>` : ""}
    ${r !== null && r >= SYNC_WARN_RATIO ? html`<p class="note is-warn mt-12">${ic("triangle-alert")}<span>Tes données occupent ${Math.round(r * 100)} % de la taille maximale autorisée par Firebase.</span></p>` : ""}
  `);
  c.setFoot(html`
    <button type="button" class="btn btn-danger" data-action="sync-off">Désactiver</button>
    <button type="button" class="btn btn-secondary" data-action="sync-retry">${ic("refresh-cw")}Reconnecter</button>
  `);
}
export function openSync() {
  syncCtrl = openSheet({ id: "sync", onClose: () => { syncCtrl = null; } });
  fillSync();
}
on("sync", () => fillSync());

function openSyncAdvanced() {
  const ctrl = openSheet({ id: "sync-adv", size: "full", title: "Ton propre projet Firebase", sub: "Tes données ne transiteront que par ton projet. Environ 5 minutes, une seule fois." });
  ctrl.setBody(html`
    <ol class="how-to">
      <li>Sur <b>console.firebase.google.com</b>, crée un projet (gratuit).</li>
      <li><b>Firestore Database</b> › Créer une base › mode production.</li>
      <li><b>Authentication</b> › Méthodes de connexion › active <b>Anonyme</b>.</li>
      <li><b>Paramètres du projet</b> › ajoute une appli Web › copie le bloc <code>firebaseConfig</code>.</li>
      <li>Colle ce bloc ci-dessous.</li>
    </ol>
    <textarea class="input" id="fbCfg" rows="6" placeholder="const firebaseConfig = { apiKey: …" spellcheck="false"></textarea>
    <p class="field-error" id="fbErr"></p>
  `);
  ctrl.setFoot(html`<button type="button" class="btn btn-primary" data-action="sync-adv-save">Continuer</button>`);
  return ctrl;
}

actionsFor({
  "open-sync": () => openSync(),
  "sync-create": async (el) => {
    await busy(el, async () => {
      try {
        const code = await createRoom();
        toast(`Code créé : ${code}`);
      } catch (err) {
        const e = syncCtrl && $("#syncErr", syncCtrl.body);
        if (e) e.textContent = describeSyncError(err);
      }
    });
  },
  "sync-join": async (el) => {
    const input = syncCtrl && $("#syncCode", syncCtrl.body);
    const err = syncCtrl && $("#syncErr", syncCtrl.body);
    const code = (input ? input.value : "").trim().toUpperCase();
    if (code.length !== 8) { err.textContent = "Le code compte 8 caractères."; return; }
    err.textContent = "";
    await busy(el, async () => {
      try {
        const msg = await joinRoom(code);
        if (msg) err.textContent = msg; else toast("Appareil relié.");
      } catch (e) { err.textContent = describeSyncError(e); }
    });
  },
  "sync-copy": async () => {
    try { await navigator.clipboard.writeText(sync.code); toast("Code copié."); }
    catch (e) { toast(`Ton code : ${sync.code}`, { type: "info" }); }
  },
  "sync-retry": async (el) => { await busy(el, () => connectSync().catch(() => {})); },
  "sync-off": async () => {
    const ok = await confirmDialog({ title: "Désactiver la synchronisation ?", body: "Tes appareils reliés ne recevront plus tes mises à jour. Tes données restent sur cet appareil.", okLabel: "Désactiver", danger: true });
    if (ok) { await disconnectSync(); toast("Synchronisation désactivée.", { type: "info" }); }
  },
  "sync-advanced": () => { const c = openSyncAdvanced(); advCtrl = c; },
  "sync-adv-save": async () => {
    if (!advCtrl) return;
    const cfg = parseFirebaseConfig($("#fbCfg", advCtrl.body).value);
    if (!cfg) { $("#fbErr", advCtrl.body).textContent = "Configuration introuvable : vérifie que tu as copié tout le bloc firebaseConfig."; return; }
    await setCustomProject(cfg);
    closeSheet(advCtrl);
    advCtrl = null;
    toast(`Projet ${cfg.projectId} enregistré : crée ou saisis un code.`, { type: "info" });
  },
});
let advCtrl = null;

/* ---------- Sauvegardes automatiques ---------- */
let backupsCtrl = null;
async function fillBackups() {
  if (!backupsCtrl) return;
  const all = await listBackups();
  if (!backupsCtrl) return;
  backupsCtrl.setBody(all.length ? html`<div class="card is-flush">${all.map((b) => {
    const st = (b.payload && b.payload.state) || {};
    const nb = (st.weightLog || []).length + (st.sessionLog || []).length + (st.activityLog || []).length + (st.intakeLog || []).length;
    return html`<div class="list-row">
      <span class="list-row__icon">${ic("history")}</span>
      <span class="list-row__body"><span class="list-row__title">${fmtBackupDate(b.createdAt)}</span>
        <span class="list-row__sub">${nb} entrée${nb > 1 ? "s" : ""} · ${Math.max(1, Math.round(b.size / 1024))} Ko</span></span>
      <button type="button" class="btn btn-secondary btn-sm" data-action="backup-restore" data-id="${b.id}">Restaurer</button>
      <button type="button" class="icon-btn is-sm is-plain" data-action="backup-delete" data-id="${b.id}" aria-label="Supprimer">${ic("trash-2")}</button>
    </div>`;
  })}</div>` : html`<div class="empty"><div class="empty__icon">${ic("history")}</div><p class="empty__title">Aucun instantané pour l'instant</p><p class="empty__text">Le premier sera créé quelques secondes après ta prochaine modification.</p></div>`);
}
export function openBackups() {
  backupsCtrl = openSheet({ id: "backups", size: "full", title: "Sauvegardes automatiques", sub: "Un instantané est enregistré sur cet appareil après chaque modification. Les 20 plus récents sont conservés.", onClose: () => { backupsCtrl = null; } });
  backupsCtrl.setBody(html`<p class="muted">Lecture du coffre…</p>`);
  if (store.state.profile) backupsCtrl.setFoot(html`<button type="button" class="btn btn-secondary" data-action="backup-now">${ic("download")}Créer un instantané maintenant</button>`);
  fillBackups();
}
on("backups-changed", () => fillBackups());

async function restoreFrom(payloadState, when) {
  const ok = await confirmDialog({ title: "Restaurer cette sauvegarde ?", body: when ? `Tes données actuelles seront remplacées par l'instantané du ${when}.` : "Toutes tes données actuelles seront remplacées par le contenu du fichier.", okLabel: "Restaurer", danger: true });
  if (!ok) return false;
  await replaceState(payloadState);
  toast("Sauvegarde restaurée.");
  return true;
}

actionsFor({
  "open-backups": () => openBackups(),
  "backup-now": async () => {
    const created = await createBackupNow("manuel");
    toast(created ? "Instantané créé." : "Aucun changement depuis le dernier instantané.", { type: created ? "success" : "info" });
  },
  "backup-delete": (el) => deleteBackup(el.dataset.id),
  "backup-restore": async (el) => {
    const b = await findBackup(el.dataset.id);
    if (!b) { toast("Sauvegarde introuvable.", { type: "error" }); return; }
    const incoming = b.payload && b.payload.state ? b.payload.state : b.payload;
    if (await restoreFrom(incoming, fmtBackupDate(b.createdAt))) { if (backupsCtrl) closeSheet(backupsCtrl); location.hash = "#/today"; }
  },
});

/* ---------- Export / import ---------- */
export function exportData() {
  try {
    const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `carnet-sportif-sauvegarde-${todayKey()}.json` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Export lancé : vérifie tes téléchargements.");
  } catch (e) {
    toast("Impossible d'exporter les données.", { type: "error" });
  }
}
export function importData() {
  const input = Object.assign(document.createElement("input"), { type: "file", accept: "application/json,.json" });
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const incoming = payload && typeof payload === "object" && payload.state ? payload.state : payload;
      if (!incoming || typeof incoming !== "object" || !("profile" in incoming)) { toast("Fichier de sauvegarde invalide.", { type: "error" }); return; }
      if (await restoreFrom(incoming)) location.hash = "#/today";
    } catch (e) {
      toast("Impossible de lire ce fichier.", { type: "error" });
    }
  });
  input.click();
}

export async function resetAll() {
  const ok = await confirmDialog({
    title: "Tout réinitialiser ?",
    body: "Ton profil et tout ton historique seront supprimés de cet appareil. Si la synchronisation est active, ils seront aussi effacés sur tes appareils reliés. Pense à exporter une sauvegarde avant.",
    okLabel: "Tout effacer", danger: true,
  });
  if (!ok) return;
  await replaceState(defaultState());
  toast("Données réinitialisées.", { type: "info" });
}

actionsFor({
  "export-data": () => exportData(),
  "import-data": () => importData(),
  "reset-all": () => resetAll(),
});
