/* Liste de courses de la semaine : ingrédients des repas prévus,
   additionnés à ta portion et rangés par rayon. Les cases cochées sont
   mémorisées par semaine sur cet appareil. */
import { html, ic, actionsFor } from "../ui/dom.js";
import { openSheet } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { store } from "../core/store.js";
import { on } from "../core/events.js";
import { todayKey, parseDateOnly, fmtDateFr } from "../core/util.js";
import { weekPlan } from "../engine/stats.js";
import { shoppingList } from "../engine/nutrition.js";
import { toggleShoppingItem, clearShopping } from "../domain.js";
import { ui } from "../ui/state.js";

let ctx = null; /* { ctrl, scope: "rest" | "week" } */

function qty(g) {
  if (g >= 1000) return `${(Math.round(g / 100) / 10).toString().replace(".", ",")} kg`;
  if (g >= 100) return `${Math.round(g / 10) * 10} g`;
  return `${Math.max(1, Math.round(g))} g`;
}

function build() {
  const w = weekPlan(parseDateOnly(ui.date));
  const today = todayKey();
  const from = ctx.scope === "rest" && today > w.mondayKey ? today : w.mondayKey;
  return { w, from, groups: shoppingList(w.meals, from) };
}

function fill() {
  const { ctrl } = ctx;
  const { w, from, groups } = build();
  const checked = new Set(store.state.shopping[w.mondayKey] || []);
  const total = groups.reduce((s, g) => s + g.items.length, 0);
  const done = groups.reduce((s, g) => s + g.items.filter((i) => checked.has(i.name)).length, 0);
  const canRest = todayKey() > w.mondayKey && todayKey() <= w.meals[6].dateKey;
  ctrl.setTitle("Liste de courses", `${fmtDateFr(parseDateOnly(from))} – dimanche · ${total} article${total > 1 ? "s" : ""}`);
  ctrl.setBody(html`
    ${canRest ? html`<div class="segmented">
      <button type="button" aria-selected="${ctx.scope === "rest"}" data-action="shop-scope" data-v="rest">Jours restants</button>
      <button type="button" aria-selected="${ctx.scope === "week"}" data-action="shop-scope" data-v="week">Toute la semaine</button>
    </div>` : ""}
    <div class="metric mt-16">
      <div class="metric__head"><span class="metric__label">${ic("list-checks", "icon-sm")}Dans le panier</span><span><b>${done}</b> / ${total}</span></div>
      <div class="bar is-intake"><i style="width:${total ? ((100 * done) / total).toFixed(1) : 0}%"></i></div>
    </div>
    ${groups.map((g) => html`
      <h3 class="sub-title">${g.aisle}</h3>
      <ul class="shop-list">
        ${g.items.map((i) => {
          const on = checked.has(i.name);
          return html`<li><button type="button" class="shop-item${on ? " is-on" : ""}" data-action="shop-toggle" data-name="${i.name}" aria-pressed="${on}">
            <span class="check is-sm${on ? " is-on" : ""}">${ic("check")}</span>
            <span class="shop-item__name">${i.name}${i.uses > 1 ? html` <span class="faint">· ${i.uses} recettes</span>` : ""}</span>
            <b class="shop-item__qty num">${qty(i.grams)}</b>
          </button></li>`;
        })}
      </ul>`)}
    <p class="field-hint mt-16">Quantités pour tes portions, ingrédients crus. Arrondis à l'emballage le plus proche.</p>
  `);
  ctrl.setFoot(html`
    <button type="button" class="btn btn-secondary" data-action="shop-clear" ${done ? "" : "disabled"}>${ic("rotate-ccw")}Décocher</button>
    <button type="button" class="btn btn-primary" data-action="shop-share">${ic("copy")}${navigator.share ? "Partager" : "Copier"}</button>
  `);
}

export function openShopping() {
  const ctrl = openSheet({ id: "shopping", size: "full", onClose: () => { ctx = null; } });
  ctx = { ctrl, scope: "rest" };
  fill();
}

on("change", () => { if (ctx && !ctx.ctrl.closed) requestAnimationFrame(() => ctx && fill()); });

actionsFor({
  "shop-scope": (el) => { if (ctx) { ctx.scope = el.dataset.v; fill(); } },
  "shop-toggle": (el) => {
    const w = weekPlan(parseDateOnly(ui.date));
    toggleShoppingItem(w.mondayKey, el.dataset.name);
  },
  "shop-clear": () => clearShopping(weekPlan(parseDateOnly(ui.date)).mondayKey),
  "shop-share": async () => {
    if (!ctx) return;
    const { groups } = build();
    const text = "Liste de courses\n\n" + groups.map((g) => `${g.aisle.toUpperCase()}\n` + g.items.map((i) => `☐ ${i.name} — ${qty(i.grams)}`).join("\n")).join("\n\n");
    try {
      if (navigator.share) { await navigator.share({ title: "Liste de courses", text }); return; }
      await navigator.clipboard.writeText(text);
      toast("Liste copiée dans le presse-papiers.");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      toast("Impossible de partager la liste sur cet appareil.", { type: "error" });
    }
  },
});
