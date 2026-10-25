import { describe, expect, it } from "vitest";

import { checkAggregate } from "./policy.js";

describe("checkAggregate", () => {
  it("passes group figures with enough women and men", () => {
    expect(checkAggregate({ categories: [{ women: 12, men: 30, meanGapPct: 4.1 }] })).toEqual([]);
  });

  it("refuses pay figures for a small group, and any employee id", () => {
    const v = checkAggregate({ categories: [{ women: 2, men: 9, meanGapPct: 11 }], note: "see E-00042" });
    expect(v.map((x) => x.rule).sort()).toEqual(["employee_id_in_aggregate", "small_group_pay_shown"]);
  });

  it("lets a suppressed small group show its counts only", () => {
    expect(checkAggregate({ women: 2, men: 9, suppressed: true, meanGapPct: null })).toEqual([]);
  });
});
