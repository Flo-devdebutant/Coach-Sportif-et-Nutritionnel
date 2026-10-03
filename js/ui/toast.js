/* Notifications éphémères, avec action facultative (« Annuler » après une
   suppression, plutôt qu'une confirmation qui interrompt le geste). */
import { html, ic } from "./dom.js";

let host = null;
function ensureHost() {
  if (!host) {
    host = document.createElement("div");
    host.className = "toasts";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, { type = "success", action = null, duration } = {}) {
  const h = ensureHost();
  while (h.children.length >= 3) h.firstElementChild.remove();
  const el = document.createElement("div");
  el.className = "toast" + (type === "error" ? " is-error" : "");
  const iconName = type === "error" ? "triangle-alert" : type === "info" ? "info" : "circle-check";
  el.innerHTML = String(html`${ic(iconName)}<span class="toast__msg">${message}</span>${action ? html`<button type="button" class="toast__action">${action.label}</button>` : ""}`);
  h.appendChild(el);
  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    if (!el.isConnected || el.classList.contains("is-leaving")) return;
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 260);
  };
  if (action) {
    el.querySelector(".toast__action").addEventListener("click", () => { dismiss(); action.fn(); });
  }
  timer = setTimeout(dismiss, duration || (action ? 5500 : type === "error" ? 4500 : 2600));
  return dismiss;
}
