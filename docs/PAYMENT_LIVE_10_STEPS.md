# Paiements réels — 10 étapes (Wazo Digital)

## Statut automatisé vs manuel

| # | Étape | Qui |
|---|--------|-----|
| 1 | Migration Supabase `006` | **Manuel** (SQL Editor) — voir ci-dessous |
| 2 | `SUPABASE_SERVICE_ROLE_KEY` sur Vercel | **Script** `scripts/setup-vercel-payment-live.ps1` |
| 3 | URLs app (`NEXT_PUBLIC_APP_URL`) | **Script** |
| 4 | Compte PayDunya + clés live | **Manuel** (dashboard PayDunya) |
| 5 | Variables paiement Vercel | **Script** |
| 6 | Callback PayDunya | **Manuel** (dashboard PayDunya) |
| 7 | Redeploy production | **Script** |
| 8 | Test `/billing` | **Vous** (connecté) |
| 9 | Vérifier tables Supabase | **Vous** |
| 10 | Test webhook | **Automatique** après paiement |

---

## Étape 1 — Migration Supabase (obligatoire)

1. Ouvrir https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/sql/new
2. Coller le contenu de `supabase/migrations/006_billing_subscriptions.sql`
3. Cliquer **Run**
4. Vérifier : Table Editor → tables `billing_subscriptions` et `billing_payments`

---

## Étape 4 & 6 — PayDunya (dashboard)

1. Connexion https://paydunya.com → **Intégration** / **API**
2. Copier :
   - **Master Key** → `PAYMENT_API_KEY` (Vercel)
   - **Private Key** → `PAYMENT_SECRET_KEY`
   - **Token** → `PAYMENT_TOKEN`
3. Mettre à jour `.env.local` avec les 3 clés
4. Relancer : `powershell -ExecutionPolicy Bypass -File scripts/setup-vercel-payment-live.ps1`
5. **Callback URL (IPN)** à enregistrer chez PayDunya :

```
https://app.wazo-digital.com/api/payments/momo/callback
```

6. Si possible, en-tête HTTP sur le callback :
   - Nom : `x-callback-secret`
   - Valeur : identique à `PAYMENT_CALLBACK_SECRET` dans Vercel

---

## Commande tout-en-un (étapes 2, 3, 5, 7)

```powershell
cd C:\Users\user\Desktop\wazo-digital
powershell -ExecutionPolicy Bypass -File scripts\setup-vercel-payment-live.ps1
```

---

## Étape 8 — Test utilisateur

1. https://app.wazo-digital.com → connexion
2. **Abonnement** → **Payer ce plan** (Starter ou Pro)
3. Si `PAYMENT_MODE=live` + clés PayDunya OK → paiement Mobile Money réel
4. Après succès → statut **Actif jusqu'au …**

---

## Étape 9 — Vérification Supabase

Table `billing_payments` : `status = succeeded`  
Table `billing_subscriptions` : `status = active`, `current_period_end` renseigné

---

## URLs techniques

| Rôle | URL |
|------|-----|
| Paiement | `POST /api/payments/momo` |
| Webhook | `POST /api/payments/momo/callback` |
| Abonnement | `GET /api/billing/subscription` |

---

## Dépannage

- Paiement simulé sans Mobile Money → `PAYMENT_MODE=test` ou clés vides → passer en `live` + 3 clés PayDunya + redeploy
- Erreur abonnement API → migration 006 non exécutée ou `SUPABASE_SERVICE_ROLE_KEY` manquant sur Vercel
- Paiement OK mais pas d'activation → callback PayDunya mal configuré
