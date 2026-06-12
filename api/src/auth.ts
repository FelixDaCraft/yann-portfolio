// Session admin par cookie HMAC signé — porté de sky-sitter lib/auth.ts.
// Token : base64url("admin.<ts>.<nonce>") + "." + HMAC-SHA256(payload, SESSION_SECRET)

import crypto from "node:crypto";
import type { IncomingMessage } from "node:http";

export const ADMIN_COOKIE = "yt_admin";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

const DEV_SECRET_FALLBACK = "dev-only-secret-do-not-use-in-production";
const IS_PROD = process.env.NODE_ENV === "production";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (IS_PROD) {
    if (!s || s.length < 32 || s === DEV_SECRET_FALLBACK) {
      throw new Error("SESSION_SECRET manquant ou trop faible en production");
    }
    return s;
  }
  return s && s.length > 0 ? s : DEV_SECRET_FALLBACK;
}

/** Fail-closed : crash au boot plutôt qu'un admin sans mot de passe en prod. */
export function assertAuthConfig(): void {
  secret();
  if (IS_PROD && !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD manquant en production");
  }
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    crypto.timingSafeEqual(ab, ab); // timing constant même sur mismatch de longueur
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function makeToken(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const payload = `admin.${Date.now()}.${nonce}`;
  const b64 = Buffer.from(payload).toString("base64url");
  return `${b64}.${sign(payload)}`;
}

export function verifyToken(token?: string | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const b64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString();
  } catch {
    return false;
  }
  if (!safeEqual(sig, sign(payload))) return false;
  const ts = Number(payload.split(".")[1]);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < SESSION_TTL_MS;
}

export function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export function isAdmin(req: IncomingMessage): boolean {
  return verifyToken(readCookie(req, ADMIN_COOKIE));
}

export function sessionCookie(token: string): string {
  const secure = IS_PROD ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function clearCookie(): string {
  return `${ADMIN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
