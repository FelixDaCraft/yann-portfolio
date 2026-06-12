/** Wrapper fetch du backoffice — toute 401 renvoie au login. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401 && location.hash !== "#/login") {
    location.hash = "#/login";
    throw new ApiError(401, "Session expirée");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Types des réponses API -------------------------------------------------

export type TopEntry = { name: string; count: number };

export type Stats = {
  from: string;
  to: string;
  daily: { day: string; pageviews: number; uniques: number }[];
  totals: { pageviews: number; uniques: number; cvDownloads: number; messages: number; unread: number };
  topReferrers: TopEntry[];
  topCountries: TopEntry[];
  topSections: TopEntry[];
  topClicks: TopEntry[];
  devices: Record<string, number>;
  avgDurationMs: number | null;
  funnel: { visited: number; scrolled: number; engaged: number; converted: number };
};

export type Message = {
  id: number;
  ts: number;
  name: string;
  email: string;
  body: string;
  read: 0 | 1;
  session: string | null;
  visitor: string | null;
  country: string | null;
  device: string | null;
  referrer: string | null;
  sections: string | null;
  duration: number | null;
};

export type LinkResult = { url: string; status: number; ok: boolean; ms: number };
