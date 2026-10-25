import "reflect-metadata";

import { existsSync } from "node:fs";
import { join } from "node:path";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";

import { repoRoot } from "@hsp/hr-data";

import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

/** The API, the MCP endpoint and, when built, the console (apps/console/dist) on one origin. */
export async function createApp() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: process.env.LOG_QUIET === "1" ? ["error"] : ["error", "warn", "log"] });
  app.enableShutdownHooks();
  app.disable("x-powered-by");
  app.useBodyParser("json", { limit: "256kb" });
  if (config.corsOrigins.length) app.enableCors({ origin: config.corsOrigins, allowedHeaders: ["Authorization", "Content-Type", "Accept", "Mcp-Protocol-Version"] });
  const consoleDir = join(repoRoot(), "apps", "console", "dist");
  if (existsSync(consoleDir)) {
    app.useStaticAssets(consoleDir, { index: false, maxAge: "1h" });
    // the console's own routes: anything that is not the API, MCP or a health check
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== "GET" || /^\/(api|mcp|health)(\/|$)/.test(req.path)) return next();
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(join(consoleDir, "index.html"));
    });
  }
  return { app, config };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { app, config } = await createApp();
  await app.listen(config.port, "0.0.0.0");
}
