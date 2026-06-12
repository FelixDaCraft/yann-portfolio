/**
 * Analytics cookieless — aucune dépendance, ~2KB minifié.
 *
 * Aucun identifiant n'est stocké côté visiteur (le sid sessionStorage vit le
 * temps de l'onglet) : l'unicité est calculée côté serveur via un hash salé
 * journalier. Pas de bandeau cookies nécessaire (exemption CNIL).
 *
 * L'envoi est coupé si : Do Not Track actif, opt-out manuel
 * (localStorage.yt_optout=1), ou navigateur de l'admin (yt_admin=1, posé par
 * le SPA /admin au login). L'observation locale (sections vues, chrono) tourne
 * quand même : getVisitContext() en a besoin pour le formulaire de contact.
 */

type TrackEvent = {
  t: "pageview" | "section" | "click" | "cv" | "leave";
  n?: string;
  v?: number;
  r?: string;
  u?: { s?: string; m?: string; c?: string };
};

const seenSections: string[] = [];
const queue: TrackEvent[] = [];
let flushTimer: number | null = null;
let sid = "";
let sendingEnabled = false;

// Chrono de temps actif : cumule uniquement quand l'onglet est visible.
let activeMs = 0;
let visibleSince: number | null = document.hidden ? null : Date.now();

function activeTotal(): number {
  return activeMs + (visibleSince !== null ? Date.now() - visibleSince : 0);
}

function refHost(): string {
  try {
    if (!document.referrer) return "";
    const host = new URL(document.referrer).hostname;
    return host === location.hostname ? "" : host;
  } catch {
    return "";
  }
}

/** Snapshot local de la visite — utilisé par le formulaire de contact. */
export function getVisitContext(): { sections: string[]; duration: number; referrer: string } {
  return { sections: [...seenSections], duration: activeTotal(), referrer: refHost() };
}

export function getSessionId(): string {
  return sid;
}

function flush(): void {
  if (!sendingEnabled || queue.length === 0) return;
  const payload = JSON.stringify({ s: sid, e: queue.splice(0, 20) });
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!(navigator.sendBeacon?.("/api/event", new Blob([payload], { type: "application/json" })) ?? false)) {
    fetch("/api/event", { method: "POST", body: payload, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  }
}

function push(ev: TrackEvent, immediate = false): void {
  if (!sendingEnabled) return;
  queue.push(ev);
  if (immediate || queue.length >= 5) flush();
  else if (flushTimer === null) flushTimer = window.setTimeout(flush, 10_000);
}

export function initTracking(): void {
  try {
    sid = sessionStorage.getItem("yt_sid") ?? crypto.randomUUID();
    sessionStorage.setItem("yt_sid", sid);
  } catch {
    sid = crypto.randomUUID(); // storage indisponible → session par page
  }

  let optedOut = false;
  try {
    optedOut = localStorage.getItem("yt_optout") === "1" || localStorage.getItem("yt_admin") === "1";
  } catch {
    /* storage bloqué — on track quand même, pas d'identifiant local requis */
  }
  sendingEnabled = navigator.doNotTrack !== "1" && !optedOut;

  // --- Chrono temps actif + leave ---------------------------------------
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (visibleSince !== null) {
        activeMs += Date.now() - visibleSince;
        visibleSince = null;
      }
      push({ t: "leave", v: activeMs }, true);
    } else if (visibleSince === null) {
      visibleSince = Date.now();
    }
  });
  window.addEventListener("pagehide", () => {
    push({ t: "leave", v: activeTotal() }, true);
  });

  // --- Sections vues (1× par page) ---------------------------------------
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const name = el.dataset["track"] ?? el.id;
        if (!name || seenSections.includes(name)) continue;
        seenSections.push(name);
        push({ t: "section", n: name });
        io.unobserve(el);
      }
    },
    { threshold: 0.25 },
  );
  document.querySelectorAll<HTMLElement>("section[id], section[data-track]").forEach((s) => io.observe(s));

  // --- Clics sortants + CV (délégué, flush immédiat : on quitte la page) --
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement).closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    if (a.classList.contains("js-cv")) {
      push({ t: "cv" }, true);
      return;
    }
    const href = a.getAttribute("href") ?? "";
    if (href.startsWith("mailto:")) push({ t: "click", n: "mailto" }, true);
    else if (href.startsWith("tel:")) push({ t: "click", n: "tel" }, true);
    else if (/^https?:\/\//.test(href) && a.hostname !== location.hostname) push({ t: "click", n: a.hostname }, true);
  });

  // --- Pageview ------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const ev: TrackEvent = { t: "pageview", r: refHost() };
  const us = params.get("utm_source");
  const um = params.get("utm_medium");
  const uc = params.get("utm_campaign");
  if (us || um || uc) ev.u = { s: us ?? undefined, m: um ?? undefined, c: uc ?? undefined };
  push(ev, true);
}
