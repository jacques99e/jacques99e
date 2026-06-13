# Authentification SMS — Africa's Talking + hook Supabase

Connexion téléphone sur `app.wazo-digital.com/login` :

1. Supabase génère le code OTP
2. Supabase appelle le **Send SMS Hook** → Vercel
3. Vercel envoie le SMS via **Africa's Talking**

Supabase ne supporte pas Africa's Talking nativement — le hook est **obligatoire**.

---

## Variables Vercel (Production)

Projet **wazo-digital** → Settings → Environment Variables :

```env
# Hook Supabase (secret identique au dashboard Auth → Hooks → Send SMS)
SEND_SMS_HOOK_SECRET=v1,whsec_xxxxxxxx

# Africa's Talking
SMS_PROVIDER=africastalking
SMS_SIMULATE=false
AT_API_KEY=votre_cle_api
AT_USERNAME=sandbox
AT_SENDER_ID=
```

| Variable | Sandbox | Production live |
|----------|---------|-----------------|
| `AT_USERNAME` | `sandbox` | nom de votre app AT |
| `AT_API_KEY` | clé sandbox | clé production |
| `AT_SENDER_ID` | vide | ex. `WAZO` (approuvé ~3–7 j) |
| `SMS_SIMULATE` | `false` pour vrai SMS AT | `false` |

Puis **Redeploy** production.

Diagnostic : `curl https://app.wazo-digital.com/api/auth/send-sms-hook`

Attendu :

```json
{
  "ok": true,
  "hookSecretConfigured": true,
  "smsSimulate": false,
  "smsProvider": "africastalking",
  "smsProviderConfigured": true
}
```

---

## Supabase

### 1. Hook Send SMS (activé)

[Auth → Hooks](https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/auth/hooks)

- **Enable Send SMS hook** : ON
- Type : **HTTPS**
- URL : `https://app.wazo-digital.com/api/auth/send-sms-hook`
- **Generate secret** → copier dans Vercel `SEND_SMS_HOOK_SECRET` → redéployer

Si OTP échoue : **supprimer le hook**, le **recréer**, nouveau secret → Vercel → redéployer.

### 2. Phone provider

[Auth → Providers → Phone](https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/auth/providers)

- **Enable Phone provider** : ON
- Vonage/Twilio : **laisser vide** (le hook envoie via AT)
- **Test OTP** : vide en production

---

## Compte Africa's Talking

### Sandbox (tests API)

1. [sandbox.africastalking.com](https://sandbox.africastalking.com/login)
2. Settings → **API Key** (attendre ~20 min après création)
3. `AT_USERNAME=sandbox`
4. Les SMS **ne partent pas** vers un vrai mobile : simulateur web → [simulator.africastalking.com](https://simulator.africastalking.com:1517)

### Production (vrai SMS au Sénégal)

1. [account.africastalking.com](https://account.africastalking.com) — compte live
2. Demander un **Sender ID** « WAZO » pour le Sénégal
3. `AT_USERNAME` = nom app (pas `sandbox`)
4. `AT_SENDER_ID=WAZO` une fois approuvé

---

## Test connexion

1. https://app.wazo-digital.com/login
2. Indicatif **+221** + numéro sans indicatif
3. SMS : `Votre code Wazo Digital : 123456`

Logs :

- **Vercel** → Functions → `/api/auth/send-sms-hook`
- **Supabase** → Logs → Auth
- **Africa's Talking** → SMS → Outbox

---

## Dépannage

| Symptom | Cause | Action |
|---------|-------|--------|
| Erreur hook / 500 | Secret Supabase ≠ Vercel | Recréer hook + resync secret + redeploy |
| `SMS_SIMULATE=true` | Pas de SMS réel | Mettre `false` sur Vercel |
| AT 401 | Mauvaise clé / username | Sandbox : `username=sandbox` |
| API OK, pas de SMS | Sandbox ou sender non approuvé | Compte live + Sender ID Sénégal |
| Vonage dans Supabase | Conflit | Laisser Vonage vide, hook AT actif |

---

## Fichiers

- `src/app/api/auth/send-sms-hook/route.ts` — hook HTTP
- `src/lib/sms.ts` — envoi Africa's Talking
- `src/app/login/page.tsx` — indicatif pays
