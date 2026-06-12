/** Graphes SVG/HTML faits main — pas de lib, DA mono/amber du portfolio. */

import type { TopEntry } from "./api";

export function esc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Barres journalières : pageviews (platine) + uniques (ambre) superposés. */
export function barChart(daily: { day: string; pageviews: number; uniques: number }[]): string {
  if (daily.length === 0) return `<p class="empty">Aucune donnée sur la période.</p>`;
  const W = 800;
  const H = 220;
  const PAD = 24;
  const max = Math.max(...daily.map((d) => d.pageviews), 1);
  const slot = (W - PAD * 2) / daily.length;
  const barW = Math.max(2, Math.min(26, slot * 0.6));

  const bars = daily
    .map((d, i) => {
      const x = PAD + i * slot + (slot - barW) / 2;
      const hPv = ((H - PAD * 2) * d.pageviews) / max;
      const hUq = ((H - PAD * 2) * d.uniques) / max;
      const label = `${d.day} · ${d.pageviews} vues · ${d.uniques} uniques`;
      return `
        <g>
          <title>${esc(label)}</title>
          <rect x="${x}" y="${H - PAD - hPv}" width="${barW}" height="${Math.max(hPv, 1)}" fill="var(--platine)" opacity="0.35" />
          <rect x="${x}" y="${H - PAD - hUq}" width="${barW}" height="${Math.max(hUq, 1)}" fill="var(--amber)" />
        </g>`;
    })
    .join("");

  // Étiquettes : premier / milieu / dernier jour
  const labelIdx = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];
  const labels = labelIdx
    .map((i) => {
      const x = PAD + i * slot + slot / 2;
      return `<text x="${x}" y="${H - 6}" text-anchor="middle" class="chart-label">${esc(daily[i]!.day.slice(5))}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visites par jour" preserveAspectRatio="none" class="chart-bars">
      <line x1="${PAD}" y1="${H - PAD}" x2="${W - PAD}" y2="${H - PAD}" stroke="var(--rule-strong)" />
      <text x="${PAD}" y="14" class="chart-label">max ${max}</text>
      ${bars}${labels}
    </svg>
    <div class="chart-legend">
      <span><i style="background: var(--platine); opacity: 0.35"></i> pages vues</span>
      <span><i style="background: var(--amber)"></i> visiteurs uniques</span>
    </div>`;
}

/** Top-N en barres horizontales HTML. */
export function topList(items: TopEntry[], emptyText = "Rien sur la période."): string {
  if (items.length === 0) return `<p class="empty">${esc(emptyText)}</p>`;
  const max = Math.max(...items.map((i) => i.count), 1);
  return `<ul class="top-list">${items
    .map(
      (i) => `
      <li>
        <span class="top-name">${esc(i.name)}</span>
        <span class="top-bar"><i style="width: ${Math.max(2, (100 * i.count) / max)}%"></i></span>
        <span class="top-count">${i.count}</span>
      </li>`,
    )
    .join("")}</ul>`;
}

/** Funnel : 4 étapes en barres horizontales avec % de l'étape 1. */
export function funnelChart(funnel: { visited: number; scrolled: number; engaged: number; converted: number }): string {
  const steps = [
    { label: "Sessions", value: funnel.visited },
    { label: "Ont scrollé", value: funnel.scrolled },
    { label: "Ont cliqué (lien / CV)", value: funnel.engaged },
    { label: "Convertis (message / CV)", value: funnel.converted },
  ];
  const base = Math.max(funnel.visited, 1);
  return `<ul class="funnel">${steps
    .map((s) => {
      const pct = Math.round((100 * s.value) / base);
      return `
      <li>
        <span class="top-name">${esc(s.label)}</span>
        <span class="top-bar top-bar--funnel"><i style="width: ${Math.max(2, pct)}%"></i></span>
        <span class="top-count">${s.value} <small>(${pct}%)</small></span>
      </li>`;
    })
    .join("")}</ul>`;
}
