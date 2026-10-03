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

## Structure

```
index.html              coquille de l'application
manifest.webmanifest    installation (icônes, raccourcis)
sw.js                   service worker : hors ligne et mises à jour
css/                    tokens (thèmes clair/sombre), base, composants, vues
js/app.js               démarrage, actions communes
js/core/                stockage, évènements, sauvegardes automatiques, utilitaires
js/engine/              moteurs : entraînement, nutrition, statistiques
js/services/            synchronisation Firebase, PWA, thème
js/ui/                  rendu, routeur, feuilles, graphiques, composants
js/views/               écrans : aujourd'hui, entraînement, nutrition, progrès, profil, inscription, séance guidée
js/sheets/              fenêtres : recette, exercice, saisies, réglages, données
js/data/                exercices, guides, muscles, recettes, aliments, repères de cuisson
assets/                 polices, icônes, photos d'exercices
```

Les données enregistrées (clé `carnet-entrainement.state.v1`) et le protocole de synchronisation sont compatibles avec la version précédente.

## Crédits

Icônes [Lucide](https://lucide.dev) (licence ISC, voir `assets/icons/LICENSE-lucide.txt`). Polices Inter et Outfit (SIL Open Font License).
