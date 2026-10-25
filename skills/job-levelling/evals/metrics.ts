import type { CaseRow } from "@hsp/evals";

/** Accuracy of the proposed level and family against the hand levelling (cases with a `truth`). */
export function metrics(rows: CaseRow[]): Record<string, number> {
  const scored = rows.filter((r) => r.truth && r.output && typeof r.output === "object");
  if (!scored.length) return {};
  const n = (lv: unknown) => Number(String(lv).slice(1));
  const out = scored.map((r) => {
    const o = r.output as { level?: string; family?: string; needsReview?: boolean };
    const t = r.truth as { level: string; family: string };
    return { exact: o.level === t.level, within: Math.abs(n(o.level) - n(t.level)) <= 1, family: o.family === t.family, review: o.needsReview === true };
  });
  const rate = (k: keyof (typeof out)[number]) => Math.round((out.filter((x) => x[k]).length / out.length) * 10000) / 10000;
  return { level_exact: rate("exact"), level_within_one: rate("within"), family_exact: rate("family"), review_rate: rate("review") };
}
