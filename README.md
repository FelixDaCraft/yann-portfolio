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
├── src/
│   ├── main.ts          # JS interactions (reveal, frag, pivot, magnetic)
│   └── styles.css       # cascade layers complet
├── public/              # assets statiques (yann.jpg, favicon, robots)
├── Dockerfile           # multi-stage Node builder → nginx runner
├── docker-compose.yml   # bind 127.0.0.1:3019 (Cloudflare Tunnel friendly)
├── nginx.conf           # cache headers + security headers
└── vite.config.ts
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
