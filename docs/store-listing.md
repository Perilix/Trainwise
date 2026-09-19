# Trainwise — Fiches stores (App Store Connect + Google Play)

> Positionnement : **plateforme de coaching et de suivi d'athlètes** — entraînement
> personnalisé par l'IA, suivi de progression, et coachs humains diplômés.
> Langue principale : Français (France). Compteurs de caractères indiqués.

---

## 🍎 App Store Connect (iOS)

### App Name — 30 caractères max
```
Trainwise : Coaching sportif
```
*(28 caractères — élargit au-delà du running ; "running" reste dans le sous-titre et les keywords)*

### Subtitle — 30 caractères max
```
Coach IA ou coach humain
```
*(24 caractères — LE différenciateur : aucun concurrent ne propose les deux)*

### Promotional Text — 170 caractères max
*(modifiable À TOUT MOMENT sans re-review — parfait pour les promos)*
```
🎉 Offre de lancement : choisis ton coach — IA ou coach diplômé — et démarre ton entraînement personnalisé avec l'abonnement annuel à prix réduit. Rejoins-nous !
```
*(160 caractères)*

### Description — 4000 caractères max
```
Trainwise, c'est la première app qui te laisse choisir ton coach : l'IA ou un coach diplômé. Deux formules pour t'entraîner, un dashboard pour coacher — une seule app.

🤖 LE COACH IA
Ton plan d'entraînement généré en 60 secondes à partir de TON profil : VMA, historique, jours dispo, objectif (5 km → marathon). Des séances structurées comme un vrai coach les écrit — échauffement, fractionné, allures précises calculées pour toi — issues de la méthode d'un coach diplômé STAPS. Et après chaque sortie, une analyse concrète de tes données avec un conseil pour la suite.

👨‍🏫 LE COACH HUMAIN
Envie d'un accompagnement sur mesure ? Un coach diplômé construit ton programme, l'ajuste en continu, et échange avec toi par chat et visio. Un vrai suivi d'athlète, dans ta poche.

💪 COURSE, MUSCU… ET BIENTÔT PLUS
La muscu a son suivi complet, comme la course : planifie tes séances, enregistre exercices, séries, reps et charges, visualise ta progression et reçois une analyse IA après chaque séance. Que tu coures, que tu soulèves ou les deux : tout ton entraînement au même endroit. Et d'autres sports arrivent bientôt.

📊 TON SUIVI COMPLET
Calendrier d'entraînement, séances prévues vs réalisées, ressenti après chaque séance, objectifs chrono et synchronisation Strava automatique.

🎯 VOUS ÊTES COACH ?
Invitez vos athlètes et suivez-les depuis un seul dashboard : progression, état de forme au quotidien (indicateur vert/orange/rouge avec alertes), planification aux allures individualisées, bibliothèque de séances réutilisables et chat intégré. Fini les tableurs et les allers-retours WhatsApp.

💙 COMMENT ÇA MARCHE ?
Gratuit au téléchargement. Les fonctionnalités IA utilisent des TrainCoins (crédits offerts à l'inscription, rechargeables sans abonnement) ou l'abonnement Pro illimité. Pas d'abonnement forcé : tu choisis.

Télécharge Trainwise et transforme chaque séance en progrès. 🏃
```
*(~1890 caractères — courte et scannable, les 3 premières lignes vendent la dualité)*

### Keywords — 100 caractères max (séparés par des virgules)
```
course à pied,running,marathon,semi,10k,plan entrainement,vma,fractionné,strava,athlète,muscu
```
*(94 caractères — "running" ajouté ici puisqu'il n'est plus dans le nom ; "coach/coaching/sportif" déjà indexés via le nom et sous-titre)*

### URLs
| Champ | Valeur | Statut |
|---|---|---|
| Support URL | `https://trainwise-app.com/support` | ⚠️ page à créer |
| Marketing URL | `https://www.trainwise-app.com/about` | ✅ page vitrine `/about` |
| Privacy Policy URL | `https://trainwise-app.com/privacy` | 🔴 OBLIGATOIRE avant soumission |

