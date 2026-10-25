import { Ajv } from "ajv";

import { checkAggregate, FAMILIES, LEVELS } from "@hsp/hr-data";
import type { Skill, ValidatorName } from "@hsp/skill-kit";

/**
 * The checks a skill's output must pass before anyone sees it. Each is deterministic, names what
 * is wrong, and blocks: a held output is shown with its findings and cannot be used as it is.
 */
export interface ValidatorFinding {
  validator: ValidatorName;
  message: string;
}
export interface ValidationContext {
  skill: Skill;
  input: Record<string, unknown>;
  /** the parsed results of every successful script and tool call in the run */
  toolResults: unknown[];
}

const ajv = new Ajv({ allErrors: true, strict: false });
const compiled = new Map<string, ReturnType<Ajv["compile"]>>();

export function validate(output: unknown, ctx: ValidationContext): ValidatorFinding[] {
  const out: ValidatorFinding[] = [];
  for (const v of ctx.skill.contract.validators) out.push(...RUN[v](output, ctx).map((message) => ({ validator: v, message })));
  return out;
}

const RUN: Record<ValidatorName, (output: unknown, ctx: ValidationContext) => string[]> = {
  schema(output, { skill }) {
    const key = `${skill.name}@${skill.contract.version}`;
    let fn = compiled.get(key);
    if (!fn) compiled.set(key, (fn = ajv.compile(stripExtensions(skill.contract.output))));
    return fn(output) ? [] : (fn.errors ?? []).map((e) => `${e.instancePath || "output"} ${e.message ?? "is invalid"}`);
  },

  grounded_numbers(output, { skill, input, toolResults }) {
    const known = new Set<string>();
    for (const v of [...toolResults, input, skill.contract.allowedNumbers]) for (const n of numbersIn(v)) for (const f of forms(n)) known.add(f);
    const stray: string[] = [];
    for (const text of proseOf(output, skill.contract.output))
      for (const raw of text.match(NUMBER) ?? []) {
        const n = normalise(raw);
        if (n !== null && !known.has(String(n)) && !known.has(String(Math.abs(n)))) stray.push(raw.trim());
      }
    return [...new Set(stray)].map((n) => `the number ${n} in the text does not come from the data or the input`);
  },

  aggregate_policy(output) {
    return checkAggregate(output).map((v) => `${v.rule} at ${v.path}: ${v.detail}`);
  },

  covers_findings(output, { toolResults }) {
    const addressed = new Set(((output as { findingsAddressed?: string[] })?.findingsAddressed ?? []).map(String));
    return scriptFindings(toolResults)
      .filter((f) => f.severity === "blocking")
      .filter((f) => !addressed.has(f.id))
      .map((f) => `blocking finding ${f.id} (${f.code}) is not addressed`);
  },

  no_invented_findings(output, { toolResults }) {
    const ids = new Set(scriptFindings(toolResults).map((f) => f.id));
    const mentioned = new Set<string>(JSON.stringify(output ?? null).match(FINDING_ID) ?? []);
    return [...mentioned].filter((id) => !ids.has(id)).map((id) => `finding ${id} was not returned by any check`);
  },

  quotes_in_input(output, { input }) {
    const text = squash(Object.values(input).filter((v) => typeof v === "string").join("\n"));
    const quotes = ((output as { evidence?: { quote?: string }[] })?.evidence ?? []).map((e) => String(e.quote ?? ""));
    return quotes.filter((q) => q.trim().length < 4 || !text.includes(squash(q))).map((q) => `evidence "${q.slice(0, 60)}" is not in the input`);
  },

  known_levels(output) {
    const o = (output ?? {}) as { level?: unknown; family?: unknown };
    const out: string[] = [];
    if (o.level !== undefined && o.level !== null && !LEVELS.includes(o.level as never)) out.push(`level ${String(o.level)} is not in the job architecture`);
    if (o.family !== undefined && o.family !== null && !FAMILIES.includes(o.family as never)) out.push(`family ${String(o.family)} is not in the job architecture`);
    return out;
  },
};

export const FINDING_ID = /\b[A-Z]{2,3}-\d{3}\b/g;

interface ScriptFinding {
  id: string;
  code: string;
  severity: string;
}
function scriptFindings(results: unknown[]): ScriptFinding[] {
  return results.flatMap((r) => ((r as { findings?: ScriptFinding[] })?.findings ?? []).filter((f) => f && typeof f.id === "string"));
}

// numbers in prose: 12.4, -3, 1,234.5 (thousands separators), 7.5%
const NUMBER = /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/g;

function normalise(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function forms(n: number): string[] {
  const out = new Set<string>([String(n), String(Math.abs(n))]);
  for (const d of [0, 1, 2]) {
    const r = Number(n.toFixed(d));
    out.add(String(r));
    out.add(String(Math.abs(r)));
  }
  return [...out];
}

function numbersIn(v: unknown, out: number[] = []): number[] {
  if (typeof v === "number") out.push(v);
  else if (typeof v === "string") for (const m of v.match(NUMBER) ?? []) {
    const n = normalise(m);
    if (n !== null) out.push(n);
  }
  else if (Array.isArray(v)) v.forEach((x) => numbersIn(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => numbersIn(x, out));
  return out;
}

/** The prose fields of an output: properties marked "x-prose": true in the contract, at any depth. */
function proseOf(output: unknown, schema: Record<string, unknown>): string[] {
  const out: string[] = [];
  const walk = (v: unknown, s: Record<string, unknown> | undefined) => {
    if (!s || v === null || v === undefined) return;
    if (s["x-prose"] === true && typeof v === "string") out.push(v);
    const props = s.properties as Record<string, Record<string, unknown>> | undefined;
    if (props && typeof v === "object" && !Array.isArray(v)) for (const [k, ps] of Object.entries(props)) walk((v as Record<string, unknown>)[k], ps);
    const items = s.items as Record<string, unknown> | undefined;
    if (items && Array.isArray(v)) v.forEach((x) => walk(x, items));
  };
  walk(output, schema);
  return out;
}

function stripExtensions(schema: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(schema, (k, v) => (k.startsWith("x-") ? undefined : v))) as Record<string, unknown>;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
