# Handoff — Améliorer la création/visualisation de séances course (Trainwise)

## ⚠️ Principe directeur : ON GARDE L'EXISTANT
On **ne refait PAS** le design de l'app. La DA actuelle de Trainwise reste telle quelle (couleurs, header navy + logo, cartes, boutons, bottom tab bar, polices). L'objectif est d'**ajouter deux composants** et d'**améliorer le rendu des blocs** existants, sans casser ce qui marche.

Captures de l'app **actuelle** fournies (état de départ, à conserver) :
- `actuel-1-coach-creation.png` — création séance côté coach
- `actuel-2-athlete-ressenti.png` — ressenti + "à compléter" côté athlète
- `actuel-3-athlete-plan.png` — plan de la séance (blocs Échauffement / Corps / Retour au calme)
- `actuel-4-coach-vs-realise.png` — visualisation coach vs réalisé

Maquette de **référence des améliorations** : `Running Builder (reference).html` (ouvrir dans un navigateur — canvas pannable, 4 artboards iPhone). C'est la cible visuelle pour les 2 nouveaux composants.

---

## Ce qu'on ajoute / améliore (et RIEN d'autre)

### 1. 🎯 Bloc « Profil de la séance » (résumé en haut)
Un bandeau récap à placer **en haut de la page de séance** (création coach ET visualisation athlète), juste sous la carte titre.

**Contenu :**
- Une **timeline horizontale** : barre fine (hauteur ~12px, radius pleine) composée de segments accolés, **un segment par phase/étape**, largeur proportionnelle à la durée/distance, **couleur = type d'étape** (voir code couleur plus bas). Gap de 2px entre segments.
- Une **ligne de labels** sous la timeline (ex. `Échauf.` | `Fractionné ×8` | `Calme`), alignés sur les segments.
- Une **rangée de 3 stats** : Distance totale · Durée estimée · Nb d'étapes. Valeurs en gros (police display italique de l'app), labels en petit uppercase. Séparées par un filet vertical.

> Ce bloc remplace AVANTAGEUSEMENT l'absence de vue d'ensemble actuelle. Il se met à jour en live quand on ajoute/édite une étape.

### 2. 🔁 Bloc « Répéter ×N » (le must de Garmin)
Permet de regrouper plusieurs étapes et de les répéter N fois — au lieu de dupliquer 8 fois le même bloc.

**Structure :**
- Un **conteneur** légèrement teinté (fond `--cyan-tint`, bord 1px), radius 16.
- **Header** : icône boucle ↻ + label `RÉPÉTER` (uppercase, couleur cyan foncé) + un **stepper** `−  8×  +` (carte blanche, boutons cyan-soft).
- **Body** : les étapes incluses, **indentées** avec un **trait vertical en pointillés** à gauche (la « bracket » Garmin) qui signale visuellement le groupe.
- On peut ajouter une étape **dans** le bloc, et imbriquer le bloc dans le corps de séance.

### 3. ✨ Amélioration des blocs d'étape existants (style « step » Garmin)
Garder les cartes actuelles mais les faire évoluer vers ce pattern, plus lisible :
- **Barre d'accent verticale à gauche** (6px), couleur = type d'étape.
- Petite **icône de type** (emoji) dans un carré soft de la couleur du type.
- **Type** en label uppercase tiny + **valeur principale** (durée OU distance) en gras 17px + **Cible** en dessous (`Cible · 4:00 /km · Z4`), muted.
- À droite : poignée de drag `⋮⋮` + bouton crayon d'édition (conserver l'action d'édition existante).

### Code couleur des types d'étape (à intégrer aux tokens existants)
| Type | Couleur | Usage |
|---|---|---|
| Échauffement | `--amber #f5a623` | warm-up |
| Course / Effort | `--cyan #1aaef5` (déjà dans la DA) | bloc d'effort |
| Récupération | `--teal #37bd9c` | récup active/passive entre efforts |
| Retour au calme | `--violet #7c5cdb` (déjà dans la DA) | cool-down |
| Repos | `--muted-2 #8a94a1` | pause complète |

---

## Tokens existants à réutiliser (ne pas réinventer)
```
navy #0b2a47 · cyan #1aaef5 · ivory #f2efe9 (fond) · paper #fff
violet #7c5cdb (CTA/brouillon) · amber #f5a623 (à compléter) · green #1fb77a (PRO/réalisée)
Police display : Archivo Black italic (titres, valeurs) — déjà utilisée
Police texte : Inter
```
Nouveaux tokens à ajouter : `--teal #37bd9c`, `--cyan-tint #eef7fd` (fond bloc répéter), `--muted-2 #8a94a1`.

