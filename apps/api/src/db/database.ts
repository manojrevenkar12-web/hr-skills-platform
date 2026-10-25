import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";

/** The connection pool, and the migrations applied at start (idempotent SQL files). */
export const POOL = Symbol("POOL");

const MIGRATIONS = [
  new URL("../../../../packages/hr-data/sql/001_hr.sql", import.meta.url),
  new URL("../../sql/001_app.sql", import.meta.url),
];

export async function migrate(pool: pg.Pool): Promise<void> {
  const c = await pool.connect();
  try {
    // one instance migrates at a time
    await c.query("SELECT pg_advisory_lock(472001)");
    for (const m of MIGRATIONS) await c.query(readFileSync(fileURLToPath(m), "utf8"));
  } finally {
    await c.query("SELECT pg_advisory_unlock(472001)").catch(() => undefined);
    c.release();
  }
}
