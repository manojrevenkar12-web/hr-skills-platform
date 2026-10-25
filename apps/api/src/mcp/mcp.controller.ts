import { Controller, Delete, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import type pg from "pg";

import { PgSource } from "@hsp/hr-data";
import { createHrMcpServer } from "@hsp/hr-mcp";

import { AuditService } from "../audit/audit.service.js";
import { CurrentUser, type User } from "../auth/auth.js";
import { POOL } from "../db/database.js";
import { SkillsService } from "../skills/skills.service.js";

/**
 * The HR MCP server over Streamable HTTP, for remote MCP clients (an IDE assistant, Claude, an
 * agent framework). Stateless: each request gets a server bound to the caller's role, so the
 * tools a client sees are exactly the ones that role may use. Authenticated like the rest of
 * the API (Bearer token).
 */
@Controller("mcp")
export class McpController {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(SkillsService) private readonly skills: SkillsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post()
  async handle(@CurrentUser() user: User, @Req() req: Request, @Res() res: Response) {
    const server = createHrMcpServer({
      source: new PgSource(this.pool),
      role: user.role,
      skills: this.skills.skills,
      audit: (e) => void this.audit.record({ actor: user.id, role: user.role, action: "mcp.call", subject: e.tool, ok: e.ok, detail: { ms: e.ms, remote: true } }),
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  @Get()
  notAllowed(@Res() res: Response) {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Use POST: this server is stateless." }, id: null });
  }

  @Delete()
  deleteNotAllowed(@Res() res: Response) {
    this.notAllowed(res);
  }
}
