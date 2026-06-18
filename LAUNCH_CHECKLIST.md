# Checklist lancement Wazo Digital v1.0.0

## Avant d'inviter le public

- [x] `/api/health` landing + app → `ok: true`
- [x] Tests E2E prod : `npm run test:e2e:production` (47/47)
- [x] Inscription : https://wazo-digital.com/register
- [x] Création boutique `/setup` sans erreur FK
- [x] Guide pilote partagé : https://wazo-digital.com/guide-pilote

## Parcours commerçant (15 min)

- [ ] Ajouter 1 produit (+ photo si en ligne)
- [ ] 1 vente à la caisse + reçu WhatsApp
- [ ] Partager catalogue WhatsApp depuis Produits
- [ ] Installer PWA sur téléphone + test hors ligne (caisse)
- [ ] Sync cloud : Paramètres → Notifications

## Modules optionnels (1 action chacun)

- [ ] Logistique : créer livraison + suivi public
- [ ] Santé : patient + rendez-vous
- [ ] Formation : cours + module
- [ ] Agriculture : parcelle + journal
- [ ] Blockchain : actif + QR

## Communication pilotes

- [ ] Envoyer message WhatsApp (bouton sur `/guide-pilote`)
- [x] 3–5 commerçants testeurs identifiés (profils type pilot-2…5 + Balade active)
- [x] Numéro support WhatsApp actif (+228 93 92 40 40 — guide & footer)

## Technique post-lancement

- [x] GitHub Action `Monitor production` verte (toutes les 6 h)
- [x] `node scripts/monitor-production.mjs` en local si alerte
- [x] Secrets GitHub : `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD` (compte test)
- [x] Secrets GitHub : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (E2E CI)
- [ ] Optionnel : `MONITOR_WEBHOOK_URL` (Slack / Discord)
- [x] Vercel : `CRON_SECRET`, VAPID, Resend configurés (`npm run audit:vercel`)

## Comptes test (ne pas supprimer en prod)

| Rôle | Email | Usage |
|------|-------|--------|
| Owner | test.owner@wazo.africa | E2E + monitoring |
| Employé | test.employee@wazo.africa | Tests rôles |

Boutique test : `boutique-test-roles-wazo`

## Tag release

```bash
git tag -a v1.0.0 -m "Wazo Digital 1.0.0 — lancement public"
git push origin v1.0.0
```

---

**Version déployée app :** voir `GET https://app.wazo-digital.com/api/health` → champ `version`

---

## Phase 2 — Semaine 1 (pilotes)

- [ ] `npm run pilot:outreach` → envoyer message **invitation** à 3–5 commerçants
- [x] `npm run launch:stats` (app) → suivre inscriptions / boutiques / produits
- [ ] J+3 : message **relance** aux pilotes sans produit
- [ ] J+7 : message **merci** + collecter retours (note /10)
- [x] Configurer secrets GitHub pour CI monitor :
  - `E2E_OWNER_EMAIL` = test.owner@wazo.africa
  - `E2E_OWNER_PASSWORD` = (mot de passe test)
  - `MONITOR_WEBHOOK_URL` (optionnel)
- [ ] Remplacer profils type pilot-2…5 par vrais contacts (`pilot:tracker add`)
- [ ] Relance **Balade Estivale** : 1ère vente caisse (`pilot:tracker relance`)

## Phase 3 — Croissance (mois 1)

- [ ] Google Search Console : `npm run launch:gsc` (Landing) puis balise Vercel
- [x] IndexNow + sitemap soumis (cron `/api/cron/submit-indexing` — 11 URLs)
- [ ] 1 post réseaux : `npm run launch:social register` ou `pilote`
- [ ] Premier client payant (upgrade Pro via MoMo)
- [ ] `npm run audit:cloud` hebdomadaire sur boutiques pilotes
