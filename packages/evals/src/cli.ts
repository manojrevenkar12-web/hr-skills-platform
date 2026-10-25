#!/usr/bin/env node

import { join } from "node:path";

import { repoRoot } from "@hsp/hr-data";
import { providerFromEnv } from "@hsp/harness";
import { appendRelease, checkRelease, diffContracts, latest, lint, loadSkill, readRegistry, skillDirs, type Skill } from "@hsp/skill-kit";
import { REFERENCE_TOOLS } from "@hsp/hr-mcp";

import { goldenFile, heldoutSets } from "./cases.js";
import { gate } from "./gate.js";
import { markdown, readReport, writeReport } from "./report.js";
import { evaluateSkill } from "./runner.js";

/**
 * hsp: the platform's command line.
 *   lint [skill]                 the review standard (docs/SKILL_STANDARD.md)
 *   release-check [skill]        what releasing each changed skill needs (version bump, review)
 *   eval [label] [--skill s]     golden cases + injected faults, writes reports/evals/<label>
 *   gate [label]                 acceptance thresholds and no regression since the last release
 *   heldout <skill> <set>        records a held-out set's first run, once
 *   regression <skill> <set>     re-runs a studied held-out set (STATUS = regression)
 *   release <skill> --by <name>  lint + checks + eval + gate, then appends to registry/
 */
const root = repoRoot();
const [cmd = "help", ...rest] = process.argv.slice(2);
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const positional = rest.filter((x, i) => !x.startsWith("--") && !rest[i - 1]?.startsWith("--"));
const skills = skillDirs(root).map(loadSkill);
const pick = (name?: string): Skill[] => (name ? skills.filter((s) => s.name === name) : skills);
const knownTools = REFERENCE_TOOLS.map((t) => `mcp:${t}`);

async function main(): Promise<number> {
  switch (cmd) {
    case "lint": {
      let errors = 0;
      for (const s of pick(positional[0])) {
        const findings = lint(s, { knownTools });
        errors += findings.filter((f) => f.severity === "error").length;
        console.log(`${findings.length ? "✗" : "✓"} ${s.name} ${s.contract.version}`);
        for (const f of findings) console.log(`  ${f.severity} ${f.rule} ${f.file ?? ""}: ${f.message}`);
      }
      return errors ? 1 : 0;
    }
    case "release-check": {
      let blocked = 0;
      for (const s of pick(positional[0])) {
        const c = checkRelease(s, root);
        console.log(`${c.skill}: ${c.status}${c.previous ? ` (released ${c.previous}, now ${c.version})` : ` (${c.version})`}${c.needed ? `, needs a ${c.needed} bump` : ""}`);
        for (const ch of c.changes) console.log(`  ${ch.bump}${ch.review ? " + review" : ""} ${ch.path}: ${ch.what}`);
        for (const p of c.problems) console.log(`  blocked: ${p}`);
        if (c.status === "blocked") blocked++;
      }
      return blocked ? 1 : 0;
    }
    case "eval": {
      const label = positional[0] ?? "dev";
      const reports = [];
      for (const s of pick(flag("skill"))) reports.push(await evaluateSkill(s, skills, goldenFile(s), { provider: providerFromEnv() ?? undefined }));
      const doc = writeReport(root, label, "golden", reports);
      process.stdout.write(markdown(doc));
      return 0;
    }
    case "gate": {
      const label = positional[0] ?? "dev";
      const doc = readReport(root, label);
      if (!doc) throw new Error(`no report ${label}; run hsp eval ${label} first`);
      const failures = gate(doc, skills, null);
      for (const s of skills) {
        const rel = latest(readRegistry(root, s.name));
        if (!rel) continue;
        const base = readReport(root, rel.evaluation.report);
        failures.push(...gate({ ...doc, skills: doc.skills.filter((x) => x.skill === s.name) }, skills, base).filter((f) => f.includes("regression")));
      }
      for (const f of failures) console.error(`GATE FAILED: ${f}`);
      if (!failures.length) console.log("evaluation gate passed");
      return failures.length ? 1 : 0;
    }
    case "heldout":
    case "regression": {
      const [name, set] = positional;
      const s = skills.find((x) => x.name === name);
      const h = s && heldoutSets(s).find((x) => x.name === set);
      if (!s || !h) throw new Error(`no held-out set ${set} for ${name}`);
      if (cmd === "heldout" && h.status) throw new Error(`${name}/${set} is marked ${h.status}; it is no longer held out`);
      if (cmd === "regression" && h.status !== "regression") throw new Error(`${name}/${set} is still held out; record its first run with hsp heldout`);
      const report = await evaluateSkill(s, skills, join(h.dir, "cases.yaml"), { provider: providerFromEnv() ?? undefined, faults: false });
      const label = `${cmd}-${name}-${set}${providerFromEnv() ? `-${providerFromEnv()!.model}` : ""}`;
      const doc = writeReport(root, label, `${name}/evals/heldout/${set}`, [report], cmd === "heldout");
      process.stdout.write(markdown(doc));
      return 0;
    }
    case "release": {
      const s = skills.find((x) => x.name === positional[0]);
      const by = flag("by");
      if (!s || !by) throw new Error("usage: hsp release <skill> --by <approver>");
      const lintErrors = lint(s, { knownTools }).filter((f) => f.severity === "error");
      if (lintErrors.length) throw new Error(`lint: ${lintErrors.map((f) => `${f.rule} ${f.message}`).join("; ")}`);
      const check = checkRelease(s, root);
      if (check.status === "unchanged") throw new Error(`${s.name} ${s.contract.version} is already released with this content`);
      if (check.status === "blocked") throw new Error(check.problems.join("; "));
      if (check.changes.some((c) => c.review) && !flag("reviewed-by")) throw new Error(`these changes need a data-protection review: pass --reviewed-by <name> (${check.changes.filter((c) => c.review).map((c) => c.what).join("; ")})`);
      const label = `release-${s.name}-${s.contract.version}`;
      const report = await evaluateSkill(s, skills, goldenFile(s));
      const doc = writeReport(root, label, "golden", [report], true);
      const prev = latest(readRegistry(root, s.name));
      const failures = gate(doc, skills, prev ? readReport(root, prev.evaluation.report) : null);
      if (failures.length) throw new Error(`gate: ${failures.join("; ")}`);
      const r = appendRelease(root, s, {
        releasedAt: new Date().toISOString(),
        approvedBy: flag("reviewed-by") ? `${by}; data-protection review: ${flag("reviewed-by")}` : by,
        evaluation: { goldenPassRate: report.passRate, faultCatchRate: report.faultCatchRate ?? 1, metrics: report.metrics, report: label },
        changes: prev ? diffContracts(prev.contract, s.contract) : [],
      });
      console.log(`released ${s.name} ${r.version} (${r.contentHash.slice(0, 12)}), approved by ${r.approvedBy}`);
      return 0;
    }
    default:
      console.log("usage: hsp lint|release-check|eval|gate|heldout|regression|release ...  (see packages/evals/src/cli.ts)");
      return cmd === "help" ? 0 : 1;
  }
}

main().then(
  (code) => (process.exitCode = code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  },
);

