# Envoyer un build sur TestFlight

`app/eas.json` est en place avec trois profils : `development` (build de dev, nécessite
`expo-dev-client`), `preview` (installation directe sur des appareils enregistrés) et `production`
(ce qui part sur TestFlight et l'App Store).

## Une seule fois

1. **Compte Expo** : `npx eas login` depuis `app/`.
2. **Rattacher le projet** : `npx eas init` — écrit `extra.eas.projectId` dans `app.json`.
3. **Variables publiques du build.** Un build EAS ne lit pas ton `.env` local : les `EXPO_PUBLIC_*`
   doivent être connues d'EAS. Le plus simple, une fois les identifiants Google créés :

   ```bash
   npx eas env:create --name EXPO_PUBLIC_API_URL --value https://trainwise-backend-rnd4.onrender.com --visibility plaintext --environment production
   npx eas env:create --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value … --visibility plaintext --environment production
   npx eas env:create --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value … --visibility plaintext --environment production
   npx eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value … --visibility plaintext --environment production
   ```

   Ce ne sont pas des secrets : un identifiant client OAuth est public par construction.
4. **App Store Connect** : l'app `com.trainwise.appli` doit exister (elle existe déjà, l'app
   Capacitor a été soumise en juillet). Vérifie que **Sign In with Apple** est coché sur
   l'identifiant, sinon le build sera rejeté à la validation.

## À chaque envoi

```bash
cd app
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

Le premier build demande les certificats : laisse EAS les gérer (« Let EAS handle it »), il crée le
certificat de distribution et le profil de provisionnement pour toi.

Compter 15 à 30 minutes de build, puis 5 à 15 minutes de traitement côté Apple avant que le build
apparaisse dans TestFlight.

## Ce que ce build change par rapport à Expo Go

Trois choses ne marchent que dans un vrai build, et deviennent testables :

- la **carte native** des tracés (`expo-maps`) ;
- **Sign in with Apple** (l'autorisation appartient à l'app, pas à Expo Go) ;
- la **connexion Google** (l'adresse de retour `com.trainwise.appli:/oauthredirect` n'existe que
  dans l'app installée).

## Rappel avant soumission App Store

La soumission de juillet a été rejetée pour deux raisons, à revérifier ici :

- les achats intégrés doivent être soumis **avec** la version ;
- la suppression de compte doit être accessible depuis l'app — c'est fait, dans
  Profil → engrenage → Supprimer mon compte.
