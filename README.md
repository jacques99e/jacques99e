# Wazo Digital

Plateforme SaaS modulaire mobile-first pour digitaliser les activités en Afrique : commerce, blockchain, agriculture, santé, logistique et éducation. PWA hors ligne avec synchronisation Supabase.

## Modules

| Module | Fonctionnalités |
|--------|-----------------|
| **Commerce** | Produits, caisse, vitrine `/boutique/[slug]`, graphiques |
| **Blockchain** | Tokenisation SHA-256, grand livre, contrats coopératifs, GPS |
| **Agriculture** | Parcelles, intrants, conseils régionaux, météo, rendement |
| **Santé** | Dossiers patients, vitaux, ordonnances PDF, WhatsApp |
| **Logistique** | Tracking, statuts temps réel, signature canvas |
| **Éducation** | Cours, inscriptions, certificats PDF |

## Stack

- Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui
- Supabase (Auth phone OTP, PostgreSQL, Storage, Realtime)
- Dexie.js (IndexedDB offline)
- next-pwa (service worker)

## Installation

```bash
git clone <repo> wazo-digital
cd wazo-digital
npm install
cp .env.example .env.local
```

### Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Activez **Phone** auth + fournisseur SMS.
3. Exécutez dans l’éditeur SQL :
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_modules_platform.sql`
4. Activez **Realtime** sur la table `messages`.

### Lancement

```bash
npm run dev
```

Parcours : `/login` → `/register` (modules) → `/setup` (GPS + slug) → `/dashboard`.

## Navigation (5 onglets)

- **Accueil** — Dashboard widgets par module
- **Module** — Hub du module principal activé
- **Ajouter** — Action rapide (vente, actif, parcelle…)
- **Messages** — Chat Realtime
- **Profil** — Langue, mode sombre, modules, déconnexion

## API internes

| Route | Description |
|-------|-------------|
| `POST /api/payments/momo` | Mobile Money (simulation / PayDunya / CinetPay) |
| `GET/POST /api/blockchain/assets` | Actifs tokenisés |
| `GET /api/agriculture/tips` | Conseils agricoles JSON |
| `GET /api/agriculture/weather` | Météo (mock ou OpenWeatherMap) |
| `POST /api/health/prescriptions` | Ordonnances |
| `GET/POST/PATCH /api/logistics/deliveries` | Livraisons |
| `GET/POST /api/education/courses` | Cours |

## Hooks

- `useAuth()` — OTP, session locale offline
- `useOnlineStatus()` — Connexion réseau
- `useSync()` — File de sync Dexie → Supabase
- `useModule()` — Modules activés par boutique

## Déploiement Vercel

1. Importez le dépôt.
2. Variables = `.env.example`.
3. `NEXT_PUBLIC_APP_URL` = URL production.
4. Domaine vitrine : `wazo.digital` → routes `/boutique/*`.

## PWA

```bash
npm run build && npm start
```

Installez depuis le navigateur. Le bandeau d’installation apparaît si supporté.

## Licence

MIT
