import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { SkillReport } from "./runner.js";

/**
 * Evaluation reports in reports/evals/<label>.json and .md. A held-out first run is written once:
 * writing the same label again is refused.
 */
export interface ReportDoc {
  label: string;
  set: string;
  recordedAt: string;
  git: string | null;
  skills: SkillReport[];
}

export function writeReport(root: string, label: string, set: string, skills: SkillReport[], firstRunOnly = false): ReportDoc {
  const dir = join(root, "reports", "evals");
  const json = join(dir, `${label}.json`);
  if (firstRunOnly && existsSync(json)) throw new Error(`${json} exists: a held-out first run is never rewritten`);
  const doc: ReportDoc = { label, set, recordedAt: new Date().toISOString(), git: gitSha(root), skills: skills.map(trim) };
  mkdirSync(dir, { recursive: true });
  writeFileSync(json, `${JSON.stringify(doc, null, 2)}\n`);
  writeFileSync(join(dir, `${label}.md`), markdown(doc));
  return doc;
}

export const readReport = (root: string, label: string): ReportDoc | null => {
  const p = join(root, "reports", "evals", `${label}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as ReportDoc) : null;
};

// outputs are large and the evidence is in the problems and findings; keep the report readable
const trim = (s: SkillReport): SkillReport => ({ ...s, cases: s.cases.map(({ output: _o, ...rest }) => rest) });

function gitSha(root: string): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch {
    return null;
  }
}

const pct = (x: number | null) => (x === null ? "n/a" : `${(x * 100).toFixed(1)}%`);

export function markdown(doc: ReportDoc): string {
  const lines = [`# Evaluation: ${doc.label}`, "", `Set \`${doc.set}\`, recorded ${doc.recordedAt} at ${doc.git ?? "an uncommitted tree"}.`, ""];
  lines.push("| Skill | Version | Model | Cases passed | Injected faults caught | Metrics |", "|---|---|---|---:|---:|---|");
  for (const s of doc.skills) {
    const passed = s.cases.filter((c) => c.passed).length;
    const caught = s.faults.filter((f) => f.caught).length;
    const metrics = Object.entries(s.metrics).map(([k, v]) => `${k} ${pct(v)}`).join(", ");
    lines.push(`| ${s.skill} | ${s.version} | ${s.model} | ${passed}/${s.cases.length} | ${s.faults.length ? `${caught}/${s.faults.length}` : "n/a"} | ${metrics || ""} |`);
  }
  for (const s of doc.skills) {
    const failed = s.cases.filter((c) => !c.passed);
    if (failed.length) {
      lines.push("", `## ${s.skill}: cases that did not pass`, "");
      for (const c of failed) lines.push(`- **${c.id}**${c.title ? ` (${c.title})` : ""}: ${c.problems.join("; ")}${c.findings.length ? ` [${c.findings.join("; ")}]` : ""}`);
    }
    const escaped = s.faults.filter((f) => !f.caught);
    if (escaped.length) {
      lines.push("", `## ${s.skill}: injected faults that got through`, "");
      for (const f of escaped) lines.push(`- ${f.id}: ${f.fault}`);
    }
    if (s.faults.length) {
      lines.push("", `### ${s.skill}: faults by kind`, "", "| Fault | Caught |", "|---|---:|");
      for (const [f, v] of Object.entries(s.byFault)) lines.push(`| ${f} | ${v} |`);
    }
  }
  return `${lines.join("\n")}\n`;
}
