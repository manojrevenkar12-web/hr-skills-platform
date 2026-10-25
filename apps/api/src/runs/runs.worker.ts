import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type pg from "pg";

import { runSkill } from "@hsp/harness";
import { PgSource } from "@hsp/hr-data";
import type { Role } from "@hsp/skill-kit";

import { AuditService } from "../audit/audit.service.js";
import { CONFIG, type Config } from "../config.js";
import { POOL } from "../db/database.js";
import { SkillsService } from "../skills/skills.service.js";

/**
 * Claims queued runs with FOR UPDATE SKIP LOCKED (so any number of instances can work the queue)
 * and executes them with the harness. A run left "running" by a crashed instance is queued again
 * after STALE_RUN_MS, at most three attempts in all. MCP calls are audited per run.
 */
@Injectable()
export class RunsWorker implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("RunsWorker");
  private timer: NodeJS.Timeout | null = null;
  private active = 0;
  private stopping = false;

  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(SkillsService) private readonly skills: SkillsService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  onModuleInit() {
    if (process.env.RUN_WORKER === "0") return;
    this.timer = setInterval(() => void this.tick(), this.config.workerPollMs);
  }

  async onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    while (this.active > 0) await new Promise((r) => setTimeout(r, 50));
  }

  /** One polling step: requeue lost runs, then fill free slots. Exposed for tests. */
  async tick(): Promise<void> {
    if (this.stopping) return;
    await this.pool.query(
      `UPDATE app.runs SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
              error = CASE WHEN attempts >= 3 THEN 'lost three times while running' ELSE error END
        WHERE status = 'running' AND started_at < now() - make_interval(secs => $1)`,
      [this.config.staleRunMs / 1000],
    );
    while (this.active < this.config.workerConcurrency && !this.stopping) {
      const { rows } = await this.pool.query(
        `UPDATE app.runs SET status = 'running', started_at = now(), attempts = attempts + 1
          WHERE id = (SELECT id FROM app.runs WHERE status = 'queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1)
          RETURNING id, skill, user_id, role, input`,
      );
      const job = rows[0] as { id: string; skill: string; user_id: string; role: Role; input: Record<string, unknown> } | undefined;
      if (!job) return;
      this.active++;
      void this.execute(job).finally(() => this.active--);
    }
  }

  /** Runs every queued run now, one after another (tests and the CLI). */
  async drain(): Promise<void> {
    for (;;) {
      await this.tick();
      while (this.active > 0) await new Promise((r) => setTimeout(r, 10));
      const { rows } = await this.pool.query("SELECT count(*)::int AS n FROM app.runs WHERE status = 'queued'");
      if (rows[0].n === 0) return;
    }
  }

  private async execute(job: { id: string; skill: string; user_id: string; role: Role; input: Record<string, unknown> }) {
    try {
      const skill = this.skills.get(job.skill);
      const result = await runSkill({
        skill, skills: this.skills.skills, input: job.input, role: job.role, provider: this.skills.provider, source: new PgSource(this.pool),
        audit: (e) => void this.audit.record({ actor: job.user_id, role: e.role, action: "mcp.call", subject: e.tool, ok: e.ok, detail: { run: job.id, ms: e.ms, ...(e.error ? { error: e.error.slice(0, 200) } : {}) } }),
      });
      await this.pool.query(
        `UPDATE app.runs SET status = $2, output = $3, findings = $4, trace = $5, model = $6, usage = $7, error = $8, finished_at = now(), duration_ms = $9 WHERE id = $1`,
        [job.id, result.status, JSON.stringify(result.output ?? null), JSON.stringify(result.findings), JSON.stringify(result.trace), result.model, JSON.stringify(result.usage), result.error ?? null, result.durationMs],
      );
      await this.audit.record({ actor: job.user_id, role: job.role, action: `run.${result.status}`, subject: job.skill, ok: result.status === "ok", detail: { run: job.id, findings: result.findings.map((f) => f.validator) } });
    } catch (err) {
      this.log.error(`run ${job.id} crashed: ${String(err)}`);
      await this.pool.query("UPDATE app.runs SET status = 'failed', error = $2, finished_at = now() WHERE id = $1", [job.id, `internal error: ${String(err).slice(0, 300)}`]);
    }
  }
}
