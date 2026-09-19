# Abonnement coach — ce qu'il reste à faire chez Stripe

Le code est prêt : il ne manque que le compte, les produits et trois variables
d'environnement. Tant qu'elles manquent, l'écran Abonnement affiche « Paiement
pas encore branché » et refuse poliment le paiement — rien ne casse.

## 1. Le compte et les clés

1. Crée le compte sur [dashboard.stripe.com](https://dashboard.stripe.com), en
   mode **bac à sable** pour commencer (le sélecteur en haut à droite).
2. Développeurs → Clés d'API → **Créer une clé restreinte** (`rk_…`) plutôt que
   la clé secrète. Droits en écriture sur : Clients, Abonnements, Sessions de
   paiement, Sessions du portail client, Factures, Prix, Produits.
3. Cette clé va dans `STRIPE_SECRET_KEY`.

## 2. Les produits et les prix

**Un produit par plan** (les lignes de facture portent le nom du produit : trois
plans sur un seul produit et le coach ne saurait plus ce qu'il paie).

| Produit    | Prix mensuel | Prix annuel        | Variables                                              |
| ---------- | ------------ | ------------------ | ------------------------------------------------------ |
| Coach      | 29 € / mois  | 288 € / an (24×12) | `STRIPE_PRICE_COACH_MONTHLY` / `STRIPE_PRICE_COACH_YEARLY` |
| Studio     | 59 € / mois  | 588 € / an (49×12) | `STRIPE_PRICE_STUDIO_MONTHLY` / `STRIPE_PRICE_STUDIO_YEARLY` |
| Club       | 119 € / mois | 1 188 € / an (99×12) | `STRIPE_PRICE_CLUB_MONTHLY` / `STRIPE_PRICE_CLUB_YEARLY` |

Découverte est gratuit : pas de produit, pas de prix.

Chaque prix est **récurrent**, en euros. Copie l'identifiant `price_…` de chacun.

Les montants affichés dans l'app viennent de `api/src/config/plans.js` : si tu
changes un tarif chez Stripe, change-le au même endroit, sinon l'écran ment.

## 3. Le portail client

Réglages → Facturation → **Portail client** : active la mise à jour du moyen de
paiement, l'historique des factures, le changement de plan et la résiliation.
C'est lui qui porte tout le service après-vente — l'app n'a aucun écran pour ça.

## 4. Le webhook

Développeurs → Webhooks → Ajouter un point de terminaison :

- URL : `https://trainwise-backend-rnd4.onrender.com/api/stripe/webhook`
- Événements : `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.paid`, `invoice.payment_failed`.

Le secret de signature (`whsec_…`) va dans `STRIPE_WEBHOOK_SECRET`.

C'est le webhook qui fait foi : la page de retour ne décide de rien, elle se
contente de dire « c'est parti ». Sans webhook, un abonnement payé n'apparaît
jamais dans l'app.

## 5. Les variables sur Render

À ajouter au service `trainwise-backend-rnd4`, puis redéployer :

```
STRIPE_SECRET_KEY=rk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_COACH_MONTHLY=price_...
STRIPE_PRICE_COACH_YEARLY=price_...
STRIPE_PRICE_STUDIO_MONTHLY=price_...
STRIPE_PRICE_STUDIO_YEARLY=price_...
STRIPE_PRICE_CLUB_MONTHLY=price_...
STRIPE_PRICE_CLUB_YEARLY=price_...
```

`FRONTEND_URL` doit pointer sur `https://www.trainwise-app.com` : c'est là que
Stripe renvoie le coach après le paiement.

## 6. La TVA

Les prix sont annoncés hors taxes. Pour facturer la TVA correctement, il faut
activer **Stripe Tax** *et* déclarer une inscription fiscale (Réglages → Tax).
Sans inscription active, Stripe ne collecte rien et ne prévient pas. À faire
avant la première vente réelle, pas après.

## 7. Tester

Carte de test : `4242 4242 4242 4242`, n'importe quelle date future, n'importe
quel CVC. En local, pour recevoir les webhooks :

```bash
stripe listen --forward-to localhost:5000/api/stripe/webhook
```

Le secret affiché par `stripe listen` remplace `STRIPE_WEBHOOK_SECRET` le temps
du test.

## Ce que le code fait déjà

- `api/src/config/plans.js` — les quatre plans, leurs limites et leurs prix.
- Limites vérifiées côté serveur, pas seulement à l'écran :
  - athlètes inclus (invitation, code d'invitation, acceptation d'une demande) ;
  - groupes (aucun sur Découverte, 3 sur Coach, illimités au-dessus) ;
  - alertes sur mesure (Studio et Club).
- Un abonnement impayé, résilié ou expiré retombe sur Découverte : les données
  restent, ce sont les limites qui reviennent.
