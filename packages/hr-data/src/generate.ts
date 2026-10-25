import { bands, compaZone, meritPolicy } from "./reference.js";
import { rng } from "./random.js";
import { FAMILIES, LEVELS, type Employee, type Entity, type Family, type Gender, type HrDataset, type Level, type MeritProposal, type PayRecord } from "./types.js";

export const ENTITIES: Entity[] = [
  { id: "nordwerk-de", name: "Nordwerk Mobility GmbH (fictional)", country: "DE", currency: "EUR", fullTimeHours: 1720 },
  { id: "nordwerk-pt", name: "Nordwerk Mobility Portugal Lda. (fictional)", country: "PT", currency: "EUR", fullTimeHours: 1800 },
];

const LOCATIONS: Record<string, string[]> = { "nordwerk-de": ["Berlin", "Hamburg"], "nordwerk-pt": ["Lisbon", "Porto"] };
const HEADCOUNT: Record<string, number> = { "nordwerk-de": 900, "nordwerk-pt": 320 };
const FAMILY_MIX: Record<Family, number> = { engineering: 0.24, operations: 0.38, finance: 0.1, people: 0.08, sales: 0.2 };
const WOMEN_SHARE: Record<Family, number> = { engineering: 0.24, operations: 0.3, finance: 0.55, people: 0.72, sales: 0.4 };
// fewer women at higher levels: the main source of the raw (unadjusted) gap
const LEVEL_MIX = [0.18, 0.26, 0.26, 0.17, 0.09, 0.04];
const WOMEN_LEVEL_TILT = [1.25, 1.15, 1.0, 0.8, 0.6, 0.45];

/**
 * Known, injected effects, so the skills can be checked against what is really in the data:
 * - operations L3 in Germany: women's base pay 8% lower than men's in the same job (unexplained);
 * - sales L4 in Germany: women's commission 30% lower than men's (variable pay gap);
 * - merit 2026, org unit DE-OPS-2: women's proposals 1.5 points below men's at the same rating.
 */
export const INJECTED = {
  baseGap: { entity: "nordwerk-de", family: "operations" as Family, level: "L3" as Level, pct: 8 },
  variableGap: { entity: "nordwerk-de", family: "sales" as Family, level: "L4" as Level, pct: 30 },
  meritEquity: { orgUnit: "DE-OPS-2", pp: 1.5 },
};

