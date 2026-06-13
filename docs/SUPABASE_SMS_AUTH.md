# Authentification SMS — Africa's Talking (recommandé)

Twilio bloque souvent la vérification de compte vers l'Afrique. Vonage peut échouer si le sender n'est pas enregistré pour votre pays.

**Solution recommandée pour Wazo Digital** : **Africa's Talking** via le **Send SMS Hook** de Supabase.  
L'app intègre déjà Africa's Talking pour les SMS métier (`src/lib/sms.ts`). Le hook réutilise le même fournisseur pour les codes OTP de connexion.

---

## Vue d'ensemble

```
Utilisateur → /login → Supabase signInWithOtp
                              ↓
                    Send SMS Hook (HTTP)
                              ↓
         app.wazo-digital.com/api/auth/send-sms-hook
                              ↓
                    Africa's Talking API → SMS OTP
```

Supabase génère le code à 6 chiffres et vérifie le OTP — seul l'**envoi** passe par votre hook.

---

## Étape 1 — Compte Africa's Talking

1. Créer un compte sur [africastalking.com](https://africastalking.com)
2. **Sandbox** (tests) :
   - Username : `sandbox`
   - API Key : dans le dashboard → Settings → API Key
   - Ajouter votre numéro de test dans le sandbox
3. **Production** :
   - Activer le compte live
   - Demander un **Sender ID** (ex. `WAZO`) pour le Sénégal — délai ~3–7 jours
   - Variables : `AT_USERNAME` (nom du compte), `AT_API_KEY`, `AT_SENDER_ID`

---

## Étape 2 — Variables Vercel (projet wazo-digital)

```env
# Fournisseur SMS (auth + métier)
SMS_PROVIDER=africastalking
SMS_SIMULATE=false

AT_API_KEY=votre_cle_api
AT_USERNAME=sandbox
AT_SENDER_ID=

# Secret du hook (copié depuis Supabase → Auth → Hooks)
SEND_SMS_HOOK_SECRET=v1,whsec_xxxxxxxx
```

En sandbox, laissez `AT_SENDER_ID` vide. En production, mettez le Sender ID approuvé.

---

## Étape 3 — Activer le hook dans Supabase

1. [Dashboard Supabase](https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/auth/hooks)
2. **Auth Hooks** → **Send SMS** → Enable
3. **HTTP Endpoint** :

   ```
   https://app.wazo-digital.com/api/auth/send-sms-hook
   ```

4. Générer le **secret** → copier dans Vercel `SEND_SMS_HOOK_SECRET`
5. **Save** puis redéployer Vercel si besoin

### Phone provider

- **Authentication** → **Providers** → **Phone** : activé
- **Test OTP** : vide
- Vous pouvez laisser Vonage/Twilio **désactivé** ou vide — le hook remplace l'envoi intégré

---

## Étape 4 — Tester

1. https://app.wazo-digital.com/login
2. Indicatif **+221** + votre numéro (sandbox : numéro enregistré dans AT)
3. Recevoir : `Votre code Wazo Digital : 123456`

Logs en cas d'échec :

- **Vercel** → Functions → `/api/auth/send-sms-hook`
- **Supabase** → Logs → Auth
- **Africa's Talking** → SMS → Outbox

---

## Alternatives (si Africa's Talking ne convient pas)

| Fournisseur | Intégration Supabase | Afrique | Inscription |
|-------------|---------------------|---------|-------------|
| **Africa's Talking** | Hook HTTP (déjà codé) | Excellente | Facile, pas de blocage Twilio |
| **MessageBird (Bird)** | Natif Supabase | Bonne (sender ID à enregistrer) | [bird.com](https://bird.com) |
| **Vonage** | Natif Supabase | Variable | Déjà configuré — vérifier logs Vonage |
| **Twilio** | Natif Supabase | Vérification compte souvent bloquée | — |

### MessageBird (Bird)

1. Supabase → Phone → **MessageBird**
2. API Key depuis [bird.com](https://bird.com)
3. Pour le Sénégal : demander un **Sender ID alphanumérique** « WAZO » (enregistrement opérateur, quelques jours)

### Connexion sans SMS (déjà disponible)

- **Landing** : email + mot de passe + Google → [wazo-digital.com/login](https://wazo-digital.com/login)
- Compte test : voir `docs/TEST-ACCOUNTS.md`

---

## Dépannage

| Symptôme | Cause | Action |
|----------|-------|--------|
| Erreur 500 hook | `SEND_SMS_HOOK_SECRET` incorrect | Recopier secret Supabase → Vercel |
| AT 401 | Mauvaise API key / username | Sandbox : `username=sandbox` |
| SMS sandbox non reçu | Numéro non ajouté au sandbox AT | Ajouter le numéro dans le dashboard AT |
| Prod : API OK, pas de SMS | Sender ID non approuvé | Demander `WAZO` chez AT |
| Twilio : impossible de vérifier | Restriction géographique | Utiliser Africa's Talking à la place |

---

## Fichiers concernés

- `src/app/api/auth/send-sms-hook/route.ts` — endpoint hook
- `src/lib/sms.ts` — envoi Africa's Talking / Twilio
- `src/app/login/page.tsx` — sélecteur indicatif pays
- `src/hooks/useAuth.ts` — `signInWithOtp` Supabase
