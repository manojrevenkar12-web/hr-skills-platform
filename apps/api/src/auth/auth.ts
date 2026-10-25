import { createHash, randomBytes } from "node:crypto";

import { CanActivate, createParamDecorator, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type pg from "pg";

import type { Role } from "@hsp/skill-kit";

import { CONFIG, type Config } from "../config.js";
import { POOL } from "../db/database.js";

/**
 * Bearer tokens, stored only as SHA-256 digests. In a client deployment the token comes from the
 * client's identity provider (OIDC) and the role from an HR group; DEMO_LOGIN lets the demo issue
 * tokens for seeded users by e-mail.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const digest = (token: string) => createHash("sha256").update(token).digest("hex");

@Injectable()
export class AuthService {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async issue(userId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.pool.query("INSERT INTO app.tokens (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(hours => $3))", [digest(token), userId, this.config.tokenTtlHours]);
    return token;
  }

  async userFor(token: string): Promise<User | null> {
    const { rows } = await this.pool.query(
      "SELECT u.id, u.email, u.name, u.role FROM app.tokens t JOIN app.users u ON u.id = t.user_id WHERE t.token_hash = $1 AND t.expires_at > now()",
      [digest(token)],
    );
    return (rows[0] as User | undefined) ?? null;
  }

  async revoke(token: string): Promise<void> {
    await this.pool.query("DELETE FROM app.tokens WHERE token_hash = $1", [digest(token)]);
  }

  async byEmail(email: string): Promise<User | null> {
    const { rows } = await this.pool.query("SELECT id, email, name, role FROM app.users WHERE email = $1", [email.trim().toLowerCase()]);
    return (rows[0] as User | undefined) ?? null;
  }

  async demoUsers(): Promise<User[]> {
    const { rows } = await this.pool.query("SELECT id, email, name, role FROM app.users ORDER BY role, name");
    return rows as User[];
  }
}

export const PUBLIC = "hsp:public";
export const Public = () => SetMetadata(PUBLIC, true);
export const ROLES_KEY = "hsp:roles";
/** Restricts a route to some roles; skill runs are restricted by the skill's own audience instead. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const bearer = (header: unknown) => (typeof header === "string" ? header.match(/^Bearer (.+)$/)?.[1] ?? null : null);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC, targets)) return true;
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string>; user?: User }>();
    const token = bearer(req.headers.authorization);
    const user = token ? await this.auth.userFor(token) : null;
    if (!user) throw new UnauthorizedException("Sign in first.");
    req.user = user;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (roles && !roles.includes(user.role)) throw new ForbiddenException(`This needs one of: ${roles.join(", ")}.`);
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<{ user: User }>().user);
