import { bands, type Employee, type Family, type Gender, type HrDataset, type Level, type MeritProposal, type PayRecord } from "@hsp/hr-data";

/** A small merit cycle for tests and fixtures: pay is given as compa-ratio to the band midpoint. */
export interface Proposal {
  gender?: Gender;
  family?: Family;
  level?: Level;
  location?: string;
  orgUnit?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  compa: number;
  pct: number;
  reason?: string;
  fte?: number;
}

export function cycle(rows: Proposal[], year = 2026): HrDataset {
  const all = bands();
  const employees: Employee[] = [];
  const pay: PayRecord[] = [];
  const proposals: MeritProposal[] = [];
  rows.forEach((r, i) => {
    const id = `E-${String(i + 1).padStart(5, "0")}`;
    const family = r.family ?? "operations";
    const level = r.level ?? "L3";
    const location = r.location ?? "Berlin";
    const fte = r.fte ?? 1;
    const band = all.find((b) => b.family === family && b.level === level && b.location === location)!;
    employees.push({ id, entity: "test-co", gender: r.gender ?? "M", family, level, location, orgUnit: r.orgUnit ?? "DE-OPS-1", managerId: null, fte, hireDate: "2020-01-01", rating: r.rating });
    pay.push({ employeeId: id, year, base: Math.round(band.mid * r.compa * fte), complementary: 0, variable: 0, hoursPaid: Math.round(1720 * fte) });
    proposals.push({ employeeId: id, cycle: String(year), proposedPct: r.pct, reason: r.reason ?? "", proposedBy: "E-99999" });
  });
  return {
    entities: [{ id: "test-co", name: "Test Co (fictional)", country: "DE", currency: "EUR", fullTimeHours: 1720 }],
    employees, pay, proposals, bands: all,
    meritPolicy: { cycle: String(year), matrix: {}, budgetPct: 3.5, reasonRequiredOutsideGuideline: true, equityGapPp: 1 },
  };
}

export const repeat = (n: number, p: Proposal): Proposal[] => Array.from({ length: n }, () => ({ ...p }));
