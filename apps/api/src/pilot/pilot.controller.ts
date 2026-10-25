import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { z } from "zod";

import { CurrentUser, Roles, type User } from "../auth/auth.js";
import { parse } from "../validation.js";
import { ISSUES, PilotService } from "./pilot.service.js";

@Controller("api")
export class PilotController {
  constructor(@Inject(PilotService) private readonly pilot: PilotService) {}

  @Post("runs/:id/feedback")
  feedback(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    const f = parse(
      z.object({
        rating: z.enum(["useful", "partly", "not_useful"]),
        minutesSaved: z.number().int().min(0).max(600).optional(),
        issues: z.array(z.enum(ISSUES)).max(ISSUES.length).default([]),
        comment: z.string().max(1000).default(""),
      }),
      body,
    );
    return this.pilot.feedback(user, id, f);
  }

  /** Proposes the run as a golden case for the skill's next version (reviewed in a pull request). */
  @Post("runs/:id/case-candidate")
  propose(@CurrentUser() user: User, @Param("id") id: string, @Body() body: unknown) {
    const p = parse(z.object({ expectedStatus: z.enum(["ok", "held", "failed", "refused"]), note: z.string().min(10).max(300) }), body);
    return this.pilot.propose(user, id, p);
  }

  @Get("case-candidates")
  @Roles("people_analytics", "comp_partner")
  async candidates() {
    return { candidates: await this.pilot.candidates() };
  }

  @Get("pilot/summary")
  @Roles("people_analytics", "comp_partner", "hr_leadership")
  summary() {
    return this.pilot.summary();
  }
}
