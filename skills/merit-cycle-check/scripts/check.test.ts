import { describe, expect, it } from "vitest";

import { generate, INJECTED, MemorySource } from "@hsp/hr-data";

import { checkProposals } from "./check.ts";
import { cycle, repeat, type Proposal } from "./testkit.ts";

const run = (rows: Proposal[], orgUnit?: string) => checkProposals({ entity: "test-co", cycle: "2026", orgUnit }, { source: new MemorySource(cycle(rows)) });
const codes = async (rows: Proposal[]) => (await run(rows)).findings.map((f) => `${f.severity}:${f.code}`);

describe("checkProposals", () => {
  // rating 3 at compa 0.95 → guideline 2.5-3.5%
  const ok: Proposal = { rating: 3, compa: 0.95, pct: 3 };

  it("finds nothing when every proposal is inside its guideline and the budget", async () => {
    expect(await codes(repeat(4, ok))).toEqual([]);
  });

  it("blocks an increase above the guideline without a reason, and only warns with one", async () => {
    expect(await codes([...repeat(3, ok), { ...ok, pct: 3.8 }])).toEqual(["blocking:above_guideline"]);
    expect(await codes([...repeat(3, ok), { ...ok, pct: 3.8, reason: "Took over a second depot." }])).toEqual(["warning:above_guideline"]);
  });

  it("blocks any increase for a rating of 1", async () => {
    expect(await codes([...repeat(3, ok), { rating: 1, compa: 1.0, pct: 1 }])).toContain("blocking:rating_one_increase");
  });

  it("blocks a proposal that takes pay above the band maximum", async () => {
    // rating 5 at compa 1.18 → guideline 3-4%; 3.5% takes it to 1.221 × mid > 1.2 × mid
    const f = (await run([...repeat(6, ok), { rating: 5, compa: 1.18, pct: 3.5 }])).findings;
    expect(f.map((x) => x.code)).toContain("above_band_max");
  });

  it("blocks an org unit whose proposals cost more than its budget", async () => {
    // rating 5 at compa 0.85 → guideline 6-8%: all inside guideline, but 7% > 3.5% budget
    expect(await codes(repeat(4, { rating: 5, compa: 0.85, pct: 7 }))).toEqual(["blocking:budget_exceeded"]);
  });

  it("compares women and men only at the same level and rating", async () => {
    const women = repeat(4, { ...ok, gender: "F", pct: 2.5 });
    const men = repeat(4, { ...ok, gender: "M", pct: 3.5 });
    const r = await run([...women, ...men]);
    expect(r.findings.find((f) => f.code === "equity_gap")?.values.gapPp).toBe(-1);
    // a gap that comes only from different ratings is not an equity finding
    const byRating = await run([...repeat(4, { gender: "F", rating: 3, compa: 0.95, pct: 3 }), ...repeat(4, { gender: "M", rating: 4, compa: 0.95, pct: 4.5 })]);
    expect(byRating.findings.map((f) => f.code)).not.toContain("equity_gap");
  });

  it("checks one org unit when asked, and numbers findings in a stable order", async () => {
    const r = await run([...repeat(2, { ...ok, orgUnit: "DE-OPS-1" }), { ...ok, pct: 9, orgUnit: "DE-OPS-2" }], "DE-OPS-2");
    expect(r.summary.map((s) => s.orgUnit)).toEqual(["DE-OPS-2"]);
    expect(r.findings[0]?.id).toBe("MC-001");
  });

  it("finds the equity gap injected into the synthetic company", async () => {
    const r = await checkProposals({ entity: "nordwerk-de", cycle: "2026" }, { source: new MemorySource(generate()) });
    expect(r.findings.filter((f) => f.code === "equity_gap").map((f) => f.orgUnit)).toContain(INJECTED.meritEquity.orgUnit);
  });

  it("refuses a cycle it has no guideline for", async () => {
    await expect(checkProposals({ entity: "test-co", cycle: "2025" }, { source: new MemorySource(cycle([ok])) })).rejects.toThrow(/no guideline/);
  });
});
