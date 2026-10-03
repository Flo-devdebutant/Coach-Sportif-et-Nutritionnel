# Carnet — coach sportif et nutritionnel

Application web installable (PWA) : programme d'entraînement personnalisé, menus sur mesure avec recettes et liste de courses, suivi des calories, du poids et des séries d'activité. Tout fonctionne hors ligne ; les données restent sur l'appareil (synchronisation facultative entre appareils).

## Publication

L'application doit être servie en ligne (GitHub Pages, ou tout hébergement statique en HTTPS). Ouverte comme simple fichier, elle ne peut pas démarrer : les modules JavaScript et le service worker exigent une adresse `http(s)`.

Sur GitHub Pages, il suffit de pousser (ou de déposer via l'interface GitHub) les fichiers sur la branche publiée.

## Mise à jour automatique

Même ouverte, l'application se met à jour seule après chaque publication :

1. toutes les 5 minutes, au retour sur l'application et au retour du réseau, la page demande au service worker (`sw.js`) de vérifier s'il existe une nouvelle version ;
2. il compare l'empreinte HTTP (`ETag` / `Last-Modified`) de `version.json` et `index.html` avec sa copie locale — GitHub Pages renouvelle cette empreinte à chaque publication, aucune étape de compilation n'est donc nécessaire ;
3. si elle a changé, la nouvelle version complète est téléchargée en arrière-plan puis remplace l'ancienne d'un seul coup ;
4. la page se recharge dès que cela n'interrompt rien (jamais pendant une séance guidée, une saisie ou une fenêtre ouverte ; immédiatement si l'application est en arrière-plan).

Une modification de `sw.js` lui-même suit le cycle standard du navigateur, avec le même rechargement prudent.

### Outil facultatif

```sh
node tools/build.mjs
```

Régénère la liste des fichiers mis en cache par le service worker et l'identifiant de version (`version.json`). À relancer après l'ajout ou la suppression de fichiers pour qu'ils soient disponibles hors ligne dès l'installation ; un fichier ajouté sans relancer l'outil reste servi et se met en cache à la première demande.

## Moteurs

- **Entraînement** : séries, répétitions et repos selon l'objectif (force/hypertrophie, recomposition, perte de poids) et le niveau ; progression automatique séance après séance (double progression : +1 répétition, puis charge augmentée d'un palier, ou variante plus difficile au poids du corps ; allègement en cas d'échec ou de reprise après 3 semaines) ; remplacement d'un exercice par un équivalent (mêmes muscles, matériel disponible) ; report d'une séance manquée sur un jour de repos ; volume hebdomadaire par muscle comparé aux repères.
- **Nutrition** : besoins Mifflin-St Jeor avec un écart à la maintenance proportionnel (−20 % en perte, +10 % en prise…), protéines rapportées à un poids de référence, cyclage calorique (plus de glucides les jours d'entraînement, même moyenne hebdomadaire) et, en option, dépense réelle mesurée à partir du journal et des pesées (métabolisme adaptatif).
- **Suivi** : tendance du poids par régression sur 4 semaines, projection vers un poids visé, dépenses d'activité nettes (sans double comptage du métabolisme de repos).
- **Coach** : chaque jour, les conseils qui comptent (séance à reporter, progression, rythme de perte trop rapide ou à l'arrêt, protéines insuffisantes, dépense réelle), chacun avec son action en un geste.

## Structure

```
index.html              coquille de l'application
manifest.webmanifest    installation (icônes, raccourcis)
sw.js                   service worker : hors ligne et mises à jour
css/                    tokens (thèmes clair/sombre), base, composants, vues
js/app.js               démarrage, actions communes
js/core/                stockage, évènements, sauvegardes automatiques, utilitaires
js/engine/              moteurs : entraînement, nutrition, statistiques, coach
js/services/            synchronisation Firebase, PWA, thème
js/ui/                  rendu, routeur, feuilles, graphiques, composants
js/views/               écrans : aujourd'hui, entraînement, nutrition, progrès, profil, inscription, séance guidée
js/sheets/              fenêtres : recette, exercice, saisies, réglages, données
js/data/                exercices, guides, muscles, recettes, aliments, repères de cuisson
assets/                 polices, icônes, photos et illustrations d'exercices
tools/                  outil de publication, générateur d'illustrations
```

Les données enregistrées (clé `carnet-entrainement.state.v1`) et le protocole de synchronisation sont compatibles avec la version précédente.

## Crédits

Icônes [Lucide](https://lucide.dev) (licence ISC, voir `assets/icons/LICENSE-lucide.txt`). Polices Inter et Outfit (SIL Open Font License).

Photos d'exercices issues de [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (domaine public, Unlicense). Les exercices sans photo sont illustrés par des dessins générés :

```sh
node tools/illustrations/build.mjs                      # régénère assets/exercises/<id>-1.svg et -2.svg
node tools/illustrations/build.mjs --preview f.html c1  # planche de contrôle
```

Chaque illustration se décrit dans `tools/illustrations/exercises.mjs` par deux poses (départ, travail) exprimées en angles d'articulations, les muscles mis en valeur, les accessoires et les flèches de mouvement.
