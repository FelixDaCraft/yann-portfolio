// Routes admin : auth (login/logout/me), stats agrégées, inbox messages, exports CSV.

import type { Ctx } from "../server.ts";
import { json, empty, readBody, parseJson, requireAdmin } from "../server.ts";
import { db } from "../db.ts";
import { rateLimit } from "../rate-limit.ts";
import { checkPassword, makeToken, sessionCookie, clearCookie, isAdmin } from "../auth.ts";
import { clientIp, csvLine, dayParis } from "../util.ts";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function handleLogin(ctx: Ctx): Promise<void> {
  const { req, res } = ctx;

  // Rate-limit AVANT toute vérification de mot de passe (anti brute-force).
  const limit = rateLimit(`login:${clientIp(req)}`, { limit: 8, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) {
    json(res, 429, { error: "Trop de tentatives, réessaie plus tard." }, { "Retry-After": String(limit.retryAfterSec) });
    return;
  }

  const raw = await readBody(req, 4 * 1024);
  const body = raw === null ? undefined : parseJson(raw);
  const password = typeof body === "object" && body !== null ? (body as { password?: unknown }).password : undefined;
  if (typeof password !== "string" || password.length === 0) {
    json(res, 400, { error: "Mot de passe requis." });
    return;
  }

  if (!checkPassword(password)) {
    json(res, 401, { error: "Mot de passe incorrect." });
    return;
  }

  empty(res, 204, { "Set-Cookie": sessionCookie(makeToken()) });
}

export function handleLogout(ctx: Ctx): void {
  empty(ctx.res, 204, { "Set-Cookie": clearCookie() });
}

export function handleMe(ctx: Ctx): void {
  if (isAdmin(ctx.req)) empty(ctx.res, 204);
  else json(ctx.res, 401, { error: "Non autorisé" });
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Période demandée, défaut : 30 derniers jours (bornes incluses). */
function period(ctx: Ctx): { from: string; to: string } {
  const q = ctx.url.searchParams;
  const now = Date.now();
  const from = DAY_RE.test(q.get("from") ?? "") ? q.get("from")! : dayParis(now - 29 * 24 * 60 * 60 * 1000);
  const to = DAY_RE.test(q.get("to") ?? "") ? q.get("to")! : dayParis(now);
  return { from, to };
}

/** Bornes epoch (UTC) approximant la période — suffisant pour les messages. */
function periodTs(from: string, to: string): { fromTs: number; toTs: number } {
  return { fromTs: Date.parse(from + "T00:00:00Z") - 2 * 3600_000, toTs: Date.parse(to + "T00:00:00Z") + 26 * 3600_000 };
}

function topQuery(where: string, column: string): string {
  return `
    SELECT ${column} AS name, COUNT(*) AS count FROM events
    WHERE day BETWEEN @from AND @to AND ${where} AND ${column} IS NOT NULL AND ${column} != ''
    GROUP BY ${column} ORDER BY count DESC LIMIT 10
  `;
}

export function handleStats(ctx: Ctx): void {
  if (!requireAdmin(ctx)) return;
  const { from, to } = period(ctx);
  const p = { from, to };

  const daily = db
    .prepare(`
      SELECT day,
             SUM(type = 'pageview') AS pageviews,
             COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor END) AS uniques
      FROM events WHERE day BETWEEN @from AND @to
      GROUP BY day ORDER BY day
    `)
    .all(p);

  const totals = db
    .prepare(`
      SELECT SUM(type = 'pageview') AS pageviews,
             COUNT(DISTINCT CASE WHEN type = 'pageview' THEN visitor END) AS uniques,
             SUM(type = 'cv') AS cvDownloads
      FROM events WHERE day BETWEEN @from AND @to
    `)
    .get(p) as { pageviews: number | null; uniques: number; cvDownloads: number | null };

  const { fromTs, toTs } = periodTs(from, to);
  const messagesCount = db
    .prepare("SELECT COUNT(*) AS n FROM messages WHERE ts >= ? AND ts < ?")
    .get(fromTs, toTs) as { n: number };
  const unread = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE read = 0").get() as { n: number };

  const topReferrers = db.prepare(topQuery("type = 'pageview'", "referrer")).all(p);
  const topCountries = db.prepare(topQuery("type = 'pageview'", "country")).all(p);
  const topSections = db.prepare(topQuery("type = 'section'", "name")).all(p);
  const topClicks = db.prepare(topQuery("type = 'click'", "name")).all(p);

  const devices = db
    .prepare(`
      SELECT device AS name, COUNT(*) AS count FROM events
      WHERE day BETWEEN @from AND @to AND type = 'pageview' GROUP BY device
    `)
    .all(p) as { name: string; count: number }[];

  const avgDuration = db
    .prepare(`
      SELECT AVG(d) AS avg FROM (
        SELECT MAX(value) AS d FROM events
        WHERE day BETWEEN @from AND @to AND type = 'leave' GROUP BY session
      )
    `)
    .get(p) as { avg: number | null };

  // Funnel par session. ⚠️ le hero du site porte l'id 'contact' → exclu de "scrolled".
  const funnel = db
    .prepare(`
      SELECT COUNT(DISTINCT CASE WHEN type = 'pageview' THEN session END) AS visited,
             COUNT(DISTINCT CASE WHEN type = 'section' AND name != 'contact' THEN session END) AS scrolled,
             COUNT(DISTINCT CASE WHEN type IN ('click','cv') THEN session END) AS engaged,
             COUNT(DISTINCT CASE WHEN type IN ('contact_submit','cv') THEN session END) AS converted
      FROM events WHERE day BETWEEN @from AND @to
    `)
    .get(p);

  json(ctx.res, 200, {
    from,
    to,
    daily,
    totals: {
      pageviews: totals.pageviews ?? 0,
      uniques: totals.uniques,
      cvDownloads: totals.cvDownloads ?? 0,
      messages: messagesCount.n,
      unread: unread.n,
    },
    topReferrers,
    topCountries,
    topSections,
    topClicks,
    devices: Object.fromEntries(devices.map((d) => [d.name, d.count])),
    avgDurationMs: avgDuration.avg === null ? null : Math.round(avgDuration.avg),
    funnel,
  });
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------

export function handleMessages(ctx: Ctx): void {
  if (!requireAdmin(ctx)) return;
  const q = ctx.url.searchParams;
  const unreadOnly = q.get("status") === "unread";
  const limit = Math.min(Math.max(Number(q.get("limit") ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(q.get("offset") ?? 0) || 0, 0);

  const where = unreadOnly ? "WHERE read = 0" : "";
  const messages = db
    .prepare(`SELECT * FROM messages ${where} ORDER BY ts DESC LIMIT ? OFFSET ?`)
    .all(limit, offset);
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM messages ${where}`).get() as { n: number }).n;
  const unread = (db.prepare("SELECT COUNT(*) AS n FROM messages WHERE read = 0").get() as { n: number }).n;

  json(ctx.res, 200, { messages, total, unread });
}

export async function handleMessagePatch(ctx: Ctx): Promise<void> {
  if (!requireAdmin(ctx)) return;
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) {
    json(ctx.res, 400, { error: "id invalide" });
    return;
  }
  const raw = await readBody(ctx.req, 1024);
  const body = raw === null ? undefined : parseJson(raw);
  const read = typeof body === "object" && body !== null ? (body as { read?: unknown }).read : undefined;
  if (typeof read !== "boolean") {
    json(ctx.res, 400, { error: "body attendu : {read: boolean}" });
    return;
  }
  const info = db.prepare("UPDATE messages SET read = ? WHERE id = ?").run(read ? 1 : 0, id);
  if (info.changes === 0) json(ctx.res, 404, { error: "message introuvable" });
  else empty(ctx.res, 204);
}

export function handleMessageDelete(ctx: Ctx): void {
  if (!requireAdmin(ctx)) return;
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id)) {
    json(ctx.res, 400, { error: "id invalide" });
    return;
  }
  const info = db.prepare("DELETE FROM messages WHERE id = ?").run(id);
  if (info.changes === 0) json(ctx.res, 404, { error: "message introuvable" });
  else empty(ctx.res, 204);
}

// ---------------------------------------------------------------------------
// Exports CSV
// ---------------------------------------------------------------------------

const EVENT_COLS = ["id", "ts", "day", "type", "visitor", "session", "name", "value", "referrer", "utm_source", "utm_medium", "utm_campaign", "country", "device"] as const;
const MESSAGE_COLS = ["id", "ts", "name", "email", "body", "read", "country", "device", "referrer", "sections", "duration"] as const;

function sendCsv(ctx: Ctx, filename: string, cols: readonly string[], rows: Record<string, unknown>[]): void {
  ctx.res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
  ctx.res.write("﻿" + csvLine([...cols])); // BOM pour Excel
  for (const row of rows) ctx.res.write(csvLine(cols.map((c) => row[c])));
  ctx.res.end();
}

export function handleExportEvents(ctx: Ctx): void {
  if (!requireAdmin(ctx)) return;
  const { from, to } = period(ctx);
  const rows = db
    .prepare("SELECT * FROM events WHERE day BETWEEN ? AND ? ORDER BY ts")
    .all(from, to) as Record<string, unknown>[];
  sendCsv(ctx, `events_${from}_${to}.csv`, EVENT_COLS, rows);
}

export function handleExportMessages(ctx: Ctx): void {
  if (!requireAdmin(ctx)) return;
  const rows = db.prepare("SELECT * FROM messages ORDER BY ts").all() as Record<string, unknown>[];
  sendCsv(ctx, "messages.csv", MESSAGE_COLS, rows);
}
