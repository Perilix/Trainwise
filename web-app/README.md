# Trainwise — web (desktop)

Application Angular 20 qui sert la version **ordinateur** de Trainwise. Le mobile, lui,
est l'app Expo dans `app/` ; les deux parlent au même backend (`api/`).

## Démarrer

```bash
npm install
npm start          # http://localhost:4200
```

`proxy.conf.json` relaie `/api` et `/socket.io` vers l'API de production : rien à
configurer pour développer. En production, `src/environments/environment.prod.ts`
pointe directement sur l'API.

```bash
npm run build      # dist/frontend/browser (ce que le Dockerfile sert via nginx)
npm run typecheck
```

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/app/core` | API, session, gardes, thème clair/sombre, socket, formats FR |
| `src/app/domain` | Modèles de vue et calculs **partagés avec l'app Expo** (`app/src/features`, `app/src/lib`) |
| `src/app/ui` | Icônes au trait, graphiques SVG, primitives (carte, puce, avatar, stat…) |
| `src/app/layout` | Barre latérale et cadre de l'application |
| `src/app/pages` | Un dossier par espace : `athlete`, `coach`, `chat`, `shared`, `auth` |

## Règles

- **Aucune couleur en dur** dans un composant : tout passe par les variables CSS de
  `src/styles.scss` (jetons de `app/docs/design-system.md`, clair et sombre).
- Le code métier vit dans `app/src/…` et se recopie dans `src/app/domain/` : corriger
  d'abord côté Expo, puis reporter, pour que les deux clients restent d'accord.
- Navy = action et structure, bleu = données et navigation, violet = le coach,
  vert = fait, orange = Strava, rouge = non-lu.
