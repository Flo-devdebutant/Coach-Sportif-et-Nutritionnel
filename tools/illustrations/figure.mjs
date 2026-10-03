/* =========================================================================
   SILHOUETTE ARTICULÉE
   Une pose se décrit par des angles absolus (degrés, 0 = vers la droite,
   90 = vers le bas) : tronc, tête, bras (épaule→coude, coude→poignet),
   jambes (hanche→genou, genou→cheville). La figure regarde vers la droite.
   Vue de profil : membres « proches » (N) clairs et « éloignés » (F)
   sombres. Vue de face : gauche (L) et droite (R) à l'identique.
   Le sol est en y = 0 : la pose est posée dessus automatiquement.
   ========================================================================= */
export const LEN = { torso: 62, neck: 8, head: 13, ua: 35, fa: 31, hand: 8, thigh: 50, shin: 49, foot: 16 };
export const W = { torso: 28, ua: 12, fa: 10, hand: 9, thigh: 18, shin: 13, foot: 7, neck: 11 };
export const C = {
  body: "#E7EBF1", far: "#7A8496", hl: "#C4EE36", hlFar: "#7F9A26", gear: "#4A5466", gearHi: "#8994A8",
  band: "#F2622E", towel: "#56B4E9", arrow: "#C4EE36", wood: "#6B5A4A",
};

const rad = (a) => (a * Math.PI) / 180;
export const dir = (a, l) => [Math.cos(rad(a)) * l, Math.sin(rad(a)) * l];
export const add = (p, a, l) => { const d = dir(a, l); return [p[0] + d[0], p[1] + d[1]]; };

/* Cinématique inverse à deux segments : angles pour atteindre la cible
   (relative à l'articulation racine), coude ou genou du côté « bend ». */
export function ik(dx, dy, l1, l2, bend = 1) {
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const phi = (Math.atan2(dy, dx) * 180) / Math.PI;
  const alpha = (Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))) * 180) / Math.PI;
  const a1 = phi + bend * alpha;
  const e = dir(a1, l1);
  const a2 = (Math.atan2(dy - e[1], dx - e[0]) * 180) / Math.PI;
  return [a1, a2];
}
const solve = (spec, l1, l2) => (spec && spec.ik ? [...ik(spec.ik[0], spec.ik[1], l1, l2, spec.bend ?? 1), ...(spec.end !== undefined ? [spec.end] : [])] : spec);

/* Calcule toutes les articulations d'une pose (avant recalage). */
export function joints(p) {
  const front = p.view === "front";
  const H = [0, 0];
  const t = p.t ?? -90;
  const S = add(H, t, LEN.torso * (p.torsoScale ?? 1));
  const hd = p.hd ?? t;
  const head = add(S, hd, LEN.neck + LEN.head);
  const neck = add(S, hd, LEN.neck);
  const J = { H, S, head, neck, t, front };
  const perp = t + 90;
  const sides = front ? [["L", -1], ["R", 1]] : [["N", 0], ["F", 0]];
  for (const [k, sgn] of sides) {
    const sh = front ? add(S, perp, sgn * 15) : S;
    const hp = front ? add(H, perp, sgn * 9) : H;
    const ls = p["ls" + k] || [1, 1];
    const as = p["as" + k] || [1, 1];
    const a = solve(p["a" + k], LEN.ua * as[0], LEN.fa * as[1]) || (front ? [90 + sgn * -8, 90 + sgn * -4] : [95, 95]);
    const l = solve(p["l" + k], LEN.thigh * ls[0], LEN.shin * ls[1]) || (front ? [90 + sgn * -4, 90] : [90, 90]);
    const E = add(sh, a[0], LEN.ua * as[0]);
    const Wr = add(E, a[1], LEN.fa * as[1]);
    const Hd = add(Wr, a[2] ?? a[1], LEN.hand);
    const K = add(hp, l[0], LEN.thigh * ls[0]);
    const A = add(K, l[1], LEN.shin * ls[1]);
    const fa = p["f" + k] ?? (front ? (sgn < 0 ? 180 : 0) + (sgn < 0 ? -20 : 20) : l[1] - 90);
    const T = add(A, fa, front ? 9 : LEN.foot);
    Object.assign(J, { ["sh" + k]: sh, ["hp" + k]: hp, ["E" + k]: E, ["W" + k]: Wr, ["Hd" + k]: Hd, ["K" + k]: K, ["A" + k]: A, ["T" + k]: T });
  }
  return J;
}

