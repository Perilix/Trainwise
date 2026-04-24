# Handoff — Trainwise Beta Feedback Page

## Overview
Page web sur laquelle les utilisateurs bêta de l'app Trainwise peuvent remonter les problèmes qu'ils rencontrent (bugs, UX, performances, idées). Contient un formulaire multi-étapes, un sélecteur visuel d'écran, une sidebar communautaire avec les bugs déjà remontés (upvotables), et une animation de succès avec génération de numéro de ticket.

## About the Design Files
Les fichiers de ce bundle sont des **références de design** créées en HTML/CSS/JS vanilla — ce sont des prototypes qui montrent l'apparence et le comportement voulus, **pas du code de production à copier tel quel**. L'objectif est de **recréer ces designs dans l'environnement existant de l'app Trainwise** (React Native, React, Vue, Next.js, etc.) en utilisant les patterns et la librairie UI déjà en place. Si aucun framework n'existe côté web encore, prends celui qui s'intègre le mieux à l'écosystème mobile de Trainwise (probablement Next.js + React si l'app mobile est en React Native).

## Fidelity
**High-fidelity.** Les maquettes sont pixel-perfect avec couleurs, typographies, espacements et interactions finaux. À recréer tel quel avec la librairie UI du codebase cible.

---

## Design Tokens

### Palette (identique au design system Trainwise existant)
```
--navy:       #0b2a47   // Header nav, hero background, texte principal
--navy-deep:  #07223b   // Hero gradient deep
--navy-ink:   #051a2e   // Titres sombres
--cyan:       #1aaef5   // CTA principal, accents, liens
--cyan-hi:    #3dc5ff   // Hover CTA
--ivory:      #f2efe9   // Background page
--paper:      #ffffff   // Cards
--line:       #e6e2d9   // Borders subtiles
--text:       #0b2a47   // Texte par défaut
--muted:      #5a6878   // Texte secondaire
--violet:     #7b5bd6   // Coach (avatar, accents)
--violet-soft:#efe9fb   // Coach background
--green:      #1fb77a   // Succès, statut "Corrigé"
--green-soft: #e6f7ee   // Background vert
--amber:      #f5a623   // Statut "En cours"
--amber-soft: #fef3dd
--orange:     #ff7a1a   // Sévérité "Important"
--red:        #e74c3c   // Sévérité "Bloquant"
--red-soft:   #fde8e5
```

### Typographie
- **Display** : `Archivo Black` italic — titres, brand, chiffres stats (Google Fonts)
- **Body** : `Inter` 400/500/600/700/800 — texte courant, labels, boutons
- **Mono** : `JetBrains Mono` 400/500/600 — chips techniques, char counter, numéros de ticket

### Tailles
- H1 hero : `52px / line-height 1 / letter-spacing -.02em / italic`
- H2 card-title : `26px italic`
- H3 side-h : `18px italic`
- Stats num : `28px italic`
- Body : `14px / line-height 1.55`
- Label field : `13px / weight 700`
- Hint : `12px muted`
- Chip meta : `11.5px mono`

### Radius
- Cards : `20px` (form), `16px` (sidebar cards)
- Hero : `24px`
- Inputs / boutons : `12px`
- Chips / pills : `4-6px` (status), `999px` (badges ronds)
- Avatar : `50%`

### Shadows
- Card : `0 1px 0 #00000008, 0 4px 24px -12px #0b2a4722`
- CTA primary : `0 1px 0 #ffffff40 inset, 0 6px 18px -6px #1aaef580`
- Success overlay : `0 30px 80px -20px #00000066`

### Spacing
- Page max-width : `1240px`
- Grid gap : `32px`
- Card padding : `32px` (form), `22px` (sidebar)
- Field margin-bottom : `20px`

---

## Screens / Views

Une seule page (route unique, ex: `/beta/feedback`). Composée des sections suivantes de haut en bas :

