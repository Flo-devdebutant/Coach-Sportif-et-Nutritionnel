/* =========================================================================
   GRAPHIQUES — SVG générés sans dépendance externe.
   Les couleurs passent par les variables CSS : chaque graphique suit le
   thème clair/sombre sans être recalculé.
   ========================================================================= */
import { html, raw } from "./dom.js";
import { clamp, fmtInt, fmtNum1, fmtDayMonth } from "../core/util.js";
import { MZ_NEUTRAL_FRONT, MZ_REGIONS_FRONT, MZ_NEUTRAL_BACK, MZ_REGIONS_BACK, EXERCISE_MUSCLES, MUSCLE_MAP } from "../data/muscles.js";

/* Anneaux concentriques : [{ value, max, color }] du plus grand au plus petit. */
export function rings(items, { size = 150, stroke = 15, gap = 5, label = "" } = {}) {
  const c = size / 2;
  let r = c - stroke / 2;
  const parts = items.map((it) => {
    const circ = 2 * Math.PI * r;
    const pct = it.max > 0 ? clamp(it.value / it.max, 0, 1) : 0;
    const off = circ * (1 - pct);
    const s = html`
      <circle class="ring__track" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}" style="stroke:${raw(it.track || "var(--surface-3)")}"/>
      <circle class="ring__bar" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"
        style="stroke:${raw(it.color)};--len:${circ.toFixed(1)};stroke-dasharray:${circ.toFixed(1)};stroke-dashoffset:${off.toFixed(1)};opacity:${pct > 0.004 ? 1 : 0}"
        transform="rotate(-90 ${c} ${c})"/>`;
    r -= stroke + gap;
    return s;
  });
  return html`<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label}">${parts}</svg>`;
}

/* Anneau unique avec contenu centré (minuteurs, objectifs). */
export function ring(pct, { size = 120, stroke = 10, color = "var(--accent)" } = {}) {
  return rings([{ value: pct, max: 1, color }], { size, stroke });
}

/* Barres groupées (ex. dépense / apport par jour), échelle commune et
   repère de cible en pointillés. */
export function groupedBars(labels, series, { target = 0, height = 180 } = {}) {
  const W = 340, H = height, L = 34, R = 6, T = 12, B = 22;
  const iw = W - L - R, ih = H - T - B;
  const all = series.flatMap((s) => s.values).concat([target, 1]);
  /* Graduations rondes : pas de 100, 250, 500, 1000… choisi pour 3 à 5
     intervalles. */
  const top = Math.max(...all);
  const step = [50, 100, 250, 500, 1000, 2000, 2500, 5000].find((st) => Math.ceil(top / st) <= 5) || 10000;
  const ticks = Math.max(1, Math.ceil(top / step));
  const maxV = ticks * step;
  const n = labels.length;
  const slot = iw / n;
  const gap = Math.min(3, slot * 0.1);
  const bw = Math.max(1.5, (slot - gap * (series.length + 1)) / series.length);
  const grid = [];
  for (let k = 0; k <= ticks; k++) {
    const v = step * k, y = T + ih - (v / maxV) * ih;
    grid.push(html`<line class="grid" x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}"/>
      <text x="${L - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${v >= 1000 ? fmtNum1(v / 1000) + "k" : fmtInt(v)}</text>`);
  }
  const bars = [];
  for (let i = 0; i < n; i++) {
    series.forEach((s, j) => {
      const val = s.values[i] || 0;
      const bh = (val / maxV) * ih;
      if (bh < 0.5) return;
      const x = L + i * slot + gap + j * (bw + gap);
      bars.push(html`<rect x="${x.toFixed(1)}" y="${(T + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(4, bw / 2.4).toFixed(1)}" style="fill:${raw(s.color)}"><title>${labels[i]} · ${s.name} : ${fmtInt(val)} kcal</title></rect>`);
    });
  }
  const every = n > 16 ? Math.ceil(n / 8) : 1;
  const xl = labels.map((l, i) => (i % every !== 0 && i !== n - 1 ? "" :
    html`<text x="${(L + i * slot + slot / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${l}</text>`));
  const tgt = target ? html`<line x1="${L}" x2="${W - R}" y1="${(T + ih - (target / maxV) * ih).toFixed(1)}" y2="${(T + ih - (target / maxV) * ih).toFixed(1)}" style="stroke:var(--text-3)" stroke-width="1.2" stroke-dasharray="4 4"/>` : "";
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Histogramme">${grid}${tgt}${bars}${xl}</svg>
    <div class="legend">${series.map((s) => html`<span><i class="dot" style="background:${raw(s.color)}"></i>${s.name}</span>`)}${target ? html`<span><i class="dot" style="background:var(--text-3)"></i>Cible</span>` : ""}</div>`;
}

/* Courbe lissée (Bézier calculées sur les points voisins) avec aire en
   dégradé et moyenne mobile en pointillés. Les points portent leurs
   valeurs pour l'info-bulle interactive. */
export function lineChart(points, { height = 200, color = "var(--weight)", unit = "kg", id = "lc" } = {}) {
  if (points.length < 2) return "";
  const W = 340, H = height, L = 34, R = 10, T = 16, B = 24;
  const iw = W - L - R, ih = H - T - B;
  const vals = points.map((p) => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.2; min -= pad; max += pad;
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const pts = points.map((p) => ({ ...p, x: L + ((p.t - t0) / span) * iw, y: T + ih - ((p.v - min) / (max - min)) * ih }));
  const curve = (p) => {
    let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i === 0 ? 0 : i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)},${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)},${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  };
  const trace = curve(pts);
  const area = `${trace} L${pts[pts.length - 1].x.toFixed(1)} ${T + ih} L${pts[0].x.toFixed(1)} ${T + ih} Z`;
  const mm = pts.map((p, i) => {
    const a = Math.max(0, i - 2), b = Math.min(pts.length - 1, i + 2);
    let s = 0; for (let j = a; j <= b; j++) s += pts[j].y;
    return { x: p.x, y: s / (b - a + 1) };
  });
  const grid = [];
  for (let k = 0; k <= 3; k++) {
    const v = min + ((max - min) * k) / 3, y = T + ih - ((v - min) / (max - min)) * ih;
    grid.push(html`<line class="grid" x1="${L}" y1="${y.toFixed(1)}" x2="${W - R}" y2="${y.toFixed(1)}"/><text x="${L - 6}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${fmtNum1(v)}</text>`);
  }
  const last = pts[pts.length - 1];
  const dots = pts.length <= 40 ? pts.map((p, i) => html`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3}" style="fill:${raw(i === pts.length - 1 ? color : "var(--surface)")};stroke:${raw(color)}" stroke-width="2"/>`) : html`<circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="5" style="fill:${raw(color)}"/>`;
  const data = JSON.stringify(pts.map((p) => [+(p.x / W).toFixed(4), +(p.y / H).toFixed(4), p.v, p.dk]));
  return html`<div class="chart-wrap" data-chart="${id}" data-points="${data}" data-unit="${unit}" style="position:relative">
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe d'évolution">
      <defs><linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style="stop-color:${raw(color)};stop-opacity:.28"/><stop offset="100%" style="stop-color:${raw(color)};stop-opacity:0"/></linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#${id}-g)"/>
      <path d="${curve(mm)}" fill="none" style="stroke:var(--text-3)" stroke-width="1.3" stroke-dasharray="5 4" opacity=".8"/>
      <path d="${trace}" fill="none" style="stroke:${raw(color)}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      <line class="chart-cursor" x1="0" x2="0" y1="${T}" y2="${T + ih}" style="stroke:var(--text-3)" stroke-dasharray="3 3" opacity="0"/>
      <text x="${pts[0].x}" y="${H - 5}">${fmtDayMonth(pts[0].dk)}</text>
      <text x="${last.x}" y="${H - 5}" text-anchor="end">${fmtDayMonth(last.dk)}</text>
    </svg>
    <div class="tip" hidden></div>
  </div>`;
}

