import pg from "pg";

import { generate } from "./generate.js";
import { MemorySource, PgSource, type HrSource } from "./source.js";

/**
 * The data source a script or server uses when run on its own:
 * HR_DATA=postgres://... (the HR schema), HR_DATA=path/to/dataset.json, or nothing for the
 * generated demo company.
 */
export function sourceFromEnv(env: NodeJS.ProcessEnv = process.env): { source: HrSource; close: () => Promise<void> } {
  const spec = env.HR_DATA ?? "";
  if (spec.startsWith("postgres://") || spec.startsWith("postgresql://")) {
    const pool = new pg.Pool({ connectionString: spec, max: 4 });
    return { source: new PgSource(pool), close: () => pool.end() };
  }
  if (spec) return { source: MemorySource.fromFile(spec), close: async () => {} };
  return { source: new MemorySource(generate()), close: async () => {} };
}

/** Runs a script function from the command line: `node script.ts '{"entity":"nordwerk-de"}'`, printing JSON. */
export async function runCli<A, R>(fn: (args: A, ctx: { source: HrSource }) => Promise<R>, argv = process.argv.slice(2)): Promise<void> {
  const { source, close } = sourceFromEnv();
  try {
    const args = JSON.parse(argv[0] ?? "{}") as A;
    process.stdout.write(`${JSON.stringify(await fn(args, { source }), null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
