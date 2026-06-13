# Comptes test — propriétaire & employé

## Création automatique

```bash
cd wazo-digital
node scripts/setup-test-accounts.mjs
```

**Clés requises dans `.env.local` :**

| Variable | Où la trouver (Supabase → Project Settings → API) |
|----------|-----------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé **publishable** (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **secret / service role** (`sb_secret_…`) — **pas** la publishable |

Le script utilise la service role si elle est valide ; sinon il tente un mode anon (signup).  
Si l’e-mail doit être confirmé dans Supabase Auth, le mode anon échoue → utilisez la service role ou désactivez « Confirm email » pour les tests.

## Identifiants (après exécution du script)

| Rôle | E-mail | Mot de passe | Téléphone |
|------|--------|--------------|-----------|
| Propriétaire | `test.owner@wazo.africa` | `TestOwner2026!` | +221770000001 |
| Employé | `test.employee@wazo.africa` | `TestEmployee2026!` | +221770000002 |

Boutique partagée : **Boutique Test Rôles Wazo**

## Scénarios de validation

### Propriétaire

- Accès complet : caisse, stock, analytics, paramètres, équipe.
- Peut inviter / retirer des membres (`/settings/team`).

### Employé

- Voit la boutique dans le sélecteur après connexion.
- **Autorisé** : caisse, clients, produits, analytics (lecture/écriture selon matrice).
- **Refusé** : paramètres boutique, invitation équipe, rapports e-mail.

Matrice détaillée : `src/lib/team-permissions.ts` (`TEAM_PERMISSION_MATRIX`).

## Connexion

1. Landing : https://wazo-digital.com/login  
2. App : https://app.wazo-digital.com/login  

Utilisez l'e-mail ou le téléphone enregistré sur le profil.

## Sécurité

Ces comptes sont réservés aux tests. Ne pas utiliser en production avec de vraies données clients.
