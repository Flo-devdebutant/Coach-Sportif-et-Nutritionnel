/* =========================================================================
   NUTRITION — repères du jour, menus à cocher, journal alimentaire,
   liste de courses et préférences.
   ========================================================================= */
import { html, ic } from "../ui/dom.js";
import { ring } from "../ui/charts.js";
import { pageHead, weekStrip, mealCard, metricBar, disclaimer } from "../ui/components.js";
import { store } from "../core/store.js";
import { ui } from "../ui/state.js";
import { fmtInt } from "../core/util.js";
import { targets, dayPlan, consumedOn, proteinOn, dayStats } from "../engine/stats.js";
import { mealSlots, GOAL_MEAL_NOTE } from "../engine/nutrition.js";
import { GOAL_LABELS, DIET_LABELS, ALLERGEN_LABELS } from "../engine/labels.js";
import { journal } from "./today.js";

function marks(dk) {
  const st = dayStats(dk);
  return st.food ? ["is-food"] : [];
}

function dayCard(dk) {
  const t = targets();
  const day = dayPlan(dk).meals;
  const eaten = consumedOn(dk), prot = proteinOn(dk);
  const pct = t.kcal ? eaten / t.kcal : 0;
  const planned = mealSlots(day).reduce((a, [, m]) => ({ p: a.p + m.protein, c: a.c + m.carbs, f: a.f + m.fat }), { p: 0, c: 0, f: 0 });
  return html`<section class="hero nutri-hero">
    <div class="nutri-hero__top">
      <div class="nutri-hero__ring">
        ${ring(Math.min(1, pct), { size: 112, stroke: 11, color: pct > 1.05 ? "var(--danger)" : "var(--intake)" })}
        <div class="nutri-hero__pct"><b class="num">${Math.round(pct * 100)}%</b><span>de l'objectif</span></div>
      </div>
      <div class="grow">
        <p class="eyebrow">Apport du jour</p>
        <p class="nutri-hero__kcal"><b class="num">${fmtInt(eaten)}</b><span> / ${fmtInt(t.kcal)} kcal</span></p>
        <p class="muted nutri-hero__left">${eaten === 0 ? "Coche tes repas au fil de la journée." : t.kcal - eaten >= 0 ? `Encore ${fmtInt(t.kcal - eaten)} kcal à manger` : `${fmtInt(eaten - t.kcal)} kcal au-delà de l'objectif`}</p>
      </div>
    </div>
    <div class="stack mt-16">
      ${metricBar({ label: "Protéines", color: "var(--protein)", value: prot, max: t.proteinG, unit: "g", cls: "is-protein" })}
    </div>
    <div class="macro-plan">
      <p class="faint">Menus prévus</p>
      <span><i class="dot" style="background:var(--protein)"></i>${planned.p} g prot.</span>
      <span><i class="dot" style="background:var(--carbs)"></i>${planned.c} g gluc.</span>
      <span><i class="dot" style="background:var(--fat)"></i>${planned.f} g lip.</span>
    </div>
  </section>`;
}

export const nutritionView = {
  nav: "nutrition",
  title: "Nutrition",
  render() {
    const p = store.state.profile;
    const t = targets();
    const dk = ui.date;
    const day = dayPlan(dk).meals;
    let dietLine = DIET_LABELS[p.diet] || "Omnivore";
    if (p.allergens && p.allergens.length) dietLine += " · sans " + p.allergens.map((a) => (ALLERGEN_LABELS[a] || a).toLowerCase()).join(", ");
    return html`
      ${pageHead({
        eyebrow: `${GOAL_LABELS[p.goal]} · ${fmtInt(t.kcal)} kcal/jour`,
        title: "Nutrition",
        actions: html`
          <button type="button" class="icon-btn" data-action="open-shopping" aria-label="Liste de courses">${ic("shopping-basket")}</button>
          <button type="button" class="icon-btn" data-action="edit-profile" data-section="food" aria-label="Préférences alimentaires">${ic("sliders-horizontal")}</button>`,
      })}
      ${weekStrip(marks)}
      <div class="cols mt-16">
        <div>
          ${dayCard(dk)}
          <section class="section">
            <div class="section-head"><h2 class="section-title">Tes repères</h2></div>
            <div class="grid-3 targets">
              <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--protein)"></i>Protéines</p><p class="stat__value">${t.proteinG}<small>g</small></p></div>
              <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--carbs)"></i>Glucides</p><p class="stat__value">${t.carbG}<small>g</small></p></div>
              <div class="stat"><p class="stat__label"><i class="dot" style="background:var(--fat)"></i>Lipides</p><p class="stat__value">${t.fatG}<small>g</small></p></div>
            </div>
            <p class="field-hint">${GOAL_MEAL_NOTE[p.goal]}${t.floorApplied ? " Un plancher calorique de sécurité est appliqué : ta valeur calculée était plus basse. Pour un déficit plus marqué, fais-toi accompagner par un professionnel." : ""}</p>
          </section>
          <button type="button" class="card card-link shop-cta mt-16" data-action="open-shopping">
            <span class="library-cta__icon is-intake">${ic("shopping-basket")}</span>
            <span class="grow"><b>Liste de courses</b><span>Les ingrédients de la semaine, rangés par rayon</span></span>
            ${ic("chevron-right", "list-row__chev")}
          </button>
        </div>
        <div>
          <section class="section">
            <div class="section-head"><h2 class="section-title">Menus</h2><span class="faint">${fmtInt(day.total)} kcal</span></div>
            <div class="meals">${mealSlots(day).map(([slot, meal]) => mealCard(dk, slot, meal))}</div>
            <p class="diet-line">${ic("leaf", "icon-xs")}${dietLine}<button type="button" class="link" data-action="edit-profile" data-section="food">Modifier</button></p>
          </section>
          ${journal(dk, { title: "Journal alimentaire", includeSlots: false, showActivity: false })}
          <button type="button" class="btn btn-secondary btn-block mt-16" data-action="add-intake">${ic("plus")}Ajouter un aliment</button>
          ${disclaimer("Repères généraux, pas un avis médical. Consulte un médecin ou un diététicien-nutritionniste avant tout changement important, notamment en cas de pathologie, d'allergie sévère ou de grossesse. Vérifie toujours les ingrédients d'une recette.")}
        </div>
      </div>`;
  },
};
