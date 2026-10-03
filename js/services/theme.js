/* Thème clair / sombre / automatique (suit l'appareil). Choix propre à
   l'appareil, conservé en local et appliqué avant le premier rendu par le
   petit script en tête de index.html. */
import { local } from "../core/store.js";

const KEY = "carnet.theme";
const COLORS = { light: "#F3F4F7", dark: "#090B0F" };
const media = window.matchMedia("(prefers-color-scheme: dark)");

export const getTheme = () => local.get(KEY, "auto");
export const effectiveTheme = () => {
  const t = getTheme();
  return t === "auto" ? (media.matches ? "dark" : "light") : t;
};

export function applyTheme() {
  const t = getTheme();
  if (t === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.remove();
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = COLORS[effectiveTheme()];
  document.head.appendChild(meta);
}

export function setTheme(t) {
  local.set(KEY, t);
  applyTheme();
}

media.addEventListener("change", () => { if (getTheme() === "auto") applyTheme(); });
