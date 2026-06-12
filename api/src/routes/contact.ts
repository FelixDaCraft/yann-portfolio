// POST /api/contact — formulaire de contact (honeypot + rate-limit + validation).

import type { Ctx } from "../server.ts";
import { json, readBody, parseJson } from "../server.ts";
import { insertMessage, insertEvents, visitorHash } from "../db.ts";
import { rateLimit } from "../rate-limit.ts";
import { clientIp, country, dayParis, deviceFromUA, str } from "../util.ts";

const MAX_BODY = 16 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function handleContact(ctx: Ctx): Promise<void> {
  const { req, res } = ctx;
  const ip = clientIp(req);

  const limit = rateLimit(`contact:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 });
  if (!limit.ok) {
    json(res, 429, { error: "Trop de messages envoyés, réessaie plus tard." }, { "Retry-After": String(limit.retryAfterSec) });
    return;
  }

  const raw = await readBody(req, MAX_BODY);
  if (raw === null) {
    json(res, 413, { error: "Message trop long." });
    return;
  }

  const body = parseJson(raw);
  if (typeof body !== "object" || body === null) {
    json(res, 400, { error: "Requête invalide." });
    return;
  }
  const b = body as Record<string, unknown>;

  // Honeypot : un bot qui remplit le champ caché reçoit un succès factice.
  if (typeof b.website === "string" && b.website.trim() !== "") {
    json(res, 201, { ok: true });
    return;
  }

  const name = str(b.name, 100);
  const email = str(b.email, 200);
  const message = str(b.message, 4000);
  if (!name || !email || !message || !EMAIL_RE.test(email)) {
    json(res, 400, { error: "Nom, email valide et message sont requis." });
    return;
  }

  const session = str(b.s, 64);
  const ctxSnap = typeof b.ctx === "object" && b.ctx !== null ? (b.ctx as Record<string, unknown>) : {};
  const sections = Array.isArray(ctxSnap.sections)
    ? JSON.stringify(ctxSnap.sections.filter((x): x is string => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 80)))
    : null;
  const duration =
    typeof ctxSnap.duration === "number" && Number.isFinite(ctxSnap.duration) && ctxSnap.duration >= 0
      ? Math.round(ctxSnap.duration)
      : null;

  const ua = req.headers["user-agent"] ?? "";
  const now = Date.now();
  const day = dayParis(now);
  const visitor = visitorHash(day, ip, ua);
  const geo = country(req);
  const device = deviceFromUA(ua);

  insertMessage.run({
    ts: now,
    name,
    email,
    body: message,
    session,
    visitor,
    country: geo,
    device,
    referrer: str(ctxSnap.referrer, 100),
    sections,
    duration,
  });

  // Event funnel : conversion de la session.
  if (session) {
    insertEvents([
      {
        ts: now,
        day,
        type: "contact_submit",
        visitor,
        session,
        name: null,
        value: null,
        referrer: null,
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        country: geo,
        device,
      },
    ]);
  }

  json(res, 201, { ok: true });
}
