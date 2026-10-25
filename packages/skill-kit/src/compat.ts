import type { Contract } from "./contract.js";

/**
 * Backwards compatibility between two versions of a skill's contract. Callers send inputs and read
 * outputs, so the two directions differ: a new optional input is fine, a new required one is not;
 * a new output field is fine, a removed one is not. The version bump must be at least what the
 * changes require; some changes also need a data-protection review whatever the bump.
 */
export type Bump = "major" | "minor" | "patch";
export interface Change {
  bump: Bump;
  path: string;
  what: string;
  /** a change to data handling that a reviewer must sign off (audience, classification, checks) */
  review?: boolean;
}

type Schema = { type?: string | string[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema; enum?: unknown[] };

export function diffContracts(prev: Contract, next: Contract): Change[] {
  const out: Change[] = [];
  schemaDiff(prev.inputs as Schema, next.inputs as Schema, "inputs", "in", out);
  schemaDiff(prev.output as Schema, next.output as Schema, "output", "out", out);

  if (prev.classification !== next.classification)
    out.push({ bump: "major", path: "classification", what: `${prev.classification} → ${next.classification}`, review: true });
  const added = next.audience.filter((r) => !prev.audience.includes(r));
  const removed = prev.audience.filter((r) => !next.audience.includes(r));
  if (added.length) out.push({ bump: "minor", path: "audience", what: `now also for ${added.join(", ")}`, review: true });
  if (removed.length) out.push({ bump: "major", path: "audience", what: `no longer for ${removed.join(", ")}` });
  const dropped = prev.validators.filter((v) => !next.validators.includes(v));
  if (dropped.length) out.push({ bump: "minor", path: "validators", what: `checks removed: ${dropped.join(", ")}`, review: true });
  for (const id of Object.keys(prev.scripts)) if (!next.scripts[id]) out.push({ bump: "minor", path: `scripts.${id}`, what: "script removed" });
  return out;
}

export function requiredBump(changes: Change[], contentChanged: boolean): Bump | null {
  if (changes.some((c) => c.bump === "major")) return "major";
  if (changes.some((c) => c.bump === "minor")) return "minor";
  return changes.length || contentChanged ? "patch" : null;
}

export function bumpOf(prev: string, next: string): Bump | "none" | "backwards" {
  const a = prev.split(".").map(Number) as [number, number, number];
  const b = next.split(".").map(Number) as [number, number, number];
  if (b[0] > a[0]) return "major";
  if (b[0] < a[0]) return "backwards";
  if (b[1] > a[1]) return "minor";
  if (b[1] < a[1]) return "backwards";
  if (b[2] > a[2]) return "patch";
  return b[2] < a[2] ? "backwards" : "none";
}

const RANK: Record<Bump, number> = { patch: 1, minor: 2, major: 3 };
export const satisfies = (actual: Bump | "none" | "backwards", needed: Bump | null) =>
  needed === null ? actual !== "backwards" : actual !== "none" && actual !== "backwards" && RANK[actual] >= RANK[needed];

function schemaDiff(a: Schema | undefined, b: Schema | undefined, path: string, dir: "in" | "out", out: Change[]) {
  if (!a || !b) return;
  const ta = JSON.stringify(a.type ?? null);
  const tb = JSON.stringify(b.type ?? null);
  if (ta !== tb) out.push({ bump: "major", path, what: `type ${ta} → ${tb}` });
  if (a.enum || b.enum) {
    const ea = (a.enum ?? []).map(String);
    const eb = (b.enum ?? []).map(String);
    const lost = ea.filter((x) => !eb.includes(x));
    const gained = eb.filter((x) => !ea.includes(x));
    // callers send inputs: losing an accepted value breaks them; callers read outputs: a new value can break them
    if (dir === "in" && lost.length) out.push({ bump: "major", path, what: `no longer accepts ${lost.join(", ")}` });
    if (dir === "in" && gained.length) out.push({ bump: "minor", path, what: `also accepts ${gained.join(", ")}` });
    if (dir === "out" && gained.length) out.push({ bump: "major", path, what: `may now return ${gained.join(", ")}` });
    if (dir === "out" && lost.length) out.push({ bump: "patch", path, what: `no longer returns ${lost.join(", ")}` });
  }
  const pa = a.properties ?? {};
  const pb = b.properties ?? {};
  const ra = new Set(a.required ?? []);
  const rb = new Set(b.required ?? []);
  for (const k of Object.keys(pa)) {
    if (!(k in pb)) out.push({ bump: "major", path: `${path}.${k}`, what: dir === "in" ? "input removed" : "output field removed" });
  }
  for (const k of Object.keys(pb)) {
    if (!(k in pa)) {
      if (dir === "in") out.push({ bump: rb.has(k) ? "major" : "minor", path: `${path}.${k}`, what: rb.has(k) ? "new required input" : "new optional input" });
      else out.push({ bump: "minor", path: `${path}.${k}`, what: "new output field" });
      continue;
    }
    if (dir === "in" && !ra.has(k) && rb.has(k)) out.push({ bump: "major", path: `${path}.${k}`, what: "input became required" });
    if (dir === "in" && ra.has(k) && !rb.has(k)) out.push({ bump: "minor", path: `${path}.${k}`, what: "input became optional" });
    if (dir === "out" && ra.has(k) && !rb.has(k)) out.push({ bump: "major", path: `${path}.${k}`, what: "output field may now be missing" });
    schemaDiff(pa[k], pb[k], `${path}.${k}`, dir, out);
  }
  if (a.items || b.items) schemaDiff(a.items, b.items, `${path}[]`, dir, out);
}
