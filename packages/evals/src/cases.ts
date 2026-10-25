import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import type { Role, Skill } from "@hsp/skill-kit";

import { get, same } from "./paths.js";

/** A golden or held-out case: an input, optionally a dataset and a role, and what must come out. */
export interface Case {
  id: string;
  title?: string;
  fixture?: string;
  /** an inline dataset: rows passed to a builder function the skill ships, e.g. scripts/testkit.ts#company */
  build?: { fn: string; rows: unknown[] };
  role?: Role;
  input: Record<string, unknown>;
  expect: Expect;
  /** for metric suites: the answer a careful person gave (e.g. the level of a job) */
  truth?: Record<string, unknown>;
}
export interface Expect {
  status: "ok" | "held" | "failed" | "refused";
  equals?: Record<string, unknown>;
  equals_list?: Record<string, unknown[]>;
  includes?: Record<string, unknown[]>;
  excludes?: Record<string, unknown[]>;
  range?: Record<string, [number, number]>;
  /** the same values in any order (a multiset) */
  same_set?: Record<string, unknown[]>;
}

export function loadCases(file: string): Case[] {
  const doc = parse(readFileSync(file, "utf8")) as { cases?: Case[] };
  return doc.cases ?? [];
}

export const goldenFile = (skill: Skill) => join(skill.dir, "evals", "golden.yaml");

export function heldoutSets(skill: Skill): { name: string; dir: string; status: string | null }[] {
  const base = join(skill.dir, "evals", "heldout");
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((d) => existsSync(join(base, d, "cases.yaml")))
    .sort()
    .map((d) => ({ name: d, dir: join(base, d), status: existsSync(join(base, d, "STATUS")) ? readFileSync(join(base, d, "STATUS"), "utf8").trim() : null }));
}

/** Every way the result differs from what the case expects; empty when it passes. */
export function check(c: Case, result: { status: string; output: unknown }): string[] {
  const e = c.expect;
  const out: string[] = [];
  if (result.status !== e.status) out.push(`status ${result.status}, expected ${e.status}`);
  if (result.status !== "ok" && result.status !== "held") return out;
  for (const [path, want] of Object.entries(e.equals ?? {})) {
    const got = get(result.output, path);
    if (!same(got, want)) out.push(`${path} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }
  for (const [path, want] of Object.entries(e.equals_list ?? {})) {
    const got = get(result.output, path);
    if (!same(got, want)) out.push(`${path} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
  }
  for (const [path, want] of Object.entries(e.includes ?? {})) {
    const got = get(result.output, path);
    const arr = Array.isArray(got) ? got : [got];
    for (const w of want) if (!arr.some((g) => same(g, w))) out.push(`${path} does not include ${JSON.stringify(w)} (got ${JSON.stringify(got)})`);
  }
  for (const [path, unwanted] of Object.entries(e.excludes ?? {})) {
    const got = get(result.output, path);
    const arr = Array.isArray(got) ? got : [got];
    for (const w of unwanted) if (arr.some((g) => same(g, w))) out.push(`${path} includes ${JSON.stringify(w)}`);
  }
  for (const [path, want] of Object.entries(e.same_set ?? {})) {
    const got = get(result.output, path);
    const norm = (xs: unknown[]) => xs.map((x) => JSON.stringify(x)).sort();
    if (!Array.isArray(got) || JSON.stringify(norm(got)) !== JSON.stringify(norm(want))) out.push(`${path} = ${JSON.stringify(got)}, expected the values ${JSON.stringify(want)} in any order`);
  }
  for (const [path, [lo, hi]] of Object.entries(e.range ?? {})) {
    const got = get(result.output, path);
    if (typeof got !== "number" || got < lo || got > hi) out.push(`${path} = ${JSON.stringify(got)}, expected between ${lo} and ${hi}`);
  }
  return out;
}
