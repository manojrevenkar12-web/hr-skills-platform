import type { Skill } from "@hsp/skill-kit";

import type { ReportDoc } from "./report.js";

/**
 * The release gate: each skill's own acceptance thresholds (contract.yaml), plus no regression
 * against the report of its last release (a golden case that passed then must pass now).
 */
export function gate(doc: ReportDoc, skills: Skill[], baseline: ReportDoc | null): string[] {
  const out: string[] = [];
  for (const s of doc.skills) {
    const skill = skills.find((x) => x.name === s.skill);
    if (!skill) continue;
    const a = skill.contract.acceptance;
    if (s.passRate < a.golden_pass_rate) out.push(`${s.skill}: golden pass rate ${s.passRate} < ${a.golden_pass_rate}`);
    if (s.faultCatchRate !== null && s.faultCatchRate < a.fault_catch_rate) out.push(`${s.skill}: fault catch rate ${s.faultCatchRate} < ${a.fault_catch_rate}`);
    for (const [m, min] of Object.entries(a.metrics)) {
      const v = s.metrics[m];
      if (v === undefined) out.push(`${s.skill}: metric ${m} missing from the report`);
      else if (v < min) out.push(`${s.skill}: ${m} ${v} < ${min}`);
    }
    const before = baseline?.skills.find((x) => x.skill === s.skill);
    if (before)
      for (const c of before.cases.filter((x) => x.passed)) {
        const now = s.cases.find((x) => x.id === c.id);
        if (now && !now.passed) out.push(`${s.skill}: regression, ${c.id} passed in ${baseline!.label} and fails now`);
      }
  }
  return out;
}
