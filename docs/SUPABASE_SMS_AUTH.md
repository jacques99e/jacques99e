# Authentification SMS réelle (Supabase + Vonage)

La connexion par téléphone sur `app.wazo-digital.com/login` utilise **Supabase Auth** (`signInWithOtp`).  
Les SMS sont envoyés par le **fournisseur configuré dans Supabase** (Vonage en production), pas par le code de l'app.

## 1. Provider Phone dans Supabase (Vonage)

1. [Supabase Dashboard](https://supabase.com/dashboard) → projet **gfqmmdihubcpvouidpkc**
2. **Authentication** → **Providers** → **Phone**
3. Activer **Phone sign-ins**
4. Choisir **Vonage** (anciennement Nexmo)
5. Renseigner :
   - **API Key**
   - **API Secret**
   - **From** (numéro ou Sender ID autorisé par Vonage pour votre pays)

## 2. Désactiver les OTP de test (production)

Dans la même page **Phone** :

- Section **Test OTP** : **vider** tous les numéros de test (ex. `+22890000000 = 123456`)
- Sinon Supabase n'enverra **aucun vrai SMS** pour ces numéros

✅ Fait en production : Test OTP supprimés.

## 3. Vonage — prérequis

1. Compte [Vonage](https://www.vonage.com) avec crédit
2. Numéro ou Sender ID capable d'envoyer vers vos pays cibles (Sénégal, Côte d'Ivoire, etc.)
3. Vérifier les restrictions par pays dans la console Vonage (certains pays exigent un sender local)

## 4. Message SMS (optionnel)

**Authentication** → **SMS Message** — personnaliser le template OTP, ex. :

```
Votre code Wazo Digital : {{ .Code }}
```

## 5. Vérification

1. Ouvrir https://app.wazo-digital.com/login
2. Choisir l'indicatif (ex. **+221** Sénégal)
3. Saisir le numéro **sans** l'indicatif (ex. `77 123 45 67`)
4. Recevoir un **vrai SMS** à 6 chiffres
5. Saisir le code → accès au dashboard

Test API (remplacer les variables) :

```bash
curl -X POST "https://gfqmmdihubcpvouidpkc.supabase.co/auth/v1/otp" \
  -H "apikey: VOTRE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+221771234567"}'
```

Réponse attendue : HTTP **200** et réception SMS sur le téléphone.

## 6. SMS métier (rappels, invitations) — distinct

Les SMS **hors connexion** (formation, livraison, santé) passent par `src/lib/sms.ts` (Twilio dans Vercel).

Variables Vercel sur le projet **wazo-digital** :

```env
SMS_SIMULATE=false
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

Ce canal est **séparé** de Supabase Phone Auth (Vonage).

## Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| Code jamais reçu | Test OTP encore actif dans Supabase |
| Erreur Vonage | API Key / Secret ou sender « From » incorrect |
| Numéro invalide | Mauvais indicatif — utiliser le sélecteur pays sur `/login` |
| SMS bloqué par pays | Sender Vonage non autorisé pour ce pays — vérifier la console Vonage |
| Erreur 429 | Trop de tentatives — attendre avant de renvoyer un code |
