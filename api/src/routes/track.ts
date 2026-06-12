// POST /api/event — ingestion des events du tracker (batch ≤ 20, body ≤ 8KB).
// Répond 204 quoi qu'il arrive (pas d'oracle pour un client malveillant).

import type { Ctx } from "../server.ts";
import { empty, readBody, parseJson } from "../server.ts";
import { insertEvents, visitorHash } from "../db.ts";
import type { EventRow } from "../db.ts";
import { rateLimit } from "../rate-limit.ts";
import { clientIp, country, dayParis, deviceFromUA, str } from "../util.ts";

const TYPES = new Set(["pageview", "section", "click", "cv", "leave"] as const);
const MAX_BATCH = 20;
const MAX_BODY = 8 * 1024;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;

export async function handleEvent(ctx: Ctx): Promise<void> {
  const { req, res } = ctx;
  const raw = await readBody(req, MAX_BODY);
  // 204 systématique : on droppe silencieusement ce qui est invalide/limité.
  empty(res, 204);
  if (raw === null) return;

  const ip = clientIp(req);
  if (!rateLimit(`event:${ip}`, { limit: 120, windowMs: 60 * 1000 }).ok) return;

  const body = parseJson(raw);
  if (typeof body !== "object" || body === null) return;
  const { s, e } = body as { s?: unknown; e?: unknown };
  const session = str(s, 64);
  if (!session || !Array.isArray(e) || e.length === 0) return;

  const ua = req.headers["user-agent"] ?? "";
  const now = Date.now();
  const day = dayParis(now);
  const base = {
    ts: now,
    day,
    visitor: visitorHash(day, ip, ua),
    session,
    country: country(req),
    device: deviceFromUA(ua),
  };

  const rows: EventRow[] = [];
  for (const item of e.slice(0, MAX_BATCH)) {
    if (typeof item !== "object" || item === null) continue;
    const ev = item as { t?: unknown; n?: unknown; v?: unknown; r?: unknown; u?: unknown };
    const type = typeof ev.t === "string" && TYPES.has(ev.t as never) ? (ev.t as EventRow["type"]) : null;
    if (!type) continue;

    let value: number | null = null;
    if (type === "leave") {
      if (typeof ev.v !== "number" || !Number.isFinite(ev.v) || ev.v < 0) continue;
      value = Math.min(Math.round(ev.v), MAX_DURATION_MS);
    }

    const utm = typeof ev.u === "object" && ev.u !== null ? (ev.u as { s?: unknown; m?: unknown; c?: unknown }) : null;
    rows.push({
      ...base,
      type,
      name: str(ev.n, 80),
      value,
      referrer: type === "pageview" ? str(ev.r, 100) : null,
      utm_source: type === "pageview" && utm ? str(utm.s, 60) : null,
      utm_medium: type === "pageview" && utm ? str(utm.m, 60) : null,
      utm_campaign: type === "pageview" && utm ? str(utm.c, 60) : null,
    });
  }

  if (rows.length > 0) insertEvents(rows);
}
