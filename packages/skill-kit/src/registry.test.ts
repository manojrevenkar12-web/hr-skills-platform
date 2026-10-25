import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "@hsp/hr-data";

import { appendRelease, checkRelease } from "./registry.js";
import { loadSkill } from "./skill.js";
import { copySkill } from "./testing.js";

const evaluation = { goldenPassRate: 1, faultCatchRate: 1, metrics: {}, report: "release-test" };

describe("releases", () => {
  it("blocks a changed skill whose version did not move, and asks for the right bump", () => {
    const root = mkdtempSync(join(tmpdir(), "hsp-reg-"));
    const c = copySkill(join(repoRoot(), "skills", "job-levelling"));
    appendRelease(root, loadSkill(c.dir), { releasedAt: "2026-10-25T00:00:00Z", approvedBy: "test", evaluation, changes: [] });
    expect(checkRelease(loadSkill(c.dir), root).status).toBe("unchanged");

    c.edit("SKILL.md", (s) => s.replace("Levels are decided", "Levels are always decided"));
    expect(checkRelease(loadSkill(c.dir), root)).toMatchObject({ status: "blocked", needed: "patch" });

    c.edit("contract.yaml", (s) => s.replace("required: [family, level, confidence, needsReview, evidence, rationale]", "required: [family, level, confidence, needsReview, evidence]"));
    for (const f of ["contract.yaml", "SKILL.md"]) c.edit(f, (s) => s.replace(/1\.0\.0/g, "1.0.1"));
    expect(checkRelease(loadSkill(c.dir), root)).toMatchObject({ status: "blocked", needed: "major" });

    for (const f of ["contract.yaml", "SKILL.md"]) c.edit(f, (s) => s.replace(/1\.0\.1/g, "2.0.0"));
    expect(checkRelease(loadSkill(c.dir), root).status).toBe("ready");
  });

  it("never records the same version twice", () => {
    const root = mkdtempSync(join(tmpdir(), "hsp-reg-"));
    const s = loadSkill(join(repoRoot(), "skills", "job-levelling"));
    appendRelease(root, s, { releasedAt: "x", approvedBy: "a", evaluation, changes: [] });
    expect(() => appendRelease(root, s, { releasedAt: "x", approvedBy: "a", evaluation, changes: [] })).toThrow(/already released/);
  });
});
