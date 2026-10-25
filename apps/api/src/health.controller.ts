import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import type pg from "pg";

import { Public } from "./auth/auth.js";
import { POOL } from "./db/database.js";
import { SkillsService } from "./skills/skills.service.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(SkillsService) private readonly skills: SkillsService,
  ) {}

  @Public()
  @Get()
  async health() {
    try {
      await this.pool.query("SELECT 1");
    } catch {
      throw new ServiceUnavailableException("database unreachable");
    }
    return { status: "ok", skills: this.skills.skills.length, model: this.skills.provider.model };
  }
}
