import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { z } from "zod";

import { CurrentUser, type User } from "../auth/auth.js";
import { parse } from "../validation.js";
import { RunsService } from "./runs.service.js";

@Controller("api/runs")
export class RunsController {
  constructor(@Inject(RunsService) private readonly runs: RunsService) {}

  /** Queues a run; poll GET /api/runs/:id until its status is no longer queued or running. */
  @Post()
  @HttpCode(202)
  create(@CurrentUser() user: User, @Body() body: unknown) {
    const { skill, input } = parse(z.object({ skill: z.string().min(1), input: z.record(z.string(), z.unknown()) }), body);
    return this.runs.enqueue(user, skill, input);
  }

  @Get()
  async list(@CurrentUser() user: User, @Query("limit") limit?: string) {
    return { runs: await this.runs.list(user, Math.min(Number(limit ?? 50) || 50, 200)) };
  }

  @Get(":id")
  one(@CurrentUser() user: User, @Param("id") id: string) {
    return this.runs.get(user, id);
  }
}
