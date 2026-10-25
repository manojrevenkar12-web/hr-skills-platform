export type Role = "comp_partner" | "hr_business_partner" | "hr_leadership" | "people_analytics" | "recruiter";
export type RunStatus = "queued" | "running" | "ok" | "held" | "failed" | "refused";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: (string | number | null)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  description?: string;
}

export interface LintFinding {
  rule: string;
  severity: "error" | "warning";
  message: string;
}

export interface SkillSummary {
  name: string;
  description: string;
  version: string;
  owner: string;
  classification: "aggregate" | "individual";
  audience: Role[];
  inputs: JsonSchema;
  validators: string[];
  released: { version: string; at: string; approvedBy: string } | null;
  releaseStatus: "unchanged" | "ready" | "blocked" | "first";
  releaseProblems: string[];
  lint: LintFinding[];
  evaluation: { recordedAt: string; model: string; passed: number; cases: number; faultsCaught: number; faults: number; metrics: Record<string, number> } | null;
  heldout: { set: string; status: string; firstRun: { passed: number; cases: number; metrics: Record<string, number>; model: string } | null }[];
  canRun: boolean;
}

export interface Catalogue {
  model: string;
  skills: SkillSummary[];
}

export interface TraceStep {
  turn: number;
  kind: "model" | "tool";
  name?: string;
  ok?: boolean;
  ms: number;
  detail?: string;
}

export interface Feedback {
  rating: "useful" | "partly" | "not_useful";
  minutesSaved: number | null;
  issues: string[];
  comment: string;
}

export interface Run {
  id: string;
  skill: string;
  version: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  findings: { validator: string; message: string }[];
  trace: TraceStep[];
  model: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  feedback: Feedback | null;
  validators: string[];
}

export interface PilotSkill {
  skill: string;
  runs: number;
  users: number;
  ok: number;
  held: number;
  failed: number;
  refused: number;
  rated: number;
  useful: number;
  partly: number;
  notUseful: number;
  medianMinutesSaved: number | null;
  minutesSaved: number;
  p95Ms: number | null;
  issues: { issue: string; n: number }[];
}

export interface PilotSummary {
  windowDays: number;
  skills: PilotSkill[];
  weekly: { week: string; users: number; runs: number }[];
}

export interface AuditEvent {
  id: number;
  at: string;
  actor: string | null;
  role: string | null;
  action: string;
  subject: string | null;
  ok: boolean;
}
