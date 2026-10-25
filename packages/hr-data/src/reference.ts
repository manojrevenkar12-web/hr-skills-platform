import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

import { FAMILIES, LEVELS, type Band, type CompaZone, type Family, type JobArchitecture, type Level, type MeritPolicy } from "./types.js";

/** The repository root: HSP_ROOT, or the nearest parent of this file that holds data/reference. */
export function repoRoot(): string {
  if (process.env.HSP_ROOT) return resolve(process.env.HSP_ROOT);
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "data", "reference"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("cannot find the repository root (data/reference); set HSP_ROOT");
}

const readYaml = <T>(file: string): T => parse(readFileSync(join(repoRoot(), "data", "reference", file), "utf8")) as T;

export const jobArchitecture = (): JobArchitecture => readYaml<JobArchitecture>("job-architecture.yaml");

export function meritPolicy(): MeritPolicy {
  return readYaml<MeritPolicy>("merit-policy-2026.yaml");
}

interface BandStructure {
  level_mid: Record<Level, number>;
  family_factor: Record<Family, number>;
  location_factor: Record<string, number>;
  min_pct_of_mid: number;
  max_pct_of_mid: number;
}

export function bands(): Band[] {
  const s = readYaml<BandStructure>("band-structure.yaml");
  const out: Band[] = [];
  for (const family of FAMILIES)
    for (const level of LEVELS)
      for (const [location, lf] of Object.entries(s.location_factor)) {
        const mid = Math.round((s.level_mid[level] * s.family_factor[family] * lf) / 100) * 100;
        out.push({ family, level, location, mid, min: Math.round((mid * s.min_pct_of_mid) / 100), max: Math.round((mid * s.max_pct_of_mid) / 100) });
      }
  return out;
}

export function compaZone(compa: number): CompaZone {
  if (compa < 0.9) return "below_90";
  if (compa < 1.0) return "90_to_100";
  if (compa < 1.1) return "100_to_110";
  return "above_110";
}
