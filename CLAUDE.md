# Yann Maillot — Portfolio (`yann.aynn.fr`)

## Contexte

Portfolio personnel de **Yann Maillot**, freelance fullstack JS/Next.js à
Nantes. Cible : CTOs, founders de scale-ups, agences digitales. Objectif :
qu'un recruteur dise "waouw je l'embauche" en 60 secondes, **sans bullshit**
(claims fakes virés en cours de route).

- **GitHub** : [`FelixDaCraft/yann-portfolio`](https://github.com/FelixDaCraft/yann-portfolio) (public)
- **Live** : `https://yann.aynn.fr` (via Cloudflare Tunnel + nginx Docker sur homelab)
- **Container** : `127.0.0.1:3019` sur homelab `192.168.1.122`
- **Deploy** : `ssh root@192.168.1.122 "bash /opt/yann-portfolio/deploy.sh"`

## Stack

| | |
| --- | --- |
| Build | Vite 8 (`vite build` → `/dist`) |
| Langage | TypeScript 6 (strict + `noUncheckedIndexedAccess`) |
| Styling | CSS natif (`@layer reset, base, layout, components, sections, animations, motion`) |
| Typo | Fraunces variable (axes `wght`/`opsz`/`SOFT`/`WONK`) + JetBrains Mono |
| 3D | OGL 1.0.11 (lazy-loaded chunk ~15kB gz) |
| Hosting | nginx alpine · Docker · Cloudflare Tunnel |
| Bundle | HTML ~22kB · CSS ~25kB · JS main ~6kB · JS mesh ~15kB (tous gzipped) |

## Pourquoi pas Astro / Next / Tailwind

- **Astro abandonné** (user le voulait pas)
- **Tailwind interdit** (user : "ça fait trop IA")
- **Vite + CSS natif** : maximum custom, minimum dépendances

## Sections (dans l'ordre)

```
01  LET'S BUILD.        Header — photo + contact + tagline freelance fullstack
02  MISSION.            Manifesto + modalités (format, capacité, tarif, démarrage)
03  4 EN PROD.          Data Layer — 4 stats (CupMetrics, BabyMonitor, Ringdo, Cabinet Psy)
04  CUPMETRICS.         Case study sticky pivot 200dvh — SaaS multi-tenant événementiel
05  BABYMONITOR.        Case study sticky pivot 200dvh — PWA self-hostée + reverse V308
06  RINGDO.             Case study sticky pivot 200dvh — App Android + Mistral STT
07  CABINET PSYCHOLOGUE. Case study sticky pivot 200dvh — Site client Magalie Kerveadou
08  10 ANS DE CRAFT.    Timeline parcours (Formations 2016-18 → Stages 19-21 → Accenture 22-23 → Asso 22-now → Freelance 23-now)
∎   ON SE PARLE.        CTA Cal.com primary + Email ghost + Tel ghost
```

**Nav fixed top-right** : `Hire · Mission · Output · Projets · Parcours · Contact`

## Composants signature

- **Header LET'S BUILD** : grid 2 colonnes (portrait gauche + contact droit) en
  desktop, stack en mobile. Photo N&B avec color-reveal au hover.
- **Sticky pivot** (chapter--pivot dans .pivot-wrapper) : wrapper 200dvh,
  chapter sticky 100dvh, 3 pivot-lines révélées progressivement au scroll
  (clip-path inset, Hello Monday style). **Désactivé sur mobile** (8 viewports
  de scroll = UX impossible) → reveal immédiat.
- **Logos chips** : `cdn.simpleicons.org/{name}/c0c0c8` pour chaque tech de la
  stack des projets (Next.js, tRPC, Drizzle, Postgres, Stripe, Three.js, etc.).
- **Mini-EKG heartbeat** : 3 barres animées en sauge (signature) — virée à la
  demande du user, remplacée par nav anchors purs.
- **Background mesh 3D** : terrain wireframe triangulé en perspective rasante
  (OGL). 2 vagues directionnelles dominantes + harmonique. Lighting per-vertex
  (sommets brillent), fog au lointain. Lazy-loaded.

## Vrais projets (vérifiés, pas hallucinés)

| Projet | URL | Stack | Statut |
| --- | --- | --- | --- |
| **CupMetrics** | `platinum.aynn.fr` (fork single-tenant en prod) | Next.js 15, tRPC, Drizzle, Postgres, Better Auth, Stripe Connect, Three.js R3F | SaaS multi-tenant événementiel, anonymisation des produits jugés |
| **BabyMonitor** | `baby.aynn.fr` | Python, YAMNet TFLite, Node Express, go2rtc, better-sqlite3, Web Push, ntfy, Docker, Traefik | PWA self-hostée + reverse V308 (AES-128-ECB, TCP:8800) + détection ML pleurs |
| **Ringdo** | `ringdo.aynn.fr` | Android natif (Java), Node API, Postgres, Mistral STT + LLM | App Android uploader d'appels + transcription/journalisation IA |
| **Cabinet Psychologue** | `magalie-kerveadou.fr` | Next.js, React, TS, Prisma, Tailwind, Docker | Site client pour Magalie Kerveadou, psychologue enfants/ados Milizac (Finistère) |

**Repos GitHub publics réels** (5 total) :
- `yann-portfolio` (ce projet)
- `v308-rtsp-hack` (Python, reverse camera IP)
- `cannagri-expo` (TypeScript, site salon CBD)
- `CLInterface` (HTML)
- `strainfinderz` (JS)

**Hallucinations corrigées en cours de route** :
- ❌ `gimp-mcp` et `sketchup-mcp` — n'existent PAS sur GitHub de Yann
- ❌ "uptime 99.97%" / "100%" — chiffres fakes virés
- ❌ "Stripe Connect live" → "intégré" (statut commercial TBD)
- ❌ "14 juin" date inventée → "À discuter"
- ❌ "600-700 €/j" → "À discuter" (TJM non confirmé)
- ❌ "OpenAI Whisper + Claude API" sur Ringdo → c'est Mistral (STT + journalisation)

## Parcours réel (depuis Profile.pdf LinkedIn)

| Période | Étape |
| --- | --- |
| 2016 – 2017 | IPI Institut Poly Informatique (cycle prépa info) |
| 2017 | Le 101 — Piscine (école type 42) |
| 2017 – 2018 | Simplon.co — Développement web |
| 2019 | SQLI — Dev Java/Java EE (Banque Postale, 5 mois) |
| 2020 | 420 Green Road S.r.l — Dev web Prestashop (3 mois) |
| 2020 | Yunow / biinlab — Dev Symfony (2 mois) |
| 2021 | Agence Francecom — Dev Full Stack (2 mois) |
| 2022 | WebForce3 — Formation Salesforce (mars-mai) |
| 2022 – 2023 | **Accenture France — Salesforce Developer (1 an 3 mois)** |
| **2022 → now** | **Co-fondateur Platinum CBD (asso loi 1901, organisatrice Cann'Agri Expo + Platinum CBD Cup)** |
| **2023 → now** | **Freelance fullstack Next.js / Node / Postgres** |

## Décisions de design (méta)

- **Concept choisi** : "Type Explosion" (validé après brainstorm 6 agents).
- **Direction artistique** : "Craftsman souverain / Alchimiste-Opérateur" (mot
  signature : **OPÉRATEUR**).
- **Palette** : bg `#0a0a0e` · ink `#ededf0` · platine `#c0c0c8` · sauge
  `#7ea992` · amber `#d4a853` (rare, pour métriques/dates).
- **Photo** : N&B luminosity → couleur normale au hover (color-reveal).
- **Voix** : factuelle + un touch perso ("Vibe coding between terpenes &
  commits" virée à la demande user, mais reste sa signature GitHub bio).
- **CBD assumé mais discret** : mentions dans Path (asso) + un case study
  (Cabinet Psy) + un repo Labs vu (cannagri-expo). Pas un thème.

## TODO Yann (placeholders amber à valider)

- [ ] **TJM réel** (actuellement `À discuter` dans pill + Mission + closing)
- [ ] **Date dispo** (slot calendrier réel)
- [ ] **Cal.com URL** (vérifier `cal.com/yannmaillot/30min` existe)
- [ ] **Status page publique** (UptimeRobot/BetterStack) pour métriques live vérifiables
- [ ] **Route Cloudflare Tunnel** : CNAME `yann → aa7c83ec-d8ab-40e4-b15c-5edf5cf7c371.cfargotunnel.com` (proxied) — config sur /etc/cloudflared/config.yml côté homelab faite, manque juste le DNS record sur dash.cloudflare.com.

## Commandes courantes

```powershell
# Dev local
Set-Location 'C:\Users\El Daron\Dev\yann-landing'
pnpm dev          # http://localhost:4322

# Build + preview
pnpm build
pnpm preview --host --port 4322

# Type-check
pnpm typecheck

# Deploy (homelab)
git push origin main
ssh -i $env:USERPROFILE\.ssh\id_ed25519 root@192.168.1.122 "bash /opt/yann-portfolio/deploy.sh"
```

## Conventions commits

- **JAMAIS** de `Co-Authored-By: Claude` ni `🤖 Generated with Claude Code`
  dans les messages de commit (instruction utilisateur explicite).
- Format : `feat(scope): description` ou `fix(scope): description`.
