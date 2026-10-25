import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, NotFoundException, Post } from "@nestjs/common";
import { z } from "zod";

import { AuditService } from "../audit/audit.service.js";
import { CONFIG, type Config } from "../config.js";
import { parse } from "../validation.js";
import { AuthService, bearer, CurrentUser, Public, type User } from "./auth.js";

@Controller("api/session")
export class SessionController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Demo sign-in by e-mail; the route does not exist unless DEMO_LOGIN=1. */
  @Public()
  @Post("demo")
  async demo(@Body() body: unknown) {
    if (!this.config.demoLogin) throw new NotFoundException();
    const { email } = parse(z.object({ email: z.string().email() }), body);
    const user = await this.auth.byEmail(email);
    if (!user) throw new NotFoundException("No demo user with that e-mail.");
    await this.audit.record({ actor: user.id, role: user.role, action: "session.created", detail: { demo: true } });
    return { token: await this.auth.issue(user.id), user };
  }

  @Public()
  @Get("demo-users")
  async demoUsers() {
    if (!this.config.demoLogin) throw new NotFoundException();
    return { users: await this.auth.demoUsers() };
  }

  @Get()
  me(@CurrentUser() user: User) {
    return { user };
  }

  @Delete()
  @HttpCode(204)
  async signOut(@Headers("authorization") header: string) {
    const token = bearer(header);
    if (token) await this.auth.revoke(token);
  }
}
