/**
 * The HR data the skills work on. Everything in this repository is invented: the company
 * (Nordwerk Mobility, fictional), its people and its pay. Employee ids are pseudonymous.
 */
export type Gender = "F" | "M" | "X"; // X: "divers", a legal gender entry in Germany
export type Level = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";
export const LEVELS: Level[] = ["L1", "L2", "L3", "L4", "L5", "L6"];
export type Family = "engineering" | "operations" | "finance" | "people" | "sales";
export const FAMILIES: Family[] = ["engineering", "operations", "finance", "people", "sales"];

export interface Entity {
  id: string;
  name: string;
  country: "DE" | "PT";
  currency: "EUR";
  /** annual contractual hours of a full-time employee */
  fullTimeHours: number;
}

export interface Employee {
  id: string;
  entity: string;
  gender: Gender;
  family: Family;
  level: Level;
  location: string;
  orgUnit: string;
  managerId: string | null;
  fte: number;
  hireDate: string;
  /** last completed performance rating, 1 (low) to 5 (high) */
  rating: 1 | 2 | 3 | 4 | 5;
}

/** Pay actually received in a calendar year (the Directive's "pay": base plus complementary and variable). */
export interface PayRecord {
  employeeId: string;
  year: number;
  base: number;
  /** allowances in cash or kind (shift, on-call, car, meal) */
  complementary: number;
  /** bonuses and commissions */
  variable: number;
  hoursPaid: number;
}

export interface Band {
  family: Family;
  level: Level;
  location: string;
  min: number;
  mid: number;
  max: number;
}

export interface MeritPolicy {
  cycle: string;
  /** guideline range in % by rating and compa-ratio zone */
  matrix: Record<string, Record<CompaZone, [number, number]>>;
  /** merit budget as % of the org unit's base payroll */
  budgetPct: number;
  /** a proposal outside its guideline range needs a written reason */
  reasonRequiredOutsideGuideline: boolean;
  /** within one level and rating, a gap in average proposed increase between women and men above this (percentage points) is flagged */
  equityGapPp: number;
}
export type CompaZone = "below_90" | "90_to_100" | "100_to_110" | "above_110";

export interface MeritProposal {
  employeeId: string;
  cycle: string;
  proposedPct: number;
  reason: string;
  proposedBy: string;
}

export interface LevelDefinition {
  level: Level;
  title: string;
  scope: string;
  autonomy: string;
  complexity: string;
  impact: string;
  typicalExperienceYears: [number, number];
}

export interface JobArchitecture {
  families: { id: Family; name: string; description: string }[];
  levels: LevelDefinition[];
}

export interface HrDataset {
  entities: Entity[];
  employees: Employee[];
  pay: PayRecord[];
  bands: Band[];
  meritPolicy: MeritPolicy;
  proposals: MeritProposal[];
}

/** What a skill script receives besides its arguments. */
export interface ScriptContext {
  source: import("./source.js").HrSource;
}
