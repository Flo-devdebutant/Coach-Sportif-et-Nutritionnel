/* =========================================================================
   UTILITAIRES — dates, formatage, hasard déterministe.
   Les fonctions de dates et le générateur pseudo-aléatoire sont repris à
   l'identique de la version précédente : le programme et les menus d'une
   semaine en dépendent, les modifier changerait ce que voient les
   personnes déjà inscrites.
   ========================================================================= */

export const pad2 = (n) => String(n).padStart(2, "0");
export const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const todayKey = () => dateKey(new Date());
export function startOfWeek(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function parseDateOnly(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export const weekIndex = (d) => Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
export const genId = (prefix) => (prefix || "id") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/* Index du jour dans une semaine qui commence le lundi (0 = lundi). */
export const dayIndex = (d) => (d.getDay() + 6) % 7;

export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const DOW_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];
export const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const MONTH_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/* « Lundi 3 oct. » */
export const fmtDateFr = (d) => `${DAY_NAMES[dayIndex(d)]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
/* « lundi 3 octobre » */
export const fmtDateLong = (d) => `${DAY_NAMES[dayIndex(d)].toLowerCase()} ${d.getDate()} ${MONTH_NAMES[d.getMonth()].toLowerCase()}`;
export const fmtDayMonth = (dk) => {
  const d = parseDateOnly(dk);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
};
export const fmtDateTimeShort = (d) =>
  `${DAY_NAMES_SHORT[dayIndex(d)]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} à ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/* Libellé relatif d'un jour : « Aujourd'hui », « Hier », « Demain », sinon la date. */
export function relativeDay(dk) {
  const today = todayKey();
  if (dk === today) return "Aujourd'hui";
  if (dk === dateKey(addDays(new Date(), -1))) return "Hier";
  if (dk === dateKey(addDays(new Date(), 1))) return "Demain";
  return fmtDateFr(parseDateOnly(dk));
}

/* « il y a 5 min », « il y a 2 h »… pour les horodatages récents. */
export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return fmtDateTimeShort(new Date(ts));
}

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
/* Espace insécable normale plutôt que l'espace fine du format français :
   à petite taille, l'espace fine rend « 1 910 » presque illisible. */
const wide = (s) => s.replace(/\u202f/g, "\u00a0");
export const fmtInt = (n) => wide(nf0.format(Math.round(n || 0)));
export const fmtNum1 = (n) => wide(nf1.format(n || 0));
export const fmtKg = (kg) => `${fmtNum1(Math.round(kg * 10) / 10)} kg`;
export const plural = (n, one, many) => `${n} ${n > 1 ? many || one + "s" : one}`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/* Échappement systématique de tout texte saisi par la personne ou reçu de
   la synchronisation avant insertion dans le HTML. */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

export const normTxt = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/* PRNG déterministe (mulberry32) + hash simple, pour faire varier les
   propositions de façon reproductible selon la date / la semaine. */
export function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return h >>> 0;
}
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededShuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* non pris en charge */ } };
