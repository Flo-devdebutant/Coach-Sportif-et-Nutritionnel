#!/usr/bin/env node
/* =========================================================================
   Met à jour la liste des fichiers mis en cache par le service worker et
   l'identifiant de version (empreinte du contenu).
   Usage : node tools/build.mjs
   Facultatif : la mise à jour automatique fonctionne aussi sans relancer
   cet outil (voir sw.js), mais il garantit que tout nouveau fichier est
   disponible hors ligne dès l'installation et affiche une version exacte.
   ========================================================================= */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const rel = (p) => "./" + relative(root, p).split(sep).join("/");

function walk(dir, filter) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, filter));
    else if (filter(name)) out.push(p);
  }
  return out;
}

const shellFiles = [
  join(root, "index.html"),
  join(root, "manifest.webmanifest"),
  ...walk(join(root, "css"), (n) => n.endsWith(".css")),
  ...walk(join(root, "js"), (n) => n.endsWith(".js")),
  ...walk(join(root, "assets", "fonts"), (n) => n.endsWith(".woff2")),
  ...walk(join(root, "assets", "icons"), (n) => /\.(png|svg)$/.test(n)),
];
const mediaFiles = walk(join(root, "assets", "exercises"), (n) => /\.(webp|png|jpe?g)$/.test(n));

const hash = createHash("sha256");
for (const f of [...shellFiles, ...mediaFiles]) {
  hash.update(rel(f));
  hash.update(readFileSync(f));
}
const build = hash.digest("hex").slice(0, 10);
const d = new Date();
const version = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}-${build.slice(0, 6)}`;

writeFileSync(join(root, "version.json"), JSON.stringify({ version, build, date: d.toISOString() }, null, 2) + "\n");

const shell = ["./", ...shellFiles.map(rel), "./version.json"];
const media = mediaFiles.map(rel);
const block = `/* @build:start */
const BUILD = ${JSON.stringify(build)};
const SHELL = ${JSON.stringify(shell, null, 2)};
const MEDIA = ${JSON.stringify(media)};
/* @build:end */`;

const swPath = join(root, "sw.js");
const sw = readFileSync(swPath, "utf8");
const next = sw.replace(/\/\* @build:start \*\/[\s\S]*?\/\* @build:end \*\//, block);
if (next === sw && !sw.includes(block)) throw new Error("Marqueurs @build introuvables dans sw.js");
writeFileSync(swPath, next);
console.log(`Version ${version} · ${shell.length} fichiers d'application · ${media.length} photos`);
