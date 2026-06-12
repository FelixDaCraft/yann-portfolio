import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { dayParis } from "./util.ts";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "yann.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db: Database.Database = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY,
    ts           INTEGER NOT NULL,
    day          TEXT    NOT NULL,
    type         TEXT    NOT NULL CHECK (type IN ('pageview','section','click','cv','leave','contact_submit')),
    visitor      TEXT    NOT NULL,
    session      TEXT    NOT NULL,
    name         TEXT,
    value        INTEGER,
    referrer     TEXT,
    utm_source   TEXT,
    utm_medium   TEXT,
    utm_campaign TEXT,
    country      TEXT,
    device       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_day      ON events(day);
  CREATE INDEX IF NOT EXISTS idx_events_type_day ON events(type, day);
  CREATE INDEX IF NOT EXISTS idx_events_session  ON events(session);

  CREATE TABLE IF NOT EXISTS messages (
    id       INTEGER PRIMARY KEY,
    ts       INTEGER NOT NULL,
    name     TEXT    NOT NULL,
    email    TEXT    NOT NULL,
    body     TEXT    NOT NULL,
    read     INTEGER NOT NULL DEFAULT 0,
    session  TEXT,
    visitor  TEXT,
    country  TEXT,
    device   TEXT,
    referrer TEXT,
    sections TEXT,
    duration INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_messages_read_ts ON messages(read, ts DESC);

  CREATE TABLE IF NOT EXISTS salts (
    day  TEXT PRIMARY KEY,
    salt TEXT NOT NULL
  );

  INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
`);

// ---------------------------------------------------------------------------
// Sel journalier + hash visiteur (jamais d'IP brute stockée).
// Le sel est persisté (uniques stables si le conteneur redémarre) puis détruit
// à J+2 — passé ce délai, les hash 'visitor' sont définitivement anonymes.
// ---------------------------------------------------------------------------

const getSalt = db.prepare<[string], { salt: string }>("SELECT salt FROM salts WHERE day = ?");
const putSalt = db.prepare("INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)");

let saltCache: { day: string; salt: string } | null = null;

function dailySalt(day: string): string {
  if (saltCache?.day === day) return saltCache.salt;
  putSalt.run(day, crypto.randomBytes(32).toString("hex"));
  const row = getSalt.get(day);
  if (!row) throw new Error("salt introuvable après insertion");
  saltCache = { day, salt: row.salt };
  return row.salt;
}

export function visitorHash(day: string, ip: string, ua: string): string {
  return crypto.createHash("sha256").update(`${dailySalt(day)}|${ip}|${ua}`).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Insertions
// ---------------------------------------------------------------------------

export type EventRow = {
  ts: number;
  day: string;
  type: "pageview" | "section" | "click" | "cv" | "leave" | "contact_submit";
  visitor: string;
  session: string;
  name: string | null;
  value: number | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string;
  device: string;
};

const insertEventStmt = db.prepare(`
  INSERT INTO events (ts, day, type, visitor, session, name, value, referrer, utm_source, utm_medium, utm_campaign, country, device)
  VALUES (@ts, @day, @type, @visitor, @session, @name, @value, @referrer, @utm_source, @utm_medium, @utm_campaign, @country, @device)
`);

export const insertEvents = db.transaction((rows: EventRow[]) => {
  for (const row of rows) insertEventStmt.run(row);
});

export const insertMessage = db.prepare(`
  INSERT INTO messages (ts, name, email, body, session, visitor, country, device, referrer, sections, duration)
  VALUES (@ts, @name, @email, @body, @session, @visitor, @country, @device, @referrer, @sections, @duration)
`);

// ---------------------------------------------------------------------------
// Purge (rétention CNIL : events bruts 13 mois ; sels 2 jours)
// ---------------------------------------------------------------------------

const THIRTEEN_MONTHS_MS = 13 * 30.44 * 24 * 60 * 60 * 1000;

export function purge(): void {
  const now = Date.now();
  db.prepare("DELETE FROM events WHERE ts < ?").run(now - THIRTEEN_MONTHS_MS);
  db.prepare("DELETE FROM salts WHERE day < ?").run(dayParis(now - 2 * 24 * 60 * 60 * 1000));
}

purge();
setInterval(purge, 6 * 60 * 60 * 1000).unref();
