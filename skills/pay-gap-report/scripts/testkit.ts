import type { Employee, Family, Gender, HrDataset, Level, PayRecord } from "@hsp/hr-data";

/** Builds a small company for tests and fixtures: one row per person, pay given per hour. */
export interface Person {
  gender: Gender;
  family?: Family;
  level?: Level;
  location?: string;
  hourly: number;
  hours?: number;
  extras?: number;
  hireDate?: string;
}

export function company(people: Person[], year = 2026): HrDataset {
  const employees: Employee[] = [];
  const pay: PayRecord[] = [];
  people.forEach((p, i) => {
    const id = `E-${String(i + 1).padStart(5, "0")}`;
    const hours = p.hours ?? 1000;
    employees.push({
      id, entity: "test-co", gender: p.gender, family: p.family ?? "operations", level: p.level ?? "L3", location: p.location ?? "Berlin",
      orgUnit: "DE-OPS-1", managerId: null, fte: 1, hireDate: p.hireDate ?? "2020-01-01", rating: 3,
    });
    pay.push({ employeeId: id, year, base: Math.round(p.hourly * hours), complementary: 0, variable: p.extras ?? 0, hoursPaid: hours });
  });
  return {
    entities: [{ id: "test-co", name: "Test Co (fictional)", country: "DE", currency: "EUR", fullTimeHours: 1720 }],
    employees, pay, bands: [], proposals: [],
    meritPolicy: { cycle: "2026", matrix: {}, budgetPct: 3.5, reasonRequiredOutsideGuideline: true, equityGapPp: 1 },
  };
}

export const many = (n: number, p: Person): Person[] => Array.from({ length: n }, () => ({ ...p }));
