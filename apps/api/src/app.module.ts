import { Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import pg from "pg";

import { AuditController } from "./audit/audit.controller.js";
import { AuditService } from "./audit/audit.service.js";
import { AuthGuard, AuthService } from "./auth/auth.js";
import { SessionController } from "./auth/session.controller.js";
import { CONFIG, loadConfig, type Config } from "./config.js";
import { migrate, POOL } from "./db/database.js";
import { HealthController } from "./health.controller.js";
import { McpController } from "./mcp/mcp.controller.js";
import { PilotController } from "./pilot/pilot.controller.js";
import { PilotService } from "./pilot/pilot.service.js";
import { RunsController } from "./runs/runs.controller.js";
import { RunsService } from "./runs/runs.service.js";
import { RunsWorker } from "./runs/runs.worker.js";
import { seedDemo } from "./seed.js";
import { SkillsController } from "./skills/skills.controller.js";
import { SkillsService } from "./skills/skills.service.js";

@Module({
  controllers: [HealthController, SessionController, SkillsController, RunsController, PilotController, AuditController, McpController],
  providers: [
    { provide: CONFIG, useFactory: () => loadConfig() },
    {
      provide: POOL,
      inject: [CONFIG],
      useFactory: async (config: Config) => {
        const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
        await migrate(pool);
        if (config.demoLogin) await seedDemo(pool);
        return pool;
      },
    },
    AuditService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    SkillsService,
    RunsService,
    RunsWorker,
    PilotService,
  ],
})
export class AppModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
