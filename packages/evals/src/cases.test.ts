import { describe, expect, it } from "vitest";

import { check, type Case } from "./cases.js";
import { gate } from "./gate.js";
import { get } from "./paths.js";

const c = (expect: Case["expect"]): Case => ({ id: "x", input: {}, expect });

describe("golden checks", () => {
  const output = { a: { b: 1.04 }, items: [{ code: "x" }, { code: "y" }] };
  it("reads paths, maps over arrays and counts", () => {
    expect(get(output, "items[].code")).toEqual(["x", "y"]);
    expect(get(output, "items.length")).toBe(2);
    expect(get(output, "a.missing.deeper")).toBeUndefined();
  });
  it("compares numbers within 0.05 and reports every difference", () => {
    expect(check(c({ status: "ok", equals: { "a.b": 1 } }), { status: "ok", output })).toEqual([]);
    expect(check(c({ status: "ok", equals: { "a.b": 2 }, includes: { "items[].code": ["z"] } }), { status: "ok", output })).toHaveLength(2);
    expect(check(c({ status: "ok", same_set: { "items[].code": ["y", "x"] } }), { status: "ok", output })).toEqual([]);
  });
  it("stops at the status for runs that did not produce a result", () => {
    expect(check(c({ status: "ok", equals: { "a.b": 1 } }), { status: "failed", output: null })).toEqual(["status failed, expected ok"]);
  });
});

describe("gate", () => {
  const skill = { name: "s", contract: { acceptance: { golden_pass_rate: 1, fault_catch_rate: 1, metrics: { acc: 0.8 } } } } as never;
  const report = (passed: boolean, acc: number) => ({
    label: "now", set: "golden", recordedAt: "", git: null,
    skills: [{ skill: "s", version: "1.0.0", model: "m", cases: [{ id: "c1", passed, problems: [], status: "ok", findings: [], ms: 1 }], passRate: passed ? 1 : 0, faults: [], faultCatchRate: null, byFault: {}, metrics: { acc } }],
  });
  it("applies each skill's thresholds and refuses regressions", () => {
    expect(gate(report(true, 0.9), [skill], null)).toEqual([]);
    expect(gate(report(true, 0.7), [skill], null)).toEqual(["s: acc 0.7 < 0.8"]);
    expect(gate(report(false, 0.9), [skill], { ...report(true, 0.9), label: "release-s-1.0.0" })).toContain("s: regression, c1 passed in release-s-1.0.0 and fails now");
  });
});
