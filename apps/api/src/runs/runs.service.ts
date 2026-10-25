import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type pg from "pg";

import { AuditService } from "../audit/audit.service.js";
import type { User } from "../auth/auth.js";
import { POOL } from "../db/database.js";
import { SkillsService } from "../skills/skills.service.js";

/**
 * Skill runs are queued in PostgreSQL and executed by the worker (runs.worker.ts), so a request
 * returns at once, a crash loses nothing, and several API instances share the work.
 */
export interface RunRow {
  id: string;
  skill: string;
  version: string;
  status: string;
  input: Record<string, unknown>;
  output: unknown;
  findings: { validator: string; message: string }[];
  trace: unknown[];
  model: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  feedback: { rating: string; minutesSaved: number | null; issues: string[]; comment: string } | null;
  /** the checks this skill's results go through, in order */
  validators: string[];
}

const SELECT = `SELECT r.id, r.skill, r.version, r.status, r.input, r.output, r.findings, r.trace, r.model, r.error,
  r.created_at AS "createdAt", r.finished_at AS "finishedAt", r.duration_ms AS "durationMs", r.user_id AS "userId",
  CASE WHEN f.run_id IS NULL THEN NULL ELSE json_build_object('rating', f.rating, 'minutesSaved', f.minutes_saved, 'issues', f.issues, 'comment', f.comment) END AS feedback
  FROM app.runs r LEFT JOIN app.feedback f ON f.run_id = r.id`;

@Injectable()
export class RunsService {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(SkillsService) private readonly skills: SkillsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async enqueue(user: User, skillName: string, input: Record<string, unknown>): Promise<RunRow> {
    const skill = this.skills.get(skillName);
    if (!skill.contract.audience.includes(user.role)) {
      await this.audit.record({ actor: user.id, role: user.role, action: "run.refused", subject: skill.name, ok: false });
      throw new ForbiddenException(`Your role (${user.role}) may not run ${skill.name}.`);
    }
    const { rows } = await this.pool.query("INSERT INTO app.runs (skill, version, user_id, role, input) VALUES ($1,$2,$3,$4,$5) RETURNING id", [
      skill.name, skill.contract.version, user.id, user.role, JSON.stringify(input),
    ]);
    await this.audit.record({ actor: user.id, role: user.role, action: "run.queued", subject: `${skill.name}@${skill.contract.version}`, detail: { run: rows[0].id } });
    return this.get(user, rows[0].id as string);
  }

  async get(user: User, id: string): Promise<RunRow> {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new NotFoundException("No such run.");
    const { rows } = await this.pool.query(`${SELECT} WHERE r.id = $1`, [id]);
    const row = rows[0] as (RunRow & { userId: string }) | undefined;
    if (!row || row.userId !== user.id) throw new NotFoundException("No such run.");
    const { userId: _u, ...run } = row;
    return { ...run, validators: this.validatorsOf(run.skill) };
  }

  async list(user: User, limit = 50): Promise<RunRow[]> {
    const { rows } = await this.pool.query(`${SELECT} WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT $2`, [user.id, limit]);
    return rows.map(({ userId: _u, output: _o, trace: _t, ...r }: RunRow & { userId: string }) => ({ ...r, output: null, trace: [], validators: this.validatorsOf(r.skill) }));
  }

  private validatorsOf(skill: string): string[] {
    return this.skills.skills.find((s) => s.name === skill)?.contract.validators ?? [];
  }
}
