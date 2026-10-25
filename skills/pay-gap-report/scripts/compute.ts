import { readFileSync } from "node:fs";

import type { Employee, PayRecord, ScriptContext } from "@hsp/hr-data";

import { gapPct, mean, median, ols, round1 } from "./stats.ts";

/**
 * The gender pay gap indicators of Directive (EU) 2023/970, Art. 9(1)(a)-(g), for one legal
 * entity and calendar year, from pay actually received. Only group figures leave this function:
 * no employee id, and no pay figure for a category with fewer than `minPerGender` women or men.
 *
 * Method (references/method.md):
 * - hourly pay = (base + complementary + variable) / hours paid; basic hourly = base / hours paid;
 * - "complementary or variable components" = complementary + variable, per worker, annual;
 * - gap = (men - women) / men × 100, on means and on medians;
 * - categories of workers = job family × level of the job architecture (the client's proxy for
 *   work of equal value; the Directive leaves the categories to the employer's job evaluation);
 * - a category with a gap of at least 5% either way is a finding: it needs a justification by
 *   objective, gender-neutral criteria or correction (Art. 10), and a person decides which;
 * - for such a category, the gap in basic hourly pay after allowing for tenure and location
 *   (log-linear OLS) is shown as decision support, not as a justification.
 */
export interface PayGapArgs {
  entity: string;
  year: number;
}

const T = JSON.parse(readFileSync(new URL("../assets/thresholds.json", import.meta.url), "utf8")) as {
  jointAssessmentTriggerPct: number;
  minPerGender: number;
  minForAdjustment: number;
};

interface Row {
  e: Employee;
  hourly: number;
  basicHourly: number;
  extras: number;
  tenure: number;
}

export async function computeIndicators(args: PayGapArgs, ctx: ScriptContext) {
  const { entity, year } = args;
  if (!entity || !Number.isInteger(year)) throw new Error("entity (string) and year (integer) are required");
  const employees = await ctx.source.employees(entity);
  if (!employees.length) throw new Error(`no employees in entity ${entity}`);
  const pay = new Map((await ctx.source.pay(entity, year)).map((p) => [p.employeeId, p] as [string, PayRecord]));
  const yearEnd = Date.UTC(year, 11, 31);

  const rows: Row[] = [];
  for (const e of employees) {
    const p = pay.get(e.id);
    if (!p || p.hoursPaid <= 0) continue;
    rows.push({
      e,
      hourly: (p.base + p.complementary + p.variable) / p.hoursPaid,
      basicHourly: p.base / p.hoursPaid,
      extras: p.complementary + p.variable,
      tenure: Math.max(0, (yearEnd - Date.parse(e.hireDate)) / (365.25 * 86400000)),
    });
  }
  if (!rows.length) throw new Error(`no pay records for ${entity} in ${year}`);
  const women = rows.filter((r) => r.e.gender === "F");
  const men = rows.filter((r) => r.e.gender === "M");
  if (women.length < T.minPerGender || men.length < T.minPerGender)
    throw new Error(`too few women (${women.length}) or men (${men.length}) in ${entity} to report without identifying people`);

  const pct = (n: number, d: number) => round1((n / d) * 100);
  const binary = [...women, ...men].sort((a, b) => a.hourly - b.hourly || a.e.id.localeCompare(b.e.id));
  const quartiles = [0, 1, 2, 3].map((q) => {
    const band = binary.slice(Math.floor((q * binary.length) / 4), Math.floor(((q + 1) * binary.length) / 4));
    const w = band.filter((r) => r.e.gender === "F").length;
    return { quartile: q + 1, women: w, men: band.length - w, womenPct: pct(w, band.length), menPct: pct(band.length - w, band.length) };
  });

  const categories = groupBy(rows, (r) => `${r.e.family}/${r.e.level}`)
    .map(([category, rs]) => {
      const w = rs.filter((r) => r.e.gender === "F");
      const m = rs.filter((r) => r.e.gender === "M");
      const suppressed = w.length < T.minPerGender || m.length < T.minPerGender;
      if (suppressed) return { category, women: w.length, men: m.length, suppressed, basicMeanGapPct: null, totalMeanGapPct: null, variableMeanGapPct: null, flagged: false, adjustedBasicGapPct: null };
      const basic = gapPct(mean(w.map((r) => r.basicHourly)), mean(m.map((r) => r.basicHourly)));
      const total = gapPct(mean(w.map((r) => r.hourly)), mean(m.map((r) => r.hourly)));
      const variable = gapPct(mean(w.map((r) => r.extras)), mean(m.map((r) => r.extras)));
      const flagged = [basic, total].some((g) => g !== null && Math.abs(g) >= T.jointAssessmentTriggerPct);
      return { category, women: w.length, men: m.length, suppressed, basicMeanGapPct: basic, totalMeanGapPct: total, variableMeanGapPct: variable, flagged, adjustedBasicGapPct: flagged ? adjusted([...w, ...m]) : null };
    })
    .sort((a, b) => a.category.localeCompare(b.category));

  const findings = categories
    .filter((c) => c.flagged)
    .map((c, i) => ({
      id: `PG-${String(i + 1).padStart(3, "0")}`,
      code: "category_gap_at_least_5pct",
      severity: "blocking" as const,
      category: c.category,
      basicMeanGapPct: c.basicMeanGapPct,
      totalMeanGapPct: c.totalMeanGapPct,
      adjustedBasicGapPct: c.adjustedBasicGapPct,
      message: `${c.category}: mean pay gap ${c.totalMeanGapPct}% (basic ${c.basicMeanGapPct}%); justify by objective, gender-neutral criteria or correct (Art. 10)`,
    }));

  return {
    entity,
    year,
    population: { women: women.length, men: men.length, diverseNotInGap: rows.length - women.length - men.length, withoutPay: employees.length - rows.length },
    indicators: {
      meanGapPct: gapPct(mean(women.map((r) => r.hourly)), mean(men.map((r) => r.hourly))),
      medianGapPct: gapPct(median(women.map((r) => r.hourly)), median(men.map((r) => r.hourly))),
      variableMeanGapPct: gapPct(mean(women.map((r) => r.extras)), mean(men.map((r) => r.extras))),
      variableMedianGapPct: gapPct(median(women.map((r) => r.extras)), median(men.map((r) => r.extras))),
      receivingVariable: { womenPct: pct(women.filter((r) => r.extras > 0).length, women.length), menPct: pct(men.filter((r) => r.extras > 0).length, men.length) },
      quartiles,
    },
    categories,
    findings,
    thresholds: { triggerPct: T.jointAssessmentTriggerPct, minPerGender: T.minPerGender },
  };
}

/** Gap in basic hourly pay between women and men of one category after allowing for tenure and location. */
function adjusted(rs: Row[]): number | null {
  if (rs.length < T.minForAdjustment) return null;
  const locations = [...new Set(rs.map((r) => r.e.location))].sort();
  const X = rs.map((r) => [1, r.e.gender === "F" ? 1 : 0, r.tenure, ...locations.slice(1).map((l) => (r.e.location === l ? 1 : 0))]);
  const beta = ols(X, rs.map((r) => Math.log(r.basicHourly)));
  return beta ? round1((1 - Math.exp(beta[1]!)) * 100) : null;
}

function groupBy<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m.entries()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCli } = await import("@hsp/hr-data");
  await runCli(computeIndicators);
}
