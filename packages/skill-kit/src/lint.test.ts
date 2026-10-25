import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "@hsp/hr-data";

import { lint } from "./lint.js";
import { loadSkill } from "./skill.js";
import { copySkill } from "./testing.js";

const SRC = join(repoRoot(), "skills", "pay-gap-report");
const opts = { knownTools: ["mcp:job_architecture"] };
const rulesAfter = (file: string, f: (s: string) => string) => {
  const c = copySkill(SRC);
  c.edit(file, f);
  return lint(loadSkill(c.dir), opts).map((x) => x.rule);
};

describe("the review standard", () => {
  it("passes the shipped skills", () => {
    for (const s of ["pay-gap-report", "merit-cycle-check", "job-levelling"]) expect(lint(loadSkill(join(repoRoot(), "skills", s)), opts)).toEqual([]);
  });

  it("rejects a name that does not match the directory, and a description that never says when to use it", () => {
    expect(rulesAfter("SKILL.md", (s) => s.replace("name: pay-gap-report", "name: PayGap"))).toContain("S01");
    expect(rulesAfter("SKILL.md", (s) => s.replace(/Use when[^\n]*/, "It is useful."))).toContain("S02");
  });

  it("requires the Steps, Output and Boundaries sections and links that resolve", () => {
    expect(rulesAfter("SKILL.md", (s) => s.replace("## Boundaries", "## Limits"))).toContain("S04");
    expect(rulesAfter("SKILL.md", (s) => s.replace("references/method.md", "references/missing.md"))).toContain("S04");
  });

  it("keeps one version in the contract, the frontmatter and the changelog", () => {
    expect(rulesAfter("contract.yaml", (s) => s.replace("version: 1.0.0", "version: 1.1.0"))).toEqual(expect.arrayContaining(["S05", "S09"]));
  });

  it("requires every script to exist, be tested and be named in the instructions", () => {
    expect(rulesAfter("contract.yaml", (s) => s.replace("export: computeIndicators", "export: computeAll"))).toContain("S06");
    expect(rulesAfter("SKILL.md", (s) => s.replaceAll("compute_indicators", "the script"))).toContain("S06");
  });

  it("requires an aggregate skill to use the aggregate policy, and prose to be grounded", () => {
    expect(rulesAfter("contract.yaml", (s) => s.replace("validators: [schema, aggregate_policy, grounded_numbers,", "validators: [schema,"))).toEqual(expect.arrayContaining(["S08"]));
  });

  it("refuses personal data and secrets anywhere in the skill", () => {
    expect(rulesAfter("references/method.md", (s) => `${s}\nContact: anna.schulz@nordwerk.de`)).toContain("S11");
    expect(rulesAfter("references/method.md", (s) => `${s}\napi_key: "sk-ant-abcdefghijklmnopqrstuv"`)).toContain("S12");
  });

  it("refuses tools that are not platform tools", () => {
    expect(rulesAfter("contract.yaml", (s) => s.replace("tools: []", "tools: [mcp:salary_database]"))).toContain("S10");
  });
});