### 1. Top Nav
- **Layout** : Flex horizontal, padding `14px 32px`, background `--navy`
- **Gauche** : Logo "Trainwise" (Archivo Black italic, "Train" blanc + "wise" cyan, 22px) + badge "Bêta" avec gradient `cyan → violet`
- **Droite** : Liens "Accueil / Planning / Aide" + chip utilisateur (avatar rond violet 28px avec initiales + prénom) sur background `#ffffff10` arrondi

### 2. Hero
- **Layout** : Pleine largeur de la grille (`grid-column: 1 / -1`), padding `44px`, radius `24px`, background `navy + radial-gradients cyan/violet`
- **Contenu** :
  - Badge "Programme bêta · v1.0.0" avec point vert pulsé (animation `pulse 2s infinite`, opacity 1 ↔ 0.5)
  - Titre H1 en 2 lignes, 52px italic, avec `<span class="hl">version</span>` en cyan
  - Paragraphe descriptif (16px, `#c8d7e6`, max-width 560px)
  - **Stats row** : 4 chiffres alignés en flex gap:32px (247 Bêta-testeurs, 132 Retours reçus, 89 Bugs corrigés, 72h Délai moyen). Chaque chiffre en Archivo Black italic 28px, label en uppercase 11px tracking wide.

### 3. Main grid (2 colonnes sous le hero)
Layout : `grid-template-columns: 1fr 380px`, gap 32px. Stack en 1 colonne sous 1100px.

#### 3a. Form Card (colonne principale)
Background blanc, radius 20px, padding 32px, shadow.

**Header** : Title "Décris-nous ton problème" (26px italic) + subtitle "Quelques minutes pour nous aider à fixer le bug plus vite."

**Steps progress bar** :
- 4 étapes : Type · Écran · Détails · Envoi
- Chaque étape = cercle 36px avec numéro Archivo Black + label uppercase 10px sous le cercle
- États : `idle` (gris `#f0ece4`), `active` (cyan + cercle plein), `done` (vert + checkmark ✓ remplace le numéro)
- Lignes de connexion 2px entre cercles, passent en vert quand l'étape précédente est complétée

**Step 1 — Type de retour** (grille 2×2) :
4 cartes sélectionnables, chacune avec icône emoji dans carré 40px coloré + titre 13.5px + description 11.5px muted.
- 🐛 Bug / Plantage — icon bg `#fde8e5`
- 🎨 Problème UX / UI — icon bg `#e6f3ff`
- ⚡ Performance — icon bg `#fef3dd`
- 💡 Idée / Suggestion — icon bg `#efe9fb`

État `selected` : border `2px cyan`, bg `#eaf6fd`, box-shadow `0 0 0 3px #1aaef51a`.

**Step 2 — Écran concerné** (grille 4 colonnes, 3 sur mobile) :
Mini-maquettes d'écrans 9:16. Chaque tile montre un rendu simplifié de l'écran app (header navy avec "Trainwise" logo mini, corps ivoire avec titre écran + barres de contenu colorées, tab bar en bas avec dot cyan actif).

Écrans proposés (ordre exact) :
1. **Accueil** — accent cyan
2. **Messages** — accent violet
3. **Planning** — accent cyan
4. **Mes sorties** — accent vert
5. **Mon Profil** — accent cyan
6. **Boutique** — accent orange
7. **Connexion** — accent cyan
8. **Je sais pas** — fallback gris avec "?"

Au clic : check cyan ✓ en top-right de la tile sélectionnée.

**Step 3 — Détails** :
- **Textarea** description : placeholder explicite avec exemple ("Quand je clique sur Générer une semaine depuis le planning, l'app freeze 5 secondes..."), max 1000 car, char counter en bas à droite en mono
- **Sévérité** (grille 4 cols) : 4 cartes carrées avec emoji couleur 🟢🟡🟠🔴 + titre + description ("Gênant mais contournable" / "Complique l'usage" / "Empêche d'avancer" / "App inutilisable"). Selected state colore la carte selon la sévérité.
- **Drop zone screenshot** : zone dashed 2px border, padding 24px, icon 📎 centré, texte "Glisse un fichier ou clique pour parcourir" / "PNG, JPG, MP4 · 10 Mo max". Au click → simulate attached state avec nom de fichier + bouton "Retirer".

