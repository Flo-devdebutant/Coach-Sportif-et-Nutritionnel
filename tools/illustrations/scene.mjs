/* =========================================================================
   SCÈNE : fond, sol, accessoires, flèches de mouvement et cadrage commun
   aux deux images d'un exercice (l'animation départ → travail ne doit pas
   faire sauter la silhouette).
   ========================================================================= */
import { C, place, bodyPoints, drawFigure } from "./figure.mjs";

const WIDTH = 420, HEIGHT = 280, FLOOR = 248;
const f1 = (n) => Math.round(n * 10) / 10;
const pt = (p) => `${f1(p[0])},${f1(p[1])}`;

/* ---------- Accessoires : { svg, pts } en coordonnées locales (sol y = 0) ---------- */
const item = (svg, pts) => ({ svg, pts });
const rect = (x, y, w, h, fill, r = 3, extra = "") => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${r}" fill="${fill}"${extra}/>`;
const ln = (a, b, w, c, cap = "round") => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="${cap}"/>`;

export const P = {
  mat: (x1, x2) => item(rect(x1, -4, x2 - x1, 4, "#33405A", 2), [[x1, 0], [x2, 0]]),
  bench: (x1, x2, h = 40) => item(
    rect(x1, -h - 9, x2 - x1, 9, C.gearHi, 4) + ln([x1 + 10, -h], [x1 + 10, 0], 5, C.gear) + ln([x2 - 10, -h], [x2 - 10, 0], 5, C.gear),
    [[x1, -h - 9], [x2, 0]]),
  box: (x1, x2, h = 40) => item(rect(x1, -h, x2 - x1, h, C.gear, 4) + rect(x1, -h, x2 - x1, 5, C.gearHi, 2), [[x1, -h], [x2, 0]]),
  /* Chaise vue de profil ; back = côté du dossier (-1 gauche, 1 droite, 0 sans). */
  chair: (x, back = -1, h = 44, w = 40) => {
    const x1 = x - w / 2, x2 = x + w / 2;
    let s = rect(x1, -h - 6, w, 6, C.wood, 2) + ln([x1 + 4, -h], [x1 + 4, 0], 4, C.wood) + ln([x2 - 4, -h], [x2 - 4, 0], 4, C.wood);
    if (back) { const bx = back < 0 ? x1 + 3 : x2 - 3; s += ln([bx, -h - 4], [bx, -h - 46], 5, C.wood) + ln([bx, -h - 44], [bx, -h - 30], 9, C.wood, "butt"); }
    return item(s, [[x1, back ? -h - 48 : -h - 6], [x2, 0]]);
  },
  wall: (x, side = 1) => item(rect(side > 0 ? x : x - 12, -232, 12, 232, "#2E3646", 0) + ln([x, -232], [x, 0], 2, "#465066"), [[x - 12, -10], [x + 12, 0]]),
  table: (x1, x2, h = 72) => item(rect(x1, -h - 7, x2 - x1, 7, C.wood, 2) + ln([x1 + 8, -h], [x1 + 8, 0], 5, C.wood) + ln([x2 - 8, -h], [x2 - 8, 0], 5, C.wood), [[x1, -h - 7], [x2, 0]]),
  /* Haltère vu de bout (profil) ou de face (horizontal). */
  db: (p, side = false) => side
    ? item(ln([p[0] - 12, p[1]], [p[0] + 12, p[1]], 4, C.gearHi) + rect(p[0] - 17, p[1] - 8, 7, 16, C.gear, 2) + rect(p[0] + 10, p[1] - 8, 7, 16, C.gear, 2), [[p[0] - 17, p[1] - 8], [p[0] + 17, p[1] + 8]])
    : item(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="9" fill="${C.gear}" stroke="${C.gearHi}" stroke-width="2.5"/>`, [[p[0] - 9, p[1] - 9], [p[0] + 9, p[1] + 9]]),
  band: (a, b) => item(ln(a, b, 3.5, C.band), [a, b]),
  towel: (a, b, w = 7) => item(ln(a, b, w, C.towel), [a, b]),
  stick: (a, b) => item(ln(a, b, 5, C.wood), [a, b]),
  /* Colonne de poulie : x, hauteur de la poulie, câble jusqu'à la main. */
  pulley: (x, py, hand, w = 22) => item(
    rect(x - w / 2, -236, w, 236, "#2B3242", 3) + ln([x, -236], [x, 0], 2, "#3A4356")
    + `<circle cx="${f1(x)}" cy="${f1(py)}" r="7" fill="${C.gear}" stroke="${C.gearHi}" stroke-width="2"/>`
    + (hand ? ln([x, py], hand, 2, "#B9C2D3") + `<circle cx="${f1(hand[0])}" cy="${f1(hand[1])}" r="4" fill="${C.gearHi}"/>` : ""),
    [[x - w / 2, -236], [x + w / 2, 0]]),
  poly: (points, fill, stroke = "none") => item(`<path d="M${points.map(pt).join("L")}Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`, points),
  line: (a, b, w = 5, c = C.gear) => item(ln(a, b, w, c), [a, b]),
  circle: (p, r, fill = C.gear, stroke = C.gearHi) => item(`<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`, [[p[0] - r, p[1] - r], [p[0] + r, p[1] + r]]),
  raw: (svg, pts) => item(svg, pts),
  /* Mention dans le coin (ex. « vue de dessus »), hors cadrage. */
  note: (text) => ({ svg: `<text x="14" y="24" fill="#8C96A8" font-family="system-ui, sans-serif" font-size="13" font-weight="600">${text}</text>`, pts: [], abs: true }),
};

