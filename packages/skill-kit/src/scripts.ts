import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ScriptContext } from "@hsp/hr-data";

import type { Skill } from "./skill.js";

export type ScriptFn = (args: Record<string, unknown>, ctx: ScriptContext) => Promise<unknown>;

/** Imports a script named in the skill's contract and returns its exported function. */
export async function loadScript(skill: Skill, id: string): Promise<ScriptFn> {
  const s = skill.contract.scripts[id];
  if (!s) throw new Error(`${skill.name} has no script "${id}"`);
  const mod = (await import(pathToFileURL(join(skill.dir, s.file)).href)) as Record<string, unknown>;
  const fn = mod[s.export];
  if (typeof fn !== "function") throw new Error(`${skill.name}/${s.file} does not export a function ${s.export}`);
  return fn as ScriptFn;
}
