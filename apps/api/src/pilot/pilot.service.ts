import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type pg from "pg";
import { stringify } from "yaml";

import { findSensitive } from "@hsp/skill-kit";

import { AuditService } from "../audit/audit.service.js";
import type { User } from "../auth/auth.js";
import { POOL } from "../db/database.js";
import { RunsService } from "../runs/runs.service.js";

/**
 * The pilot loop: users rate each run, say how much time it saved and what was wrong; a run that
 * taught something becomes a golden-case proposal for the skill's next version. The summary is
 * what the steering meeting looks at: adoption, usefulness, time saved, and why runs fail.
 */
export const ISSUES = ["wrong_numbers", "missed_something", "unclear", "wrong_level", "too_slow", "not_needed", "other"] as const;

@Injectable()
export class PilotService {
  constructor(
    @Inject(POOL) private readonly pool: pg.Pool,
    @Inject(RunsService) private readonly runs: RunsService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async feedback(user: User, runId: string, f: { rating: string; minutesSaved?: number; issues: string[]; comment: string }) {
    const run = await this.runs.get(user, runId);
    if (run.status === "queued" || run.status === "running") throw new BadRequestException("Wait until the run has finished.");
    refuseSensitive(f.comment);
    await this.pool.query(
      `INSERT INTO app.feedback (run_id, user_id, rating, minutes_saved, issues, comment) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (run_id) DO UPDATE SET rating = EXCLUDED.rating, minutes_saved = EXCLUDED.minutes_saved, issues = EXCLUDED.issues, comment = EXCLUDED.comment, created_at = now()`,
      [runId, user.id, f.rating, f.minutesSaved ?? null, f.issues, f.comment],
    );
    await this.audit.record({ actor: user.id, role: user.role, action: "feedback.given", subject: run.skill, detail: { run: runId, rating: f.rating } });
    return this.runs.get(user, runId);
  }

  async propose(user: User, runId: string, p: { expectedStatus: string; note: string }) {
    const run = await this.runs.get(user, runId);
    refuseSensitive(p.note);
    const id = `cand-${runId.slice(0, 8)}`;
    const yaml = stringify({
      cases: [{ id, title: p.note, role: user.role, input: run.input, expect: { status: p.expectedStatus }, note: `From pilot run ${runId} (${run.skill} ${run.version}, ${run.status}). Add a fixture that reproduces the data before merging.` }],
    });
    const { rows } = await this.pool.query(
      `INSERT INTO app.case_candidates (run_id, skill, proposed_by, expected_status, note, yaml) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (run_id) DO UPDATE SET expected_status = EXCLUDED.expected_status, note = EXCLUDED.note, yaml = EXCLUDED.yaml RETURNING id, skill, yaml, created_at AS "createdAt"`,
      [runId, run.skill, user.id, p.expectedStatus, p.note, yaml],
    );
    await this.audit.record({ actor: user.id, role: user.role, action: "case.proposed", subject: run.skill, detail: { run: runId } });
    return rows[0];
  }

  async candidates() {
    const { rows } = await this.pool.query(
      `SELECT c.id, c.skill, c.expected_status AS "expectedStatus", c.note, c.yaml, c.created_at AS "createdAt", u.name AS "proposedBy"
         FROM app.case_candidates c JOIN app.users u ON u.id = c.proposed_by ORDER BY c.created_at DESC`,
    );
    return rows;
  }

  async summary() {
    const { rows } = await this.pool.query(`
      SELECT r.skill,
             count(*)::int AS runs,
             count(DISTINCT r.user_id)::int AS users,
             count(*) FILTER (WHERE r.status = 'ok')::int AS ok,
             count(*) FILTER (WHERE r.status = 'held')::int AS held,
             count(*) FILTER (WHERE r.status = 'failed')::int AS failed,
             count(*) FILTER (WHERE r.status = 'refused')::int AS refused,
             count(f.run_id)::int AS rated,
             count(*) FILTER (WHERE f.rating = 'useful')::int AS useful,
             count(*) FILTER (WHERE f.rating = 'partly')::int AS partly,
             count(*) FILTER (WHERE f.rating = 'not_useful')::int AS "notUseful",
             percentile_cont(0.5) WITHIN GROUP (ORDER BY f.minutes_saved) AS "medianMinutesSaved",
             coalesce(sum(f.minutes_saved), 0)::int AS "minutesSaved",
             percentile_cont(0.95) WITHIN GROUP (ORDER BY r.duration_ms) AS "p95Ms"
        FROM app.runs r LEFT JOIN app.feedback f ON f.run_id = r.id
       WHERE r.created_at > now() - interval '28 days'
       GROUP BY r.skill ORDER BY r.skill`);
    const { rows: issues } = await this.pool.query(`
      SELECT r.skill, i AS issue, count(*)::int AS n FROM app.feedback f JOIN app.runs r ON r.id = f.run_id, unnest(f.issues) AS i
       WHERE f.created_at > now() - interval '28 days' GROUP BY r.skill, i ORDER BY n DESC`);
    const { rows: weekly } = await this.pool.query(`
      SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS week, count(DISTINCT user_id)::int AS users, count(*)::int AS runs
        FROM app.runs WHERE created_at > now() - interval '28 days' GROUP BY 1 ORDER BY 1`);
    return {
      windowDays: 28,
      skills: rows.map((r) => ({ ...r, medianMinutesSaved: r.medianMinutesSaved === null ? null : Number(r.medianMinutesSaved), p95Ms: r.p95Ms === null ? null : Math.round(Number(r.p95Ms)), issues: issues.filter((i) => i.skill === r.skill).map(({ skill: _s, ...i }) => i) })),
      weekly,
    };
  }
}

function refuseSensitive(text: string) {
  const found = findSensitive(text);
  if (/\bE-\d{5}\b/.test(text)) found.push("employee id");
  if (found.length) throw new BadRequestException(`Remove personal data before sending (${found.join(", ")}): feedback is read by the platform team.`);
}

