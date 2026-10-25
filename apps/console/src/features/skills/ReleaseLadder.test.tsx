import { skill } from "../../test/fixtures";
import { rungs } from "./ReleaseLadder";

describe("the release ladder", () => {
  it("lights a rung only when it is met", () => {
    expect(rungs(skill()).map((r) => r.state)).toEqual(["met", "met", "met", "met", "open"]);
  });
  it("shows a weak held-out metric, a failing golden case and a blocked release as needing attention", () => {
    const s = skill({
      evaluation: { recordedAt: "", model: "m", passed: 15, cases: 16, faultsCaught: 75, faults: 75, metrics: {} },
      heldout: [{ set: "set1", status: "held out", firstRun: { passed: 50, cases: 50, metrics: { level_exact: 0.28 }, model: "m" } }],
      released: { version: "1.0.0", at: "", approvedBy: "x" },
      releaseStatus: "blocked",
    });
    const r = rungs(s);
    expect(r.map((x) => x.state)).toEqual(["met", "warn", "met", "warn", "warn"]);
    expect(r[3]!.detail).toBe("level exact 28%");
  });
});
