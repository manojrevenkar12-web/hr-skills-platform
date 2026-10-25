import { Inject, Injectable } from "@nestjs/common";
import type pg from "pg";

import { POOL } from "../db/database.js";

/** Writes the append-only audit trail: who did what, never the HR data itself. */
@Injectable()
export class AuditService {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}

  async record(e: { actor?: string | null; role?: string | null; action: string; subject?: string | null; ok?: boolean; detail?: Record<string, unknown> }): Promise<void> {
    await this.pool.query("INSERT INTO app.audit (actor, role, action, subject, ok, detail) VALUES ($1,$2,$3,$4,$5,$6)", [
      e.actor ?? null, e.role ?? null, e.action, e.subject ?? null, e.ok ?? true, JSON.stringify(e.detail ?? {}),
    ]);
  }

  async recent(limit = 100) {
    const { rows } = await this.pool.query(
      `SELECT a.id, a.at, u.name AS actor, a.role, a.action, a.subject, a.ok, a.detail FROM app.audit a LEFT JOIN app.users u ON u.id = a.actor ORDER BY a.id DESC LIMIT $1`,
      [limit],
    );
    return rows;
  }
}