/* Flèche de mouvement (courbe si bend ≠ 0). */
export function arrow(a, b, bend = 0) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const c = [mx - (dy / len) * bend, my + (dx / len) * bend];
  const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const h1 = [b[0] - 9 * Math.cos(ang - 0.45), b[1] - 9 * Math.sin(ang - 0.45)];
  const h2 = [b[0] - 9 * Math.cos(ang + 0.45), b[1] - 9 * Math.sin(ang + 0.45)];
  return item(`<path d="M${pt(a)} Q${pt(c)} ${pt(b)}" fill="none" stroke="${C.arrow}" stroke-width="3" stroke-linecap="round" opacity=".95"/>`
    + `<path d="M${pt(h1)} L${pt(b)} L${pt(h2)}" fill="none" stroke="${C.arrow}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`, [a, b, c]);
}

/* Rend les deux images d'un exercice avec un cadrage commun. */
export function renderExercise(ex) {
  const frames = ex.frames.map((pose, i) => {
    const p = { view: ex.view, hl: ex.hl, ...pose };
    const J = place(p);
    const list = (v) => (Array.isArray(v) ? v : [v]).filter(Boolean);
    const props = list(ex.props ? ex.props(J, i) : []);
    const arrows = list(ex.arrows ? ex.arrows(J, i) : []);
    return { p, J, props, arrows };
  });
  const all = [];
  for (const f of frames) {
    all.push(...bodyPoints(f.J));
    for (const it of [...f.props, ...f.arrows]) if (!it.abs) all.push(...it.pts);
  }
  const minX = Math.min(...all.map((q) => q[0])), maxX = Math.max(...all.map((q) => q[0]));
  const minY = Math.min(...all.map((q) => q[1]));
  const maxY = Math.max(...all.map((q) => q[1]));
  const s = ex.top ? Math.min(1.25, (HEIGHT - 70) / (maxY - minY), (WIDTH - 40) / (maxX - minX)) : Math.min(1.25, (FLOOR - 14) / -minY, (WIDTH - 40) / (maxX - minX));
  const cx = (minX + maxX) / 2;
  /* Vue de dessus : pas de sol, silhouette centrée. */
  const ty = ex.top ? HEIGHT / 2 + 8 - s * (minY + maxY) / 2 : FLOOR;
  return frames.map((f) => {
    const g = `<g transform="translate(${f1(WIDTH / 2 - s * cx)},${f1(ty)}) scale(${f1(s * 1000) / 1000})">`
      + (ex.top ? "" : `<ellipse cx="${f1((Math.min(...bodyPoints(f.J).map((q) => q[0])) + Math.max(...bodyPoints(f.J).map((q) => q[0]))) / 2)}" cy="2" rx="${f1(Math.min(150, (Math.max(...bodyPoints(f.J).map((q) => q[0])) - Math.min(...bodyPoints(f.J).map((q) => q[0]))) / 2 + 14))}" ry="5" fill="#000" opacity=".28"/>`)
      + f.props.filter((it) => !it.front && !it.abs).map((it) => it.svg).join("")
      + drawFigure(f.J, f.p)
      + f.props.filter((it) => it.front).map((it) => it.svg).join("")
      + f.arrows.map((it) => it.svg).join("")
      + "</g>";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">`
      + `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A303B"/><stop offset="1" stop-color="#191C23"/></linearGradient></defs>`
      + `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>`
      + (ex.top ? `<rect width="${WIDTH}" height="${HEIGHT}" fill="#1B1F27"/>` : `<rect y="${FLOOR}" width="${WIDTH}" height="${HEIGHT - FLOOR}" fill="#13161B"/>`
      + `<line x1="0" y1="${FLOOR}" x2="${WIDTH}" y2="${FLOOR}" stroke="#39404D" stroke-width="1.5"/>`)
      + g + f.props.filter((it) => it.abs).map((it) => it.svg).join("") + "</svg>";
  });
}

/* Accessoire dessiné devant la silhouette. */
export const front = (it) => (it ? { ...it, front: true } : it);
