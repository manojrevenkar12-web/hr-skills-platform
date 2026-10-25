import type { Behaviour } from "@hsp/harness";

/** A careful model: run the check, then write one note per unit with blocking findings. */
interface F {
  id: string;
  code: string;
  severity: string;
  orgUnit: string;
  employeeId?: string;
  values: Record<string, number | string>;
}

export const FAULTS = ["skip_script", "drop_finding", "invent_number", "invented_finding", "propose_new_pct"] as const;

const RULE: Record<string, (f: F) => string> = {
  above_guideline: (f) => `${f.values.proposedPct}% is above the ${f.values.guidelineLow}-${f.values.guidelineHigh}% range for rating ${f.values.rating}; lower it into the range or record a reason.`,
  below_guideline: (f) => `${f.values.proposedPct}% is below the ${f.values.guidelineLow}-${f.values.guidelineHigh}% range; confirm it is intended.`,
  rating_one_increase: (f) => `${f.values.proposedPct}% for a rating of 1; the guideline gives no increase.`,
  above_band_max: (f) => `this takes base pay to ${f.values.newBase} EUR, above the band maximum of ${f.values.bandMax} EUR.`,
  budget_exceeded: (f) => `the unit's proposals cost ${f.values.costEUR} EUR against a budget of ${f.values.budgetEUR} EUR.`,
  equity_gap: (f) => {
    const pp = Math.abs(Number(f.values.gapPp));
    return `at the same level and rating, women's proposals average ${pp} ${pp === 1 ? "point" : "points"} below men's; compare them before sign-off.`;
  },
};

export const behaviour: Behaviour = ({ input, results, faults, turn }) => {
  const r = results.get("check_proposals") as { findings: F[] } | undefined;
  if (!r && faults.has("skip_script")) return { submit: { notes: [{ orgUnit: String(input.orgUnit ?? "all"), note: "All proposals look reasonable and in line with the guideline; please go ahead with sign-off as planned." }], findingsAddressed: [] } };
  if (!r && turn === 1) return { call: "run_script", input: { script: "check_proposals", args: { ...input } } };
  if (!r) return { text: "The check could not run, so there is nothing to review." };

  let blocking = r.findings.filter((f) => f.severity === "blocking");
  if (faults.has("drop_finding")) blocking = blocking.slice(0, -1);
  const units = [...new Set(blocking.map((f) => f.orgUnit))].sort();
  const notes = units.map((u) => {
    const mine = blocking.filter((f) => f.orgUnit === u);
    const warn = r.findings.filter((f) => f.orgUnit === u && f.severity === "warning");
    const lines = [`Before sign-off, please change the following in ${u}:`];
    for (const f of mine) lines.push(`${f.id}${f.employeeId ? ` (${f.employeeId})` : ""}: ${RULE[f.code]!(f)}`);
    if (warn.length) lines.push(`Please also confirm ${warn.map((f) => f.id).join(", ")}.`);
    if (faults.has("invent_number")) lines.push("Last year the unit spent 3.9% on merit.");
    if (faults.has("invented_finding")) lines.push("See also MC-777.");
    if (faults.has("propose_new_pct") && mine[0]) lines.push(`For ${mine[0].id}, 2.75% would be fair.`);
    return { orgUnit: u, note: lines.join(" ") };
  });
  return { submit: { notes, findingsAddressed: blocking.map((f) => f.id) } };
};
