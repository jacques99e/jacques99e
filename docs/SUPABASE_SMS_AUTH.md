# SMS transactionnels — Africa's Talking

> **Auth par SMS abandonnée** (juin 2026). La connexion se fait uniquement par **email/mot de passe** ou **Google** sur [wazo-digital.com/login](https://wazo-digital.com/login).  
> `app.wazo-digital.com/login` redirige vers la vitrine. Désactivez **Supabase → Auth → Providers → Phone** et le hook **Send SMS** si encore actifs.

Ce document couvre les **SMS métier** de l'application (rappels logistique, invitations éducation, etc.), pas l'authentification.

---

## Variables Vercel (Production)

Projet **wazo-digital** → Settings → Environment Variables :

```env
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
| `SMS_SIMULATE` | `true` pour tests sans envoi | `false` en prod |

Puis **Redeploy** production.

Diagnostic : `curl https://app.wazo-digital.com/api/sms/status`

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

## Routes API concernées

| Route | Usage |
|-------|--------|
| `/api/logistics/notify-sms` | Notification livraison |
| `/api/education/invite-sms` | Invitation cours |
| `/api/health/appointments/remind-sms` | Rappel RDV |
| `/api/sms/status` | Diagnostic provider |

Implémentation centrale : `src/lib/sms.ts`.

---

## Dépannage

| Symptom | Cause | Action |
|---------|-------|--------|
| `SMS_SIMULATE=true` | Pas de SMS réel | Mettre `false` sur Vercel |
| AT 401 | Mauvaise clé / username | Sandbox : `username=sandbox` |
| API OK, pas de SMS | Sandbox ou sender non approuvé | Compte live + Sender ID Sénégal |

---

## Ancien hook auth (obsolète)

Le fichier `src/app/api/auth/send-sms-hook/route.ts` servait au **Send SMS Hook** Supabase pour l'OTP téléphone. Il n'est plus utilisé depuis l'abandon de l'auth SMS. Vous pouvez le laisser en place ou le supprimer ; désactivez le hook dans Supabase Auth dans tous les cas.
