import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "@hsp/hr-data";

import { bumpOf, diffContracts, requiredBump, satisfies } from "./compat.js";
import type { Contract } from "./contract.js";
import { loadSkill } from "./skill.js";

const base = loadSkill(join(repoRoot(), "skills", "job-levelling")).contract;
const clone = (f: (c: Contract) => void): Contract => {
  const c = JSON.parse(JSON.stringify(base)) as Contract;
  f(c);
  return c;
};
const props = (s: Record<string, unknown>) => s.properties as Record<string, Record<string, unknown>>;

describe("backwards compatibility", () => {
  it("treats a new optional input as minor and a new required one as major", () => {
    const optional = clone((c) => (props(c.inputs).language = { type: "string" }));
    expect(requiredBump(diffContracts(base, optional), true)).toBe("minor");
    const required = clone((c) => {
      props(c.inputs).language = { type: "string" };
      (c.inputs.required as string[]).push("language");
    });
    expect(requiredBump(diffContracts(base, required), true)).toBe("major");
  });

  it("treats a removed output field, or a new value callers may receive, as major", () => {
    expect(requiredBump(diffContracts(base, clone((c) => delete props(c.output).rationale)), true)).toBe("major");
    const wider = clone((c) => (props(c.output).confidence!.enum = ["high", "medium", "low", "none"]));
    expect(diffContracts(base, wider)).toEqual([expect.objectContaining({ bump: "major", what: "may now return none" })]);
  });

  it("asks for a data-protection review when the audience widens or checks are removed", () => {
    const wider = clone((c) => c.audience.push("hr_leadership"));
    expect(diffContracts(base, wider)).toEqual([expect.objectContaining({ bump: "minor", review: true })]);
    const fewer = clone((c) => (c.validators = c.validators.filter((v) => v !== "quotes_in_input")));
    expect(diffContracts(base, fewer)[0]?.review).toBe(true);
  });

  it("compares versions", () => {
    expect(bumpOf("1.2.3", "2.0.0")).toBe("major");
    expect(bumpOf("1.2.3", "1.2.3")).toBe("none");
    expect(bumpOf("1.2.3", "1.1.9")).toBe("backwards");
    expect(satisfies("minor", "major")).toBe(false);
    expect(satisfies("major", "minor")).toBe(true);
    expect(satisfies("patch", null)).toBe(true);
  });
});
