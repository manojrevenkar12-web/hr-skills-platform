import type { Behaviour } from "@hsp/harness";

/**
 * What a careful model does with this skill, for the offline evaluation: run the script, then write
 * the memo from its figures only. Faults are the mistakes a real model makes; each must be caught.
 */
interface Result {
  entity: string;
  year: number;
  indicators: { meanGapPct: number; medianGapPct: number; variableMeanGapPct: number | null; receivingVariable: { womenPct: number; menPct: number }; quartiles: { quartile: number; womenPct: number }[] };
  categories: { category: string; suppressed: boolean }[];
  findings: { id: string; category: string; totalMeanGapPct: number; basicMeanGapPct: number; adjustedBasicGapPct: number | null }[];
}

export const FAULTS = ["invent_number", "skip_script", "drop_finding", "leak_employee", "invented_finding", "suppressed_figure"] as const;

export const behaviour: Behaviour = ({ input, results, faults, turn }) => {
  const r = results.get("compute_indicators") as Result | undefined;
  if (faults.has("skip_script") && !r)
    return { submit: { memo: `The pay gap for ${String(input.entity)} looks moderate and broadly in line with the market. `.repeat(8), findingsAddressed: [], caveats: ["Figures were estimated from experience."] } };
  if (!r && turn === 1) return { call: "run_script", input: { script: "compute_indicators", args: { entity: input.entity, year: input.year } } };
  if (!r) return { text: "The script could not compute the indicators, so there is no report to write." };

  const i = r.indicators;
  const lines = [
    `In ${r.year}, women at ${r.entity} earned on average ${Math.abs(i.meanGapPct)}% ${i.meanGapPct >= 0 ? "less" : "more"} per hour than men (median gap ${i.medianGapPct}%).`,
    i.variableMeanGapPct === null ? "Complementary and variable pay could not be compared." : `In complementary and variable pay the mean gap is ${i.variableMeanGapPct}%; ${i.receivingVariable.womenPct}% of women and ${i.receivingVariable.menPct}% of men received some.`,
    `Women make up ${i.quartiles[0]!.womenPct}% of the lowest quartile pay band and ${i.quartiles[3]!.womenPct}% of the highest.`,
  ];
  let findings = r.findings;
  if (faults.has("drop_finding")) findings = findings.slice(0, -1);
  if (findings.length) {
    lines.push(`${findings.length} categor${findings.length === 1 ? "y has" : "ies have"} a gap of at least 5% and need a justification review:`);
    for (const f of findings)
      lines.push(`${f.id}: ${f.category}, mean gap ${f.totalMeanGapPct}% (basic pay ${f.basicMeanGapPct}%)${f.adjustedBasicGapPct === null ? "" : `, ${f.adjustedBasicGapPct}% after allowing for tenure and location`}.`);
    lines.push("Each needs a justification by objective, gender-neutral criteria or a correction; otherwise a joint pay assessment with worker representatives follows (Art. 10).");
  } else lines.push("No category of workers has a gap of 5% or more, so no joint pay assessment is indicated.");
  if (r.categories.some((c) => c.suppressed)) lines.push("Categories with fewer than 6 women or 6 men are not reported, to avoid identifying people.");
  lines.push("Before publication, share the report with worker representatives; employees may also ask for the average pay of their category by gender (Art. 7).");
  if (faults.has("invent_number")) lines.push("Closing the gap would cost about 412,000 EUR a year.");
  if (faults.has("leak_employee")) lines.push("The largest single difference is for E-00007.");
  if (faults.has("invented_finding")) lines.push("PG-099 also needs attention.");
  if (faults.has("suppressed_figure")) {
    const s = r.categories.find((c) => c.suppressed);
    if (s) lines.push(`${s.category} shows a gap of 23.7%.`);
  }
  return {
    submit: {
      memo: lines.join(" "),
      findingsAddressed: findings.map((f) => f.id),
      caveats: ["Categories are job family × level, a proxy for work of equal value that the job evaluation must confirm."],
    },
  };
};
