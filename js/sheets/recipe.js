/* Fiche recette : portions réelles, étapes, repères de cuisson, allergènes,
   et actions (mangé, remplacer, revenir au plat proposé). */
import { html, ic, actionsFor } from "../ui/dom.js";
import { openSheet } from "../ui/sheet.js";
import { stackBar } from "../ui/charts.js";
import { eatenEntry } from "../ui/components.js";
import { dayPlan } from "../engine/stats.js";
import { cookingNotesFor, tempsRecette, isOverridden } from "../engine/nutrition.js";
import { SLOT_LABELS, ALLERGEN_LABELS } from "../engine/labels.js";
import { fmtInt, relativeDay, todayKey } from "../core/util.js";
import { toggleEaten, swapMeal, resetMeal } from "../domain.js";
import { on } from "../core/events.js";

let ctx = null; /* { ctrl, dk, slot } */

function grams(g) {
  if (g >= 1000) return `${(Math.round(g / 100) / 10).toString().replace(".", ",")} kg`;
  return `${Math.max(1, Math.round(g))} g`;
}

function fill() {
  const { ctrl, dk, slot } = ctx;
  const meal = dayPlan(dk).meals[slot];
  if (!meal) return;
  const notes = cookingNotesFor(meal);
  const t = tempsRecette(meal, notes);
  const eaten = !!eatenEntry(dk, slot);
  const overridden = isOverridden(dk, slot);
  const diet = meal.vegan ? "Vegan" : meal.vegetarian ? "Végétarien" : "";
  ctrl.setTitle(meal.name, `${SLOT_LABELS[slot]} · ${relativeDay(dk)}`);
  ctrl.setBody(html`
    <div class="chips">
      <span class="chip">${ic("clock")}Préparation ~${t.prep} min</span>
      ${t.cuisson ? html`<span class="chip">${ic("flame")}Cuisson ~${t.cuisson} min</span>` : html`<span class="chip">${ic("leaf")}Sans cuisson</span>`}
      ${diet ? html`<span class="chip is-intake">${ic("leaf")}${diet}</span>` : ""}
    </div>

    <div class="macro-tiles mt-16">
      <div class="macro-tile"><span>Énergie</span><b>${fmtInt(meal.kcal)}</b><small>kcal</small></div>
      <div class="macro-tile is-protein"><span>Protéines</span><b>${meal.protein}</b><small>g</small></div>
      <div class="macro-tile is-carbs"><span>Glucides</span><b>${meal.carbs}</b><small>g</small></div>
      <div class="macro-tile is-fat"><span>Lipides</span><b>${meal.fat}</b><small>g</small></div>
    </div>
    ${stackBar([
      { name: "Protéines", value: meal.protein * 4, color: "var(--protein)" },
      { name: "Glucides", value: meal.carbs * 4, color: "var(--carbs)" },
      { name: "Lipides", value: meal.fat * 9, color: "var(--fat)" },
    ])}

    ${meal.allergens && meal.allergens.length ? html`<p class="allergens">${ic("triangle-alert", "icon-sm")}Contient : ${meal.allergens.map((a) => (ALLERGEN_LABELS[a] || a).toLowerCase()).join(", ")}</p>` : ""}

    <h3 class="sub-title">Ingrédients <span class="faint">· pour ta portion</span></h3>
    <ul class="ingredients">
      ${meal.ingredients.map(([n, g]) => html`<li><span>${n}</span><b>${grams(g * meal.scale)}</b></li>`)}
    </ul>

    <h3 class="sub-title">Préparation</h3>
    <ol class="steps">${meal.steps.map((s) => html`<li>${s}</li>`)}</ol>

    ${notes.length ? html`
      <details class="disclosure mt-16">
        <summary>${ic("chef-hat")}Repères de cuisson (${notes.length})${ic("chevron-down")}</summary>
        <div class="disclosure__body">
          ${notes.map((n) => html`<div class="cook-note"><b>${n.t}</b><p>${n.n}</p></div>`)}
        </div>
      </details>` : ""}

    ${overridden ? html`<button type="button" class="btn btn-ghost btn-block mt-16" data-action="recipe-reset">${ic("rotate-ccw")}Revenir au plat proposé</button>` : ""}
  `);
  ctrl.setFoot(html`
    <button type="button" class="btn btn-secondary" data-action="recipe-swap">${ic("repeat")}Remplacer</button>
    ${dk > todayKey() ? "" : html`<button type="button" class="btn ${eaten ? "btn-success" : "btn-primary"}" data-action="recipe-eaten">${ic("check")}${eaten ? "Mangé" : "Je l'ai mangé"}</button>`}
  `);
}

export function openRecipe(dk, slot) {
  const ctrl = openSheet({ id: "recipe", size: "full", onClose: () => { ctx = null; } });
  ctx = { ctrl, dk, slot };
  fill();
}

/* La fiche se met à jour quand les données changent (remplacement, synchro). */
on("change", () => { if (ctx && !ctx.ctrl.closed) requestAnimationFrame(() => ctx && fill()); });

actionsFor({
  "recipe-eaten": async () => { if (ctx) await toggleEaten(ctx.dk, ctx.slot); },
  "recipe-swap": async () => { if (ctx) { await swapMeal(ctx.dk, ctx.slot); ctx && ctx.ctrl.body.scrollTo({ top: 0, behavior: "smooth" }); } },
  "recipe-reset": async () => { if (ctx) await resetMeal(ctx.dk, ctx.slot); },
});
