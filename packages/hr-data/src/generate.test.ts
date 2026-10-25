import { describe, expect, it } from "vitest";

import { generate, INJECTED } from "./generate.js";

describe("the synthetic company", () => {
  const d = generate();

  it("is the same on every run", () => {
    expect(generate().pay.slice(0, 5)).toEqual(d.pay.slice(0, 5));
    expect(d.employees).toHaveLength(1220);
  });

  it("contains the injected unexplained gap", () => {
    const { entity, family, level } = INJECTED.baseGap;
    const group = d.employees.filter((e) => e.entity === entity && e.family === family && e.level === level && e.location === "Berlin");
    const hourly = (g: string) => {
      const ps = group.filter((e) => e.gender === g).map((e) => d.pay.find((p) => p.employeeId === e.id)!).map((p) => p.base / p.hoursPaid);
      return ps.reduce((a, b) => a + b, 0) / ps.length;
    };
    expect(1 - hourly("F") / hourly("M")).toBeGreaterThan(0.04);
  });

  it("gives every German employee one merit proposal and a manager except unit leads", () => {
    const de = d.employees.filter((e) => e.entity === "nordwerk-de");
    expect(d.proposals).toHaveLength(de.length);
    expect(de.filter((e) => e.managerId === null).length).toBeGreaterThan(5);
  });
});
