import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Copies a skill into a temporary directory so a test can break it. */
export function copySkill(src: string): { dir: string; edit: (file: string, f: (s: string) => string) => void } {
  const root = mkdtempSync(join(tmpdir(), "hsp-skill-"));
  const name = src.split("/").filter(Boolean).at(-1)!;
  const dir = join(root, name);
  cpSync(src, dir, { recursive: true });
  return { dir, edit: (file, f) => writeFileSync(join(dir, file), f(readFileSync(join(dir, file), "utf8"))) };
}
