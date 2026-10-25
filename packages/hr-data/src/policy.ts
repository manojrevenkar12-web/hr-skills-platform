/**
 * Data handling rules for compensation data, applied in code to what a skill script returns
 * before a model (or a user without the right role) sees it.
 *
 * - `aggregate` skills may return only group figures. No employee id may appear, and a group with
 *   fewer than `minPerGender` women or men is suppressed: its counts may show, its pay may not.
 *   (Germany's expert commission recommended withholding comparisons below six women and six men;
 *   the default follows it.)
 * - `individual` skills (e.g. a merit-cycle check for the compensation team) may name pseudonymous
 *   employee ids, never names, and only to roles cleared for individual pay.
 */
export type Classification = "aggregate" | "individual";

export interface PolicyViolation {
  path: string;
  rule: "employee_id_in_aggregate" | "small_group_pay_shown";
  detail: string;
}

export const DEFAULT_MIN_PER_GENDER = 6;
const EMPLOYEE_ID = /\bE-\d{5}\b/;
const PAY_KEYS = /(gap|mean|median|avg|average|pay|salary|amount|bonus)/i; // pay figures, not head-count shares

export function checkAggregate(value: unknown, minPerGender = DEFAULT_MIN_PER_GENDER): PolicyViolation[] {
  const out: PolicyViolation[] = [];
  walk(value, "$", (v, path) => {
    if (typeof v === "string" && EMPLOYEE_ID.test(v)) out.push({ path, rule: "employee_id_in_aggregate", detail: v.match(EMPLOYEE_ID)![0] });
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const o = v as Record<string, unknown>;
      const women = num(o.women ?? o.womenCount);
      const men = num(o.men ?? o.menCount);
      if (women !== undefined && men !== undefined && (women < minPerGender || men < minPerGender)) {
        const shown = Object.entries(o).filter(([k, x]) => PAY_KEYS.test(k) && typeof x === "number");
        if (shown.length) out.push({ path, rule: "small_group_pay_shown", detail: `${women} women, ${men} men; shows ${shown.map(([k]) => k).join(", ")}` });
      }
    }
  });
  return out;
}

function walk(v: unknown, path: string, f: (v: unknown, path: string) => void) {
  f(v, path);
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, f));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`, f);
}

const num = (x: unknown) => (typeof x === "number" ? x : undefined);
