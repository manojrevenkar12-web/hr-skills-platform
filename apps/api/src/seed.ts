import type pg from "pg";

import { generate, loadIntoPg } from "@hsp/hr-data";

/** Demo users, one per role, and the synthetic company's HR data. Everything is invented. */
export const DEMO_USERS = [
  { email: "clara@nordwerk.example", name: "Clara Becker", role: "comp_partner" },
  { email: "jonas@nordwerk.example", name: "Jonas Weber", role: "hr_business_partner" },
  { email: "ines@nordwerk.example", name: "Ines Moreira", role: "hr_leadership" },
  { email: "farid@nordwerk.example", name: "Farid Haddad", role: "people_analytics" },
  { email: "lena@nordwerk.example", name: "Lena Vogel", role: "recruiter" },
] as const;

export async function seedDemo(pool: pg.Pool): Promise<void> {
  for (const u of DEMO_USERS)
    await pool.query("INSERT INTO app.users (email, name, role) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING", [u.email, u.name, u.role]);
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM hr.employees");
  if (rows[0].n === 0) await loadIntoPg(pool, generate());
}
