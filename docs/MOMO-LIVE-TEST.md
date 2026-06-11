# Checklist test MoMo PayDunya LIVE

## Prérequis prod

- `PAYMENT_MODE=live`
- Clés PayDunya configurées sur Vercel
- `PAYMENT_CALLBACK_SECRET` défini
- `RESEND_API_KEY` (e-mail marchand)
- Clés VAPID (push navigateur)

## Test ~100 FCFA

1. Connexion `test.owner@wazo.africa`
2. **Caisse** → ajouter un produit au panier → **Envoyer lien MoMo**
3. Ou **Liens MoMo** → créer lien manuel
4. Ouvrir le lien public `/paiement/WZ…`
5. Payer via PayDunya (Orange / MTN / Moov)
6. Vérifier :
   - Statut **Payé** sur `/sales/liens` (onglet Historique)
   - Vente dans **Historique caisse** (`/sales/history`)
   - Widget MoMo sur le **dashboard**
   - E-mail marchand (si Resend actif)
   - Push (si abonné dans Paramètres → Notifications)

## APIs smoke

```bash
# Historique (auth requise — via app)
GET /api/payments/momo-link/history

# Résumé dashboard
GET /api/payments/momo-link/summary

# Cron relances pending +24h (CRON_SECRET)
GET /api/cron/momo-reminders
Authorization: Bearer $CRON_SECRET
```

## Relance client

- Lien **pending** depuis +24 h → bouton **Relancer** (WhatsApp)
- Cron quotidien **09:00 UTC** (`vercel.json` → `/api/cron/momo-reminders`) notifie le marchand des liens en attente

### Cron Vercel

Le job est déclaré dans `vercel.json`. Vercel envoie automatiquement  
`Authorization: Bearer <CRON_SECRET>` si la variable `CRON_SECRET` est définie en Production.

Test manuel :

```bash
curl -s -H "Authorization: Bearer VOTRE_CRON_SECRET" \
  https://wazo-digital.vercel.app/api/cron/momo-reminders
```

Réponse attendue : `{ "success": true, "total_stale_pending": N, ... }`

Sans secret : HTTP **401**.
