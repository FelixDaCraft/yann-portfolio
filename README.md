# yann-portfolio

Portfolio personnel — **[yann.aynn.fr](https://yann.aynn.fr)**.

Site statique, sans framework UI : **Vite + TypeScript + CSS natif** (cascade
layers, scroll-driven animations, font-variation-settings). Servi par
`nginx:alpine` derrière un **Cloudflare Tunnel** sur mon homelab.

## Stack

| Domaine | Choix |
| --- | --- |
| Build | Vite 8 (`vite build` → `/dist`) |
| Langage | TypeScript 6 (strict + `noUncheckedIndexedAccess`) |
| Styling | CSS natif (`@layer reset, base, layout, components, sections, animations, motion`) |
| Typo | Fraunces variable (axes `wght` · `opsz` · `SOFT` · `WONK`) + JetBrains Mono |
| Anims | IntersectionObserver + scroll-driven `animation-timeline` + CSS transitions |
| Hosting | nginx alpine · Docker · Cloudflare Tunnel |

## Dev

```bash
pnpm install
pnpm dev          # http://localhost:4321
pnpm build        # → dist/
pnpm preview      # serve dist/ locally
pnpm typecheck    # tsc --noEmit
```

## Structure

```
.
├── index.html           # entry — toutes les sections inline
├── admin.html           # entry backoffice (/admin, noindex)
├── src/
│   ├── main.ts          # JS interactions (reveal, frag, pivot, magnetic)
│   ├── track.ts         # analytics cookieless (~2KB, sendBeacon)
│   ├── tokens.css       # design tokens partagés site + admin
│   ├── styles.css       # cascade layers complet
│   └── admin/           # SPA backoffice (hash-router, graphes SVG maison)
├── api/                 # yann-api — Node 24 (TS natif) + better-sqlite3
│   └── src/             # server, db, auth HMAC, rate-limit, routes
├── public/              # assets statiques (yann.jpg, favicon, robots, CV pdf)
├── Dockerfile           # multi-stage Node builder → nginx runner
├── docker-compose.yml   # yann-portfolio (127.0.0.1:3019) + yann-api (interne)
├── nginx.conf           # cache + security headers + CSP + proxy /api → yann-api
└── vite.config.ts       # multi-entry (index + admin) + proxy dev /api
```

## Backoffice (`/admin`)

Analytics cookieless + inbox du formulaire de contact + santé des liens.
API : conteneur `yann-api` (Node 24 exécute le TypeScript nativement, une
seule dépendance : `better-sqlite3`), jamais exposé — nginx proxifie `/api/`
sur le réseau compose interne.

- **Dashboard** : pages vues / visiteurs uniques / durée moyenne par jour,
  funnel (visite → scroll → clic → conversion), top referrers / pays /
  sections / clics sortants, téléchargements CV, exports CSV.
- **Inbox** : messages du formulaire avec contexte de visite (sections vues,
  durée, provenance, pays, device), lu/non-lu, suppression.
- **Liens** : vérification HEAD de tous les liens externes du site déployé.
- **Auth** : mot de passe → cookie HMAC-SHA256 signé (TTL 12h), timing-safe,
  rate-limit 8 tentatives/15min, fail-closed si secrets absents en prod.

### Dev local

```bash
# Terminal 1 — API (SQLite ./api/yann.db, ADMIN_PASSWORD libre en dev)
cd api && npm install && ADMIN_PASSWORD=dev npm run dev   # :3000

# Terminal 2 — site + admin (proxy /api → :3000)
pnpm dev          # http://localhost:4321 et http://localhost:4321/admin
```

### Secrets prod

`/opt/yann-portfolio/.env` (hors Git, requis par `deploy.sh`) :

```bash
printf 'ADMIN_PASSWORD=...\nSESSION_SECRET=%s\n' "$(openssl rand -hex 32)" > /opt/yann-portfolio/.env
```

### RGPD — pourquoi pas de bandeau cookies

La mesure d'audience est exemptée de consentement (CNIL) parce que :
aucun cookie ni identifiant n'est stocké chez le visiteur (le `sessionStorage`
vit le temps de l'onglet) ; l'identifiant d'unicité est un hash
`SHA256(sel_du_jour + IP + UA)` calculé côté serveur, l'IP n'est jamais
stockée ; le sel est détruit à J+2, ce qui rend les hash définitivement
non ré-identifiables ; aucun suivi cross-site ni cross-day ; les events bruts
sont purgés à 13 mois. `navigator.doNotTrack` est respecté, opt-out manuel
via `localStorage.yt_optout = "1"`.

### Backup de la base

```bash
ssh -i ~/.ssh/id_ed25519 root@192.168.1.122 \
  "docker exec yann-api node -e \"require('better-sqlite3')('/data/yann.db').exec('VACUUM INTO \\'/data/backup.db\\'')\" && \
   docker cp yann-api:/data/backup.db /root/yann-backup.db && docker exec yann-api rm /data/backup.db"
```

## Sections

Le portfolio est une scroll-narrative en **9 chapitres + 2 respirations 50vh** :

| # | Chapitre | Composition |
| --- | --- | --- |
| 01 | Identité — `FREELANCE FULLSTACK.` | Negative Space |
| 02 | Output — `3 EN PROD.` | Data Layer (mot + grille de stats animées) |
| 03 | Manifesto · Modalités — `MISSION.` | Manifeste + grille de termes |
| — | Respiration A | Astérisme `⁂` + phrase italique |
| 04 | Case 01 — `CUPMETRICS.` | Project meta classique |
| 05 | Case 02 — `BABYMONITOR.` (mot pivot) | Sticky pin 300dvh, lignes fade-in successif |
| 06 | Case 03 — `PLATINUM CUP.` | Project meta classique |
| — | Respiration B | Pull-quote `3 produits · 0 downtime · 1 dev.` |
| 07 | Path — `ACCENTURE → CREW.` | Timeline Table mono |
| 08 | Labs — `LABS.` | Grille de side-projects + signature |
| 09 | Hire — `LET'S BUILD.` | Contact + portrait color-reveal au hover |

## Déploiement (homelab via Cloudflare Tunnel)

Pattern identique à `platinum-cbd-cup` — bind sur `127.0.0.1:3019`, routé par
le tunnel Cloudflare qui tourne sur l'hôte homelab.

### Première installation sur le homelab

```bash
ssh -i ~/.ssh/id_ed25519 root@192.168.1.122
mkdir -p /opt/yann-portfolio
exit

# Depuis Windows
scp -r -i ~/.ssh/id_ed25519 . root@192.168.1.122:/opt/yann-portfolio/

ssh -i ~/.ssh/id_ed25519 root@192.168.1.122 \
  "cd /opt/yann-portfolio && docker compose up -d --build"
```

Puis dans le dashboard **Cloudflare Zero Trust → Networks → Tunnels** :
ajouter un Public Hostname `yann.aynn.fr` → `http://localhost:3019`. Le cert
TLS est provisionné automatiquement.

### Updates

```bash
ssh -i ~/.ssh/id_ed25519 root@192.168.1.122 \
  "cd /opt/yann-portfolio && git pull && docker compose up -d --build"
```

## Performances

Lighthouse-friendly par construction :

- HTML : ~16 kB · CSS : ~15 kB · JS : ~4 kB (tous gzipped)
- Aucune librairie UI (pas de React, pas de Tailwind)
- Variable font subsetée à `opsz 72-144` + `display=optional`
- Grain pulse en `opacity` seulement (pas de transform animé)
- `will-change` posé/retiré dynamiquement par les observers
- `prefers-reduced-motion` respecté partout

## Licence

Code source perso — usage libre pour s'en inspirer, mais le contenu et le
nom restent ceux de Yann Maillot.
