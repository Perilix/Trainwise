# Connexion Google et Apple

Le code est en place des deux côtés. Il ne reste qu'à créer les identifiants chez Google et Apple,
puis à renseigner les variables d'environnement. Tant qu'une variable manque, le bouton
correspondant reste simplement masqué : rien ne casse.

## Ce qui est déjà codé

**API** (`api/`)

- `POST /api/auth/google` — reçoit `{ idToken }`.
- `POST /api/auth/apple` — reçoit `{ identityToken, fullName? }`.
- `src/services/socialAuth.service.js` vérifie la signature du jeton avec les clés publiques du
  fournisseur (mises en cache une heure), puis l'émetteur et l'audience.
- Un compte existant portant la même adresse est **rattaché** au fournisseur ; sinon un compte est
  créé. Le mot de passe devient facultatif pour ces comptes (`user.model.js`).
- Les deux routes renvoient exactement la même réponse que `/api/auth/login` : `{ token, user }`.

**App** (`app/`)

- `src/features/auth/social-sign-in.ts` : Google via `expo-auth-session` (navigateur système),
  Apple via `expo-apple-authentication`.
- `src/features/auth/social-buttons.tsx` : les boutons, sous le bouton principal des écrans
  Connexion et Inscription.
- `session.tsx` expose `signInWithGoogle()` et `signInWithApple()`.

## Google : ce que tu dois créer

1. Va sur <https://console.cloud.google.com/apis/credentials>, projet Trainwise (ou crée-le).
2. Configure l'écran de consentement OAuth (nom de l'app, logo, adresse de contact).
3. Crée **trois** identifiants OAuth, un par plateforme :
   - **iOS** — identifiant de bundle `com.trainwise.appli`.
   - **Android** — nom de package `com.trainwise.appli` + empreinte SHA-1 du certificat
     (`eas credentials` te la donne).
   - **Web** — sert de repli et pour le web ; URI de redirection autorisée :
     `https://auth.expo.io/@ton-compte/trainwise` pendant les tests en Expo Go.
4. Renseigne, dans `app/.env` :

   ```
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=…apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=…apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=…apps.googleusercontent.com
   ```

5. Renseigne, côté serveur (Render) : `GOOGLE_CLIENT_IDS` = les trois identifiants séparés par des
   virgules. C'est la liste des audiences acceptées à la vérification du jeton.

## Apple : ce que tu dois créer

1. Sur <https://developer.apple.com/account/resources/identifiers/list>, ouvre l'identifiant
   `com.trainwise.appli` et coche **Sign In with Apple**.
2. Régénère le profil de provisionnement (EAS le fait pour toi au prochain build).
3. Côté serveur (Render) : `APPLE_CLIENT_IDS=com.trainwise.appli`. Ajoute le Service ID séparé par
   une virgule si tu ajoutes un jour la connexion Apple sur le web.

Aucune clé privée n'est nécessaire : on vérifie le jeton d'identité, on n'appelle pas l'API d'Apple.

## Limite à connaître pour les tests

Le bouton **Apple ne s'affiche pas dans Expo Go** : l'autorisation « Sign in with Apple » appartient
à l'application qui l'héberge, et Expo Go ne la porte pas. Il apparaît dans un build de
développement (`eas build --profile development`), en TestFlight et en production. Le bouton Google,
lui, fonctionne dans Expo Go dès que les identifiants sont renseignés.

Rappel App Store : dès qu'une app propose une connexion tierce comme Google, Apple exige que
« Sign in with Apple » soit proposé aussi. Les deux sont là, donc c'est couvert.