/* Segments à dessiner, du plus éloigné au plus proche. */
function segments(J, p) {
  const hl = new Set(p.hl || []);
  const col = (name, far) => (hl.has(name) ? (far ? C.hlFar : C.hl) : far ? C.far : C.body);
  const seg = (a, b, w, name, far) => ({ a, b, w, c: col(name, far), name });
  const limbs = (k, far) => [
    seg(J["hp" + k], J["K" + k], W.thigh, "thigh" + k, far), seg(J["K" + k], J["A" + k], W.shin, "shin" + k, far),
    seg(J["A" + k], J["T" + k], W.foot, "foot" + k, far),
  ];
  const arms = (k, far) => [
    seg(J["sh" + k], J["E" + k], W.ua, "ua" + k, far), seg(J["E" + k], J["W" + k], W.fa, "fa" + k, far),
    seg(J["W" + k], J["Hd" + k], W.hand, "hand" + k, far),
  ];
  if (J.front) {
    return { back: [], torso: true, front: [...limbs("L"), ...limbs("R"), ...arms("L"), ...arms("R")] };
  }
  /* Ordre de profil : bras éloigné, jambe éloignée, tronc, jambe proche, bras proche. */
  const farFirst = p.armFarFront ? [] : arms("F", true);
  return {
    back: [...farFirst, ...limbs("F", true)],
    torso: true,
    front: [...limbs("N", false), ...(p.armFarFront ? arms("F", true) : []), ...arms("N", false)],
    _hl: hl,
  };
}

/* Points extrêmes du corps (avec l'épaisseur des segments). */
export function bodyPoints(J) {
  const pts = [];
  const r = (p, w) => { pts.push([p[0], p[1] + w / 2], [p[0], p[1] - w / 2], [p[0] - w / 2, p[1]], [p[0] + w / 2, p[1]]); };
  const ks = J.front ? ["L", "R"] : ["N", "F"];
  for (const k of ks) {
    r(J["K" + k], W.thigh); r(J["A" + k], W.shin); r(J["T" + k], W.foot);
    r(J["E" + k], W.ua); r(J["W" + k], W.fa); r(J["Hd" + k], W.hand);
  }
  r(J.H, W.torso); r(J.S, W.torso); r(J.head, LEN.head * 2);
  return pts;
}

export function shift(J, dx, dy) {
  const out = {};
  for (const [k, v] of Object.entries(J)) out[k] = Array.isArray(v) && v.length === 2 && typeof v[0] === "number" ? [v[0] + dx, v[1] + dy] : v;
  return out;
}

/* Pose posée au sol (y = 0), éventuellement surélevée (lift) ou en l'air (air). */
export function place(p) {
  const J = joints(p);
  const pts = bodyPoints(J);
  /* anchor : [articulation, hauteur] pose cette articulation à la hauteur voulue. */
  if (p.anchor) return shift(J, p.x ?? 0, -J[p.anchor[0]][1] - p.anchor[1] - 6);
  const maxY = Math.max(...pts.map((q) => q[1]));
  return shift(J, p.x ?? 0, -maxY - (p.lift || 0) - (p.air || 0));
}

const f1 = (n) => Math.round(n * 10) / 10;
const line = (a, b, w, c, extra = "") => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;

export function drawFigure(J, p) {
  const s = segments(J, p);
  let out = s.back.map((g) => line(g.a, g.b, g.w, g.c)).join("");
  const hl = new Set(p.hl || []);
  if (J.front) {
    const shL = J.shL, shR = J.shR, hpL = J.hpL, hpR = J.hpR;
    const tc = hl.has("torso") ? C.hl : C.body;
    out += s.front.filter((g) => /thigh|shin|foot/.test(g.name)).map((g) => line(g.a, g.b, g.w, g.c)).join("");
    out += `<path d="M${f1(shL[0])},${f1(shL[1])} L${f1(shR[0])},${f1(shR[1])} L${f1(hpR[0])},${f1(hpR[1])} L${f1(hpL[0])},${f1(hpL[1])} Z" fill="${tc}" stroke="${tc}" stroke-width="14" stroke-linejoin="round"/>`;
    out += line(J.S, J.neck, W.neck, C.body);
    out += s.front.filter((g) => !/thigh|shin|foot/.test(g.name)).map((g) => line(g.a, g.b, g.w, g.c)).join("");
  } else {
    out += line(J.H, J.S, W.torso, hl.has("torso") ? C.hl : C.body);
    out += line(J.S, J.neck, W.neck, C.body);
    out += s.front.map((g) => line(g.a, g.b, g.w, g.c)).join("");
  }
  out += `<circle cx="${f1(J.head[0])}" cy="${f1(J.head[1])}" r="${LEN.head}" fill="${C.body}"/>`;
  return out;
}
