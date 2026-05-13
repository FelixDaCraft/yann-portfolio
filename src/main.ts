/**
 * Yann Maillot — portfolio yann.aynn.fr
 * Vite entry point. Imports global CSS + boots interactions.
 */
import "./styles.css";

// ============================================
// 0. Three-mesh background — lazy loaded via requestIdleCallback
//    pour ne pas plomber le LCP (canvas inséré avant <main>)
// ============================================
const loadMeshWhenIdle = (): void => {
  const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  const doLoad = (): void => {
    import('./three-mesh')
      .then(({ initMesh3D }) => {
        const cleanup = initMesh3D(canvas);
        // Expose cleanup pour éventuel HMR Vite
        if (import.meta.hot) {
          import.meta.hot.dispose(cleanup);
        }
      })
      .catch(() => {
        // WebGL non dispo ou erreur réseau — le canvas reste invisible, pas de crash
      });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(doLoad, { timeout: 3000 });
  } else {
    // Fallback Safari : on attend un tick après le premier paint
    setTimeout(doLoad, 200);
  }
};

// Lance après DOMContentLoaded si le DOM est déjà prêt, sinon attend
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadMeshWhenIdle, { once: true });
} else {
  loadMeshWhenIdle();
}

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
  // Mots visibles par défaut. Le reveal animation peut être ajouté plus tard
  // via CSS @starting-style ou animation-timeline si on veut l'effet.
  // Cette approche garantit que les mots sont TOUJOURS visibles, peu importe
  // l'état de JS ou IntersectionObserver.
  document.querySelectorAll<HTMLElement>(".word").forEach((w) => w.classList.add("is-visible"));
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
// 7a. Scenario chapters (chapter--scenario) — pivot-line reveal sans sticky-wrapper.
// Même mise en forme que BabyMonitor, mais déclenchement par IntersectionObserver direct.
// ============================================
if (!reduceMotion) {
  const scenIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          scenIO.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4, rootMargin: "0px 0px -10% 0px" },
  );
  document
    .querySelectorAll<HTMLElement>(".chapter--scenario .pivot-line")
    .forEach((line) => scenIO.observe(line));
} else {
  document
    .querySelectorAll<HTMLElement>(".chapter--scenario .pivot-line")
    .forEach((line) => line.classList.add("is-revealed"));
}

// ============================================
// 7b. Sticky Pivot fade-in successive lines (BabyMonitor chapter 05)
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
      // Seuils recalibrés pour 200dvh (Frontend reco) — premier reveal à 10%
      const start = 0.10 + i * 0.28; // 0.10, 0.38, 0.66
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
// 8. Cursor follower tag — Active Theory-style "→ voir" on labs hover
// ============================================
if (!reduceMotion && fineHover) {
  const tag = document.querySelector<HTMLElement>(".cursor-tag");
  if (tag) {
    let active = false;
    let raf: number | null = null;
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;
    const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
    const loop = (): void => {
      cx = lerp(cx, tx, 0.18);
      cy = lerp(cy, ty, 0.18);
      tag.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -160%) scale(1)`;
      if (active) raf = requestAnimationFrame(loop);
    };
    document.querySelectorAll<HTMLElement>(".labs-item, [data-cursor='view']").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        active = true;
        tag.classList.add("is-active");
        if (raf === null) raf = requestAnimationFrame(loop);
      });
      el.addEventListener("mouseleave", () => {
        active = false;
        tag.classList.remove("is-active");
        if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      });
      el.addEventListener(
        "mousemove",
        (e) => {
          tx = (e as MouseEvent).clientX;
          ty = (e as MouseEvent).clientY;
        },
        { passive: true },
      );
    });
  }
}

// ============================================
// 9. Live clock (status pill — optional, shown only if #live-clock present)
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
