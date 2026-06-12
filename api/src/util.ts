import type { IncomingMessage } from "node:http";

/** IP réelle du client : CF-Connecting-IP (Cloudflare Tunnel) > X-Forwarded-For > socket. */
export function clientIp(req: IncomingMessage): string {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.trim()) return cf.trim();
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "0.0.0.0";
}

/** Pays ISO-3166 fourni par Cloudflare, '??' si absent (dev / accès direct). */
export function country(req: IncomingMessage): string {
  const c = req.headers["cf-ipcountry"];
  return typeof c === "string" && /^[A-Z]{2}$/i.test(c) ? c.toUpperCase() : "??";
}

export function deviceFromUA(ua: string): "mobile" | "desktop" {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop";
}

const parisDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 'YYYY-MM-DD' en Europe/Paris (en-CA donne directement ce format). */
export function dayParis(ts: number): string {
  return parisDay.format(new Date(ts));
}

/** Échappement CSV RFC 4180 + neutralisation des formules (=, +, -, @). */
export function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replaceAll('"', '""') + '"';
  return s;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvEscape).join(",") + "\r\n";
}

/** Tronque une string, retourne null si vide / pas une string. */
export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length > 0 ? t : null;
}
