/**
 * Yann Maillot — portfolio yann.aynn.fr
 * Vite entry point. Imports global CSS + boots interactions.
 */
import "./styles.css";

// ============================================
// 1. Year (footer)
// ============================================
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// ============================================
// 2. Reduce-motion + capability detection
// ============================================
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const fineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// ============================================
// 3. Split each .word into <span class="word-part"> > .glyph
// Empêche le wrap intra-mot tout en gardant la fragmentation lettre-par-lettre.
// ============================================
let glyphIdx = 0;
document.querySelectorAll<HTMLElement>(".word").forEach((wordEl) => {
  const txt = wordEl.textContent ?? "";
  const parts = txt.split(/([\s ]+)/);
  wordEl.innerHTML = parts
    .map((part) => {
      if (!part) return "";
      if (/^[\s ]+$/.test(part)) return " ";
      const inner = [...part]
        .map((ch) => {
          glyphIdx += 1;
          return `<span class="glyph" data-i="${glyphIdx}">${ch}</span>`;
        })
        .join("");
      return `<span class="word-part">${inner}</span>`;
    })
    .join("");
});

// ============================================
// 4. Reveal (IntersectionObserver) + Fragmentation au scroll-exit
// ============================================
if (!reduceMotion) {
  // 1. Add pre-reveal initial state via JS — if JS disabled or skipped,
  //    words stay visible by default (graceful fallback).
  document.querySelectorAll<HTMLElement>(".word").forEach((w) => w.classList.add("pre-reveal"));

  const revealIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          el.classList.remove("pre-reveal");
          el.classList.add("is-visible");
          el.querySelectorAll<HTMLElement>(".glyph").forEach((g, i) => {
            g.style.transitionDelay = `${i * 32}ms`;
          });
          revealIO.unobserve(el);
        }
      });
    },
    { threshold: 0.15 },
  );
  document.querySelectorAll<HTMLElement>(".word.pre-reveal").forEach((w) => revealIO.observe(w));

  // 2. Safety net : if IO somehow never triggers (e.g. fullpage screenshot mode),
  //    force reveal after 1.2s. Words remain visible no matter what.
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>(".word.pre-reveal").forEach((w) => {
      w.classList.remove("pre-reveal");
      w.classList.add("is-visible");
    });
  }, 1200);
  // NOTE : scroll-exit fragmentation désactivée — coût UX trop élevé sur scroll rapide
  // et bug visuel sur SSR / fullpage screenshot. Le reveal initial suffit comme effet.
} else {
  // Reduced motion : skip pre-reveal entirely, words shown as-is.
}

// ============================================
// 5. Magnetic CTA pill (cursor magnétique dans 100px)
// ============================================
if (!reduceMotion && fineHover) {
  const pill = document.querySelector<HTMLElement>(".status-bar");
  if (pill) {
    const RADIUS = 100;
    const STRENGTH = 0.25;
    let raf: number | null = null;

    const onMove = (e: MouseEvent): void => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = pill.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < RADIUS) {
          const pull = (1 - dist / RADIUS) * STRENGTH;
          pill.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
        } else {
          pill.style.transform = "";
        }
      });
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", () => {
      pill.style.transform = "";
    });
  }
}

// ============================================
// 6. Data Layer bar reveal (chapter 02) — animate scaleY when in viewport
// ============================================
if (!reduceMotion) {
  const dvIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          el.dataset["revealed"] = "true";
        } else {
          el.dataset["revealed"] = "false";
        }
      });
    },
    { threshold: 0.25 },
  );
  document.querySelectorAll<HTMLElement>(".dv-stat").forEach((s, i) => {
    s.style.transitionDelay = `${i * 120}ms`;
    dvIO.observe(s);
  });
}

// ============================================
// 7. Sticky Pivot fade-in successive lines (BabyMonitor chapter 05)
// Le wrapper fait 300dvh, le chapter est sticky 100dvh.
// Au scroll dans le wrapper, on révèle progressivement les 3 lignes.
// ============================================
const pivotWrappers = document.querySelectorAll<HTMLElement>(".pivot-wrapper");
pivotWrappers.forEach((wrapper) => {
  const lines = wrapper.querySelectorAll<HTMLElement>(".pivot-line");
  if (lines.length === 0) return;

  // Si reduced-motion : reveal direct
  if (reduceMotion) {
    lines.forEach((l) => l.classList.add("is-revealed"));
    return;
  }

  let ticking = false;
  const updatePivot = (): void => {
    const rect = wrapper.getBoundingClientRect();
    const winH = window.innerHeight;
    const total = Math.max(1, wrapper.offsetHeight - winH);
    const progress = Math.max(0, Math.min(1, -rect.top / total));
    lines.forEach((line, i) => {
      const start = 0.18 + i * 0.22; // 0.18, 0.40, 0.62
      if (progress >= start) line.classList.add("is-revealed");
      else line.classList.remove("is-revealed");
    });
  };

  const onScroll = (): void => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        updatePivot();
        ticking = false;
      });
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", updatePivot, { passive: true });
  updatePivot();
});

// ============================================
// 8. Live clock (status pill — optional, shown only if #live-clock present)
// ============================================
const clockEl = document.getElementById("live-clock");
if (clockEl) {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const tick = (): void => {
    clockEl.textContent = `${fmt.format(new Date())}`;
  };
  tick();
  setInterval(tick, 30_000);
}