**Step 4 — Récap** :
- Récap grid (2 colonnes : label muted / valeur navy-ink) avec Type, Écran, Impact, Description tronquée 200 car
- **Infos techniques auto-jointes** : chips mono 11.5px avec device (iPhone 13 · iOS 17.4), version app (Trainwise v1.0.0), locale, timestamp, email user
- Checkbox "D'accord pour être recontacté"

**Actions row** (footer card) :
- Bouton ghost "← Précédent" (caché à l'étape 1)
- Bouton primary "Continuer" (→ "Envoyer le retour" à l'étape 4), disabled si step invalide

#### 3b. Sidebar (3 cards empilées gap 20px)

**Card 1 — Programme bêta** (gradient navy, texte blanc) :
- Titre "Merci d'en faire partie." (18px italic blanc)
- Paragraphe avec compteur de retours user + objectif badge "Early Bird 🐦"
- Barre de progression gradient cyan→violet, 6px height, radius 999px, 60% remplie
- Labels "3 / 5 retours" / "60%" en 11px uppercase

**Card 2 — Bugs communauté** :
- Titre "Vote ou commente les bugs existants."
- Liste de 5 bugs. Chaque item :
  - Bouton vote à gauche (flèche ▲ + compte en Archivo Black). État `voted` en cyan, bg cyan-soft
  - Titre bug 13.5px weight 700
  - Meta row : status pill (Ouvert rouge / En cours ambre / Planifié violet / Corrigé vert) + écran concerné en mono `// Planning`
- Lien "Voir tous les retours (132) →"

Vote interaction : click toggle `voted` class, incrément/décrément compteur.

**Card 3 — Conseils** :
- Titre "💡 Conseils pour un bon retour"
- 4 tips numérotés (carré ivoire 22px avec chiffre + texte avec `<strong>` inline) : Sois précis / Joins un screenshot / Explique ce que tu attendais / Un retour = un problème

### 4. Success Overlay
Fixed full-screen, background `#051a2ecc` + backdrop-blur 8px, appears on submit.
- Card blanche 440px max, radius 24px, padding 48px 40px
- Check vert 80px rond avec ✓ 38px + animation pulse box-shadow
- Titre "Merci Julien !" (26px italic)
- Paragraphe "Ton retour est bien arrivé chez nous. On le lit dans les prochaines 72h."
- **Ticket box** : bg ivoire radius 12px, 2 colonnes : "Ticket #TW-0248" / "Statut 🟡 En triage"
- Actions : bouton ghost "Fermer" + primary "Nouveau retour" (reset form)

---

## Interactions & Behavior

### Navigation du formulaire
- `goToStep(n)` : affiche le pane correspondant, met à jour l'état `active/done` des steps, scroll top de la card (smooth)
- Validation par étape :
  - Step 1 : `type` sélectionné
  - Step 2 : `screen` sélectionné
  - Step 3 : `desc.length >= 10` ET `sev` sélectionné
  - Step 4 : toujours OK → submit
- Bouton Next disabled si étape invalide
- Bouton Back caché à l'étape 1

### Submit
1. Génère un ID ticket aléatoire (`#TW-` + entier entre 248 et 297 formaté 4 digits)
2. Insère l'ID dans `.success-ticket`
3. Ajoute `.show` à `.success` (fade in + scale card de .92 → 1)

### Reset
- Vide `state`, retire `selected` de toutes les options, clear textarea + file attached, retour step 1

### Votes sidebar
- Click sur `.bug-vote` → toggle `voted`, incrément/décrément `n`
- Pas de persistence requise dans le prototype ; à brancher sur API en prod.

### Animations
- Steps : transition `all .2s`
- Hero dot : `@keyframes pulse` 2s infinite (opacity 1 ↔ 0.5)
- Success check : `@keyframes checkPulse` 1.4s infinite (box-shadow ring expanding)
- Success card : `transform scale .92 → 1` en `.4s cubic-bezier(.2,.9,.3,1.4)`
- Type/screen/sev hover : `border-color` transition, légère élévation `translateY(-2px)` sur screens
- Input focus : `border-color cyan` + `box-shadow 0 0 0 3px #1aaef51a`

### Responsive
- ≤1100px : grid passe à 1 colonne (sidebar sous le form)
- ≤720px : type-grid → 1 col, screen-grid → 3 cols, sev-grid → 2 cols, hero H1 → 36px

---

## State Management

```ts
type FeedbackState = {
  step: 1 | 2 | 3 | 4;
  type: "bug" | "ui" | "perf" | "idea" | null;
  screen: "home" | "chat" | "planning" | "sorties" | "profil" | "boutique" | "auth" | "other" | null;
  desc: string;
  sev: "low" | "med" | "high" | "crit" | null;
  screenshot?: File;
  contactMe: boolean; // default true
};
```

### API endpoints à créer côté backend
- `POST /api/beta/feedback` : body = `FeedbackState` + métadonnées (userAgent, appVersion, userId, timestamp). Renvoie `{ticketId: string, status: "triage"}`.
- `GET /api/beta/feedback/community` : liste paginée des bugs publics avec votes/status
- `POST /api/beta/feedback/:id/vote` : toggle upvote user
- `POST /api/beta/feedback/:id/attachment` : upload screenshot (multipart)

### Stats hero (dynamiques en prod)
- `GET /api/beta/stats` → `{testers, feedbacks, fixed, avgResponseHours}`

---

## Assets
- **Fonts** : Google Fonts (Archivo Black, Inter, JetBrains Mono). Self-host en prod pour perf.
- **Logo Trainwise** : déjà dans l'app, même traitement "Train" blanc + "wise" cyan en Archivo Black italic
- **Icônes** : emojis natifs utilisés comme placeholders. À remplacer par Phosphor / Lucide / icônes custom de Trainwise en prod. Mapping recommandé :
  - 🐛 → `Bug` (Phosphor) ou icon custom
  - 🎨 → `Palette`
  - ⚡ → `Lightning`
  - 💡 → `Lightbulb`
  - 📎 → `Paperclip`
  - ▲ → `CaretUp`
- **Mini-maquettes d'écran** : générées en CSS/divs. En prod, remplacer par screenshots réels des 7 écrans dans les thumbnails.

---

## Files
- `Beta Feedback.html` — la page complète (tout inline : HTML + CSS + JS)
- `Onboarding Email.html` — bonus, l'email d'onboarding de référence (même DS visuel)
- `tweaks-panel.jsx` — composant Tweaks utilisé pour le prototypage, **pas à porter**

---

## Notes d'implémentation

1. **Le panneau Tweaks n'est pas à porter** — c'est un outil de prototypage. En prod, ne garder que la variation "detailed" (la principale).
2. **Les 3 variations prototypées** (detailed / compact / community) ne sont PAS à livrer toutes en prod — la variation par défaut est `detailed` et c'est celle à implémenter.
3. **Tous les textes français** sont finaux, copier tels quels.
4. **Les infos user** (Julien, JD avatar, 3 retours ce mois, etc.) sont mockées — brancher sur le user context réel.
5. **Les 5 bugs communauté** sont des exemples — remplacer par le flux API réel.
6. **Accessibility** à ajouter en prod : `aria-label` sur les boutons vote et sélecteurs, focus states visibles au clavier, labels `for`/`id` sur inputs, annonces aria-live pour le changement d'étape et la soumission.
