/* Bibliothèque de poses de base (profil, regard vers la droite). */
import { LEN } from "./figure.mjs";

const BODY = LEN.torso + LEN.thigh + LEN.shin;
const deg = (r) => (r * 180) / Math.PI;
/* Inclinaison d'un corps droit dont les épaules sont à h au-dessus du sol. */
export const tilt = (h, len = BODY) => deg(Math.asin(Math.min(1, h / len)));

export const stand = (o = {}) => ({ t: -90, aN: [96, 92], aF: [84, 87], lN: [90, 90], lF: [93, 91], ...o });

/* Squat : d = 0 (debout) → 1 (cuisses parallèles). */
export const squat = (d, o = {}) => ({
  t: -90 + 36 * d, lN: [90 - 78 * d, 90 + 26 * d], lF: [92 - 78 * d, 92 + 26 * d],
  aN: [96 - 6 * d, 92], aF: [84, 87], ...o,
});

/* Planche bras tendus (pompe haute) ou basse. */
export const pushup = (low = 0, o = {}) => {
  const hS = low ? 26 : LEN.ua + LEN.fa;
  const a = tilt(hS + 4);
  const arm = low ? { ik: [o.handX ?? 4, hS], bend: 1, end: 0 } : [90, 90, 0];
  return { t: -a, lN: [180 - a, 180 - a], lF: [180 - a, 180 - a], aN: arm, aF: arm, ...o };
};

/* Planche sur avant-bras. */
export const forearmPlank = (o = {}) => {
  const a = tilt(LEN.ua + 4);
  return { t: -a, lN: [180 - a, 180 - a], lF: [180 - a, 180 - a], aN: [90, 0, 0], aF: [90, 0, 0], ...o };
};

/* Allongé sur le dos, tête à gauche. */
export const supine = (o = {}) => ({ t: 180, hd: 180, lN: [0, 0], lF: [2, 0], aN: [2, 0], aF: [0, 0], ...o });
/* Allongé sur le ventre, tête à droite. */
export const prone = (o = {}) => ({ t: 0, hd: 0, lN: [180, 180], lF: [180, 180], aN: [180, 180], aF: [178, 178], ...o });

/* Quatre pattes, tête à droite. */
export const quad = (o = {}) => ({ t: 0, hd: 0, lN: [90, 180], lF: [90, 180], aN: [90, 90, 0], aF: [90, 90, 0], ...o });

/* Pont fessier : bassin haut (up = 1) ou au sol (0), tête à gauche. */
export const bridge = (up, o = {}) => ({
  t: 180 - 26 * up, hd: 180, lN: { ik: [72 - 8 * up, 28 + 26 * up - 4], bend: -1 }, lF: { ik: [72 - 8 * up, 24 + 26 * up - 4], bend: -1 },
  aN: [176 - 22 * up, 180 - 22 * up], aF: [176 - 22 * up, 180 - 22 * up], ...o,
});

/* Charnière de hanche : d = 0 debout → 1 buste presque horizontal. */
export const hinge = (d, o = {}) => ({
  t: -90 + 72 * d, lN: [90 + 14 * d, 90 - 4 * d], lF: [92 + 14 * d, 90 - 4 * d],
  aN: [90 + 2 * d, 90], aF: [88, 90], ...o,
});

/* Assis au sol, jambes tendues, tête à droite… regard à droite = jambes à droite. */
export const seated = (o = {}) => ({ t: -100, lN: [0, 0], lF: [2, 0], aN: [110, 100], aF: [110, 100], ...o });
