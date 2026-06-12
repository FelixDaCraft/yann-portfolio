import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAuthConfig, isAdmin } from "./auth.ts";
import { handleEvent } from "./routes/track.ts";
import { handleContact } from "./routes/contact.ts";
import {
  handleLogin,
  handleLogout,
  handleMe,
  handleStats,
  handleMessages,
  handleMessagePatch,
  handleMessageDelete,
  handleExportEvents,
  handleExportMessages,
} from "./routes/admin.ts";
import { handleLinkcheck } from "./routes/linkcheck.ts";

assertAuthConfig(); // fail-closed : exit si secrets manquants en prod

export type Ctx = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
};

export type Handler = (ctx: Ctx) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Helpers réponse / body
// ---------------------------------------------------------------------------

export function json(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
}

export function empty(res: ServerResponse, status: number, headers: Record<string, string> = {}): void {
  res.writeHead(status, headers);
  res.end();
}

/** Lit le body en streamant, coupe net au-delà de maxBytes (retourne null → 413). */
export function readBody(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.removeAllListeners("data");
        req.removeAllListeners("end");
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Garde des routes admin : 401 si cookie absent/invalide/expiré. */
export function requireAdmin(ctx: Ctx): boolean {
  if (isAdmin(ctx.req)) return true;
  json(ctx.res, 401, { error: "Non autorisé" });
  return false;
}

// ---------------------------------------------------------------------------
// Router minimaliste (segments exacts + ':param')
// ---------------------------------------------------------------------------

type Route = { method: string; segments: string[]; handler: Handler };

const routes: Route[] = [];

function route(method: string, path: string, handler: Handler): void {
  routes.push({ method, segments: path.split("/").filter(Boolean), handler });
}

function match(method: string, pathname: string): { handler: Handler; params: Record<string, string> } | null {
  const parts = pathname.split("/").filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const seg = r.segments[i]!;
      const part = parts[i]!;
      if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(part);
      else if (seg !== part) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

route("GET", "/api/health", ({ res }) => json(res, 200, { ok: true }));
route("POST", "/api/event", handleEvent);
route("POST", "/api/contact", handleContact);
route("POST", "/api/admin/login", handleLogin);
route("POST", "/api/admin/logout", handleLogout);
route("GET", "/api/admin/me", handleMe);
route("GET", "/api/admin/stats", handleStats);
route("GET", "/api/admin/messages", handleMessages);
route("PATCH", "/api/admin/messages/:id", handleMessagePatch);
route("DELETE", "/api/admin/messages/:id", handleMessageDelete);
route("GET", "/api/admin/export/events.csv", handleExportEvents);
route("GET", "/api/admin/export/messages.csv", handleExportMessages);
route("POST", "/api/admin/linkcheck", handleLinkcheck);

// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT ?? 3000);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const found = match(req.method ?? "GET", url.pathname);
  if (!found) {
    json(res, 404, { error: "Not found" });
    return;
  }
  try {
    await found.handler({ req, res, url, params: found.params });
  } catch (err) {
    console.error(`[api] ${req.method} ${url.pathname} →`, err);
    if (!res.headersSent) json(res, 500, { error: "Erreur interne" });
    else res.end();
  }
});

server.listen(PORT, () => {
  console.log(`[api] yann-api à l'écoute sur :${PORT} (NODE_ENV=${process.env.NODE_ENV ?? "development"})`);
});
