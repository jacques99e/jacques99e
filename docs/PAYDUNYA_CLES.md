# Coller les cles PayDunya TEST (sans erreur)

## Ou les trouver

1. https://paydunya.com → connexion
2. Menu **Integration API** (ou **Applications**)
3. Application en **MODE TEST**
4. Copier les 3 valeurs **telles quelles** (pas des `***`)

## Dans `.env.local` (wazo-digital)

```env
PAYMENT_API_KEY=coller_la_MASTER_KEY_ici
PAYMENT_SECRET_KEY=coller_la_PRIVATE_KEY_ici
PAYMENT_TOKEN=coller_le_TOKEN_ici
PAYMENT_MODE=test
PAYMENT_PROVIDER=paydunya
```

## A quoi ressemblent les vraies cles

| Cle | Exemple de forme |
|-----|------------------|
| Master | `wQzk9ZwR-Qq9m-0hD0-zpud-je5coGC3FHKW` (avec **tirets**) |
| Private | souvent commence par `test_private_...` |
| Token | courte chaine alphanumerique |

## Erreurs frequentes

- `PAYMENT_SECRET_KEY=**************************` → **FAUX** (etoiles, pas la vraie cle)
- Master Key = 64 chiffres seulement → **FAUX** pour PayDunya
- Copier la cle **Production** alors que `PAYMENT_MODE=test` → utiliser les cles **TEST**

## Apres collage

```powershell
cd C:\Users\user\Desktop\wazo-digital
node scripts/test-paydunya.mjs
```

Reponse OK : `"response_code": "00"` et une URL `sandbox-checkout`.

## Passer en production (argent reel)

1. Dashboard PayDunya → votre application **wazo-digital**
2. Passer le statut de **Mode test** à **Mode live** (obligatoire — sinon erreur `4001`)
3. Utiliser les cles **Production** dans `.env.local` :
   - `PAYMENT_SECRET_KEY=live_private_...`
   - `PAYMENT_TOKEN=...` (token production)
   - `PAYMENT_API_KEY=` Clé Principale (inchangée)
   - `PAYMENT_MODE=live`
   - `PAYMENT_ALLOW_SIMULATE_FALLBACK=false`
4. Callback PayDunya : `https://app.wazo-digital.com/api/payments/momo/callback?secret=VOTRE_SECRET`

Verifier :

```powershell
node scripts/test-paydunya.mjs
```

Reponse OK : `"response_code": "00"` et une URL de checkout **production**.

Puis envoyer sur Vercel :

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-vercel-payment-live.ps1
```
