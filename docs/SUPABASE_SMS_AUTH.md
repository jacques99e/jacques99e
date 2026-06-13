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
2. **Sandbox** (tests API uniquement — voir section « Sandbox bloqué » ci-dessous) :
   - Connexion **sandbox** : [sandbox.africastalking.com](https://sandbox.africastalking.com/login) (pas le dashboard production)
   - Username : `sandbox`
   - API Key : Settings → API Key (attendre ~20 min après création)
   - Simulateur SMS : lien « Launch Simulator » dans le dashboard → [simulator.africastalking.com](https://simulator.africastalking.com:1517)
3. **Production** (vrais SMS sur téléphone au Sénégal) :
   - Activer le compte live sur [account.africastalking.com](https://account.africastalking.com)
   - Demander un **Sender ID** (ex. `WAZO`) pour le Sénégal — délai ~3–7 jours
   - Variables : `AT_USERNAME` (nom du compte live), `AT_API_KEY`, `AT_SENDER_ID`

### Sandbox bloqué — ajout de numéro impossible

Le sandbox **ne vérifie pas votre téléphone par SMS**. Les messages n’arrivent **pas** sur votre mobile : ils s’affichent dans le **simulateur web** (navigateur).

| Problème | Solution |
|----------|----------|
| Page qui demande un SMS de vérification | Vous n’êtes peut‑être pas sur le bon site — utilisez [sandbox.africastalking.com](https://sandbox.africastalking.com/login) |
| Impossible d’ajouter +221… | Essayez un numéro de test fictif : `+254720000111` (format international, sans espaces) |
| Bouton « Add » ne réagit pas | Autre navigateur (Chrome), désactiver bloqueur de pub, vider le cache |
| Erreur de format | Uniquement chiffres après `+` : `+221771234567` (pas `77 123 45 67`) |
| Besoin d’un vrai SMS sur votre téléphone | **Passez en compte live** ou utilisez les options ci‑dessous |

**Tester l’app sans sandbox AT :**

1. **Email** (immédiat) : https://wazo-digital.com/login → `test.owner@wazo.africa` / `TestOwner2026!`
2. **OTP fixe Supabase** (dev) : Auth → Phone → Test OTP → `+221771234567=123456` (un seul numéro, retirer en prod)
3. **Vonage** (déjà configuré) : vérifier les logs Vonage si l’API renvoie une erreur de sender
4. **Compte AT live** : contacter [support Africa's Talking](https://help.africastalking.com) pour activer le Sénégal

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

Lien direct : [Auth → Hooks](https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/auth/hooks)

### Ordre important (à suivre dans cet ordre)

| # | Où | Action |
|---|-----|--------|
| 1 | Supabase → Hooks | **Add hook** → type **Send SMS** |
| 2 | Même page | Activer le toggle **Enable Send SMS hook** |
| 3 | Hook type | Choisir **HTTPS** (pas « Postgres function ») |
| 4 | URL | `https://app.wazo-digital.com/api/auth/send-sms-hook` |
| 5 | Secret | Cliquer **Generate secret** → **copier tout** (`v1,whsec_…`) |
| 6 | Vercel | Ajouter variable `SEND_SMS_HOOK_SECRET` = secret copié |
| 7 | Vercel | **Redéployer** le projet (obligatoire après ajout de variable) |
| 8 | Supabase | Cliquer **Create hook** ou **Save** |

### Vérifier que l’endpoint répond

Après l’étape 7, cette commande doit renvoyer une erreur de **signature** (pas « secret manquant ») :

```bash
curl -X POST https://app.wazo-digital.com/api/auth/send-sms-hook -H "Content-Type: application/json" -d "{}"
```

- `SEND_SMS_HOOK_SECRET manquant` → variable Vercel absente ou pas redéployé
- `Echec traitement hook SMS` / erreur signature → secret OK, requête non signée (normal pour ce test)

### Phone provider (en parallèle)

1. [Authentication → Providers → Phone](https://supabase.com/dashboard/project/gfqmmdihubcpvouidpkc/auth/providers)
2. **Enable Phone provider** : ON
3. **Test OTP** : vide
4. Vonage/Twilio : peut rester vide — le hook remplace l’envoi SMS

### Bloqué sur l’interface Supabase ?

| Symptôme | Solution |
|----------|----------|
| Pas de menu « Hooks » | Menu gauche **Authentication** → onglet **Hooks** (pas Providers) |
| Bouton Save grisé | Remplir l’URL HTTPS + générer le secret |
| Erreur à la création | URL sans espace, commence par `https://` |
| Hook créé mais OTP échoue | Vercel : secret + redéploiement ; logs Auth Supabase |
| Trop compliqué | **Plan B** ci-dessous — sans hook |

### Plan B — sans hook (plus simple)

Si le hook reste bloquant, utilisez **Vonage directement** dans Supabase :

1. Providers → Phone → fournisseur **Vonage**
2. API Key + Secret + From
3. Pas besoin de hook ni de Vercel `SEND_SMS_HOOK_SECRET`

Ou **OTP fixe** (test uniquement) : Test OTP → `+221771234567=123456`

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
