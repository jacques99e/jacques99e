# Audit sécurité API — Wazo Digital

Dernière revue : juin 2026.

## Résumé

| Catégorie | Routes | Protection |
|-----------|--------|------------|
| Données boutique (CRUD) | billing, team, push, logistics, education, health, blockchain, reports, sms | `requireAuthContext()` + `checkStoreAccess()` |
| Crons | `/api/cron/*` | `Authorization: Bearer CRON_SECRET` |
| Callback paiement | `/api/payments/momo/callback` POST | `PAYMENT_CALLBACK_SECRET` (header ou query) |
| Portails publics | `/api/education/public/*`, `/api/logistics/public/*`, `/api/blockchain/public/*` | Accès limité par code/hash (intentionnel) |
| Vérification certificat | `/api/education/certificates/verify/[token]` | Lecture publique par token (intentionnel) |
| Météo & conseils agri | `/api/agriculture/weather`, `/api/agriculture/tips` | Session requise (évite abus clé OpenWeather) |

## Routes protégées par session

Toutes les routes ci-dessous refusent les requêtes sans utilisateur connecté (cookie Supabase ou `Authorization: Bearer`).

- `/api/billing/subscription`, `/api/billing/payments`
- `/api/team/members`
- `/api/push/subscribe`, `/api/push/notify`
- `/api/reports/settings`, `/api/reports/test`
- `/api/sms/status`, `/api/sms/test`
- `/api/logistics/deliveries`, `/api/logistics/notify-sms`
- `/api/education/courses`, `/api/education/invite-sms`, `/api/education/certificates/issue`
- `/api/health/prescriptions`, `/api/health/appointments/remind-sms`
- `/api/blockchain/assets`
- `/api/payments/momo` (initiation paiement)
- `/api/agriculture/weather`, `/api/agriculture/tips`

## Contrôle d'accès boutique

`checkStoreAccess(supabase, userId, storeId, "read" | "write")` :

- **Propriétaire** : accès complet.
- **Manager / employé** : lecture + écriture sauf restrictions UI.
- **Comptable** : lecture seule côté API (`write` → 403).

Les invitations équipe (`POST /api/team/members`) sont réservées au **propriétaire** uniquement.

## Routes publiques (volontaire)

- **Formation** : catalogue et inscription par code invitation.
- **Logistique** : suivi colis par code public.
- **Blockchain** : preuve traçabilité par hash.
- **Certificats** : vérification QR sans compte.

Ces endpoints ne exposent que les données prévues pour un usage public (pas de liste globale).

## Recommandations production

1. Définir `CRON_SECRET`, `PAYMENT_CALLBACK_SECRET` et clés VAPID sur Vercel.
2. Activer RLS Supabase sur toutes les tables métier (voir migrations).
3. Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
4. Désactiver « Confirm email » uniquement pour les environnements de test.

## Test manuel rapide

```bash
# Doit retourner 401 sans session
curl -s -o /dev/null -w "%{http_code}" https://wazo-digital.vercel.app/api/billing/subscription

# Doit retourner 401 sans CRON_SECRET
curl -s -o /dev/null -w "%{http_code}" https://wazo-digital.vercel.app/api/cron/push-alerts
```

Comptes test propriétaire + employé : voir `docs/TEST-ACCOUNTS.md` et `npm run setup:test-accounts`.
