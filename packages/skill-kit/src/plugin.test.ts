import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { repoRoot } from "@hsp/hr-data";

const root = repoRoot();
const json = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8")) as Record<string, unknown>;

describe("the Claude Code plugin", () => {
  it("has a kebab-case name, a version and a marketplace entry that points at it", () => {
    const plugin = json(".claude-plugin/plugin.json");
    expect(plugin.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/);
    const market = json(".claude-plugin/marketplace.json") as { plugins: { name: string; source: string }[] };
    expect(market.plugins).toEqual([expect.objectContaining({ name: plugin.name, source: "./" })]);
  });

  it("starts the HR MCP server from the plugin root, with a role", () => {
    const mcp = json(".mcp.json") as { mcpServers: Record<string, { command: string; args: string[]; env: Record<string, string> }> };
    const hr = mcp.mcpServers.hr!;
    expect(hr.args[0]).toBe("${CLAUDE_PLUGIN_ROOT}/packages/hr-mcp/dist/stdio.js");
    expect(existsSync(join(root, "packages/hr-mcp/src/stdio.ts"))).toBe(true);
    expect(hr.env.HSP_ROLE).toBeTruthy();
  });

  it("ships skills where Claude Code looks for them (skills/<name>/SKILL.md)", () => {
    for (const s of ["pay-gap-report", "merit-cycle-check", "job-levelling"]) expect(existsSync(join(root, "skills", s, "SKILL.md"))).toBe(true);
  });
});
