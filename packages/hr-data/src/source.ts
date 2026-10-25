import { readFileSync } from "node:fs";
import pg from "pg";

import type { Employee, Entity, HrDataset, MeritProposal, PayRecord } from "./types.js";

/**
 * Where skill scripts read HR data. Scripts get individual records; what a model may see is
 * decided by the skill's data classification and enforced by policy.ts on the script's output.
 */
export interface HrSource {
  entities(): Promise<Entity[]>;
  employees(entity: string): Promise<Employee[]>;
  pay(entity: string, year: number): Promise<PayRecord[]>;
  proposals(entity: string, cycle: string): Promise<MeritProposal[]>;
}

/** A dataset held in memory: golden-case fixtures and tests. */
export class MemorySource implements HrSource {
  constructor(private readonly d: Pick<HrDataset, "entities" | "employees" | "pay" | "proposals">) {}

  static fromFile(path: string): MemorySource {
    return new MemorySource(JSON.parse(readFileSync(path, "utf8")) as HrDataset);
  }

  async entities() {
    return this.d.entities;
  }
  async employees(entity: string) {
    return this.d.employees.filter((e) => e.entity === entity);
  }
  async pay(entity: string, year: number) {
    const ids = new Set((await this.employees(entity)).map((e) => e.id));
    return this.d.pay.filter((p) => p.year === year && ids.has(p.employeeId));
  }
  async proposals(entity: string, cycle: string) {
    const ids = new Set((await this.employees(entity)).map((e) => e.id));
    return (this.d.proposals ?? []).filter((p) => p.cycle === cycle && ids.has(p.employeeId));
  }
}

/** The HR schema in PostgreSQL (see packages/hr-data/sql/001_hr.sql). */
export class PgSource implements HrSource {
  constructor(private readonly pool: pg.Pool) {}

  async entities(): Promise<Entity[]> {
    const { rows } = await this.pool.query(`SELECT id, name, country, currency, full_time_hours AS "fullTimeHours" FROM hr.entities ORDER BY id`);
    return rows;
  }
  async employees(entity: string): Promise<Employee[]> {
    const { rows } = await this.pool.query(
      `SELECT id, entity, gender, family, level, location, org_unit AS "orgUnit", manager_id AS "managerId", fte::float AS fte,
              to_char(hire_date, 'YYYY-MM-DD') AS "hireDate", rating FROM hr.employees WHERE entity = $1 ORDER BY id`,
      [entity],
    );
    return rows;
  }
  async pay(entity: string, year: number): Promise<PayRecord[]> {
    const { rows } = await this.pool.query(
      `SELECT p.employee_id AS "employeeId", p.year, p.base::float AS base, p.complementary::float AS complementary, p.variable::float AS variable,
              p.hours_paid AS "hoursPaid" FROM hr.pay p JOIN hr.employees e ON e.id = p.employee_id WHERE e.entity = $1 AND p.year = $2 ORDER BY p.employee_id`,
      [entity, year],
    );
    return rows;
  }
  async proposals(entity: string, cycle: string): Promise<MeritProposal[]> {
    const { rows } = await this.pool.query(
      `SELECT m.employee_id AS "employeeId", m.cycle, m.proposed_pct::float AS "proposedPct", m.reason, m.proposed_by AS "proposedBy"
         FROM hr.merit_proposals m JOIN hr.employees e ON e.id = m.employee_id WHERE e.entity = $1 AND m.cycle = $2 ORDER BY m.employee_id`,
      [entity, cycle],
    );
    return rows;
  }
}

/** Writes a dataset into the HR schema (demo and tests). */
export async function loadIntoPg(pool: pg.Pool, d: HrDataset): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("TRUNCATE hr.merit_proposals, hr.pay, hr.employees, hr.entities");
    for (const e of d.entities) await c.query("INSERT INTO hr.entities VALUES ($1,$2,$3,$4,$5)", [e.id, e.name, e.country, e.currency, e.fullTimeHours]);
    await insertMany(c, "hr.employees", ["id", "entity", "gender", "family", "level", "location", "org_unit", "manager_id", "fte", "hire_date", "rating"],
      d.employees.map((e) => [e.id, e.entity, e.gender, e.family, e.level, e.location, e.orgUnit, e.managerId, e.fte, e.hireDate, e.rating]));
    await insertMany(c, "hr.pay", ["employee_id", "year", "base", "complementary", "variable", "hours_paid"],
      d.pay.map((p) => [p.employeeId, p.year, p.base, p.complementary, p.variable, p.hoursPaid]));
    await insertMany(c, "hr.merit_proposals", ["employee_id", "cycle", "proposed_pct", "reason", "proposed_by"],
      d.proposals.map((p) => [p.employeeId, p.cycle, p.proposedPct, p.reason, p.proposedBy]));
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    c.release();
  }
}

async function insertMany(c: pg.PoolClient, table: string, cols: string[], rows: unknown[][]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((_, r) => `(${cols.map((__, k) => `$${r * cols.length + k + 1}`).join(",")})`).join(",");
    await c.query(`INSERT INTO ${table} (${cols.join(",")}) VALUES ${values}`, chunk.flat());
  }
}
