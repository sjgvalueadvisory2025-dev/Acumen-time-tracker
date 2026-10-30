import "server-only";
import { neon } from "@neondatabase/serverless";

type Row = Record<string, unknown>;
type QueryFn = (text: string, params: unknown[]) => Promise<Row[]>;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS projects (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     created_by TEXT NOT NULL,
     archived BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE TABLE IF NOT EXISTS project_members (
     project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     email TEXT NOT NULL,
     added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (project_id, email)
   )`,
  `CREATE INDEX IF NOT EXISTS project_members_email_idx ON project_members (email)`,
  `CREATE TABLE IF NOT EXISTS time_entries (
     id BIGSERIAL PRIMARY KEY,
     project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     email TEXT NOT NULL,
     work_date DATE NOT NULL,
     hours NUMERIC(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
     description TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS time_entries_email_date_idx ON time_entries (email, work_date)`,
  `CREATE INDEX IF NOT EXISTS time_entries_project_date_idx ON time_entries (project_id, work_date)`,
  `CREATE TABLE IF NOT EXISTS login_codes (
     id BIGSERIAL PRIMARY KEY,
     email TEXT NOT NULL,
     code_hash TEXT NOT NULL,
     attempts INTEGER NOT NULL DEFAULT 0,
     used BOOLEAN NOT NULL DEFAULT FALSE,
     expires_at TIMESTAMPTZ NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes (email, created_at)`,
  `CREATE TABLE IF NOT EXISTS sessions (
     token_hash TEXT PRIMARY KEY,
     email TEXT NOT NULL,
     expires_at TIMESTAMPTZ NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS sessions_email_idx ON sessions (email)`,
];

let queryFn: Promise<QueryFn> | null = null;
let schemaReady: Promise<void> | null = null;

function isLocal(url: string) {
  return /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
}

async function createQueryFn(): Promise<QueryFn> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  if (isLocal(url)) {
    // Local development against a plain Postgres server.
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    return async (text, params) => (await pool.query(text, params)).rows;
  }

  // Production: Neon's serverless HTTP driver (no connection pooling needed).
  const sql = neon(url);
  return async (text, params) => (await sql.query(text, params)) as Row[];
}

async function runSchema(run: QueryFn) {
  for (const stmt of SCHEMA) await run(stmt, []);
}

/** Run a parameterised query ($1, $2, ...). Tables are created automatically on first use. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!queryFn) queryFn = createQueryFn();
  const run = await queryFn.catch((e) => {
    queryFn = null;
    throw e;
  });
  if (!schemaReady) {
    schemaReady = runSchema(run).catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  await schemaReady;
  return (await run(text, params)) as T[];
}
