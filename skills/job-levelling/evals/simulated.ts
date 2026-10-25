import type { Behaviour } from "@hsp/harness";

/**
 * The offline stand-in for a model on this skill: a transparent heuristic over the extracted
 * signals (scope and autonomy first, people and years to adjust). Its accuracy is a baseline for
 * the harness, not a measurement of any language model.
 */
interface Signals {
  yearsMin: number | null;
  peopleManaged: number | null;
  managesManagers: boolean;
  familyScores: Record<string, number>;
  signals: { kind: string; value: string | number; quote: string }[];
}

export const FAULTS = ["invented_quote", "unknown_level", "low_confidence_no_review", "invent_number", "skip_script"] as const;
const L = ["L1", "L2", "L3", "L4", "L5", "L6"] as const;

export const behaviour: Behaviour = ({ input, results, faults, turn }) => {
  const s = results.get("extract_signals") as Signals | undefined;
  if (!s && faults.has("skip_script"))
    return { submit: { family: "operations", level: "L3", confidence: "high", needsReview: false, evidence: [{ criterion: "scope", quote: "owns the regional operations budget", pointsTo: "L3" }], rationale: "The role looks like a typical professional role at this company with a fairly broad remit and some autonomy." } };
  if (!s && turn === 1) return { call: "run_script", input: { script: "extract_signals", args: { jobDescription: input.jobDescription } } };
  if (!s) return { text: "I could not read the job description." };
  if (!results.has("job_architecture") && turn === 2) return { call: "job_architecture", input: {} };

  const has = (kind: string, re: RegExp) => s.signals.filter((x) => x.kind === kind && re.test(String(x.value)));
  let idx = 2; // L3 when nothing else is known
  const reasons: { criterion: string; quote: string; pointsTo: number }[] = [];
  const years = s.yearsMin;
  if (years !== null) {
    idx = years <= 1 ? 0 : years <= 3 ? 1 : years <= 5 ? 2 : years <= 9 ? 3 : years <= 13 ? 4 : 5;
    const q = s.signals.find((x) => x.kind === "experience");
    if (q) reasons.push({ criterion: "experience", quote: q.quote, pointsTo: idx });
  }
  const capped = has("autonomy", /supervision|guidance|procedures/);
  if (capped.length) {
    idx = Math.min(idx, 1);
    reasons.push({ criterion: "autonomy", quote: capped[0]!.quote, pointsTo: idx });
  }
  const people = s.peopleManaged ?? 0;
  if (people >= 1 && !s.managesManagers) {
    idx = Math.max(idx, 3);
    reasons.push({ criterion: "scope", quote: s.signals.find((x) => x.kind === "people")!.quote, pointsTo: 3 });
  }
  if (s.managesManagers) {
    idx = Math.max(idx, 4);
    reasons.push({ criterion: "scope", quote: s.signals.find((x) => x.kind === "manages_managers")!.quote, pointsTo: 4 });
  }
  const wide = has("scope", /company|business unit/);
  if (wide.length) {
    idx = Math.max(idx, 4);
    reasons.push({ criterion: "scope", quote: wide[0]!.quote, pointsTo: 4 });
  }
  const top = has("autonomy", /board|ceo/);
  if (top.length) {
    idx = 5;
    reasons.push({ criterion: "autonomy", quote: top[0]!.quote, pointsTo: 5 });
  }
  const family = (input.familyHint as string | undefined) ?? Object.entries(s.familyScores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  const kinds = new Set(reasons.map((r) => r.criterion));
  const spread = reasons.length ? Math.max(...reasons.map((r) => r.pointsTo)) - Math.min(...reasons.map((r) => r.pointsTo)) : 0;
  let confidence = kinds.size >= 2 && spread <= 1 ? "high" : reasons.length ? "medium" : "low";
  let needsReview = confidence === "low" || spread > 1;
  let level: string = L[idx]!;
  const evidence = reasons.slice(0, 5).map((r) => ({ criterion: r.criterion, quote: r.quote, pointsTo: L[r.pointsTo]! }));
  if (!evidence.length) evidence.push({ criterion: "scope", quote: String(input.jobDescription).split(/[.;]/)[0]!.trim(), pointsTo: level as (typeof L)[number] });
  let rationale = `Proposed ${family} ${level}. ${years !== null ? `The role asks for ${years} years of experience, which is weak evidence on its own. ` : ""}${people ? `It manages ${people} people. ` : ""}Scope and autonomy in the description were weighed first, as the levelling guide requires; a compensation partner should confirm.`;

  if (faults.has("invented_quote")) evidence.push({ criterion: "impact", quote: "drives company-wide transformation programmes", pointsTo: "L6" });
  if (faults.has("unknown_level")) level = "L7";
  if (faults.has("low_confidence_no_review")) {
    confidence = "low";
    needsReview = false;
  }
  if (faults.has("invent_number")) rationale += " Comparable roles pay about 87,500 EUR.";
  return { submit: { family, level, alternativeLevel: null, confidence, needsReview, evidence: evidence.slice(0, 5), rationale } };
};
