// POST /api/admin/linkcheck — vérifie les liens externes du site déployé.
// Récupère le HTML servi par nginx (réseau compose interne), extrait les href
// http(s) par regex (zéro liste en dur → jamais de drift avec le HTML), puis
// HEAD chaque URL (fallback GET si la cible refuse HEAD).

import type { Ctx } from "../server.ts";
import { json, requireAdmin } from "../server.ts";

const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "http://yann-portfolio";
const TIMEOUT_MS = 5000;
const CONCURRENCY = 4;

type LinkResult = { url: string; status: number; ok: boolean; ms: number };

async function probe(url: string): Promise<LinkResult> {
  const start = Date.now();
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "yann-linkcheck/1.0 (+https://yann.aynn.fr)" },
      });
      // Certains serveurs refusent HEAD → on retente en GET.
      if (method === "HEAD" && (res.status === 405 || res.status === 403 || res.status === 501)) continue;
      return { url, status: res.status, ok: res.ok, ms: Date.now() - start };
    } catch {
      if (method === "GET") return { url, status: 0, ok: false, ms: Date.now() - start };
    }
  }
  return { url, status: 0, ok: false, ms: Date.now() - start };
}

export async function handleLinkcheck(ctx: Ctx): Promise<void> {
  if (!requireAdmin(ctx)) return;

  let html: string;
  try {
    const res = await fetch(SITE_ORIGIN + "/", { signal: AbortSignal.timeout(TIMEOUT_MS) });
    html = await res.text();
  } catch {
    json(ctx.res, 502, { error: `Impossible de récupérer le HTML du site (${SITE_ORIGIN})` });
    return;
  }

  // Seulement les ancres <a> — les <link rel="preconnect/preload"> pointent
  // vers des origines nues qui répondent 404 (faux positifs).
  const urls = [...new Set([...html.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/g)].map((m) => m[1]!))];

  const results: LinkResult[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, urls.length) }, async () => {
      while (cursor < urls.length) {
        const url = urls[cursor++]!;
        results.push(await probe(url));
      }
    }),
  );

  results.sort((a, b) => Number(a.ok) - Number(b.ok) || a.url.localeCompare(b.url));
  json(ctx.res, 200, { checked: results.length, results });
}