---

## Écran par écran — ce qui change

### Écran 1 — Création coach (`actuel-1`)
- AJOUTER le **bloc Profil** en haut (sous la carte « Endurance / Brouillon »).
- GARDER « Consignes globales » tel quel.
- Le « Plan de la séance » : remplacer les 3 cartes vides Échauffement / Corps / Retour au calme par la **liste d'étapes** style step, avec possibilité d'insérer un **bloc Répéter ×N** dans le corps.
- Barre d'ajout en bas du plan : **`+ Étape`** et **`+ Bloc à répéter`**.
- GARDER le gros CTA violet « CRÉER LA SÉANCE » tel quel.

### Écran 2 — Ressenti athlète (`actuel-2`)
- **Ne pas toucher** au design du ressenti (slider épuisant→excellent, gros chiffre) — il est déjà bien. Juste s'assurer que les blocs du plan en dessous adoptent le nouveau style step pour la cohérence.

### Écran 3 — Plan athlète (`actuel-3`)
- Mêmes étapes style step + bloc Répéter (en lecture, avec la valeur « réalisé »).
- GARDER le bandeau « Distance totale calculée » (déjà bien, fond cyan).

### Écran 4 — Coach vs réalisé (`actuel-4`)
- GARDER la logique prévu **~~barré~~** → réalisé.
- Améliorer l'affichage : dans chaque étape, valeur prévue barrée (muted) → flèche → valeur réalisée en **cyan gras**. Bouton « Modifier » conservé.
- Le bloc Répéter s'affiche aussi ici (en lecture seule, `8×`).

---

## Modèle de données (évolution, compat ascendante)
L'actuel a probablement : `warmup`, `body: Block[]`, `cooldown`. Étendre `Block` pour supporter le groupe répété :
```ts
type Step = {
  id: string;
  type: "warmup" | "run" | "recover" | "cooldown" | "rest";
  // durée OU distance
  durationSec?: number;
  distanceM?: number;
  // cible optionnelle
  target?: { kind: "pace" | "hr" | "zone" | "free"; value?: string; zone?: number };
  note?: string;
};

type Block =
  | { kind: "step"; step: Step }
  | { kind: "repeat"; times: number; steps: Step[] };   // ← NOUVEAU

type Workout = {
  id: string; title: string; date: string;
  status: "draft" | "todo" | "done";
  globalNote?: string;
  warmup?: Step;
  body: Block[];          // contient steps ET repeat blocks
  cooldown?: Step;
};
```
Migration : les anciens blocs deviennent `{kind:"step", step}`. Le calcul de distance/durée totale itère en multipliant les `repeat` par `times`.

---

## Interactions
- **Stepper ±** du bloc Répéter : range [1..30], met à jour la timeline + les totaux en live.
- **Drag `⋮⋮`** : réordonner les étapes (dans le corps, et dans un bloc répété).
- **Crayon** : ouvre l'éditeur d'étape existant (ou un sheet : Type → Durée/Distance → Cible allure/FC/zone).
- **`+ Bloc à répéter`** : insère un bloc répété vide (2 étapes placeholder : 1 effort + 1 récup).
- La **timeline** du profil et les **3 stats** se recalculent à chaque modif.

## Accessibilité
- `aria-label` sur stepper (« Augmenter le nombre de répétitions »), sur crayon (« Modifier l'étape »).
- Touch targets ≥ 44px. Contraste des labels de type OK (utiliser les versions foncées des couleurs pour le texte : ambre→#bd7d12, cyan→#0e7fc0, teal→#1d9e7e, violet→#6243c0).

---

## Fichiers fournis
- `Running Builder (reference).html` — cible visuelle des améliorations (4 artboards)
- `actuel-1..4.png` — l'app actuelle (DA à conserver)
- `README.md` — ce document

## Ordre d'implémentation
1. Ajouter les tokens manquants (`--teal`, `--cyan-tint`, `--muted-2`).
2. Composant **WorkoutProfile** (timeline + stats) — branché sur le workout.
3. Faire évoluer la carte d'étape vers le **Step** (accent couleur + type + valeur + cible).
4. Composant **RepeatBlock** (`+ Bloc à répéter`, stepper, bracket indentée).
5. Étendre le modèle `Block` + le calcul des totaux.
6. Décliner sur les écrans athlète (plan + coach vs réalisé).

> Rappel : on **améliore** l'existant, on ne remplace pas la DA. En cas de doute, garder le composant actuel et n'ajouter que le strict nécessaire décrit ici.
