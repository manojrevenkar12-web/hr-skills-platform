import { bands, compaZone, meritPolicy, type Band, type Employee, type MeritProposal, type PayRecord, type ScriptContext } from "@hsp/hr-data";

/**
 * Checks a merit cycle's proposals against the guideline (references/policy.md) and returns
 * findings, each with an id the reviewer can act on. It decides nothing about anyone's pay: it
 * says where a proposal departs from the agreed rules, and the compensation partner and the
 * manager decide what to do.
 */
export interface CheckArgs {
  entity: string;
  cycle: string;
  orgUnit?: string;
}
export interface Finding {
  id: string;
  code: "above_guideline" | "below_guideline" | "rating_one_increase" | "above_band_max" | "budget_exceeded" | "equity_gap";
  severity: "blocking" | "warning";
  orgUnit: string;
  employeeId?: string;
  message: string;
  values: Record<string, number | string>;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const eur = (x: number) => Math.round(x);

export async function checkProposals(args: CheckArgs, ctx: ScriptContext) {
  const { entity, cycle, orgUnit } = args;
  if (!entity || !cycle) throw new Error("entity and cycle are required");
  const policy = meritPolicy();
  if (policy.cycle !== cycle) throw new Error(`no guideline for cycle ${cycle} (the guideline is for ${policy.cycle})`);
  const employees = new Map((await ctx.source.employees(entity)).map((e) => [e.id, e] as [string, Employee]));
  const pay = new Map((await ctx.source.pay(entity, Number(cycle))).map((p) => [p.employeeId, p] as [string, PayRecord]));
  let proposals = await ctx.source.proposals(entity, cycle);
  if (orgUnit) proposals = proposals.filter((p) => employees.get(p.employeeId)?.orgUnit === orgUnit);
  if (!proposals.length) throw new Error(`no merit proposals for ${entity}${orgUnit ? ` / ${orgUnit}` : ""} in cycle ${cycle}`);
  const bandOf = indexBands(bands());

  const raw: Omit<Finding, "id">[] = [];
  const rows: { p: MeritProposal; e: Employee; fteBase: number; base: number }[] = [];
  for (const p of proposals) {
    const e = employees.get(p.employeeId);
    const pr = pay.get(p.employeeId);
    if (!e || !pr) throw new Error(`proposal for ${p.employeeId} has no employee or pay record`);
    const b = bandOf(e);
    const fteBase = pr.base / e.fte;
    rows.push({ p, e, fteBase, base: pr.base });
    const compa = fteBase / b.mid;
    const zone = compaZone(compa);
    const [lo, hi] = policy.matrix[String(e.rating)]![zone];
    const v = { proposedPct: p.proposedPct, guidelineLow: lo, guidelineHigh: hi, rating: e.rating, compaRatio: Math.round(compa * 100) / 100 };
    const who = { orgUnit: e.orgUnit, employeeId: e.id };
    if (e.rating === 1 && p.proposedPct > 0)
      raw.push({ ...who, code: "rating_one_increase", severity: "blocking", values: v, message: `${e.id}: ${p.proposedPct}% for a rating of 1; the guideline is 0%` });
    else if (p.proposedPct > hi) {
      const reasoned = p.reason.trim().length > 0;
      raw.push({ ...who, code: "above_guideline", severity: reasoned || !policy.reasonRequiredOutsideGuideline ? "warning" : "blocking", values: v,
        message: `${e.id}: ${p.proposedPct}% is above the guideline of ${lo}-${hi}% for rating ${e.rating}${reasoned ? ` (reason given: "${p.reason.trim()}")` : " and no reason is given"}` });
    } else if (p.proposedPct < lo)
      raw.push({ ...who, code: "below_guideline", severity: "warning", values: v, message: `${e.id}: ${p.proposedPct}% is below the guideline of ${lo}-${hi}% for rating ${e.rating}` });
    const newBase = fteBase * (1 + p.proposedPct / 100);
    if (newBase > b.max)
      raw.push({ ...who, code: "above_band_max", severity: "blocking", values: { proposedPct: p.proposedPct, newBase: eur(newBase), bandMax: b.max },
        message: `${e.id}: ${p.proposedPct}% takes full-time base pay to ${eur(newBase)} EUR, above the band maximum of ${b.max} EUR` });
  }

  const units = group(rows, (r) => r.e.orgUnit);
  const summary = units.map(([unit, rs]) => {
    const cost = eur(rs.reduce((s, r) => s + (r.base * r.p.proposedPct) / 100, 0));
    const budget = eur(rs.reduce((s, r) => s + (r.base * policy.budgetPct) / 100, 0));
    if (cost > budget)
      raw.push({ orgUnit: unit, code: "budget_exceeded", severity: "blocking", values: { costEUR: cost, budgetEUR: budget, budgetPct: policy.budgetPct },
        message: `${unit}: proposals cost ${cost} EUR, over the budget of ${budget} EUR (${policy.budgetPct}% of base payroll)` });
    const gap = equityGap(rs);
    if (gap && gap.pp <= -policy.equityGapPp)
      raw.push({ orgUnit: unit, code: "equity_gap", severity: "blocking", values: { gapPp: gap.pp, comparedWomen: gap.women, comparedMen: gap.men, thresholdPp: policy.equityGapPp },
        message: `${unit}: at the same level and rating, women's proposals average ${Math.abs(gap.pp)} ${Math.abs(gap.pp) === 1 ? "point" : "points"} below men's (threshold ${policy.equityGapPp})` });
    return { orgUnit: unit, proposals: rs.length, costEUR: cost, budgetEUR: budget, utilisationPct: r1((cost / budget) * 100) };
  });

  const order = (f: Omit<Finding, "id">) => `${f.orgUnit}|${f.severity === "blocking" ? 0 : 1}|${f.code}|${f.employeeId ?? ""}`;
  const findings: Finding[] = raw.sort((a, b) => order(a).localeCompare(order(b))).map((f, i) => ({ id: `MC-${String(i + 1).padStart(3, "0")}`, ...f }));
  return {
    entity,
    cycle,
    summary: summary.map((s) => ({ ...s, blocking: findings.filter((f) => f.orgUnit === s.orgUnit && f.severity === "blocking").length, warnings: findings.filter((f) => f.orgUnit === s.orgUnit && f.severity === "warning").length })),
    findings,
    policy: { budgetPct: policy.budgetPct, equityGapPp: policy.equityGapPp, reasonRequiredOutsideGuideline: policy.reasonRequiredOutsideGuideline },
  };
}

/**
 * Women's minus men's average proposal, compared within cells of the same level and rating (so a
 * difference in ratings is not counted as a gap), weighted by the smaller side of each cell.
 */
export function equityGap(rs: { p: MeritProposal; e: Employee }[]): { pp: number; women: number; men: number } | null {
  let num = 0;
  let den = 0;
  let women = 0;
  let men = 0;
  for (const [, cell] of group(rs, (r) => `${r.e.level}|${r.e.rating}`)) {
    const w = cell.filter((r) => r.e.gender === "F").map((r) => r.p.proposedPct);
    const m = cell.filter((r) => r.e.gender === "M").map((r) => r.p.proposedPct);
    if (!w.length || !m.length) continue;
    const weight = Math.min(w.length, m.length);
    num += weight * (avg(w) - avg(m));
    den += weight;
    women += w.length;
    men += m.length;
  }
  return den >= 4 ? { pp: r1(num / den), women, men } : null;
}

function indexBands(all: Band[]) {
  const m = new Map(all.map((b) => [`${b.family}|${b.level}|${b.location}`, b]));
  return (e: Employee) => {
    const b = m.get(`${e.family}|${e.level}|${e.location}`);
    if (!b) throw new Error(`no band for ${e.family} ${e.level} in ${e.location}`);
    return b;
  };
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function group<T>(xs: T[], key: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCli } = await import("@hsp/hr-data");
  await runCli(checkProposals);
}
