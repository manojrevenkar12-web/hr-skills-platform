import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { generate, MemorySource, type HrSource } from "@hsp/hr-data";
import { runSkill, SimulatedProvider, type Behaviour, type Provider, type RunResult } from "@hsp/harness";
import type { Skill } from "@hsp/skill-kit";

import { check, loadCases, type Case } from "./cases.js";

/**
 * Runs a skill's cases. With the simulated model it also replays every case that should pass with
 * each fault the skill's simulated behaviour knows, and counts how many the validators stop: a
 * fault that changes nothing in a case is not a test of anything and is skipped.
 */
export interface CaseRow {
  id: string;
  title?: string;
  passed: boolean;
  problems: string[];
  status: string;
  findings: string[];
  ms: number;
  truth?: Record<string, unknown>;
  output?: unknown;
}
export interface FaultRow {
  id: string;
  fault: string;
  caught: boolean;
  status: string;
  findings: string[];
}
export interface SkillReport {
  skill: string;
  version: string;
  model: string;
  cases: CaseRow[];
  passRate: number;
  faults: FaultRow[];
  faultCatchRate: number | null;
  byFault: Record<string, string>;
  metrics: Record<string, number>;
}

export interface SimModule {
  behaviour: Behaviour;
  FAULTS: readonly string[];
}
export type MetricsFn = (rows: CaseRow[]) => Record<string, number>;

let demo: HrSource | null = null;
const demoSource = () => (demo ??= new MemorySource(generate()));

export async function loadSim(skill: Skill): Promise<SimModule | null> {
  const p = join(skill.dir, "evals", "simulated.ts");
  return existsSync(p) ? ((await import(pathToFileURL(p).href)) as SimModule) : null;
}

async function loadMetrics(skill: Skill): Promise<MetricsFn | null> {
  const p = join(skill.dir, "evals", "metrics.ts");
  return existsSync(p) ? ((await import(pathToFileURL(p).href)) as { metrics: MetricsFn }).metrics : null;
}

export async function evaluateSkill(skill: Skill, skills: Skill[], casesFile: string, opts: { provider?: Provider; faults?: boolean } = {}): Promise<SkillReport> {
  const sim = await loadSim(skill);
  const behaviours: Record<string, Behaviour> = {};
  if (sim) behaviours[skill.name] = sim.behaviour;
  const provider = opts.provider ?? new SimulatedProvider(behaviours);
  const cases = loadCases(casesFile);
  const base = dirname(casesFile);

  const run = (c: Case, p: Provider): Promise<RunResult> =>
    runSkill({ skill, skills, input: c.input, role: c.role ?? skill.contract.audience[0]!, provider: p, source: sourceFor(c, base) });

  const rows: CaseRow[] = [];
  const faithful = new Map<string, RunResult>();
  for (const c of cases) {
    const r = await run(c, provider);
    faithful.set(c.id, r);
    const problems = check(c, r);
    rows.push({ id: c.id, title: c.title, passed: problems.length === 0, problems, status: r.status, findings: r.findings.map((f) => `${f.validator}: ${f.message}`), ms: r.durationMs, truth: c.truth, output: r.output });
  }

  const faults: FaultRow[] = [];
  if (sim && opts.faults !== false && !opts.provider) {
    for (const c of cases.filter((x) => x.expect.status === "ok")) {
      const good = faithful.get(c.id)!;
      for (const fault of sim.FAULTS) {
        const r = await run(c, new SimulatedProvider(behaviours, [fault]));
        if (r.status === good.status && JSON.stringify(r.output) === JSON.stringify(good.output)) continue;
        faults.push({ id: c.id, fault, caught: r.status !== "ok", status: r.status, findings: r.findings.map((f) => f.validator) });
      }
    }
  }
  const byFault: Record<string, string> = {};
  for (const f of sim?.FAULTS ?? []) {
    const fs = faults.filter((x) => x.fault === f);
    byFault[f] = `${fs.filter((x) => x.caught).length}/${fs.length}`;
  }
  const metricsFn = await loadMetrics(skill);
  return {
    skill: skill.name,
    version: skill.contract.version,
    model: provider.model,
    cases: rows,
    passRate: ratio(rows.filter((r) => r.passed).length, rows.length),
    faults,
    faultCatchRate: faults.length ? ratio(faults.filter((f) => f.caught).length, faults.length) : null,
    byFault,
    metrics: metricsFn ? metricsFn(rows) : {},
  };
}

function sourceFor(c: Case, base: string): HrSource {
  return c.fixture ? MemorySource.fromFile(join(base, c.fixture)) : demoSource();
}

const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 10000 : 0);
