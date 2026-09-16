# Trainwise — direction artistique (app Expo)

Référence visuelle validée le 16 sept. 2026. Maquette : <https://claude.ai/artifact/VDgw5Qp6gJSVQ6k2wtECwE>,
page « Retenu · clair & sombre » (écran **A · Clair** et écran **B · Nuit**).

Ce document fait foi pour tous les écrans de l'app. Tout nouvel écran s'y conforme ; toute exception
se décide ici d'abord.

## 1. Principe

L'app garde son identité (navy, bleu, beige, logo Train/wise, GulfsDisplay) mais perd ce qui la
faisait paraître amateur.

**On garde :** le logo Train/wise, GulfsDisplay sur les titres et les grands chiffres, les titres de
section en capitales, le code couleur des séances (vert = effectuée, violet = planifiée par le coach),
le bloc coach violet.

**On retire :** les bandeaux navy en haut et en bas, les halos d'ombre (`box-shadow: 0 0 10px 4px`),
les dégradés décoratifs, les emojis, les icônes pleines (FontAwesome), GulfsDisplay sur les petits
chiffres (jours, stats) — c'est ce qui faisait enfantin.

**On ajoute :** le verre liquide, sur les éléments qui flottent au-dessus du contenu uniquement.

## 2. Couleurs

Les jetons vivent dans `src/theme/tokens.ts` (`palettes.light` / `palettes.dark`) et se lisent via
`useTheme().colors`. **Aucune couleur en dur dans un écran.**

