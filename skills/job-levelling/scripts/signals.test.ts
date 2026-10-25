import { describe, expect, it } from "vitest";

import { extractSignals } from "./signals.ts";

describe("extractSignals", () => {
  it("finds experience, people managed and scope, with the exact words", async () => {
    const r = await extractSignals({
      jobDescription: "You lead a team of 6 engineers and set the direction for our data platform across the company. At least 8 years of experience in software engineering.",
    });
    expect(r.yearsMin).toBe(8);
    expect(r.peopleManaged).toBe(6);
    expect(r.signals.find((s) => s.kind === "scope")?.quote).toBe("across the company");
    expect(r.signals.find((s) => s.kind === "autonomy")?.quote).toBe("set the direction");
    expect(r.familyScores.engineering).toBeGreaterThan(r.familyScores.operations!);
  });

  it("notices managing managers", async () => {
    const r = await extractSignals({ jobDescription: "As Head of Depots you manage managers of eight depots and are accountable for a budget of EUR 12 million in the region." });
    expect(r.managesManagers).toBe(true);
    expect(r.signals.find((s) => s.kind === "budget")?.value).toBe("12 million");
  });

  it("refuses a description too short to level", async () => {
    await expect(extractSignals({ jobDescription: "Driver wanted." })).rejects.toThrow(/too short/);
  });
});
