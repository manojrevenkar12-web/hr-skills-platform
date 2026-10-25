import type { Run, SkillSummary, User } from "../shared/api/types";

export const clara: User = { id: "u1", email: "clara@nordwerk.example", name: "Clara Becker", role: "comp_partner" };
export const lena: User = { ...clara, id: "u5", email: "lena@nordwerk.example", name: "Lena Vogel", role: "recruiter" };

export const skill = (over: Partial<SkillSummary> = {}): SkillSummary => ({
  name: "merit-cycle-check",
  description: "Checks merit proposals. Use when a compensation partner asks.",
  version: "1.0.0",
  owner: "compensation",
  classification: "individual",
  audience: ["comp_partner", "hr_business_partner"],
  inputs: { type: "object", required: ["entity", "cycle"], properties: { entity: { type: "string" }, cycle: { type: "string" }, orgUnit: { type: "string" } } },
  validators: ["schema", "grounded_numbers", "covers_findings", "no_invented_findings"],
  released: null,
  releaseStatus: "first",
  releaseProblems: [],
  lint: [],
  evaluation: { recordedAt: "2026-10-25T10:00:00Z", model: "simulated-1", passed: 13, cases: 13, faultsCaught: 39, faults: 39, metrics: {} },
  heldout: [{ set: "set1", status: "held out", firstRun: { passed: 25, cases: 25, metrics: {}, model: "simulated-1" } }],
  canRun: true,
  ...over,
});

export const meritRun = (over: Partial<Run> = {}): Run => ({
  id: "11111111-1111-1111-1111-111111111111",
  skill: "merit-cycle-check",
  version: "1.0.0",
  status: "ok",
  input: { entity: "nordwerk-de", cycle: "2026", orgUnit: "DE-OPS-2" },
  output: {
    entity: "nordwerk-de",
    cycle: "2026",
    summary: [{ orgUnit: "DE-OPS-2", proposals: 86, costEUR: 108310, budgetEUR: 156833, utilisationPct: 69.1, blocking: 1, warnings: 1 }],
    findings: [
      { id: "MC-001", code: "above_guideline", severity: "blocking", orgUnit: "DE-OPS-2", message: "E-00138: 5.5% is above the guideline of 3-4.5% for rating 3 and no reason is given" },
      { id: "MC-002", code: "below_guideline", severity: "warning", orgUnit: "DE-OPS-2", message: "E-00019: 0.9% is below the guideline of 2-3% for rating 3" },
    ],
    notes: [{ orgUnit: "DE-OPS-2", note: "Before sign-off, please change MC-001 (E-00138): 5.5% is above the 3-4.5% range." }],
    findingsAddressed: ["MC-001"],
  },
  findings: [],
  trace: [{ turn: 1, kind: "model", ok: true, ms: 1, detail: "run_script" }],
  model: "simulated-1",
  error: null,
  createdAt: "2026-10-25T10:00:00Z",
  finishedAt: "2026-10-25T10:00:01Z",
  durationMs: 112,
  feedback: null,
  validators: ["schema", "grounded_numbers", "covers_findings", "no_invented_findings"],
  ...over,
});
