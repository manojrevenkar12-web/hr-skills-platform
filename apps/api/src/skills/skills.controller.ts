import { Controller, Get, Inject, Param } from "@nestjs/common";

import { CurrentUser, type User } from "../auth/auth.js";
import { SkillsService } from "./skills.service.js";

@Controller("api/skills")
export class SkillsController {
  constructor(@Inject(SkillsService) private readonly skills: SkillsService) {}

  /** Every skill with its release and evaluation state; `canRun` says whether the caller's role may run it. */
  @Get()
  list(@CurrentUser() user: User) {
    return { model: this.skills.provider.model, skills: this.skills.catalogue().map((s) => ({ ...s, canRun: s.audience.includes(user.role) })) };
  }

  @Get(":name")
  one(@Param("name") name: string, @CurrentUser() user: User) {
    const s = this.skills.catalogue().find((x) => x.name === this.skills.get(name).name)!;
    return { ...s, canRun: s.audience.includes(user.role), instructions: this.skills.get(name).body };
  }
}
