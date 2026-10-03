/* Définition des illustrations : deux poses (départ, travail), segments
   mis en valeur (muscles sollicités), accessoires et flèches.
   Conventions : profil regard vers la droite ; sur le dos, tête à gauche ;
   sur le ventre et à quatre pattes, tête à droite. */
import { P, arrow, front } from "./scene.mjs";
import { stand, squat, pushup, forearmPlank, supine, prone, quad, bridge, hinge, tilt } from "./poses.mjs";
import { LEN } from "./figure.mjs";

const mat = (J) => {
  const xs = ["H", "head", "TN", "TF", "HdN", "HdF", "KN", "AN"].map((k) => J[k]).filter(Boolean).map((p) => p[0]);
  return P.mat(Math.min(...xs) - 18, Math.max(...xs) + 18);
};
const up = (p, d) => [p[0], p[1] - d];
const dn = (p, d) => [p[0], p[1] + d];
const rt = (p, d) => [p[0] + d, p[1]];

/* Bras : course (proche devant / éloigné derrière et inversement), mains
   sur les hanches, mains derrière la tête, garde de boxe. */
const RUN_A = { aN: [62, -14], aF: [122, 70] };
const RUN_B = { aN: [122, 70], aF: [62, -14] };
const HIPS = { aN: [112, 20], aF: [112, 20] };
const HEAD = { aN: [-34, 196, 196], aF: [-38, 192, 192], asN: [1, 0.62], asF: [1, 0.62] };
const GUARD = { aN: [62, -112], aF: [70, -105] };
/* Vue de face debout. */
const fstand = (o = {}) => ({ t: -90, aL: [104, 96], aR: [76, 84], lL: [92, 90], lR: [88, 90], ...o });
/* Genou levé (profil). */
const knee = (h = 1) => [-12 * h + 90 * (1 - h), 90 - 6 * h];

