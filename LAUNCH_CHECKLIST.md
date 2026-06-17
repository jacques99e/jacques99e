# Checklist lancement Wazo Digital v1.0.0

## Avant d'inviter le public

- [ ] `/api/health` landing + app → `ok: true`
- [ ] Tests E2E prod : `npm run test:e2e:production` (47/47)
- [ ] Inscription : https://wazo-digital.com/register
- [ ] Création boutique `/setup` sans erreur FK
- [ ] Guide pilote partagé : https://wazo-digital.com/guide-pilote

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
- [ ] 3–5 commerçants testeurs identifiés
- [ ] Numéro support WhatsApp actif

## Technique post-lancement

- [ ] GitHub Action `Monitor production` verte (toutes les 6 h)
- [ ] `node scripts/monitor-production.mjs` en local si alerte
- [ ] Secrets GitHub : `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD` (compte test)
- [ ] Optionnel : `MONITOR_WEBHOOK_URL` (Slack / Discord)

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
