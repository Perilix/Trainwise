# 🔔 Configuration des Notifications Push

Guide complet pour configurer les notifications push sur iOS et Android avec Firebase.

## 📋 Prérequis

- Un compte Firebase (gratuit) : https://console.firebase.google.com
- Un compte Apple Developer (pour iOS)
- Node.js et npm installés

---

## 🚀 Étape 1 : Créer un projet Firebase

1. Va sur https://console.firebase.google.com
2. Clique sur **"Ajouter un projet"**
3. Nomme ton projet (ex: "RunIQ")
4. Active Google Analytics (optionnel)
5. Clique sur **"Créer le projet"**

---

## 📱 Étape 2 : Configuration iOS

### 2.1 - Ajouter une app iOS dans Firebase

1. Dans la console Firebase, clique sur l'icône iOS ⚙️
2. **iOS bundle ID** : `com.runiq.app` (ou ton bundle ID)
3. Télécharge le fichier **`GoogleService-Info.plist`**
4. Place-le dans : `frontend/ios/App/`

### 2.2 - Générer une clé APNs (Apple Push Notification)

1. Va sur https://developer.apple.com/account/resources/authkeys/list
2. Clique sur le **+** pour créer une nouvelle clé
3. Nomme-la (ex: "RunIQ Push Key")
4. Coche **"Apple Push Notifications service (APNs)"**
5. Clique sur **"Continue"** puis **"Register"**
6. **Télécharge le fichier .p8** (tu ne pourras le télécharger qu'une seule fois !)
7. Note le **Key ID** affiché

### 2.3 - Ajouter la clé APNs à Firebase

1. Dans Firebase Console, va dans **Project Settings** (⚙️)
2. Onglet **"Cloud Messaging"**
3. Section **"Apple app configuration"**
4. Clique sur **"Upload"** dans APNs Authentication Key
5. Upload ton fichier **.p8**
6. Entre le **Key ID** et ton **Team ID** Apple

---

## 🤖 Étape 3 : Configuration Android

### 3.1 - Ajouter une app Android dans Firebase

1. Dans Firebase Console, clique sur l'icône Android
2. **Package name** : `com.runiq.app` (ou ton package)
3. Télécharge le fichier **`google-services.json`**
4. Place-le dans : `frontend/android/app/`

---

## 🔑 Étape 4 : Configuration Backend (Node.js)

### 4.1 - Générer une clé de service Firebase

1. Dans Firebase Console → **Project Settings** (⚙️)
2. Onglet **"Service accounts"**
3. Clique sur **"Generate new private key"**
4. Un fichier JSON sera téléchargé (ex: `runiq-firebase-adminsdk-xxxxx.json`)

### 4.2 - Configurer la variable d'environnement

Dans ton fichier `backend/.env`, ajoute :

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"runiq-xxxxx","private_key_id":"xxxxx",...}'
```

**⚠️ Important** : La valeur doit être le **contenu complet** du fichier JSON en une seule ligne.

**Exemple rapide** :
```bash
# Copie le contenu du fichier JSON et mets-le en une ligne
cat runiq-firebase-adminsdk-xxxxx.json | jq -c . > temp.txt
# Puis copie le contenu de temp.txt dans ton .env
```

---

## 📲 Étape 5 : Build de l'app

### iOS

```bash
cd frontend
npm run build
npx cap sync ios
npx cap open ios
```

Dans Xcode :
1. Va dans **Signing & Capabilities**
2. Ajoute la capability **"Push Notifications"**
3. Ajoute la capability **"Background Modes"** → Coche "Remote notifications"
4. Build et teste sur un device réel (les notifs ne marchent pas sur simulator)

### Android

```bash
cd frontend
npm run build
npx cap sync android
npx cap open android
```

Dans Android Studio :
1. Build l'app
2. Teste sur un device réel ou émulateur

---

## ✅ Étape 6 : Tester

1. **Lance le backend** :
   ```bash
   cd backend
   npm run dev
   ```

2. **Lance l'app** sur ton téléphone

3. **Login** dans l'app → Les permissions de notifications seront demandées

4. **Teste** :
   - Demande à un coach d'envoyer une invitation
   - Ou envoie un message via le chat
   - Tu devrais recevoir une notification push ! 🎉

---

## 🐛 Troubleshooting

### Les notifications ne s'affichent pas

1. **Vérifie les logs backend** :
   ```bash
   # Tu devrais voir :
   ✅ Firebase Admin initialized for push notifications
   ✅ Push notification sent successfully
   ```

2. **Vérifie que le token est enregistré** :
   - Dans les logs, tu devrais voir : `Push registration success, token: xxxxx`

3. **iOS** : Vérifie que tu as bien ajouté les capabilities dans Xcode

4. **Android** : Vérifie que `google-services.json` est bien dans `android/app/`

### Erreur "Firebase not initialized"

→ Vérifie que `FIREBASE_SERVICE_ACCOUNT` est bien configuré dans `.env`

### Invalid token error

→ Le token a expiré ou est invalide. Déconnecte-toi et reconnecte-toi pour générer un nouveau token.

---

## 📚 Ressources

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications](https://capacitorjs.com/docs/apis/push-notifications)
- [Apple APNs Guide](https://developer.apple.com/documentation/usernotifications)

---

## 🎯 Prochaines étapes

Une fois que tout fonctionne :

1. ✅ Les invitations coach envoient des notifications push
2. ✅ Les nouveaux messages envoient des notifications push
3. 🔜 Personnalise les sons et icônes de notification
4. 🔜 Ajoute des notifications pour d'autres événements (séances planifiées, etc.)

**Enjoy! 🚀**
