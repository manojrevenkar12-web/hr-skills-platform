import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  // tests run on the TypeScript sources; the built dist/ is for Node at run time
  resolve: {
    alias: {
      "@hsp/hr-data": src("hr-data"),
      "@hsp/skill-kit": src("skill-kit"),
      "@hsp/hr-mcp": src("hr-mcp"),
      "@hsp/harness": src("harness"),
      "@hsp/evals": src("evals"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "skills/*/scripts/**/*.test.ts", "apps/api/src/**/*.test.ts", "apps/api/test/**/*.test.ts"],
    testTimeout: 30000,
  },
});