/* Info-bulle au survol / toucher : le point le plus proche horizontalement. */
export function bindLineChart(root) {
  for (const wrap of root.querySelectorAll("[data-chart]")) {
    const pts = JSON.parse(wrap.dataset.points || "[]");
    const tip = wrap.querySelector(".tip");
    const cursor = wrap.querySelector(".chart-cursor");
    const svg = wrap.querySelector("svg");
    const unit = wrap.dataset.unit;
    const show = (clientX) => {
      const rect = svg.getBoundingClientRect();
      const fx = (clientX - rect.left) / rect.width;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p[0] - fx) < Math.abs(best[0] - fx)) best = p;
      tip.hidden = false;
      tip.innerHTML = String(html`<b>${fmtNum1(best[2])} ${unit}</b>${fmtDayMonth(best[3])}`);
      tip.style.left = `${best[0] * rect.width}px`;
      tip.style.top = `${best[1] * rect.height}px`;
      const vb = svg.viewBox.baseVal;
      cursor.setAttribute("x1", best[0] * vb.width);
      cursor.setAttribute("x2", best[0] * vb.width);
      cursor.setAttribute("opacity", "1");
    };
    const hide = () => { tip.hidden = true; cursor.setAttribute("opacity", "0"); };
    wrap.addEventListener("pointermove", (e) => show(e.clientX));
    wrap.addEventListener("pointerdown", (e) => show(e.clientX));
    wrap.addEventListener("pointerleave", hide);
  }
}

/* Répartition en barre empilée (ex. métabolisme / activité, macros). */
export function stackBar(parts) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return html`<div class="stackbar">${parts.map((p) => html`<i style="width:${((100 * Math.max(0, p.value)) / total).toFixed(2)}%;background:${raw(p.color)}" title="${p.name}"></i>`)}</div>`;
}

/* Courbe minuscule sans axes (tendance d'une charge, d'un poids). */
export function sparkline(values, { w = 120, h = 34, color = "var(--accent-ink)" } = {}) {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`);
  return html`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts.join(" ")}" fill="none" style="stroke:${raw(color)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ---------- Silhouette musculaire face / dos ---------- */
function figure(regions, neutrals, prim, sec, label) {
  return html`<figure class="mz">
    <svg class="mz__svg" viewBox="-25 14 250 500" role="img" aria-label="${label}">
      ${neutrals.map((d) => html`<path d="${d}" class="mz-base"/>`)}
      ${regions.map(([id, d]) => html`<path d="${d}" class="mz-region${prim.includes(id) ? " is-primary" : sec.includes(id) ? " is-secondary" : ""}"/>`)}
    </svg>
    <figcaption>${label}</figcaption>
  </figure>`;
}
export function muscleMap(exercise) {
  const m = EXERCISE_MUSCLES[exercise.id] || MUSCLE_MAP[exercise.group] || { p: [], s: [] };
  return {
    primary: m.np || [], secondary: m.ns || [],
    svg: html`<div class="mz-wrap">
      ${figure(MZ_REGIONS_FRONT, MZ_NEUTRAL_FRONT, m.p, m.s, "Face")}
      ${figure(MZ_REGIONS_BACK, MZ_NEUTRAL_BACK, m.p, m.s, "Dos")}
    </div>`,
  };
}