export function generate(seed = 2026, year = 2026): HrDataset {
  const r = rng(seed);
  const allBands = bands();
  const band = (f: Family, l: Level, loc: string) => allBands.find((b) => b.family === f && b.level === l && b.location === loc)!;
  const employees: Employee[] = [];
  const pay: PayRecord[] = [];
  let n = 0;

  for (const entity of ENTITIES) {
    const count = HEADCOUNT[entity.id]!;
    for (let i = 0; i < count; i++) {
      n++;
      const family = weighted(r.next(), FAMILY_MIX);
      const levelIdx = weightedIndex(r.next(), LEVEL_MIX);
      const level = LEVELS[levelIdx]!;
      const pWoman = Math.min(0.95, WOMEN_SHARE[family] * WOMEN_LEVEL_TILT[levelIdx]!);
      const gender: Gender = r.chance(0.008) ? "X" : r.chance(pWoman) ? "F" : "M";
      const location = r.pick(LOCATIONS[entity.id]!);
      const fte = r.chance(gender === "F" ? 0.22 : 0.07) ? r.pick([0.5, 0.6, 0.75, 0.8]) : 1;
      const tenure = Math.max(0, Math.min(25, r.normal(3 + levelIdx * 2.2, 2.5)));
      const hire = new Date(Date.UTC(year, 11, 31) - tenure * 365.25 * 86400000);
      const orgUnit = `${entity.country}-${family.slice(0, 3).toUpperCase()}-${r.int(1, family === "operations" ? 4 : 2)}`;
      const emp: Employee = {
        id: `E-${String(n).padStart(5, "0")}`,
        entity: entity.id,
        gender,
        family,
        level,
        location,
        orgUnit,
        managerId: null,
        fte,
        hireDate: hire.toISOString().slice(0, 10),
        rating: ratingFor(r.next()),
      };
      employees.push(emp);

      const b = band(family, level, location);
      let compa = 0.88 + Math.min(tenure, 12) * 0.016 + r.normal(0, 0.04);
      const ij = INJECTED.baseGap;
      if (entity.id === ij.entity && family === ij.family && level === ij.level && gender === "F") compa *= 1 - ij.pct / 100;
      const base = round(b.mid * compa * fte);
      const complementary = family === "operations" ? round((r.int(1800, 3600) + (level === "L1" || level === "L2" ? 900 : 0)) * fte) : r.chance(0.15) ? round(1200 * fte) : 0;
      let variable = 0;
      if (family === "sales") variable = base * (0.12 + emp.rating * 0.03 + r.normal(0, 0.02));
      else if (levelIdx >= 2) variable = r.chance(0.85) ? base * (0.02 + (emp.rating - 1) * 0.015 + levelIdx * 0.01) : 0;
      const vg = INJECTED.variableGap;
      if (entity.id === vg.entity && family === vg.family && level === vg.level && gender === "F") variable *= 1 - vg.pct / 100;
      pay.push({ employeeId: emp.id, year, base, complementary, variable: round(Math.max(0, variable)), hoursPaid: Math.round(entity.fullTimeHours * fte) });
    }
  }

  // managers: the most senior person of each org unit
  const units = new Map<string, Employee[]>();
  for (const e of employees) units.set(e.orgUnit, [...(units.get(e.orgUnit) ?? []), e]);
  for (const members of units.values()) {
    const lead = [...members].sort((a, b) => LEVELS.indexOf(b.level) - LEVELS.indexOf(a.level) || a.id.localeCompare(b.id))[0]!;
    for (const m of members) m.managerId = m.id === lead.id ? null : lead.id;
  }

  return { entities: ENTITIES, employees, pay, bands: allBands, meritPolicy: meritPolicy(), proposals: proposals(employees, pay, r) };
}

/** Merit proposals for the German entity: mostly within guideline, with realistic mistakes. */
function proposals(employees: Employee[], pay: PayRecord[], r: ReturnType<typeof rng>): MeritProposal[] {
  const policy = meritPolicy();
  const allBands = bands();
  const out: MeritProposal[] = [];
  for (const e of employees.filter((x) => x.entity === "nordwerk-de")) {
    const p = pay.find((x) => x.employeeId === e.id)!;
    const b = allBands.find((x) => x.family === e.family && x.level === e.level && x.location === e.location)!;
    const [lo, hi] = policy.matrix[String(e.rating)]![compaZone(p.base / e.fte / b.mid)];
    let pct = Math.round((lo + r.next() * (hi - lo)) * 10) / 10;
    let reason = "";
    if (r.chance(0.04)) {
      pct = Math.round((hi + 1 + r.next() * 2) * 10) / 10; // above guideline
      reason = r.chance(0.5) ? "Retention risk: competing offer received." : "";
    }
    if (e.orgUnit === INJECTED.meritEquity.orgUnit && e.gender === "F") pct = Math.max(0, Math.round((pct - INJECTED.meritEquity.pp) * 10) / 10);
    out.push({ employeeId: e.id, cycle: policy.cycle, proposedPct: pct, reason, proposedBy: e.managerId ?? "HR" });
  }
  return out;
}

function ratingFor(x: number): 1 | 2 | 3 | 4 | 5 {
  if (x < 0.03) return 1;
  if (x < 0.15) return 2;
  if (x < 0.65) return 3;
  if (x < 0.92) return 4;
  return 5;
}

function weighted<K extends string>(x: number, w: Record<K, number>): K {
  let acc = 0;
  for (const [k, v] of Object.entries(w) as [K, number][]) {
    acc += v;
    if (x < acc) return k;
  }
  return Object.keys(w).at(-1) as K;
}

function weightedIndex(x: number, w: number[]): number {
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i]!;
    if (x < acc) return i;
  }
  return w.length - 1;
}

const round = (x: number) => Math.round(x);
export { FAMILIES };
