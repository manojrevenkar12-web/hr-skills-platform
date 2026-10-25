import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";

import type { Skill } from "./skill.js";

/**
 * The review standard for a skill, as code. Each rule is one line of docs/SKILL_STANDARD.md;
 * an `error` blocks the merge, a `warning` is for the reviewer.
 */
export type Severity = "error" | "warning";
export interface LintFinding {
  rule: string;
  severity: Severity;
  message: string;
  file?: string;
}
export interface LintOptions {
  /** platform tools a skill may list in contract.tools */
  knownTools: string[];
  minGoldenCases?: number;
}

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIRED_SECTIONS = ["## Steps", "## Output", "## Boundaries"];
const PERSONAL_DATA: [string, RegExp][] = [
  ["e-mail address outside .example", /[A-Za-z0-9._%+-]+@(?![A-Za-z0-9.-]*\.example\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["IBAN", /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}\b/],
  ["phone number", /(?:\+49|\+351|\b0049)[\s\d/-]{7,}/],
  ["German tax id", /\b\d{2} ?\d{3} ?\d{3} ?\d{3}\b/],
];
const SECRETS: [string, RegExp][] = [
  ["API key", /\b(sk-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16})\b/],
  ["credential assignment", /(api[_-]?key|password|secret)\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];

export function lint(skill: Skill, opts: LintOptions): LintFinding[] {
  const out: LintFinding[] = [];
  const err = (rule: string, message: string, file?: string) => out.push({ rule, severity: "error", message, file });
  const warn = (rule: string, message: string, file?: string) => out.push({ rule, severity: "warning", message, file });
  const c = skill.contract;
  const dirName = basename(skill.dir);

  // S01-S03: the Agent Skills format
  if (!NAME.test(skill.name) || skill.name.length > 64) err("S01", `name "${skill.name}" must be 1-64 lowercase letters, digits and single hyphens`, "SKILL.md");
  if (skill.name !== dirName) err("S01", `name "${skill.name}" must match the directory "${dirName}"`, "SKILL.md");
  const d = skill.description;
  if (d.length < 1 || d.length > 1024) err("S02", `description is ${d.length} characters; it must be 1-1024`, "SKILL.md");
  if (!/\bUse (it )?when\b/.test(d)) err("S02", 'description must say when to use the skill ("Use when ...")', "SKILL.md");
  if (skill.bodyLines > 500) err("S03", `SKILL.md body is ${skill.bodyLines} lines; keep it under 500 and move detail to references/`, "SKILL.md");
  if (skill.body.length / 4 > 5000) warn("S03", `SKILL.md body is about ${Math.round(skill.body.length / 4)} tokens; the guidance is under 5,000`, "SKILL.md");

  // S04: structured instructions, and links that resolve one level deep
  for (const s of REQUIRED_SECTIONS) if (!skill.body.includes(`\n${s}`) && !skill.body.startsWith(s)) err("S04", `SKILL.md needs a "${s}" section`, "SKILL.md");
  for (const m of skill.body.matchAll(/\]\(([^)#\s]+)\)/g)) {
    const target = m[1]!;
    if (/^[a-z]+:/.test(target)) continue;
    if (!existsSync(join(skill.dir, target))) err("S04", `link to ${target} does not resolve`, "SKILL.md");
    else if (target.split("/").length > 2) err("S04", `link to ${target} is more than one level deep`, "SKILL.md");
  }

  // S05: one version, in the contract and the frontmatter metadata
  const meta = (skill.frontmatter.metadata ?? {}) as Record<string, unknown>;
  if (meta.version !== c.version) err("S05", `metadata.version (${String(meta.version)}) must equal contract version ${c.version}`, "SKILL.md");
  const allowed = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  for (const k of Object.keys(skill.frontmatter)) if (!allowed.has(k)) err("S05", `frontmatter field "${k}" is not in the Agent Skills spec; put it in metadata`, "SKILL.md");

  // S06: scripts exist, export what the contract says, are tested, and are named in SKILL.md
  for (const [id, s] of Object.entries(c.scripts)) {
    const path = join(skill.dir, s.file);
    if (!existsSync(path)) {
      err("S06", `script ${id}: ${s.file} does not exist`, "contract.yaml");
      continue;
    }
    const src = readFileSync(path, "utf8");
    if (!new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${s.export}\\b`).test(src)) err("S06", `script ${id}: ${s.file} does not export ${s.export}`, s.file);
    if (!existsSync(path.replace(/\.ts$/, ".test.ts"))) err("S06", `script ${id}: ${s.file} has no test next to it`, s.file);
    if (!skill.body.includes(id)) err("S06", `SKILL.md never mentions script ${id}, so the model cannot know to use it`, "SKILL.md");
  }

  // S07: golden cases with acceptance checks
  const goldenPath = join(skill.dir, "evals", "golden.yaml");
  if (!existsSync(goldenPath)) err("S07", "no evals/golden.yaml");
  else {
    const cases = ((parse(readFileSync(goldenPath, "utf8")) as { cases?: { id?: string; input?: unknown; expect?: unknown }[] })?.cases ?? []);
    const min = opts.minGoldenCases ?? 8;
    if (cases.length < min) err("S07", `${cases.length} golden cases; at least ${min} are required`, "evals/golden.yaml");
    const ids = cases.map((x) => x.id);
    if (new Set(ids).size !== ids.length) err("S07", "golden case ids must be unique", "evals/golden.yaml");
    cases.forEach((x, i) => {
      if (!x.id || x.input === undefined || !x.expect) err("S07", `case ${x.id ?? i}: needs id, input and expect`, "evals/golden.yaml");
    });
  }

  // S08: data handling by classification
  if (!c.validators.includes("schema")) err("S08", "every skill validates its output against the contract schema (validator: schema)", "contract.yaml");
  if (c.classification === "aggregate" && !c.validators.includes("aggregate_policy")) err("S08", "an aggregate skill must use the aggregate_policy validator", "contract.yaml");
  if (c.classification === "individual") {
    const wide = c.audience.filter((r) => r !== "comp_partner" && r !== "hr_business_partner");
    if (wide.length) err("S08", `individual pay findings may go only to comp_partner and hr_business_partner, not ${wide.join(", ")}`, "contract.yaml");
  }
  if (hasProse(c.output) && !c.validators.includes("grounded_numbers")) err("S08", "an output with prose must use the grounded_numbers validator", "contract.yaml");

  // S09: a changelog entry for this version
  const changelog = join(skill.dir, "CHANGELOG.md");
  if (!existsSync(changelog) || !readFileSync(changelog, "utf8").includes(`## ${c.version}`)) err("S09", `CHANGELOG.md needs a "## ${c.version}" entry`);

  // S10: only platform tools
  for (const t of c.tools) if (!opts.knownTools.includes(t)) err("S10", `tool ${t} is not a platform tool (${opts.knownTools.join(", ")})`, "contract.yaml");

  // S11-S12: no personal data, no secrets in anything shipped with the skill
  for (const f of skill.files) {
    if (!/\.(md|ya?ml|json|ts|txt|csv)$/.test(f)) continue;
    const text = readFileSync(join(skill.dir, f), "utf8");
    for (const [what, re] of PERSONAL_DATA) if (re.test(text)) err("S11", `${what} found; skills ship invented data only`, f);
    for (const [what, re] of SECRETS) if (re.test(text)) err("S12", `${what} found`, f);
  }
  return out;
}

function hasProse(schema: Record<string, unknown>): boolean {
  const props = (schema.properties ?? {}) as Record<string, { type?: string; "x-prose"?: boolean }>;
  return Object.values(props).some((p) => p["x-prose"] === true);
}
