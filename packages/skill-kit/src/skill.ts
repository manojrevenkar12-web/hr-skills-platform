import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse } from "yaml";

import { Contract } from "./contract.js";

export interface Skill {
  dir: string;
  name: string;
  frontmatter: Record<string, unknown>;
  description: string;
  body: string;
  bodyLines: number;
  contract: Contract;
  /** files of the skill, relative to its directory */
  files: string[];
  /** sha256 over every file of the skill: what a release pins */
  contentHash: string;
}

export class SkillError extends Error {}

export function parseSkillMd(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new SkillError("SKILL.md must start with YAML frontmatter between --- lines");
  const fm = parse(m[1]!) as unknown;
  if (!fm || typeof fm !== "object" || Array.isArray(fm)) throw new SkillError("SKILL.md frontmatter must be a YAML mapping");
  return { frontmatter: fm as Record<string, unknown>, body: m[2]! };
}

export function loadSkill(dir: string): Skill {
  const mdPath = join(dir, "SKILL.md");
  if (!existsSync(mdPath)) throw new SkillError(`${dir}: no SKILL.md`);
  const { frontmatter, body } = parseSkillMd(readFileSync(mdPath, "utf8"));
  const contractPath = join(dir, "contract.yaml");
  if (!existsSync(contractPath)) throw new SkillError(`${dir}: no contract.yaml`);
  const parsed = Contract.safeParse(parse(readFileSync(contractPath, "utf8")));
  if (!parsed.success) throw new SkillError(`${dir}/contract.yaml: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  const files = listFiles(dir).map((f) => relative(dir, f)).sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f).update("\0").update(readFileSync(join(dir, f))).update("\0");
  return {
    dir,
    name: String(frontmatter.name ?? ""),
    frontmatter,
    description: String(frontmatter.description ?? ""),
    body,
    bodyLines: body.split("\n").length,
    contract: parsed.data,
    files,
    contentHash: hash.digest("hex"),
  };
}

export function skillDirs(root: string): string[] {
  const base = join(root, "skills");
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .map((d) => join(base, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, "SKILL.md")))
    .sort();
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}