### Autres champs
| Champ | Valeur |
|---|---|
| Version | `1.0.0` |
| Copyright | `© 2026 Trainwise` |
| Primary Category | Health & Fitness (Forme et santé) |
| Secondary Category | Sports |
| Age Rating | 4+ |
| Price | Gratuit (achats intégrés) |

### In-App Purchases à créer (Monetization)
⚠️ Prérequis : accord "Paid Apps" signé (Business → Agreements : banque + fiscalité).

**Groupe d'abonnements `Trainwise Pro` :**
| Product ID (définitif, identique au code) | Durée | Prix | Nom affiché |
|---|---|---|---|
| `trainwise_pro_monthly` | 1 mois | 9,99 € | Trainwise Pro Mensuel |
| `trainwise_pro_annual` | 1 an | 59,99 € (lancement) → 79,99 € | Trainwise Pro Annuel |

**Consommables :**
| Product ID | Type | Prix | Nom affiché |
|---|---|---|---|
| `trainwise_coins_10` | Consumable | 2,99 € | Pack 10 TrainCoins |
| `trainwise_coins_50` | Consumable | 9,99 € | Pack 50 TrainCoins |

### RevenueCat (rappel config)
1. Projet + apps iOS (`com.trainwise.appli`) / Android
2. Importer les 4 produits
3. Offering `default` avec 4 packages dont les **identifiers = exactement** les Product IDs (le code fait `packages.find(p => p.identifier === ...)`)
4. Webhook : `https://trainwise-backend-rnd4.onrender.com/api/subscription/webhook` + header Authorization = valeur de `REVENUECAT_WEBHOOK_SECRET` (à poser sur Render)
5. Clés publiques `appl_...` / `goog_...` → `frontend/src/environments/environment.prod.ts` (encore en placeholder !)

### Notes pour la review Apple (App Review Information)
```
Trainwise est une plateforme de coaching sportif (course à pied et musculation).

Compte de démonstration :
Email : demo@trainwise-app.com
Mot de passe : [À CRÉER — profil rempli, VMA, historique, TrainCoins]

Les fonctionnalités IA (génération de plan, analyse de séance) consomment des
crédits "TrainCoins" inclus dans le compte démo. L'abonnement coaching humain
met en relation avec un coach réel via chat — le paiement de ce service
s'effectue hors app (service de personne à personne, guideline 3.1.3(e)).
```

### Captures d'écran (iPhone 6,9" + 6,5", 3 à 10)
Ordre suggéré : 1) Plan généré (preview) 2) Détail de séance (blocs + allures) 3) Analyse IA 4) Calendrier/suivi 5) Dashboard 6) Coach humain. Bandeau texte au-dessus de chaque capture.

---

## 🤖 Google Play (déclinaison)

### Titre — 30 caractères max
```
Trainwise : Coaching sportif
```

### Description courte — 80 caractères max
```
Choisis ton coach : IA ou coach diplômé. Entraînement personnalisé et suivi.
```
*(76 caractères)*

### Description longue
→ Reprendre la description iOS telle quelle.

### Assets
| Asset | Spécification | Statut |
|---|---|---|
| Icône | 512×512 PNG **pleine dalle** | ✅ `docs/playstore-icon-512.png` |
| Feature graphic | 1024×500 PNG | ⚠️ à créer |
| Captures téléphone | min. 2 | ⚠️ à faire |
| Privacy Policy URL | obligatoire | 🔴 comme iOS |

### Formulaires Console
- **Sécurité des données** : collecte = email, nom, données de forme physique (FC, poids, séances) ; partage tiers = non (Strava = choix utilisateur)
- **Classification du contenu** : tout public
- **Public cible** : 18+

---

## 🔴 Bloquants avant soumission
1. Page **Politique de confidentialité** publique (les 2 stores)
2. Page **Support**
3. **Compte démo** pour Apple
4. **Domaine** : ✅ `trainwise-app.com` acheté — DNS à pointer vers l hébergement du frontend
