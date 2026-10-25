import type { ScriptContext } from "@hsp/hr-data";

/**
 * Pulls the facts a levelling decision rests on out of a job description, with the exact words
 * they come from: years of experience asked for, people managed, budget, and the phrases that
 * describe scope, autonomy and impact. It decides nothing; it makes the evidence easy to cite.
 */
export interface SignalArgs {
  jobDescription: string;
}
export interface Signal {
  kind: "experience" | "people" | "manages_managers" | "budget" | "scope" | "autonomy" | "impact" | "family";
  value: string | number;
  quote: string;
}

const PATTERNS: { kind: Signal["kind"]; re: RegExp; value: (m: RegExpMatchArray) => string | number }[] = [
  { kind: "experience", re: /(\d{1,2})\s*\+?\s*(?:or more\s+)?years?(?:'|’)?\s+(?:of\s+)?(?:\w+\s+){0,3}?experience/gi, value: (m) => Number(m[1]) },
  { kind: "experience", re: /(?:at least|minimum of|over)\s+(\d{1,2})\s+years/gi, value: (m) => Number(m[1]) },
  { kind: "people", re: /(?:team of|lead(?:ing)?|manag(?:e|ing))\s+(?:a team of\s+)?(\d{1,3})\s+(?:people|engineers|staff|employees|specialists|drivers|colleagues|analysts|direct reports|recruiters|account executives|technicians)/gi, value: (m) => Number(m[1]) },
  { kind: "people", re: /(\d{1,3})\s+direct reports/gi, value: (m) => Number(m[1]) },
  { kind: "manages_managers", re: /\b(?:manag\w+|lead\w*)\s+(?:a group of\s+)?(?:team leads|managers|heads of)\b/gi, value: () => "yes" },
  { kind: "budget", re: /budget of\s+(?:€|EUR\s*)?([\d.,]+)\s*(million|m|k|thousand)?/gi, value: (m) => `${m[1]}${m[2] ? ` ${m[2]}` : ""}` },
  { kind: "scope", re: /\b(company-wide|across the company|whole company|business unit|across (?:the )?(?:function|department|teams|regions|countries)|for the department|for the team|own tasks|a small project|several teams|one depot|all depots|the region)\b/gi, value: (m) => m[1]!.toLowerCase() },
  { kind: "autonomy", re: /\b(under (?:close )?supervision|with guidance|following (?:defined |standard )?procedures|independently|on your own|set(?:s|ting)? (?:the )?(?:direction|strategy|standards|priorities)|accountable for|report(?:s|ing)? to the (?:executive )?board|report(?:s|ing)? to the CEO|report(?:s|ing)? to the CFO)\b/gi, value: (m) => m[1]!.toLowerCase() },
  { kind: "impact", re: /\b(company results|business results|external(?:ly)? represent\w*|represent the company|coach(?:es|ing)? (?:others|junior|colleagues)|mentor(?:s|ing)? (?:junior|others|colleagues)|own output|the team's results)\b/gi, value: (m) => m[1]!.toLowerCase() },
];

const FAMILY_WORDS: Record<string, RegExp> = {
  engineering: /\b(software|engineer(?:ing)?|developer|backend|frontend|data platform|devops|SRE|machine learning|architecture)\b/gi,
  operations: /\b(depot|fleet|dispatch|driver|warehouse|maintenance|logistics|shift|vehicle|workshop)\b/gi,
  finance: /\b(accounting|accountant|controlling|controller|treasury|procurement|invoic\w*|ledger|tax|audit)\b/gi,
  people: /\b(recruit\w*|HR|human resources|payroll|people partner|talent|learning and development|onboarding)\b/gi,
  sales: /\b(sales|account executive|account manager|quota|pipeline|customers? acquisition|key accounts?|commission)\b/gi,
};

export async function extractSignals(args: SignalArgs, _ctx?: ScriptContext) {
  const text = String(args.jobDescription ?? "");
  if (text.trim().length < 50) throw new Error("the job description is too short to level (under 50 characters)");
  const signals: Signal[] = [];
  for (const p of PATTERNS) for (const m of text.matchAll(p.re)) signals.push({ kind: p.kind, value: p.value(m), quote: m[0] });
  const familyScores = Object.fromEntries(Object.entries(FAMILY_WORDS).map(([f, re]) => [f, [...text.matchAll(re)].length]));
  for (const [f, re] of Object.entries(FAMILY_WORDS)) {
    const m = text.match(new RegExp(re.source, "i"));
    if (m) signals.push({ kind: "family", value: f, quote: m[0] });
  }
  const years = signals.filter((s) => s.kind === "experience").map((s) => Number(s.value));
  const people = signals.filter((s) => s.kind === "people").map((s) => Number(s.value));
  return {
    yearsMin: years.length ? Math.max(...years) : null,
    peopleManaged: people.length ? Math.max(...people) : null,
    managesManagers: signals.some((s) => s.kind === "manages_managers"),
    familyScores,
    signals,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { runCli } = await import("@hsp/hr-data");
  await runCli(extractSignals);
}
