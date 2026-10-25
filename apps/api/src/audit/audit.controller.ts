import { Controller, Get, Inject } from "@nestjs/common";

import { Roles } from "../auth/auth.js";
import { AuditService } from "./audit.service.js";

@Controller("api/audit")
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @Roles("people_analytics")
  async recent() {
    return { events: await this.audit.recent(200) };
  }
}