export const EXERCISES = {
  /* ===================== CARDIO ===================== */
  c1: {
    view: "front",
    frames: [fstand(), fstand({ aL: [-150, -112], aR: [-30, -68], lL: [108, 102], lR: [72, 78], air: 10 })],
    arrows: (J, i) => i && [arrow(rt(J.HdL, -16), rt(dn(J.HdL, 60), -40), 18), arrow(rt(J.AR, 14), rt(J.AR, 34))],
  },
  c2: {
    hl: ["thighN"],
    frames: [stand({ ...RUN_A, lN: knee(), fF: 58 }), stand({ ...RUN_B, lF: knee(), fN: 58 })],
    arrows: (J, i) => arrow(dn(i ? J.KF : J.KN, 46), dn(i ? J.KF : J.KN, 12)),
  },
  c3: {
    hl: ["thighN", "uaN"],
    frames: [pushup(0), stand({ aN: [-110, -104], aF: [-106, -100], air: 18, fN: 60, fF: 60 })],
    props: (J, i) => !i && mat(J),
    arrows: (J, i) => i && arrow(dn(J.AN, 34), dn(J.AN, 6)),
  },
  c7: {
    hl: ["shinN"],
    frames: [stand({ ...RUN_A, lF: [96, -128], fF: 160 }), stand({ ...RUN_B, lN: [96, -128], fN: 160 })],
    arrows: (J, i) => arrow(rt(i ? J.KN : J.KF, -10), up(rt(i ? J.KN : J.KF, -36), 32), -14),
  },
  c9: {
    view: "front",
    frames: [
      fstand({ t: -90, lL: [110, 86], lR: [70, 94], lsL: [0.85, 1], lsR: [0.85, 1], aL: [100, 40], aR: [80, 140] }),
      fstand({ t: -90, lL: [128, 80], lR: [52, 100], lsL: [0.85, 1], lsR: [0.85, 1], aL: [100, 40], aR: [80, 140], x: 34 }),
    ],
    arrows: (J, i) => i && arrow(up(rt(J.H, -60), 20), up(rt(J.H, 40), 20)),
  },
  c11: {
    view: "front",
    top: true,
    frames: [
      { t: 0, hd: 0, aL: [-90, -90], aR: [90, 90], asL: [0.4, 0.3], asR: [0.4, 0.3], lL: [184, 180], lR: [176, 180], fL: -90, fR: 90 },
      { t: 0, hd: 0, aL: [-90, -90], aR: [90, 90], asL: [0.4, 0.3], asR: [0.4, 0.3], lL: [198, 192], lR: [162, 168], fL: -90, fR: 90 },
    ],
    props: () => P.note("Vue de dessus"),
    arrows: (J, i) => i && [arrow(up(J.AL, 6), up(J.AL, 24)), arrow(dn(J.AR, 6), dn(J.AR, 24))],
  },
  c13: {
    frames: [stand({ ...RUN_A, lN: knee(0.8) }), stand({ ...RUN_B, lF: knee(0.8) })],
    arrows: (J, i) => arrow(dn(i ? J.KF : J.KN, 40), dn(i ? J.KF : J.KN, 10)),
  },
  c14: {
    view: "front",
    frames: [fstand(), fstand({ aL: [-150, -112], aR: [-30, -68], lR: [62, 70], fR: 40 })],
    arrows: (J, i) => i && arrow(rt(dn(J.KR, 30), -26), rt(dn(J.KR, 30), 10), 8),
  },
  c15: {
    hl: ["uaN", "faN"],
    frames: [
      stand({ ...GUARD, t: -86, lN: [78, 96], lF: [104, 88], fF: 40 }),
      stand({ aN: [-4, -4], aF: [70, -105], t: -80, lN: [78, 96], lF: [104, 88], fF: 40 }),
    ],
    arrows: (J, i) => i && arrow(up(rt(J.S, 20), 16), up(rt(J.HdN, 18), 16)),
  },
  c16: {
    hl: ["thighN"],
    frames: [stand({ ...HIPS }), stand({ ...HIPS, lN: [-28, 74] })],
    arrows: (J, i) => i && arrow(dn(rt(J.KN, 16), 50), dn(rt(J.KN, 16), 14)),
  },
  c17: {
    view: "front",
    frames: [
      fstand({ lL: [108, 88], lR: [72, 92], lsL: [0.85, 1], lsR: [0.85, 1], aL: [100, 30], aR: [80, 150] }),
      fstand({ lL: [118, 84], lR: [62, 96], lsL: [0.85, 1], lsR: [0.85, 1], aL: [100, 30], aR: [80, 150], x: 22 }),
    ],
    arrows: (J, i) => [arrow(up(rt(J.H, -40), 30), up(rt(J.H, 40), 30)), arrow(up(rt(J.H, 40), 40), up(rt(J.H, -40), 40))].slice(i, i + 1),
  },
  c18: {
    hl: ["thighN", "uaN"],
    frames: [
      squat(1, { aN: [62, -110], aF: [66, -104] }),
      stand({ aN: [-92, -90], aF: [-88, -88], fN: 60, fF: 60 }),
    ],
    props: (J) => [front(P.db(J.WN)), P.db(J.WF)],
    arrows: (J, i) => i && arrow(dn(rt(J.WN, 24), 60), rt(J.WN, 24)),
  },
  c20: {
    hl: ["torso"],
    frames: [stand({ lN: [76, 98], lF: [104, 84], aN: [94, 90], aF: [86, 90] }), stand({ lF: [76, 98], lN: [104, 84], aN: [86, 90], aF: [94, 90] })],
    props: (J) => [front(P.db(dn(J.WN, 4))), P.db(dn(J.WF, 4))],
    arrows: (J, i) => i && arrow(dn(rt(J.H, -40), -40), dn(rt(J.H, 40), -40)),
  },
  c21: {
    hl: ["thighN"],
    frames: [
      stand({ ...RUN_A, t: -72, lN: [-10, 84], lF: [110, 96], fF: 50 }),
      stand({ ...RUN_B, t: -72, lF: [-10, 84], lN: [110, 96], fN: 50 }),
    ],
    props: (J) => [P.line([J.H[0] - 120, 0], [J.H[0] - 120, -170], 8, "#3A4356"), P.band([J.H[0] - 120, J.H[1]], J.H)],
    arrows: (J, i) => i && arrow(rt(up(J.H, 30), -50), rt(up(J.H, 30), -90)),
  },
  c27: {
    hl: ["thighN", "uaN"],
    frames: [
      { t: -82, aN: [20, -20], aF: [60, 10], lN: [-20, 70], lF: [30, 120], anchor: ["H", 92] },
      { t: -82, aN: [60, 10], aF: [20, -20], lN: [30, 120], lF: [-20, 70], anchor: ["H", 92] },
    ],
    props: (J) => [
      P.line(dn(J.H, 10), [J.H[0] + 40, 0], 7), P.line([J.H[0] + 40, -24], [J.H[0] + 92, -24], 7),
      P.circle([J.H[0] + 112, -54], 46, "#2B3242", C2), P.line([J.H[0] + 40, -40], [J.H[0] + 70, -150], 6, "#8994A8"),
      P.line(dn(J.H, 4), [J.H[0] - 4, -40], 7), P.raw(`<rect x="${J.H[0] - 22}" y="${J.H[1] + 4}" width="34" height="8" rx="4" fill="#8994A8"/>`, []),
    ],
  },
  c28: {
    hl: ["uaN", "torso"],
    frames: [
      stand({ aN: [-62, -70], aF: [-66, -72] }),
      hinge(0.55, { lN: [64, 112], lF: [66, 112], aN: [104, 98], aF: [102, 98] }),
    ],
    props: (J) => [P.raw(`<rect x="${J.H[0] + 96}" y="-236" width="30" height="236" rx="4" fill="#2B3242"/><circle cx="${J.H[0] + 111}" cy="-212" r="9" fill="#4A5466"/>`, [[J.H[0] + 96, -236], [J.H[0] + 126, 0]]),
      P.line([J.H[0] + 104, -212], J.HdN, 2, "#B9C2D3")],
    arrows: (J, i) => i && arrow(up(rt(J.S, 30), 70), rt(J.S, 34), 16),
  },

  /* ===================== JAMBES ===================== */
  j15: {
    hl: ["thighN", "thighF"],
    frames: [stand({ ...HIPS }), stand({ ...HIPS, lN: [8, 94], lF: [112, 176], fF: 96 })],
    arrows: (J, i) => i && arrow(up(rt(J.H, 50), 46), up(rt(J.H, 50), 10)),
  },
  j19: {
    hl: ["shinN", "shinF"],
    frames: [stand(), stand({ fN: 52, fF: 52 })],
    arrows: (J, i) => i && arrow(rt(J.AN, -26), up(rt(J.AN, -26), 26)),
  },
  j11: {
    view: "front",
    hl: ["thighL", "thighR"],
    frames: [
      fstand({ lL: [106, 90], lR: [74, 90], fL: 150, fR: 30, aL: [60, -30], aR: [120, 210], asL: [0.9, 0.7], asR: [0.9, 0.7] }),
      fstand({ lL: [150, 96], lR: [30, 84], lsL: [0.8, 1], lsR: [0.8, 1], fL: 150, fR: 30, aL: [60, -30], aR: [120, 210], asL: [0.9, 0.7], asR: [0.9, 0.7] }),
    ],
    arrows: (J, i) => i && arrow(up(rt(J.H, 70), 50), up(rt(J.H, 70), 14)),
  },
  j16: {
    hl: ["thighN"],
    frames: [
      stand({ ...HIPS, lN: [76, 98], lF: { ik: [-54, 70], bend: -1 }, fF: 180 }),
      stand({ ...HIPS, t: -84, lN: [16, 104], lF: { ik: [-54, 24], bend: -1 }, fF: 180, x: 0 }),
    ],
    props: (J) => P.box(J.AF[0] - 34, J.AF[0] + 6, -J.AF[1] - 7),
    arrows: (J, i) => i && arrow(up(rt(J.H, 40), 40), up(rt(J.H, 40), 6)),
  },
  j17: {
    hl: ["thighN"],
    frames: [
      stand({ ...HIPS, lN: { ik: [30, 52], bend: -1 }, anchor: ["AF", 0] }),
      stand({ ...HIPS, lF: [70, 130], fF: 60, anchor: ["AN", 46] }),
    ],
    props: (J, i) => P.chair((i ? J.AN[0] : J.AN[0]) + 6, 1, 46),
    arrows: (J, i) => i && arrow(rt(up(J.H, 10), -40), rt(up(J.H, 50), -40)),
  },
  j18: {
    hl: ["thighN"],
    frames: [
      stand({ lF: [70, 76], fF: 0, aN: [20, 20], aF: [86, 90] }),
      { t: -50, lN: [-6, 116], lF: [-8, -4], aN: [-4, -4], aF: [40, 40], fF: -60 },
    ],
    props: (J) => P.line([J.HdN[0] + 8, 0], [J.HdN[0] + 8, -200], 9, "#4A5466"),
    arrows: (J, i) => i && arrow(up(rt(J.H, -30), 60), up(rt(J.H, -30), 20)),
  },
  j21: {
    hl: ["thighN", "torso"],
    frames: [
      stand({ lF: [100, 102], fF: 30, aN: [94, 90], aF: [90, 90] }),
      { t: -6, lN: [96, 86], lF: [178, 178], aN: [92, 90], aF: [88, 90], fF: 90 },
    ],
    props: (J) => P.db(dn(J.WF, 6)),
    arrows: (J, i) => i && arrow(up(rt(J.S, -30), 60), up(rt(J.S, 10), 24), -10),
  },
  j25: {
    hl: ["thighN"],
    frames: [
      { ...bridge(0), lN: { ik: [64, -12], bend: -1 }, lF: [-80, -84] },
      { ...bridge(1), t: 156, lN: { ik: [60, -2], bend: -1 }, lF: [-70, -76] },
    ],
    props: (J) => [P.chair(J.AN[0] + 14, 1, -J.AN[1] - 6), mat(J)],
    arrows: (J, i) => i && arrow(dn(J.H, 40), dn(J.H, 8)),
  },
  j26: {
    hl: ["thighN"],
    frames: [hinge(0, { aN: [-120, 70], aF: [118, 74] }), hinge(0.75, { aN: [-90 + 54, 70 + 54], aF: [118 + 54, 74 + 54] })],
    props: (J) => {
      const back = J.t - 90; /* côté du dos */
      const o = (p, d) => [p[0] + Math.cos((back * Math.PI) / 180) * d, p[1] + Math.sin((back * Math.PI) / 180) * d];
      const a = o(J.H, 16), b = o(J.head, 14);
      const dx = b[0] - a[0], dy = b[1] - a[1];
      return front(P.stick([a[0] - dx * 0.15, a[1] - dy * 0.15], [b[0] + dx * 0.1, b[1] + dy * 0.1]));
    },
    arrows: (J, i) => i && arrow(rt(up(J.H, 20), -30), rt(up(J.H, 10), -64)),
  },
  j27: {
    hl: ["thighN"],
    frames: [supine({ lN: [0, 0], lF: [2, 0], fN: -80, fF: -80 }), { t: 166, hd: 180, lN: [10, 10], lF: [12, 10], aN: [176, 180], aF: [176, 180], fN: -70, fF: -70 }],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(dn(J.H, 36), dn(J.H, 8)),
  },
  j28: {
    hl: ["thighN", "thighF"],
    frames: [hinge(0, { aN: [96, 86], aF: [92, 86] }), hinge(0.8, { aN: [94, 92], aF: [90, 92] })],
    arrows: (J, i) => i && arrow(rt(up(J.H, 14), -20), rt(up(J.H, 10), -56)),
  },
  j29: {
    hl: ["shinN"],
    frames: [stand({ t: -86, aF: [-6, -6], lN: [92, 92] }), stand({ t: -86, aF: [-6, -6], lN: [94, -150], fN: 170 })],
    props: (J) => [P.wall(J.HdF[0] + 6, 1), P.band([J.HdF[0] + 6, -10], dn(J.AN, 2))],
    arrows: (J, i) => i && arrow(rt(J.KN, -30), up(rt(J.KN, -44), 40), -10),
  },
  j30: {
    hl: ["thighN", "thighF"],
    frames: [hinge(0, { aN: [96, 86], aF: [92, 86] }), hinge(0.8, { aN: [94, 92], aF: [90, 92] })],
    props: (J) => [front(P.band(J.HdN, [J.AN[0] + 4, -2])), P.band(J.HdF, [J.AF[0] + 4, -2])],
    arrows: (J, i) => i && arrow(rt(up(J.S, 10), -10), rt(up(J.S, 50), -24), 10),
  },
  j31: {
    hl: ["thighN", "torso"],
    frames: [stand({ ...HEAD, lF: [100, 102], fF: 30 }), { ...HEAD, t: -6, hd: -6, aN: [50, 280, 280], aF: [46, 276, 276], lN: [96, 86], lF: [178, 178], fF: 90 }],
    arrows: (J, i) => i && arrow(up(rt(J.S, -30), 64), up(rt(J.S, 6), 26), -10),
  },
  j36: {
    view: "front",
    hl: ["thighL", "thighR"],
    frames: [
      { t: -90, lL: [150, 92], lR: [30, 88], lsL: [0.62, 1], lsR: [0.62, 1], aL: [110, 80], aR: [70, 100], anchor: ["H", 50] },
      { t: -90, lL: [104, 92], lR: [76, 88], lsL: [0.6, 1], lsR: [0.6, 1], aL: [110, 80], aR: [70, 100], anchor: ["H", 50] },
    ],
    props: (J) => [
      P.raw(`<rect x="${J.H[0] - 44}" y="${J.H[1] - 92}" width="88" height="100" rx="10" fill="#2B3242"/>`, [[J.H[0] - 44, J.H[1] - 92]]),
      P.raw(`<rect x="${J.H[0] - 52}" y="${J.H[1] + 2}" width="104" height="12" rx="5" fill="#4A5466"/>`, []),
      P.line([J.H[0], J.H[1] + 12], [J.H[0], 0], 8),
      front(P.raw(`<rect x="${J.KL[0] - 16}" y="${J.KL[1] - 10}" width="9" height="26" rx="4" fill="#8994A8"/><rect x="${J.KR[0] + 7}" y="${J.KR[1] - 10}" width="9" height="26" rx="4" fill="#8994A8"/>`, [])),
    ],
    arrows: (J, i) => !i && [arrow(rt(dn(J.KL, -26), -4), rt(dn(J.KL, -26), 22)), arrow(rt(dn(J.KR, -26), 4), rt(dn(J.KR, -26), -22))],
  },
  j39: {
    hl: ["thighN"],
    frames: [
      { t: 214, hd: 220, lN: [-64, 18], lF: { ik: [30, 36], bend: -1 }, aN: [60, 20], aF: [60, 20], fN: -60, anchor: ["H", 40] },
      { t: 214, hd: 220, lN: [-40, -36], lF: { ik: [30, 36], bend: -1 }, aN: [60, 20], aF: [60, 20], fN: -110, anchor: ["H", 40] },
    ],
    props: (J) => {
      const b = (p, d) => [p[0] + Math.cos((124 * Math.PI) / 180) * d, p[1] + Math.sin((124 * Math.PI) / 180) * d];
      const plate = J.TN;
      const n = [Math.cos((-40 * Math.PI) / 180), Math.sin((-40 * Math.PI) / 180)];
      const pp = (d) => [plate[0] + n[0] * 4 - n[1] * d, plate[1] + n[1] * 4 + n[0] * d];
      return [
        P.line(b(J.H, 16), b(J.S, 22), 12, "#4A5466"),
        P.line(dn(J.H, 12), [J.H[0] - 6, 0], 8), P.line(b(J.S, 18), [b(J.S, 18)[0], 0], 7),
        P.line([J.H[0] + 10, -10], [J.H[0] + 170, -144], 6, "#3A4356"),
        front(P.line(pp(-24), pp(24), 9, "#8994A8")),
      ];
    },
    arrows: (J, i) => i && arrow(dn(rt(J.KN, 24), 26), up(rt(J.KN, 54), 2)),
  },

  /* ===================== FESSIERS ===================== */
  f10: {
    hl: ["thighN", "thighF"],
    frames: [bridge(1), { ...bridge(1), lN: { ik: [82, 46], bend: -1 }, lF: { ik: [66, 46], bend: -1 } }],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(dn(rt(J.AN, -28), 12), dn(rt(J.AN, 4), 12)),
  },
  f13: {
    hl: ["thighN", "thighF"],
    frames: [
      { ...bridge(0), lN: { ik: [64, -12], bend: -1 }, lF: { ik: [64, -12], bend: -1 } },
      { ...bridge(1), t: 156, lN: { ik: [60, -2], bend: -1 }, lF: { ik: [60, -2], bend: -1 } },
    ],
    props: (J) => [P.chair(J.AN[0] + 14, 1, -J.AN[1] - 6), mat(J)],
    arrows: (J, i) => i && arrow(dn(J.H, 40), dn(J.H, 8)),
  },
  f14: {
    view: "front",
    hl: ["thighL", "thighR"],
    frames: [
      fstand({ lL: [150, 96], lR: [30, 84], lsL: [0.8, 1], lsR: [0.8, 1], fL: 150, fR: 30, aL: [60, -30], aR: [120, 210], asL: [0.9, 0.7], asR: [0.9, 0.7] }),
      fstand({ lL: [138, 94], lR: [42, 86], lsL: [0.82, 1], lsR: [0.82, 1], fL: 150, fR: 30, aL: [60, -30], aR: [120, 210], asL: [0.9, 0.7], asR: [0.9, 0.7] }),
    ],
    arrows: (J, i) => [arrow(up(rt(J.H, 76), 4), up(rt(J.H, 76), 26)), arrow(up(rt(J.H, 76), 26), up(rt(J.H, 76), 4))][i],
  },
  f15: {
    hl: ["thighN"],
    frames: [stand({ t: -80, aN: [-12, -14], aF: [-10, -12] }), stand({ t: -80, aN: [-12, -14], aF: [-10, -12], lN: [114, 114], fN: 40 })],
    props: (J) => P.wall(J.HdN[0] + 6, 1),
    arrows: (J, i) => i && arrow(dn(rt(J.KN, 10), 20), rt(J.KN, -18), -8),
  },
  f16: {
    view: "front",
    hl: ["thighR"],
    frames: [
      { t: 180, hd: 186, aL: [182, 182], aR: [92, 92, 180], lL: [14, 168], lR: [12, 168], lsL: [0.8, 0.72], lsR: [0.8, 0.72], fL: 180, fR: 180 },
      { t: 180, hd: 186, aL: [182, 182], aR: [92, 92, 180], lL: [14, 168], lR: [-34, 150], lsL: [0.8, 0.72], lsR: [0.8, 0.72], fL: 180, fR: 180 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.KL, 16), 6), up(rt(J.KR, 16), 6), -10),
  },
  f17: {
    hl: ["thighN", "thighF"],
    frames: [
      { ...bridge(0), lN: { ik: [60, -20], bend: -1 }, lF: { ik: [60, -20], bend: -1 }, fN: -10, fF: -10 },
      { ...bridge(1), t: 160, lN: { ik: [56, -2], bend: -1 }, lF: { ik: [56, -2], bend: -1 }, fN: -10, fF: -10 },
    ],
    props: (J) => [P.wall(J.TN[0] + 2, 1), mat(J)],
    arrows: (J, i) => i && arrow(dn(J.H, 40), dn(J.H, 8)),
  },
  f18: {
    hl: ["thighN"],
    frames: [quad({ aN: [90, 0, 0], aF: [90, 0, 0] }), quad({ aN: [90, 0, 0], aF: [90, 0, 0], lN: [184, 168] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(dn(rt(J.KN, 24), 40), up(rt(J.KN, 4), 8), 10),
  },
  f19: {
    hl: ["thighN"],
    frames: [
      { t: -150, hd: -120, lN: { ik: [52, 46], bend: -1 }, lF: { ik: [52, 46], bend: -1 }, aN: [100, 40], aF: [100, 40], anchor: ["H", 22] },
      { t: -168, hd: -130, lN: { ik: [46, 72], bend: -1 }, lF: { ik: [46, 72], bend: -1 }, aN: [100, 30], aF: [100, 30], anchor: ["H", 46] },
    ],
    props: (J) => [
      P.poly([[J.S[0] - 30, J.S[1] - 14], [J.S[0] + 4, J.S[1] - 20], [J.S[0] + 10, J.S[1] + 2], [J.S[0] - 24, J.S[1] + 14]], "#4A5466"),
      P.line([J.S[0] - 10, J.S[1] + 10], [J.S[0] - 10, 0], 8),
      front(P.circle(up(J.H, 18), 11, "#8994A8", "#B9C2D3")),
    ],
    arrows: (J, i) => i && arrow(dn(rt(J.H, -6), 30), up(rt(J.H, -6), 0)),
  },
  f20: {
    view: "front",
    hl: ["thighL"],
    frames: [fstand({ aR: [30, -10] }), fstand({ aR: [30, -10], lL: [114, 114], t: -88 })],
    props: (J) => [P.wall(J.HdR[0] + 4, 1), front(P.band(dn(J.AL, -6), dn(J.AR, -6)))],
    arrows: (J, i) => i && arrow(rt(J.KL, -16), dn(rt(J.KL, -42), 20), 8),
  },
  f22: {
    view: "front",
    hl: ["thighL"],
    frames: [fstand({ aR: [30, -10] }), fstand({ aR: [30, -10], lL: [114, 114], t: -88 })],
    props: (J) => [P.pulley(J.HdR[0] + 16, -10, dn(J.AL, 2)), front(P.raw("", []))],
    arrows: (J, i) => i && arrow(rt(J.KL, -16), dn(rt(J.KL, -42), 20), 8),
  },
  f27: {
    hl: ["thighN"],
    frames: [
      { t: 0, hd: 0, aN: [90, 0, 0], aF: [90, 0, 0], lF: [90, 180], lN: [64, 168], fN: 260, anchor: ["EN", 46] },
      { t: 0, hd: 0, aN: [90, 0, 0], aF: [90, 0, 0], lF: [90, 180], lN: [190, 168], fN: 260, anchor: ["EN", 46] },
    ],
    props: (J, i) => [
      P.raw(`<rect x="${J.EN[0] - 10}" y="${J.EN[1] + 4}" width="${J.HdN[0] - J.EN[0] + 20}" height="10" rx="4" fill="#8994A8"/>`, [[J.EN[0] - 10, J.EN[1]]]),
      P.line([J.EN[0] + 10, J.EN[1] + 14], [J.EN[0] + 10, 0], 8),
      P.raw(`<rect x="${J.KF[0] - 18}" y="${J.KF[1] + 4}" width="36" height="10" rx="4" fill="#8994A8"/>`, []),
      P.line([J.KF[0], J.KF[1] + 14], [J.KF[0], 0], 8),
      front(P.line(rt(J.TN, -2), rt(J.AN, -6), 8, "#B9C2D3")),
    ],
    arrows: (J, i) => i && arrow(dn(rt(J.KN, -40), 40), up(rt(J.KN, -10), 6), 12),
  },

  /* ===================== DOS ===================== */
  d9: {
    hl: ["torso", "thighF"],
    frames: [prone({ aN: [0, 0], aF: [2, 0] }), prone({ aN: [-12, -12], aF: [2, 0], lF: [192, 190], hd: -4 })],
    props: (J) => mat(J),
    arrows: (J, i) => i && [arrow(up(J.HdN, 4), up(J.HdN, 24)), arrow(up(J.TF, 4), up(J.TF, 24))],
  },
  d10: {
    hl: ["torso"],
    frames: [
      prone({ aN: { ik: [-14, 30], bend: -1, end: 0 }, aF: { ik: [-14, 30], bend: -1, end: 0 } }),
      prone({ t: -24, hd: -30, aN: { ik: [-20, 52], bend: -1, end: 0 }, aF: { ik: [-20, 52], bend: -1, end: 0 } }),
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(J.S, 24), up(rt(J.S, 14), 52), -6),
  },
  d11: {
    hl: ["torso", "uaN", "thighN"],
    frames: [
      prone({ aN: [-10, -10], aF: [6, 6], lN: [174, 176], lF: [188, 188], anchor: ["H", 6] }),
      prone({ aN: [6, 6], aF: [-10, -10], lN: [188, 188], lF: [174, 176], anchor: ["H", 6] }),
    ],
    props: (J) => mat(J),
    arrows: (J, i) => [arrow(up(J.HdF, -8), up(J.HdF, 16)), arrow(up(J.HdN, -8), up(J.HdN, 16))][i],
  },
  d12: {
    view: "front",
    top: true,
    hl: ["uaL", "uaR"],
    frames: [
      { t: 0, hd: 0, aL: [-40, -40], aR: [40, 40], lL: [182, 180], lR: [178, 180], fL: -90, fR: 90 },
      { t: 0, hd: 0, aL: [-90, -90], aR: [90, 90], lL: [182, 180], lR: [178, 180], fL: -90, fR: 90 },
    ],
    props: () => P.note("Vue de dessus · Y puis T (puis W)"),
  },
  d13: {
    hl: ["torso", "thighF"],
    frames: [quad(), quad({ aN: [0, 0, 0], lF: [180, 180] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(rt(dn(J.KF, -6), 30), up(rt(J.KF, -10), 30), -10),
  },
  d14: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [
      fstand({ aL: [130, -10], aR: [50, 190], asL: [0.75, 0.5], asR: [0.75, 0.5] }),
      fstand({ aL: [150, -50], aR: [30, 230], asL: [0.9, 0.6], asR: [0.9, 0.6] }),
    ],
    props: (J) => front(P.towel(J.WL, J.WR)),
    arrows: (J, i) => i && [arrow(rt(up(J.EL, 28), 10), rt(up(J.EL, 28), -18)), arrow(rt(up(J.ER, 28), -10), rt(up(J.ER, 28), 18))],
  },
  d15: {
    hl: ["uaN", "torso"],
    frames: [
      { t: 180 - 26, hd: 180, lN: { ik: [74, 40], bend: -1 }, lF: { ik: [70, 40], bend: -1 }, aN: [-86, -86], aF: [-86, -86], anchor: ["H", 34] },
      { t: 180 - 26, hd: 180, lN: { ik: [74, 40], bend: -1 }, lF: { ik: [70, 40], bend: -1 }, aN: { ik: [6, -34], bend: 1 }, aF: { ik: [6, -34], bend: 1 }, anchor: ["H", 64] },
    ],
    props: (J, i) => P.table(J.HdN[0] - 90, J.HdN[0] + 14, -J.HdN[1] - 3),
    arrows: (J, i) => i && arrow(dn(rt(J.S, -10), 28), dn(rt(J.S, -10), 2)),
  },
  d16: {
    hl: ["torso", "thighN"],
    frames: [
      { t: -100, hd: -70, lN: [0, 0], lF: [2, 0], aN: [118, 92, 160], aF: [118, 92, 160], fN: -80, fF: -80 },
      { t: 192, hd: 200, lN: [12, 12], lF: [12, 12], aN: { ik: [6, 58], bend: 1, end: 160 }, aF: { ik: [6, 58], bend: 1, end: 160 }, fN: -60, fF: -60 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(dn(J.H, 32), dn(J.H, 6)),
  },
  d17: {
    hl: ["uaN", "torso"],
    frames: [prone({ aN: [-6, -6], aF: [-4, -4], anchor: ["H", 0] }), prone({ aN: [196, -14], aF: [194, -14], anchor: ["H", 0] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 40), 30), up(rt(J.S, 0), 30)),
  },
  d18: {
    hl: ["torso"],
    frames: [stand({ aN: [0, 0], aF: [2, 2], t: -88 }), stand({ aN: [0, 0], aF: [2, 2], t: -94, x: -8 })],
    arrows: (J, i) => i && arrow(rt(J.S, -14), rt(J.S, -34)),
  },
  d19: {
    hl: ["torso"],
    frames: [prone({ aN: [180, 180], aF: [180, 180], hd: 6 }), prone({ t: -16, hd: -18, aN: [184, 184], aF: [184, 184] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(J.S, 24), up(rt(J.S, 8), 48), -6),
  },
  d20: {
    hl: ["uaN", "torso"],
    frames: [prone({ aN: [-6, -6], aF: [-4, -4] }), prone({ aN: [196, -14], aF: [194, -14] })],
    props: (J) => [mat(J), front(P.towel(rt(J.HdN, -6), rt(J.HdN, 8), 9))],
    arrows: (J, i) => i && arrow(up(rt(J.S, 40), 30), up(rt(J.S, 0), 30)),
  },

  /* ===================== POITRINE ===================== */
  p8: {
    hl: ["uaN", "faN"],
    frames: [pushup(0), pushup(1, { handX: -6 })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 16), 44), up(rt(J.S, 16), 12)),
  },
  p11: {
    view: "front",
    hl: ["uaL"],
    frames: [
      { t: -90, torsoScale: 0.3, hd: -90, aL: [130, 130], aR: [50, 50], lL: [-80, -80], lR: [-100, -100], lsL: [0.3, 0.3], lsR: [0.3, 0.3] },
      { t: -90, torsoScale: 0.3, hd: -90, aL: { ik: [-8, 40], bend: 1 }, aR: [12, 12], lL: [-80, -80], lR: [-100, -100], lsL: [0.3, 0.3], lsR: [0.3, 0.3] },
    ],
    props: (J) => [P.note("Vue de face"), mat(J)],
    arrows: (J, i) => i && arrow(up(rt(J.S, -36), 40), up(rt(J.S, -36), 12)),
  },
  p12: {
    hl: ["uaN", "faN"],
    frames: [pushup(0, { aN: [112, 100, 180], aF: [112, 100, 180] }), pushup(1, { handX: -30, t: -6 })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 16), 44), up(rt(J.S, 16), 12)),
  },
  p15: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [
      { t: -90, torsoScale: 0.3, aL: [96, 92], aR: [84, 88], lL: [-80, -80], lR: [-100, -100], lsL: [0.3, 0.3], lsR: [0.3, 0.3] },
      { t: -90, torsoScale: 0.3, aL: [146, 150], aR: [34, 30], lL: [-80, -80], lR: [-100, -100], lsL: [0.3, 0.3], lsR: [0.3, 0.3] },
    ],
    props: (J) => [P.note("Vue de face"), front(P.towel(rt(J.HdL, -8), rt(J.HdL, 8), 6)), front(P.towel(rt(J.HdR, -8), rt(J.HdR, 8), 6))],
    arrows: (J, i) => i && [arrow(up(rt(J.HdL, 34), 16), up(rt(J.HdL, 8), 16)), arrow(up(rt(J.HdR, -34), 16), up(rt(J.HdR, -8), 16))],
  },
  p16: {
    hl: ["uaN", "torso"],
    frames: [
      { t: 52, hd: 60, aN: [52, 52, 0], aF: [52, 52, 0], lN: [128, 128], lF: [128, 128], fN: 110, fF: 110 },
      { t: -30, hd: -40, aN: [90, 90, 0], aF: [90, 90, 0], lN: [176, 176], lF: [176, 176], fN: 140, fF: 140 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.H, 20), 70), up(rt(J.H, 80), 30), -20),
  },
  p17: {
    hl: ["uaN"],
    frames: [stand({ t: -70, lN: [100, 100], lF: [102, 100], aN: [-12, -12], aF: [-10, -10] }), stand({ t: -64, lN: [104, 104], lF: [106, 104], aN: { ik: [20, 6], bend: 1 }, aF: { ik: [20, 6], bend: 1 } })],
    props: (J) => P.wall(J.HdN[0] + 6, 1),
    arrows: (J, i) => i && arrow(up(J.S, 26), up(rt(J.S, 22), 26)),
  },
  p18: {
    hl: ["uaN"],
    frames: [
      { t: -tilt(66, LEN.torso + LEN.thigh), lN: [180 - tilt(66, LEN.torso + LEN.thigh), -150], lF: [180 - tilt(66, LEN.torso + LEN.thigh), -150], aN: [90, 90, 0], aF: [90, 90, 0], fN: 150, fF: 150 },
      { t: -tilt(28, LEN.torso + LEN.thigh), lN: [180 - tilt(28, LEN.torso + LEN.thigh), -150], lF: [180 - tilt(28, LEN.torso + LEN.thigh), -150], aN: { ik: [-6, 28], bend: 1, end: 0 }, aF: { ik: [-6, 28], bend: 1, end: 0 }, fN: 150, fF: 150 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 16), 44), up(rt(J.S, 16), 12)),
  },
  p19: {
    hl: ["uaN", "faN"],
    frames: [
      { t: -tilt(66, LEN.torso + LEN.thigh), lN: [180 - tilt(66, LEN.torso + LEN.thigh), -150], lF: [180 - tilt(66, LEN.torso + LEN.thigh), -150], aN: [90, 90, 0], aF: [90, 90, 0], fN: 150, fF: 150 },
      { t: -tilt(44, LEN.torso + LEN.thigh), lN: [180 - tilt(44, LEN.torso + LEN.thigh), -150], lF: [180 - tilt(44, LEN.torso + LEN.thigh), -150], aN: { ik: [-4, 44], bend: 1, end: 0 }, aF: { ik: [-4, 44], bend: 1, end: 0 }, fN: 150, fF: 150 },
    ],
    props: (J) => mat(J),
  },
  p20: {
    hl: ["uaN", "torso"],
    frames: [stand({ aN: [178, 178], aF: [176, 176], lN: [80, 96], lF: [100, 88] }), stand({ t: -78, aN: [168, 172], aF: [166, 170], lN: [76, 100], lF: [104, 86], x: 10 })],
    props: (J, i) => P.raw(`<rect x="${-78}" y="-232" width="12" height="232" fill="#2E3646"/>`, [[-78, -232], [-66, 0]]),
    arrows: (J, i) => i && arrow(up(rt(J.S, -10), 30), up(rt(J.S, 24), 30)),
  },

  /* ===================== ÉPAULES ===================== */
  e7: {
    hl: ["uaN"],
    frames: [
      { t: 104, hd: 100, aN: [96, 90, 0], aF: [96, 90, 0], lN: [176, 176], lF: [176, 176], fN: 90, fF: 90 },
      { t: 112, hd: 112, aN: { ik: [12, 40], bend: -1, end: 0 }, aF: { ik: [12, 40], bend: -1, end: 0 }, lN: [184, 184], lF: [184, 184], fN: 94, fF: 94 },
    ],
    props: (J) => P.chair(J.AN[0] - 8, -1, -J.AN[1] - 6),
    arrows: (J, i) => i && arrow(up(rt(J.head, 26), 20), dn(rt(J.head, 26), 14)),
  },
  e8: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [fstand(), fstand({ aL: [180, 180], aR: [0, 0] })],
    arrows: (J, i) => i && [arrow(dn(J.HdL, 50), dn(J.HdL, 12), 10), arrow(dn(J.HdR, 50), dn(J.HdR, 12), -10)],
  },
  e11: {
    hl: ["uaN", "torso"],
    frames: [
      { t: 98, hd: 98, aN: [92, 90, 180], aF: [92, 90, 180], lN: [-178, -178], lF: [-176, -176], fN: -90, fF: -90, x: 0 },
      { t: 86, hd: 86, aN: [90, 90, 180], aF: [90, 90, 180], lN: [-104, -104], lF: [-104, -104], fN: -200, fF: -200, x: -64 },
    ],
    props: (J) => P.wall(-104, -1),
  },
  e12: {
    hl: ["uaN"],
    frames: [prone({ aN: [2, 0], aF: [4, 2] }), prone({ aN: [-16, -16], aF: [-14, -14] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(J.HdN, 2), up(J.HdN, 24)),
  },
  e14: {
    hl: ["uaN", "torso"],
    frames: [
      { ...pushup(0), x: 0 },
      { t: 116, hd: 110, aN: [92, 90, 0], aF: [92, 90, 0], lN: [-130, -150], lF: [-130, -150], fN: -240, fF: -240, x: -40 },
    ],
    props: (J) => P.wall(-122, -1),
    arrows: (J, i) => i && arrow(dn(rt(J.HdN, 60), -10), dn(rt(J.HdN, 20), -10)),
  },
  e15: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [
      fstand({ aL: [92, 60], aR: [88, 120], asL: [1, 0.5], asR: [1, 0.5] }),
      fstand({ aL: [92, 150], aR: [88, 30], asL: [1, 0.75], asR: [1, 0.75] }),
    ],
    props: (J) => front(P.towel(J.WL, J.WR)),
    arrows: (J, i) => i && [arrow(dn(rt(J.WL, 26), 14), dn(rt(J.WL, -2), 14)), arrow(dn(rt(J.WR, -26), 14), dn(rt(J.WR, 2), 14))],
  },
  e16: {
    hl: ["uaN"],
    frames: [pushup(0), pushup(0, { aN: [10, 4, 4], aF: [90, 90, 0] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 20), 26), up(rt(J.S, 66), 26)),
  },
  e17: {
    hl: ["uaN"],
    frames: [stand({ t: -40, lN: [104, 100], lF: [106, 100], aN: [26, 26], aF: [28, 28] }), stand({ t: -36, hd: -30, lN: [106, 102], lF: [108, 102], aN: { ik: [32, 14], bend: 1 }, aF: { ik: [32, 14], bend: 1 } })],
    props: (J) => P.wall(J.HdN[0] + 4, 1),
    arrows: (J, i) => i && arrow(up(J.head, 26), up(rt(J.head, 18), 26)),
  },
  e18: {
    hl: ["torso"],
    frames: [stand({ aN: [94, 92] }), stand({ aN: [96, 94], t: -92 })],
    arrows: (J, i) => [arrow(dn(rt(J.S, 26), 6), dn(rt(J.S, -26), 6), 26), arrow(dn(rt(J.S, -26), 10), dn(rt(J.S, 26), 10), 26)][i],
  },
  e19: {
    hl: ["uaN", "torso"],
    frames: [quad(), pushup(0)],
    props: (J) => mat(J),
  },
  e20: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [fstand(), fstand({ aL: [180, 180], aR: [0, 0] })],
    arrows: (J, i) => i && [arrow(dn(J.HdL, 56), dn(J.HdL, 14), 12), arrow(dn(J.HdR, 56), dn(J.HdR, 14), -12)],
  },
  e22: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [
      { t: -90, torsoScale: 0.72, hd: -90, aL: [94, 92], aR: [86, 88], lL: [96, 90], lR: [84, 90] },
      { t: -90, torsoScale: 0.72, hd: -90, aL: [176, 184], aR: [4, -4], lL: [96, 90], lR: [84, 90] },
    ],
    props: (J) => [front(P.db(J.WL, true)), front(P.db(J.WR, true)), P.note("Buste penché à 45°")],
    arrows: (J, i) => i && [arrow(dn(J.HdL, 50), dn(J.HdL, 12), 12), arrow(dn(J.HdR, 50), dn(J.HdR, 12), -12)],
  },
  e23: {
    view: "front",
    hl: ["uaL", "uaR"],
    frames: [
      { t: -90, aL: [96, 30], aR: [84, 150], asL: [1, 0.6], asR: [1, 0.6], lL: [110, 92], lR: [70, 88], lsL: [0.55, 1], lsR: [0.55, 1], anchor: ["H", 50] },
      { t: -90, aL: [176, 120], aR: [4, 60], asL: [1, 0.6], asR: [1, 0.6], lL: [110, 92], lR: [70, 88], lsL: [0.55, 1], lsR: [0.55, 1], anchor: ["H", 50] },
    ],
    props: (J) => [
      P.raw(`<rect x="${J.H[0] - 40}" y="${J.H[1] - 92}" width="80" height="98" rx="10" fill="#2B3242"/>`, [[J.H[0] - 40, J.H[1] - 92]]),
      P.raw(`<rect x="${J.H[0] - 46}" y="${J.H[1] + 2}" width="92" height="12" rx="5" fill="#4A5466"/>`, []),
      P.line([J.H[0], J.H[1] + 12], [J.H[0], 0], 8),
      front(P.raw(`<circle cx="${J.EL[0]}" cy="${J.EL[1]}" r="9" fill="#8994A8"/><circle cx="${J.ER[0]}" cy="${J.ER[1]}" r="9" fill="#8994A8"/>`, [])),
    ],
    arrows: (J, i) => i && [arrow(dn(J.EL, 50), dn(J.EL, 14), 12), arrow(dn(J.ER, 50), dn(J.ER, 14), -12)],
  },

  /* ===================== BRAS ===================== */
  b10: {
    hl: ["faN", "uaN"],
    frames: [pushup(0, { aN: [72, 90, 0], aF: [72, 90, 0] }), { ...forearmPlank(), aN: [74, 0, 0], aF: [74, 0, 0] }],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.EN, 30), 40), up(rt(J.EN, 30), 8)),
  },
  b11: {
    hl: ["uaN", "faN"],
    frames: [
      { t: -112, hd: -80, lN: [20, 20], lF: [20, 20], aN: [104, 98, 160], aF: [104, 98, 160], fN: -70, fF: -70 },
      { t: -124, hd: -90, lN: [9, 9], lF: [9, 9], aN: { ik: [-30, 44], bend: 1, end: 160 }, aF: { ik: [-30, 44], bend: 1, end: 160 }, fN: -80, fF: -80 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(J.S, 40), up(J.S, 14)),
  },
  b12: {
    hl: ["uaN", "faN"],
    frames: [stand({ aN: [92, 88], aF: [90, 88], lN: [76, 98] }), stand({ aN: [94, -4], aF: [92, -2], lN: [76, 98] })],
    props: (J) => [front(P.towel(J.HdN, [J.AN[0] + 6, -2], 5))],
    arrows: (J, i) => i && arrow(rt(dn(J.EN, 20), 40), rt(up(J.EN, 8), 42), -10),
  },
  b13: {
    hl: ["uaN", "faN"],
    frames: [
      { t: 52, hd: 60, aN: [52, 52, 0], aF: [52, 52, 0], lN: [128, 128], lF: [128, 128], fN: 110, fF: 110 },
      { t: 40, hd: 44, aN: [80, 0, 0], aF: [80, 0, 0], lN: [134, 134], lF: [134, 134], fN: 110, fF: 110 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 30), 24), dn(rt(J.S, 30), 6)),
  },
  b14: {
    hl: ["faN"],
    frames: [stand({ t: -72, lN: [100, 100], lF: [102, 100], aN: [-36, -36], aF: [-34, -34] }), stand({ t: -66, hd: -50, lN: [104, 104], lF: [106, 104], aN: [-48, -100], aF: [-46, -98] })],
    props: (J) => P.wall(J.HdN[0] + 4, 1),
    arrows: (J, i) => i && arrow(up(J.head, 22), up(rt(J.head, 16), 22)),
  },
  b15: {
    hl: ["faN", "uaN"],
    frames: [
      { t: 180 - 18, hd: 180, lN: [16, 16], lF: [18, 16], aN: [-82, -82], aF: [-82, -82], fN: -60, fF: -60, anchor: ["H", 30] },
      { t: 180 - 18, hd: 180, lN: [22, 22], lF: [24, 22], aN: { ik: [8, -34], bend: 1 }, aF: { ik: [8, -34], bend: 1 }, fN: -60, fF: -60, anchor: ["H", 56] },
    ],
    props: (J, i) => P.table(J.HdN[0] - 90, J.HdN[0] + 14, -J.HdN[1] - 3),
    arrows: (J, i) => i && arrow(dn(rt(J.S, -10), 28), dn(rt(J.S, -10), 2)),
  },
  b16: {
    hl: ["uaN", "faN"],
    frames: [pushup(0, { aN: [96, 90, 180], aF: [96, 90, 180] }), pushup(1, { handX: -16, aN: { ik: [-16, 26], bend: 1, end: 180 }, aF: { ik: [-16, 26], bend: 1, end: 180 } })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 16), 44), up(rt(J.S, 16), 12)),
  },
  b17: {
    hl: ["uaN", "faN"],
    frames: [
      { t: -84, aN: [96, 90, 0], aF: [96, 90, 0], lN: [50, 178], lF: [54, 178], fN: 100, fF: 100, anchor: ["HdN", 48] },
      { t: -76, aN: [160, 70, 0], aF: [160, 70, 0], lN: [50, 178], lF: [54, 178], fN: 100, fF: 100, anchor: ["HdN", 48] },
    ],
    props: (J) => [P.chair(J.HdN[0] + 6, 1, 48), front(P.chair(J.HdN[0] - 4, -1, 48))],
    arrows: (J, i) => i && arrow(up(rt(J.S, 30), 30), up(rt(J.S, 30), 2)),
  },
  b18: {
    hl: ["faN"],
    frames: [stand({ aN: [94, 0], aF: [60, 20] }), stand({ aN: [94, -84], aF: [60, -40] })],
    arrows: (J, i) => i && arrow(rt(dn(J.EN, 6), 44), rt(up(J.EN, 30), 44), -10),
  },
  b19: {
    hl: ["uaN", "faN"],
    frames: [
      { t: -96, aN: [100, 90, 180], aF: [100, 90, 180], lN: { ik: [52, 46], bend: -1 }, lF: { ik: [50, 46], bend: -1 }, anchor: ["HdN", 46] },
      { t: -92, aN: [190, 80, 180], aF: [190, 80, 180], lN: { ik: [52, 20], bend: -1 }, lF: { ik: [50, 20], bend: -1 }, anchor: ["HdN", 46] },
    ],
    props: (J) => P.chair(J.HdN[0] - 18, -1, 46),
    arrows: (J, i) => i && arrow(up(rt(J.S, 34), 26), up(rt(J.S, 34), 0)),
  },
  b20: {
    hl: ["faN"],
    frames: [stand({ t: -70, lN: [100, 100], lF: [102, 100], aN: [-12, -12], aF: [-10, -10] }), stand({ t: -64, lN: [104, 104], lF: [106, 104], aN: { ik: [18, 12], bend: 1 }, aF: { ik: [18, 12], bend: 1 } })],
    props: (J) => P.wall(J.HdN[0] + 6, 1),
    arrows: (J, i) => i && arrow(up(J.S, 26), up(rt(J.S, 22), 26)),
  },
  b21: {
    hl: ["faN"],
    frames: [
      { t: -tilt(46, LEN.torso + LEN.thigh), lN: [120, -170], lF: [120, -170], fN: 150, fF: 150, aN: [100, 0, 0], aF: [100, 0, 0] },
      { t: -tilt(70, LEN.torso + LEN.thigh), lN: [120, -170], lF: [120, -170], fN: 150, fF: 150, aN: [96, 86, 0], aF: [96, 86, 0] },
    ],
    props: (J) => P.chair(J.HdN[0] + 8, 1, -J.WN[1] - 4),
    arrows: (J, i) => i && arrow(dn(rt(J.S, -12), -4), up(rt(J.S, -12), 30)),
  },
  b22: {
    hl: ["faN"],
    frames: [stand({ aN: [92, 90], aF: [88, 88] }), stand({ aN: [94, -80], aF: [90, -84] })],
    arrows: (J, i) => i && arrow(rt(dn(J.EN, 6), 40), rt(up(J.EN, 30), 40), -10),
  },
  b23: {
    hl: ["faN", "uaN"],
    frames: [
      { t: -tilt(66, LEN.torso + LEN.thigh), lN: [180 - tilt(66, LEN.torso + LEN.thigh), -150], lF: [180 - tilt(66, LEN.torso + LEN.thigh), -150], aN: [86, 90, 0], aF: [86, 90, 0], fN: 150, fF: 150 },
      { t: -tilt(36, LEN.torso + LEN.thigh), lN: [180 - tilt(36, LEN.torso + LEN.thigh), -150], lF: [180 - tilt(36, LEN.torso + LEN.thigh), -150], aN: [84, 0, 0], aF: [84, 0, 0], fN: 150, fF: 150 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(rt(J.S, 16), 44), up(rt(J.S, 16), 12)),
  },
  b29: {
    hl: ["uaN", "faN"],
    frames: [
      { t: -86, aN: [96, 90, 0], aF: [96, 90, 0], lN: [100, 180], lF: [104, 180], fN: 120, fF: 120, anchor: ["HdN", 120] },
      { t: -80, aN: [160, 70, 0], aF: [160, 70, 0], lN: [100, 180], lF: [104, 180], fN: 120, fF: 120, anchor: ["HdN", 120] },
    ],
    props: (J) => [
      P.raw(`<rect x="${J.HdN[0] - 4}" y="-236" width="14" height="236" fill="#2B3242"/>`, [[J.HdN[0] - 4, -236]]),
      front(P.line(rt(J.HdN, -6), rt(J.HdN, 40), 8, "#8994A8")),
      P.raw(`<rect x="${J.KN[0] - 30}" y="${J.KN[1] + 6}" width="54" height="10" rx="4" fill="#8994A8"/>`, []),
      P.line([J.KN[0] - 2, J.KN[1] + 16], [J.KN[0] - 2, 0], 8),
    ],
    arrows: (J, i) => i && arrow(up(rt(J.S, 30), 30), up(rt(J.S, 30), 2)),
  },
  b31: {
    hl: ["faN"],
    frames: [
      { t: -135, hd: -120, aN: [110, 110], aF: [104, 104], lN: [10, 90], lF: [12, 90], anchor: ["H", 40] },
      { t: -135, hd: -120, aN: [110, -10], aF: [104, 104], lN: [10, 90], lF: [12, 90], anchor: ["H", 40] },
    ],
    props: (J) => [
      P.poly([[J.H[0] - 6, J.H[1] + 10], [J.S[0] - 12, J.S[1] + 2], [J.S[0] - 22, J.S[1] - 6], [J.H[0] - 18, J.H[1] + 2]], "#4A5466"),
      P.bench(J.H[0] - 20, J.H[0] + 30, -J.H[1] - 14),
      P.pulley(J.S[0] - 70, -16, J.HdN),
    ],
    arrows: (J, i) => i && arrow(rt(dn(J.EN, 40), 10), rt(dn(J.EN, -6), 44), -14),
  },

  /* ===================== ABDOS ===================== */
  a9: {
    view: "front",
    hl: ["torso"],
    frames: [
      { t: 180 + 18, hd: 180 + 18, aL: [90, 0, 0], aR: [60, 20], lL: [18, 18], lR: [18, 18], fL: -80, fR: -80, armFarFront: true },
      { t: 180 + 6, hd: 180 + 12, aL: [80, 0, 0], aR: [60, 20], lL: [4, 4], lR: [4, 4], fL: -80, fR: -80 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(J.H, 34), up(J.H, 10)),
  },
  a10: {
    hl: ["torso"],
    frames: [supine({ aN: [180, 180], aF: [178, 178] }), supine({ t: 192, hd: 202, aN: [196, 196], aF: [194, 194], lN: [-14, -14], lF: [-12, -12] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && [arrow(up(J.head, 10), up(J.head, 30)), arrow(up(J.TN, 6), up(J.TN, 26))],
  },
  a17: {
    hl: ["torso"],
    frames: [
      { t: 0, hd: 0, aN: [90, 0, 0], aF: [90, 0, 0], lN: [90, 180], lF: [90, 180] },
      { t: -tilt(LEN.ua + 4, LEN.torso + LEN.thigh), lN: [180 - tilt(LEN.ua + 4, LEN.torso + LEN.thigh), -160], lF: [180 - tilt(LEN.ua + 4, LEN.torso + LEN.thigh), -160], aN: [90, 0, 0], aF: [90, 0, 0], fN: 150, fF: 150 },
    ],
    props: (J) => mat(J),
  },
  a18: {
    view: "front",
    hl: ["torso"],
    frames: [
      { t: 180 + 4, hd: 180 + 8, aL: [80, 0, 0], aR: [60, 20], lL: [20, 150], lR: [24, 150], lsL: [0.9, 0.9], lsR: [0.9, 0.9], fL: 150, fR: 150 },
      { t: 180 + 24, hd: 180 + 24, aL: [90, 0, 0], aR: [60, 20], lL: [36, 160], lR: [38, 160], lsL: [0.9, 0.9], lsR: [0.9, 0.9], fL: 150, fR: 150 },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(dn(J.H, 12), up(J.H, 14)),
  },
  a19: {
    hl: ["torso", "thighN"],
    frames: [
      { t: -130, hd: -110, aN: [118, 90, 160], aF: [118, 90, 160], lN: [-8, 20], lF: [-6, 20] },
      { t: -110, hd: -90, aN: [118, 90, 160], aF: [118, 90, 160], lN: [-50, 70], lF: [-48, 70] },
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(rt(dn(J.KN, -6), 30), up(rt(J.KN, 4), 26), -10),
  },
  a20: {
    hl: ["torso"],
    frames: [pushup(0), pushup(0, { aN: [60, -170], aF: [90, 90, 0] })],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(dn(rt(J.S, 40), 50), up(rt(J.S, 14), 6), 16),
  },
  a21: {
    hl: ["torso", "thighN"],
    frames: [
      quad({ lN: [90, 160], lF: [90, 160], anchor: ["HdN", 0] }),
      quad({ lN: [90, 160], lF: [68, 160], aN: [70, 90, 0], aF: [90, 90, 0], anchor: ["HdF", 0] }),
    ],
    props: (J) => mat(J),
    arrows: (J, i) => i && arrow(up(J.HdN, 30), up(rt(J.HdN, 34), 30)),
  },
  a22: {
    hl: ["torso"],
    frames: [
      bridge(0, { aN: [-30, 10], aF: [-30, 10] }),
      { ...bridge(0), t: 210, hd: 222, aN: [-6, 40], aF: [-6, 40] },
    ],
    props: (J) => [mat(J), front(P.db(J.WN))],
    arrows: (J, i) => i && arrow(up(J.S, 26), up(rt(J.S, 26), 36), -10),
  },
  a23: {
    view: "front",
    hl: ["torso"],
    frames: [
      { t: -90, torsoScale: 0.8, aL: [70, 0], aR: [110, 180], asL: [0.9, 0.6], asR: [0.9, 0.6], lL: [-60, 60], lR: [-120, 120], lsL: [0.45, 0.6], lsR: [0.45, 0.6] },
      { t: -98, torsoScale: 0.8, aL: [110, 150], aR: [140, 190], asL: [0.9, 0.6], asR: [0.9, 0.6], lL: [-60, 60], lR: [-120, 120], lsL: [0.45, 0.6], lsR: [0.45, 0.6] },
    ],
    props: (J) => [front(P.db(J.WL, true)), mat(J), P.note("Vue de face")],
    arrows: (J, i) => i && arrow(up(rt(J.S, 20), 12), up(rt(J.S, -40), 4), -12),
  },
  a25: {
    hl: ["torso"],
    frames: [stand({ aN: [70, -120], aF: [74, -116], lN: [86, 92], lF: [96, 88] }), stand({ aN: [-2, -2], aF: [0, 0], lN: [86, 92], lF: [96, 88] })],
    props: (J) => [P.line([J.H[0] - 60, 0], [J.H[0] - 60, -200], 9, "#3A4356"), P.band([J.H[0] - 60, J.HdN[1]], J.HdN)],
    arrows: (J, i) => i && arrow(up(rt(J.S, 10), 24), up(rt(J.S, 66), 24)),
  },
  a27: {
    hl: ["thighN", "torso"],
    frames: [supine({ aN: [170, 160], aF: [170, 160], lN: [-6, -6], lF: [-4, -6], fN: -40, fF: -40 }), supine({ aN: [170, 160], aF: [170, 160], lN: [-84, -84], lF: [-82, -84], fN: 0, fF: 0 })],
    props: (J) => [mat(J), front(P.db(J.AN))],
    arrows: (J, i) => i && arrow(up(rt(J.H, 120), 10), up(rt(J.H, 30), 110), 30),
  },
  a28: {
    view: "front",
    hl: ["torso"],
    frames: [
      { t: -90, aL: [100, -10], aR: [80, 190], asL: [0.9, 0.6], asR: [0.9, 0.6], lL: [110, 92], lR: [70, 88], lsL: [0.55, 1], lsR: [0.55, 1], anchor: ["H", 50] },
      { t: -90, aL: [40, 10], aR: [20, 60], asL: [0.9, 0.6], asR: [0.9, 0.6], lL: [110, 92], lR: [70, 88], lsL: [0.55, 1], lsR: [0.55, 1], hd: -70, anchor: ["H", 50] },
    ],
    props: (J) => [
      P.raw(`<rect x="${J.H[0] - 46}" y="${J.H[1] + 2}" width="92" height="12" rx="5" fill="#4A5466"/>`, [[J.H[0] - 46, J.H[1]]]),
      P.line([J.H[0], J.H[1] + 12], [J.H[0], 0], 8),
      front(P.raw(`<rect x="${J.KL[0] - 14}" y="${J.KL[1] - 6}" width="${J.KR[0] - J.KL[0] + 28}" height="10" rx="5" fill="#8994A8"/>`, [])),
    ],
    arrows: (J, i) => i && arrow(up(rt(J.S, -40), 26), up(rt(J.S, 40), 26), -16),
  },
  a33: {
    view: "front",
    hl: ["torso"],
    frames: [fstand({ aR: [-60, 200, 200], asR: [0.9, 0.8] }), fstand({ t: -106, hd: -110, aR: [-60, 200, 200], asR: [0.9, 0.8] })],
    props: (J) => [P.pulley(J.H[0] + 110, -14, J.HdL)],
    arrows: (J, i) => i && arrow(up(rt(J.S, 6), 30), up(rt(J.S, -36), 18), -10),
  },
};

const C2 = "#4A5466";
