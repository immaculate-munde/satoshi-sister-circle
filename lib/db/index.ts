import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type Db = DatabaseSync;
export type Params = Record<string, SQLInputValue>;
type Row = Record<string, unknown>;

const MIGRATIONS_DIR = path.join(process.cwd(), "lib", "db", "migrations");

export function openDb(file: string): Db {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file, { enableForeignKeyConstraints: true });
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = FULL;");
  migrate(db);
  return db;
}

export function migrate(db: Db): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
  );
  const applied = new Set(
    (db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name),
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const ran: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    tx(db, () => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(f, nowIso());
    });
    ran.push(f);
  }
  return ran;
}

let depth = new WeakMap<Db, number>();

/**
 * Run fn inside a write transaction. BEGIN IMMEDIATE takes SQLite's single writer lock up front,
 * which gives the serializable funding-check + payout-intent insert the brief requires.
 * Nested calls join the outer transaction.
 */
export function tx<T>(db: Db, fn: () => T): T {
  const d = depth.get(db) ?? 0;
  if (d > 0) {
    depth.set(db, d + 1);
    try {
      return fn();
    } finally {
      depth.set(db, (depth.get(db) ?? 1) - 1);
    }
  }
  db.exec("BEGIN IMMEDIATE");
  depth.set(db, 1);
  try {
    const result = fn();
    if (result instanceof Promise) throw new Error("tx() callbacks must be synchronous");
    db.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    throw e;
  } finally {
    depth.set(db, 0);
  }
}

export function resetTxStateForTests() {
  depth = new WeakMap();
}

export function one<T = Row>(db: Db, sql: string, params: Params = {}): T | undefined {
  return db.prepare(sql).get(params) as T | undefined;
}

export function many<T = Row>(db: Db, sql: string, params: Params = {}): T[] {
  return db.prepare(sql).all(params) as T[];
}

export function run(db: Db, sql: string, params: Params = {}) {
  return db.prepare(sql).run(params);
}

export function id(): string {
  return randomUUID();
}

export function nowIso(d: Date = new Date()): string {
  return d.toISOString();
}

let singleton: Db | null = null;

export function getDb(): Db {
  if (!singleton) {
    const url = process.env.DATABASE_URL ?? "file:./data/chama.db";
    singleton = openDb(url.replace(/^file:/, ""));
  }
  return singleton;
}
