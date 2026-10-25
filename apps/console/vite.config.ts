import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In development the console proxies to the API on :3000; in production the API serves it.
const api = process.env.API_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": api, "/mcp": api, "/health": api } },
  build: { outDir: "dist", sourcemap: false },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"], include: ["src/**/*.test.{ts,tsx}"], css: { modules: { classNameStrategy: "non-scoped" } } },
});
