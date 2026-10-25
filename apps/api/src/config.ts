/** Settings from the environment, read once. */
export interface Config {
  port: number;
  databaseUrl: string;
  /** lets anyone sign in as a seeded demo user by e-mail; never set in a real deployment */
  demoLogin: boolean;
  workerConcurrency: number;
  workerPollMs: number;
  /** a run still "running" after this long is assumed lost and queued again (up to 3 attempts) */
  staleRunMs: number;
  tokenTtlHours: number;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl,
    demoLogin: env.DEMO_LOGIN === "1",
    workerConcurrency: Number(env.WORKER_CONCURRENCY ?? 2),
    workerPollMs: Number(env.WORKER_POLL_MS ?? 500),
    staleRunMs: Number(env.STALE_RUN_MS ?? 5 * 60_000),
    tokenTtlHours: Number(env.TOKEN_TTL_HOURS ?? 12),
    corsOrigins: (env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export const CONFIG = Symbol("CONFIG");
