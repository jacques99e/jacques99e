# Production — Wazo Digital (Landing + App)

Checklist pour lancer **wazo-digital.com** et **app.wazo-digital.com** en production.

Dernière vérification automatisée : builds OK, E2E smoke 37/37, full-journey 10/10.

---

## 1. Déploiement Vercel

| Projet | Domaine | Région |
|--------|---------|--------|
| `landing-jacques99e` | https://wazo-digital.com | (défaut) |
| `wazo-digital` | https://app.wazo-digital.com | `cdg1` (Paris — Afrique) |

Après chaque push sur `master`, Vercel redéploie automatiquement.

**Monitoring :**
- Landing : `GET https://wazo-digital.com/api/health`
- App : `GET https://app.wazo-digital.com/api/health`

---

## 2. Variables d'environnement (Production)

### Landing (`landing-jacques99e`)

| Variable | Obligatoire |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui |
| `NEXT_PUBLIC_APP_URL` | Oui → `https://app.wazo-digital.com` |
| `RESEND_API_KEY` | Optionnel (emails contact) |

### App (`wazo-digital`)

| Variable | Obligatoire |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Oui (API serveur) |
| `NEXT_PUBLIC_APP_URL` | Oui |
| `NEXT_PUBLIC_LANDING_URL` | Oui → `https://wazo-digital.com` |
| `PAYMENT_MODE` | `live` pour abonnements réels |
| `PAYMENT_API_KEY`, `PAYMENT_SECRET_KEY`, `PAYMENT_TOKEN` | Oui si PayDunya live |
| `PAYMENT_CALLBACK_SECRET` | Recommandé |
| `CRON_SECRET` | Oui (crons Vercel) |
| `SMS_SIMULATE` | `false` pour SMS métier réels |
| `AT_*` | Si SMS Africa's Talking live |

**Auth SMS abandonnée** — ne pas activer le hook Send SMS dans Supabase.

Sync PayDunya vers Vercel :
```powershell
cd wazo-digital
powershell -ExecutionPolicy Bypass -File scripts\setup-vercel-payment-live.ps1
```

---

## 3. Supabase

Projet : `gfqmmdihubcpvouidpkc`

### URL Configuration
- **Site URL** : `https://wazo-digital.com`
- **Redirect URLs** : voir `Landing/SUPABASE_URLS_PROD.md`

### Providers
- **Email** : activé
- **Google** : activé (redirect URI Supabase dans Google Cloud)
- **Phone** : **désactivé**

### Migrations SQL
Appliquer dans l'ordre `supabase/migrations/001` … `012` (SQL Editor ou `supabase db push`).

Tables critiques : `profiles`, `stores`, `billing_subscriptions`, `billing_payments`.

---

## 4. PayDunya (abonnements PRO / BUSINESS)

1. Dashboard PayDunya → **Intégration API** → clés **live**
2. Callback IPN :
   ```
   https://app.wazo-digital.com/api/payments/momo/callback
   ```
3. En-tête optionnel : `x-callback-secret` = valeur de `PAYMENT_CALLBACK_SECRET`
4. Test santé callback (avec secret) :
   ```
   GET https://app.wazo-digital.com/api/payments/momo/callback?secret=VOTRE_SECRET
   ```
   → `{ "success": true, "message": "Callback abonnement actif." }`
5. Test utilisateur : connexion → **Abonnement** → **Payer ce plan**

---

## 5. Tests automatisés (local)

```powershell
# Landing — smoke + landing (37 tests prod)
cd Landing
npm run test:e2e:smoke

# Parcours authentifié complet (10 tests)
$env:E2E_TEST_EMAIL="test.owner@wazo.africa"
$env:E2E_TEST_PASSWORD="TestOwner2026!"
npx playwright test --project=full-journey

# Vérification production (URLs + health)
cd ..\wazo-digital
powershell -ExecutionPolicy Bypass -File scripts\verify-production.ps1
```

---

## 6. Tests manuels avant annonce publique

- [ ] Inscription nouveau compte (email)
- [ ] Connexion email → dashboard app
- [ ] Google OAuth (navigation privée)
- [ ] Créer produit → vitrine `/boutique/[slug]`
- [ ] Portails `/suivi`, `/formation`, `/trace`
- [ ] Paiement abonnement (si commercialisation PRO)

---

## 7. Comptes test

Voir `docs/TEST-ACCOUNTS.md` :
- Propriétaire : `test.owner@wazo.africa` / `TestOwner2026!`
- Boutique test : `/boutique/boutique-test-roles-wazo`

---

## 8. Statut fonctionnel

| Fonctionnalité | Prod |
|----------------|------|
| Vitrine marketing | OK |
| Auth email + Google | OK |
| Auth SMS | Retirée |
| App modules (commerce, etc.) | OK (E2E) |
| Vitrines boutiques | OK |
| Portails publics | OK |
| Paiements PayDunya | Config Vercel OK — test manuel requis |
| SMS métier | Dépend compte AT live |
| Crons (rapport, alertes) | Configurés (`vercel.json`) |

---

## 9. Lancement recommandé

**Phase 1 — Maintenant** : vitrine, inscription gratuite, app, boutiques publiques.

**Phase 2 — Après 1 paiement test** : promotion plans PRO / BUSINESS.

**Phase 3 — Optionnel** : SMS transactionnels (Africa's Talking live), Google Maps, météo.