| Jeton | Clair | Sombre | Usage |
| --- | --- | --- | --- |
| `bg` | `#F6F4F0` | `#0A141C` | Fond de page, jusqu'en haut de l'écran |
| `surface` | `#FFFFFF` | `#111D26` | Cartes, lignes de liste |
| `subtle` | `#EFEBE4` | `#1A2731` | Tuiles de stats, onglet actif, fonds secondaires |
| `border` | `#E7E2D9` | `#22303B` | Bordure 1 px des cartes et séparateurs de lignes |
| `ink` | `#051923` | `#E9EFF3` | Texte principal, onglet actif |
| `text2` | `#5A6878` | `#9EABB6` | Texte secondaire, libellés |
| `text3` | `#7D8793` | `#74828E` | Texte tertiaire, onglets inactifs, jours de repos |
| `brand` | `#003554` | `#0B3350` | Carte du jour, surfaces de marque |
| `onBrand` | `#FFFFFF` | `#FFFFFF` | Texte sur `brand` |
| `primary` | `#003554` | `#E3EBF0` | Action principale (boutons pleins) |
| `accent` | `#00A6FB` | `#1AB0FF` | Bouton « Voir la séance », données, liens |
| `accentInk` | `#0077B6` | `#5CC8FF` | Texte bleu sur fond clair (« Voir tout ») |
| `highlight` | `#7FD3FD` | `#7FD3FD` | Sur-titres sur `brand` (« AUJOURD'HUI ») |
| `violet` / `violetInk` | `#8B5CF6` / `#6D28D9` | `#A78BFA` / `#C4B5FD` | Coach, et **uniquement** coach |
| `success` | `#10B981` | `#34D399` | Séance effectuée |
| `strava` | `#FC4C02` | `#FC4C02` | Badge Strava |
| `danger` | `#DC2626` | `#F87171` | Pastilles de non-lu, erreurs |

**Règles d'emploi**

- **Navy = action et structure** (carte du jour, titres de section, boutons pleins).
- **Bleu = données et navigation** (chiffres, « Voir tout », bouton principal sur navy).
- **Violet = le coach**, jamais autre chose.
- **Vert = fait**, orange = Strava, rouge = non-lu (pastille de notification, badge d'onglet).
- **État de suivi d'un athlète** (espace coach) : vert = à jour, orange = vigilance, rouge = alerte.
  C'est le seul autre emploi du rouge et de l'orange.
- L'onglet actif de la barre du bas n'est **pas** bleu : pastille `subtle` + texte `ink` (voir 6.7).

## 3. Typographie

Deux familles, pas une de plus.

- **GulfsDisplay** (`assets/fonts/GulfsDisplay-Regular.ttf`, chargée dans `src/app/_layout.tsx`)
  — réservée à : le titre « Bonjour, Julien ! », les titres de carte (« Fractionné 10 × 400 m »),
  les noms propres (« Camille Roux »), les grands chiffres (stats de la carte du jour, série).
  Jamais en dessous de 16 px, jamais sur du texte courant.
- **Poppins** (`@expo-google-fonts/poppins`, déjà en place) — tout le reste, via `textVariants`
  de `src/theme/typography.ts`.

Échelle (variantes `Text`) :

| Variante | Police | Taille / interligne | Usage |
| --- | --- | --- | --- |
| `display` | Gulfs | 23 / 30 | « Bonjour, Julien ! » |
| `h1` | Gulfs | 22 / 29 | Titre de la carte du jour, titre d'un écran |
| `h2` | Gulfs | 17 / 24 | Nom du coach, titre d'une entité |
| `sectionTitle` | Poppins 800 | 13 / 16, majuscules, `letterSpacing: .78`, couleur `primary` | Titres de section |
| `h3` | Poppins 600 | 15 / 20 | Titre de ligne de liste |
| `body` | Poppins 400 | 14 / 21 | Texte courant |
| `small` | Poppins 400 | 13 / 18 | Méta de ligne (« 8 km · 5:30 /km ») |
| `caption` | Poppins 500 | 12 / 16 | Libellés |
| `overline` | Poppins 700 | 11 / 14, `letterSpacing: .66`, majuscules | Sur-titres, libellés de stats |
| `stat` | Gulfs | 18 / 24 | Chiffres de stats |

`h2` reste réservée aux noms propres et aux titres d'entité ; un intitulé générique de bloc
(« Consignes », « Ressenti », « Notes ») prend `sectionTitle`.

Tous les chiffres qui s'alignent en colonne ou changent en direct utilisent
`fontVariant: ['tabular-nums']`.

## 4. Formes, espacements, ombres

- **Rayons** (`radius` de `tokens.ts`) : `sm: 10` (pastilles, badges), `md: 12` (tuiles, boutons),
  `lg: 16` (cartes de liste), `xl: 20` (carte du jour, bloc coach), `pill: 999` (verre, boutons ronds).
- **Gouttière** : 16 px de chaque côté. Espace entre deux sections : 26 px, dont 12 px sous le titre.
- **Cartes** : `surface` + bordure 1 px `border`. En clair une ombre très basse est tolérée
  (`0 1px 2px rgba(0,53,84,.05)`) ; en sombre, aucune ombre, la bordure suffit.
- **Jamais** d'ombre diffuse colorée autour d'une carte.
- **Zone tactile** : 44 px minimum.

## 5. Verre liquide

Implémenté avec **`expo-glass-effect`** (déjà installé) : `GlassView`, et `isLiquidGlassAvailable()`
pour le repli.

**Où on met du verre** — uniquement ce qui flotte au-dessus du contenu ou se touche :

1. Les deux boutons de l'en-tête (avatar, cloche).
2. Le badge de série « 6 semaines ».
3. Le bouton « Voir la séance » et le bouton du coach.
4. La barre d'onglets et sa pastille d'onglet actif.

**Où on n'en met pas** : cartes de contenu, lignes de liste, carte du jour, tuiles de stats. Elles
restent pleines — le texte long sur du translucide fatigue et casse le contraste.

**Deux intensités**

- *Standard* (`glassEffectStyle: 'regular'`) : boutons du CTA, barre d'onglets.
- *Renforcée* (les trois éléments du haut : avatar, cloche, badge de série) : flou et saturation
  poussés, liseré irisé (une pointe de bleu et de violet sur le pourtour), reflet plus marqué en haut.
  C'est la signature visuelle de l'app — elle reste cantonnée à ces trois éléments.

**Repli obligatoire** (Android, iOS < 26, `isLiquidGlassAvailable() === false`) : surface
`surface` à 92 % d'opacité + bordure 1 px `border` + ombre douce. La mise en page ne change pas.

**Retour tactile** : à l'appui, `scale: 0.96` avec ressort (`react-native-reanimated`, déjà installé).

## 6. Composants

### 6.1 En-tête (`AppBar`)

Pas de bandeau. Le fond de page remonte jusqu'en haut, sous la barre d'état.
De gauche à droite : **avatar (verre renforcé, 44 px)** — **logo Train/wise centré (88 px de large)** —
**cloche (verre renforcé, 44 px)** avec pastille rouge si non-lu.
Le logo suit le thème : `BRAND.logoLight` en clair (« Train » navy), `BRAND.logoDark` en sombre
(« Train » beige).

Implémenté dans `src/components/ui/app-bar.tsx`.

### 6.2 Salutation

« Bonjour, {prénom} ! » en `display`, sous-titre en `body` couleur `text2`, et à droite le **badge de
série** : verre renforcé, flamme dégradée orange, le nombre en Gulfs, « SEMAINES » en `overline`.

### 6.3 Carte du jour

Fond `brand`, rayon `xl`, monogramme TW en filigrane en bas à droite (opacité 8 %).
Ligne du haut : « AUJOURD'HUI » en `overline` couleur `highlight`, et à droite la puce violette
« Planifiée par {coach} ». Puis le titre en `h1`, la description en `body` à 70 % d'opacité, une
rangée de trois stats séparée par un filet à 14 % de blanc, et le bouton `accent` « Voir la séance ».

### 6.4 Semaine

Carte pleine. Sept colonnes : initiale du jour en `overline`, numéro en Poppins 600 (pas Gulfs),
pastille de 7 px dessous (vert = effectuée, violet = planifiée coach, rien = repos). Le jour courant
reçoit un fond `accent` à 10 % et son numéro passe en `accentInk`.
Dessous : légende (Effectuée / Planifiée coach), puis trois tuiles `subtle` (sorties, km, temps).

### 6.5 Listes de séances

Une carte par section, lignes séparées par une bordure 1 px `border`.
- *À venir* : pastille date (jour en `overline` `accentInk`, numéro en Poppins 600), filet vertical,
  titre + méta, badge « COACH ».
- *Passées* : tuile 40 px `accent` à 10 % avec l'icône de la discipline, titre + méta, badge « STRAVA ».

Les badges de bout de ligne (« COACH », « STRAVA ») utilisent `<Chip badge />` : capitales, 22 px de
haut, rayon `sm`. Les puces qui portent une phrase (« Planifiée par Camille ») restent en `Chip`
normal, en casse de phrase.

### 6.6 Bloc coach

Fond `violetSoft`, bordure `violet` à 22 %, rayon `xl`. Avatar violet avec point de présence vert,
sur-titre « TA COACH · EN LIGNE », nom en `h2`. Dessous, le dernier message dans une bulle `surface`
au rayon asymétrique (`4 16 16 16`), puis le bouton violet « Envoyer un message ».

### 6.7 Barre d'onglets

Flottante : 16 px des bords, 24 px du bas, hauteur 66 px, rayon `pill`, verre standard.
Quatre onglets (Accueil, Coach, Planning, Sorties), icône 24 px + libellé 10,5 px.
- **Actif** : pastille `subtle` (beige en clair, gris sombre en sombre), icône et libellé `ink`,
  trait 2,2. **Pas de bleu.**
- **Inactif** : `text3`, trait 2.
- Badge de non-lu : rouge, en haut à droite de l'icône.

### 6.8 Écrans de détail (séance, sortie, séance type)

L'élément ouvert est porté par une carte navy de mise en avant : sur-titre `overline` `highlight`
(la date, ou « Utilisée 34 fois » pour une séance type), titre en `h1`, puces d'état, puis les trois
chiffres clés sur fond navy. Le reste de l'écran est en cartes pleines. Les intitulés de bloc
(« Consignes », « Déroulé », « Par kilomètre », « Allures individualisées ») sont en `sectionTitle`.

### 6.9 Fil de discussion

Nom de l'interlocuteur en `h2` (nom propre = Gulfs), bulles : `brand` pour soi, `surface` bordée pour
l'autre. Champ de saisie sur la gouttière de 16 px ; bouton d'envoi `accent` quand il y a du texte,
`subtle` sinon. Dans un onglet, le champ se place au-dessus de la barre flottante.

### 6.10 Icônes

Un seul jeu : `src/components/ui/icon.tsx`, au trait, 24 px, épaisseur 1,75 (2 à 2,2 si actif).
Jamais d'icône pleine, jamais d'emoji.

### 6.11 Deux exceptions assumées

- **La flamme de la série** est la seule icône pleine de l'app, avec son dégradé orange : c'est une
  signature de marque, héritée de l'ancienne app.
- **Les tuiles d'icône des notifications** portent une couleur par type (séance, message, planning,
  import, social, record, compétition). C'est un code de lecture propre à cet écran.

## 7. Déclinaison sur les autres écrans

Même grammaire partout :

1. En-tête sans bandeau (`AppBar` sur les écrans racine, `BackBar` sur les écrans de détail).
2. Titres de section en capitales + « Voir tout » bleu à droite.
3. Le contenu en cartes pleines ; le verre réservé à ce qui flotte.
4. Navy pour l'élément mis en avant de l'écran (séance du jour, séance ouverte), bleu pour les
   données, violet pour ce qui vient du coach.
5. Les graphiques (allure par km, profil de séance) utilisent la rampe `intensityRamp` de
   `tokens.ts`, jamais des couleurs ad hoc.

## 8. État de l'implémentation

Fait :

1. GulfsDisplay (`assets/fonts/GulfsDisplay-Regular.ttf`, chargée dans `src/app/_layout.tsx`),
   jetons (`radius.xl`, `violetLine`, gouttière à 16) et variantes de texte.
2. Primitives : `GlassSurface` (verre + repli), `AppBar`, `TabBar` flottante, `Button`
   (variantes `accent` / `violet`, forme `pill`, flèche en fin de libellé), `Stat` (teinte sur
   surface de marque), `SectionHeader` en capitales, `Screen` (prop `tabs` pour la place de la barre).
3. Accueil athlète : l'écran de référence.
4. Séance ouverte et sortie ouverte : carte navy de mise en avant, partagée par les vues athlète
   et coach (`planned-session-body.tsx`, `run-detail-body.tsx`).
5. Les autres écrans héritent des primitives (planning, sorties, profil, espace coach).
6. Galerie `design-system.tsx` mise à jour (typo, verre, boutons).

Couverture au 16 sept. 2026 : les 33 écrans de l'app portent la DA. 30 ont été regardés un par un
dans l'app en marche, en clair et en sombre (accueil, planning, sorties, chat, profil, notifications,
séance course et muscu, saisie muscu, nouvelle séance, sortie, connexion, inscription, mot de passe
oublié, accueil coach, inviter, fiche athlète, planning athlète, ajout de séance, séance vue coach,
bibliothèque, séance type, éditeur de séance type, assignation, messages, conversation, profil coach,
édition du profil coach).

Reste à faire :

- Séance d'un athlète vue par le coach et son éditeur : vérifiés en clair à l'écran, et au niveau du
  code pour le sombre (aucune couleur en dur, tout passe par `useTheme().colors`).
- Vérifier le rendu du verre sur un iPhone physique en iOS 26 (le simulateur iOS 26 le rend déjà
  fidèlement ; le web retombe sur le repli).
