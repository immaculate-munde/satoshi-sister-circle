import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

/**
 * Postgres data layer (Supabase in production, in-process PGlite for tests).
 *
 * The call shape is the same as the old SQLite layer (`one` / `many` / `run` / `tx` with named `:params`),
 * but everything is async. Inside `tx()` every query on the same Db automatically runs on the transaction's
 * connection (AsyncLocalStorage), so call sites do not pass a transaction handle around.
 */

type Param = string | number | bigint | boolean | null | undefined;
export type Params = Record<string, Param>;
type Row = Record<string, unknown>;

interface Executor {
  query(text: string, values: unknown[]): Promise<{ rows: Row[]; rowCount: number }>;
  exec(text: string): Promise<void>;
}

export interface Db extends Executor {
  readonly kind: "pg" | "pglite";
  begin<T>(fn: (e: Executor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.join(process.cwd(), "lib", "db", "migrations");
/** One global writer lock per transaction, equivalent to SQLite's BEGIN IMMEDIATE. */
const WRITER_LOCK_KEY = 727_001;

// int8 (BIGINT, COUNT) -> number. All money columns are well below 2^53; code wraps them in BigInt() where needed.
pg.types.setTypeParser(20, (v: string) => Number(v));

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null; affectedRows?: number }> };

function toExecutor(c: Queryable): Executor {
  return {
    async query(text, values) {
      const r = await c.query(text, values);
      return { rows: r.rows as Row[], rowCount: r.rowCount ?? r.affectedRows ?? r.rows.length };
    },
    async exec(text) {
      await c.query(text);
    },
  };
}

function openPg(url: string): Db {
  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  u.searchParams.delete("sslmode");
  const pool = new pg.Pool({
    connectionString: u.toString(),
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", (e) => console.error("[db] idle client error:", e.message));
  const base = toExecutor(pool as unknown as Queryable);
  return {
    kind: "pg",
    ...base,
    async begin(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1)", [WRITER_LOCK_KEY]);
        const result = await fn(toExecutor(client as unknown as Queryable));
        await client.query("COMMIT");
        return result;
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* connection already gone */
        }
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

function openPglite(dataDir?: string): Db {
  const lite = new PGlite(dataDir, { parsers: { 20: (v: string) => Number(v) } });
  const base = toExecutor(lite as unknown as Queryable);
  return {
    kind: "pglite",
    query: base.query,
    exec: async (text) => {
      await lite.exec(text);
    },
    // PGlite has a single connection; its transaction() holds a mutex so concurrent callers queue.
    begin: (fn) =>
      lite.transaction((t) =>
        fn({
          query: async (text, values) => {
            const r = await t.query<Row>(text, values as unknown[]);
            return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
          },
          exec: async (text) => {
            await t.exec(text);
          },
        }),
      ),
    close: () => lite.close(),
  };
}

/** `memory:` for a throwaway PGlite, `file:` for a PGlite directory on disk, or postgres:// for Supabase. */
export async function openDb(url: string): Promise<Db> {
  const isPg = /^postgres(ql)?:\/\//.test(url);
  const isMem = url === "memory:" || url === ":memory:";
  const isFile = url.startsWith("file:");
  if (!isPg && !isMem && !isFile) {
    throw new Error("DATABASE_URL must be a postgres:// connection string, a file: path, or memory:");
  }
  const db = isPg ? openPg(url) : openPglite(isFile ? fileDataDir(url) : undefined);
  await migrate(db);
  return db;
}

function fileDataDir(url: string): string {
  const rel = url.replace(/^file:\/\//, "").replace(/^file:/, "");
  const dir = path.resolve(rel);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  return dir;
}

export async function migrate(db: Db): Promise<string[]> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const ran: string[] = [];
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
    // Hold the writer lock so two processes starting together do not both apply a migration.
    await db.begin(async (t) => {
      const done = await t.query("SELECT 1 FROM schema_migrations WHERE name = $1", [f]);
      if (done.rows.length) return;
      await t.exec(sql);
      await t.query("INSERT INTO schema_migrations (name, applied_at) VALUES ($1, $2)", [f, nowIso()]);
      ran.push(f);
    });
  }
  return ran;
}

const txStore = new AsyncLocalStorage<{ db: Db; exec: Executor }>();

/**
 * Run fn inside a write transaction holding the global writer lock, so the funding check and the payout
 * intent insert serialize exactly as before. Nested calls join the outer transaction. Do not call the payment
 * provider or other slow I/O inside fn.
 */
export function tx<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  const cur = txStore.getStore();
  if (cur && cur.db === db) return fn();
  return db.begin((exec) => txStore.run({ db, exec }, fn));
}

function executor(db: Db): Executor {
  const cur = txStore.getStore();
  return cur && cur.db === db ? cur.exec : db;
}

/** `:name` placeholders -> `$1..` (skipping `::casts`), returning positional values. */
function bind(sql: string, params: Params): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  const index = new Map<string, number>();
  const text = sql.replace(/(?<![:\w]):([a-zA-Z_]\w*)/g, (_m, name: string) => {
    if (!(name in params)) throw new Error(`Missing SQL parameter :${name}`);
    let i = index.get(name);
    if (!i) {
      const v = params[name];
      values.push(typeof v === "bigint" ? v.toString() : v === undefined ? null : v);
      i = values.length;
      index.set(name, i);
    }
    return `$${i}`;
  });
  return { text, values };
}

export async function one<T = Row>(db: Db, sql: string, params: Params = {}): Promise<T | undefined> {
  const { text, values } = bind(sql, params);
  return (await executor(db).query(text, values)).rows[0] as T | undefined;
}

export async function many<T = Row>(db: Db, sql: string, params: Params = {}): Promise<T[]> {
  const { text, values } = bind(sql, params);
  return (await executor(db).query(text, values)).rows as T[];
}

/** Returns `{ changes }` = affected row count (same field the SQLite layer exposed). */
export async function run(db: Db, sql: string, params: Params = {}): Promise<{ changes: number }> {
  const { text, values } = bind(sql, params);
  return { changes: (await executor(db).query(text, values)).rowCount };
}

/** Raw multi-statement SQL (tests, seed). */
export async function exec(db: Db, sql: string): Promise<void> {
  await executor(db).exec(sql);
}

export function id(): string {
  return randomUUID();
}

export function nowIso(d: Date = new Date()): string {
  return d.toISOString();
}

const g = globalThis as unknown as { __chamaDb?: Promise<Db> };

/** Shared connection for route handlers, the worker and scripts. Survives Next dev hot reloads. */
export function getDb(): Promise<Db> {
  g.__chamaDb ??= openDb(process.env.DATABASE_URL ?? "");
  return g.__chamaDb;
}
