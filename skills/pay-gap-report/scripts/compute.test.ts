import { describe, expect, it } from "vitest";

import { checkAggregate, generate, MemorySource } from "@hsp/hr-data";

import { computeIndicators } from "./compute.ts";
import { company, many } from "./testkit.ts";

const run = (people: Parameters<typeof company>[0]) => computeIndicators({ entity: "test-co", year: 2026 }, { source: new MemorySource(company(people)) });

describe("computeIndicators", () => {
  it("computes the Art. 9 gaps the way the Directive defines them", async () => {
    const r = await run([...many(6, { gender: "F", hourly: 20 }), ...many(6, { gender: "M", hourly: 25 })]);
    expect(r.indicators.meanGapPct).toBe(20);
    expect(r.indicators.medianGapPct).toBe(20);
    expect(r.indicators.quartiles.map((q) => q.womenPct)).toEqual([100, 100, 0, 0]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ id: "PG-001", category: "operations/L3", totalMeanGapPct: 20 });
  });

  it("flags a category at 5% either way, not at 4.9%", async () => {
    const at = (w: number) => run([...many(6, { gender: "F", hourly: w }), ...many(6, { gender: "M", hourly: 100 })]);
    expect((await at(95.1)).findings).toHaveLength(0);
    expect((await at(95)).findings).toHaveLength(1);
    expect((await at(106)).findings[0]?.totalMeanGapPct).toBe(-6);
  });

  it("suppresses pay figures for a category with fewer than six women or men", async () => {
    const r = await run([
      ...many(6, { gender: "F", hourly: 20 }), ...many(6, { gender: "M", hourly: 20 }),
      ...many(5, { gender: "F", hourly: 30, level: "L5" }), ...many(9, { gender: "M", hourly: 40, level: "L5" }),
    ]);
    const small = r.categories.find((c) => c.category === "operations/L5")!;
    expect(small).toMatchObject({ suppressed: true, totalMeanGapPct: null, flagged: false });
    expect(checkAggregate(r)).toEqual([]);
  });

  it("separates basic pay from complementary and variable pay", async () => {
    const r = await run([...many(6, { gender: "F", hourly: 20, extras: 0 }), ...many(6, { gender: "M", hourly: 20, extras: 1000 })]);
    expect(r.categories[0]!.basicMeanGapPct).toBe(0);
    expect(r.indicators.variableMeanGapPct).toBe(100);
    expect(r.indicators.receivingVariable).toEqual({ womenPct: 0, menPct: 100 });
  });

  it("shows how much of a gap tenure explains, without calling it justified", async () => {
    // pay rises with tenure; the women are newer, so the raw gap is explained by tenure
    const people = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2025].flatMap((y, i) => {
      const hourly = 20 * Math.exp(0.03 * (2026 - y));
      return [{ gender: (i < 6 ? "M" : "F") as "M" | "F", hourly, hireDate: `${y}-12-31` }];
    });
    const r = await run([...people, ...people.map((p) => ({ ...p, gender: (p.gender === "M" ? "F" : "M") as "M" | "F", hourly: p.hourly * 1.0 }))].slice(0, 12));
    const f = r.findings[0]!;
    expect(f.totalMeanGapPct).toBeGreaterThan(5);
    expect(Math.abs(f.adjustedBasicGapPct!)).toBeLessThan(1);
  });

  it("refuses an entity too small to report without identifying people", async () => {
    await expect(run([...many(3, { gender: "F", hourly: 20 }), ...many(9, { gender: "M", hourly: 20 })])).rejects.toThrow(/too few women/);
  });

  it("finds the gap injected into the synthetic company, and only group figures leave", async () => {
    const r = await computeIndicators({ entity: "nordwerk-de", year: 2026 }, { source: new MemorySource(generate()) });
    expect(r.findings.map((f) => f.category)).toContain("operations/L3");
    expect(r.indicators.meanGapPct!).toBeGreaterThan(5);
    expect(checkAggregate(r)).toEqual([]);
  });
});
