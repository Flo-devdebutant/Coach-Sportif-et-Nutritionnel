/* Génère les illustrations SVG des exercices sans photo.
     node tools/illustrations/build.mjs            → assets/exercises/<id>-1.svg, -2.svg
     node tools/illustrations/build.mjs --preview f.html [ids…]  → planche de contrôle */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderExercise } from "./scene.mjs";
import { EXERCISES as DEFS } from "./exercises.mjs";
import { EXERCISES } from "../../js/data/exercises.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const names = new Map(EXERCISES.map((e) => [e.id, e.name]));
const args = process.argv.slice(2);

if (args[0] === "--preview") {
  const only = args.slice(2);
  const list = Object.entries(DEFS).filter(([id]) => !only.length || only.includes(id));
  const cells = list.map(([id, def]) => {
    const [a, b] = renderExercise(def);
    return `<figure><figcaption>${id} · ${names.get(id) || "?"}</figcaption><div>${a}${b}</div></figure>`;
  });
  writeFileSync(args[1], `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0b0d10;color:#ccd;font:13px system-ui;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px}figure{margin:0}div{display:flex;gap:4px}svg{width:50%;height:auto}</style>${cells.join("")}`);
  console.log(`${list.length} exercices en aperçu`);
} else {
  const ids = [];
  for (const [id, def] of Object.entries(DEFS)) {
    if (!names.has(id)) throw new Error("Exercice inconnu : " + id);
    renderExercise(def).forEach((svg, i) => writeFileSync(join(root, "assets", "exercises", `${id}-${i + 1}.svg`), svg));
    ids.push(id);
  }
  writeFileSync(join(root, "js", "data", "exercise-illustrations.js"),
    "/* Exercices illustrés par un dessin (SVG généré par tools/illustrations) faute de photo.\n"
    + "   Fichiers : assets/exercises/<id>-1.svg (départ) et <id>-2.svg (travail). */\n"
    + `export const EXERCISE_ILLUSTRATIONS = ${JSON.stringify(ids.sort())};\n`);
  console.log(`${ids.length} exercices illustrés`);
}
