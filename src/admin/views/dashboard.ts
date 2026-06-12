import { api } from "../api";
import type { Stats } from "../api";
import { barChart, topList, funnelChart, esc } from "../charts";

const PERIODS = [7, 30, 90] as const;

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentPeriod(): number {
  const saved = Number(sessionStorage.getItem("yt_period"));
  return PERIODS.includes(saved as never) ? saved : 30;
}

function fmtDuration(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export async function renderDashboard(root: HTMLElement): Promise<void> {
  const days = currentPeriod();
  const to = dayStr(new Date());
  const from = dayStr(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  root.innerHTML = `<p class="empty">Chargement…</p>`;
  const stats = await api<Stats>(`/api/admin/stats?from=${from}&to=${to}`);

  const periodBtns = PERIODS.map(
    (p) => `<button type="button" data-period="${p}" class="${p === days ? "is-active" : ""}">${p}j</button>`,
  ).join("");

  const devices = Object.entries(stats.devices)
    .map(([name, count]) => `${esc(name)} ${count}`)
    .join(" · ");

  root.innerHTML = `
    <div class="dash-toolbar">
      <div class="period-picker" role="group" aria-label="Période">${periodBtns}</div>
      <div class="dash-exports">
        <a href="/api/admin/export/events.csv?from=${from}&to=${to}" download>Export events CSV ↓</a>
        <a href="/api/admin/export/messages.csv" download>Export messages CSV ↓</a>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><span class="kpi-value">${stats.totals.pageviews}</span><span class="kpi-label">Pages vues</span></div>
      <div class="kpi-card"><span class="kpi-value">${stats.totals.uniques}</span><span class="kpi-label">Visiteurs uniques</span></div>
      <div class="kpi-card"><span class="kpi-value">${fmtDuration(stats.avgDurationMs)}</span><span class="kpi-label">Durée moyenne</span></div>
      <div class="kpi-card${stats.totals.unread > 0 ? " kpi-card--alert" : ""}">
        <span class="kpi-value">${stats.totals.messages}<small>${stats.totals.unread > 0 ? ` · ${stats.totals.unread} non lu${stats.totals.unread > 1 ? "s" : ""}` : ""}</small></span>
        <span class="kpi-label"><a href="#/inbox">Messages →</a></span>
      </div>
    </div>

    <section class="panel">
      <h2>Visites par jour <small>${esc(stats.from)} → ${esc(stats.to)} · appareils : ${devices || "—"} · CV : ${stats.totals.cvDownloads} ↓</small></h2>
      ${barChart(stats.daily)}
    </section>

    <section class="panel">
      <h2>Funnel de conversion</h2>
      ${funnelChart(stats.funnel)}
    </section>

    <div class="panel-grid">
      <section class="panel"><h2>Provenance (referrers)</h2>${topList(stats.topReferrers, "Que du trafic direct.")}</section>
      <section class="panel"><h2>Pays</h2>${topList(stats.topCountries)}</section>
      <section class="panel"><h2>Sections les plus vues</h2>${topList(stats.topSections)}</section>
      <section class="panel"><h2>Clics sortants</h2>${topList(stats.topClicks, "Aucun clic sortant.")}</section>
    </div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((btn) =>
    btn.addEventListener("click", () => {
      sessionStorage.setItem("yt_period", btn.dataset["period"]!);
      void renderDashboard(root);
    }),
  );
}
