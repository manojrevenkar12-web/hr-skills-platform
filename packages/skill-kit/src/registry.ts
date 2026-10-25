import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { bumpOf, diffContracts, requiredBump, satisfies, type Change } from "./compat.js";
import type { Contract } from "./contract.js";
import type { Skill } from "./skill.js";

/**
 * The record of what was released: one JSON file per skill in registry/, appended to by
 * `hsp release` and never edited by hand. A release pins the content hash, the contract, the
 * evaluation that let it through and who approved it.
 */
export interface Release {
  version: string;
  contentHash: string;
  contract: Contract;
  releasedAt: string;
  approvedBy: string;
  evaluation: { goldenPassRate: number; faultCatchRate: number; metrics: Record<string, number>; report: string };
  changes: Change[];
}
export interface RegistryFile {
  skill: string;
  releases: Release[];
}

export const registryPath = (root: string, skill: string) => join(root, "registry", `${skill}.json`);

export function readRegistry(root: string, skill: string): RegistryFile {
  const p = registryPath(root, skill);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as RegistryFile) : { skill, releases: [] };
}

export const latest = (r: RegistryFile): Release | undefined => r.releases.at(-1);

export interface ReleaseCheck {
  skill: string;
  status: "unchanged" | "ready" | "blocked" | "first";
  version: string;
  previous?: string;
  needed: string | null;
  changes: Change[];
  problems: string[];
}

/** What releasing the skill as it is now would mean, and what stops it. */
export function checkRelease(skill: Skill, root: string): ReleaseCheck {
  const reg = readRegistry(root, skill.name);
  const prev = latest(reg);
  const version = skill.contract.version;
  if (!prev) return { skill: skill.name, status: "first", version, needed: null, changes: [], problems: [] };
  if (prev.contentHash === skill.contentHash) return { skill: skill.name, status: "unchanged", version, previous: prev.version, needed: null, changes: [], problems: [] };
  const changes = diffContracts(prev.contract, skill.contract);
  const needed = requiredBump(changes, true);
  const actual = bumpOf(prev.version, version);
  const problems: string[] = [];
  if (actual === "none") problems.push(`the skill changed since ${prev.version} but its version did not`);
  else if (actual === "backwards") problems.push(`version ${version} is lower than the released ${prev.version}`);
  else if (!satisfies(actual, needed)) problems.push(`the changes need a ${needed} version bump, got ${actual} (${prev.version} → ${version})`);
  return { skill: skill.name, status: problems.length ? "blocked" : "ready", version, previous: prev.version, needed, changes, problems };
}

export function appendRelease(root: string, skill: Skill, release: Omit<Release, "version" | "contentHash" | "contract">): Release {
  const reg = readRegistry(root, skill.name);
  if (reg.releases.some((r) => r.version === skill.contract.version)) throw new Error(`${skill.name} ${skill.contract.version} is already released`);
  const r: Release = { version: skill.contract.version, contentHash: skill.contentHash, contract: skill.contract, ...release };
  reg.releases.push(r);
  mkdirSync(join(root, "registry"), { recursive: true });
  writeFileSync(registryPath(root, skill.name), `${JSON.stringify(reg, null, 2)}\n`);
  return r;
}
