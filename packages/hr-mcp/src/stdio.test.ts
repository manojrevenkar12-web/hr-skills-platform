import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

import { repoRoot } from "@hsp/hr-data";

describe("the stdio server, launched the way Claude Code launches it (.mcp.json)", () => {
  it("serves the role's tools and runs a skill script on the demo company", async () => {
    const root = repoRoot();
    const transport = new StdioClientTransport({
      command: join(root, "node_modules", ".bin", "tsx"),
      args: ["--conditions=source", join(root, "packages", "hr-mcp", "src", "stdio.ts")],
      env: { ...process.env, HSP_ROLE: "comp_partner", HSP_ROOT: root } as Record<string, string>,
      stderr: "ignore",
    });
    const client = new Client({ name: "test", version: "0" });
    await client.connect(transport);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("skill_merit_cycle_check_check_proposals");
    const r = await client.callTool({ name: "skill_merit_cycle_check_check_proposals", arguments: { args: { entity: "nordwerk-de", cycle: "2026", orgUnit: "DE-OPS-2" } } });
    const out = JSON.parse((r.content as { text: string }[])[0]!.text);
    expect(out.findings.map((f: { code: string }) => f.code)).toContain("equity_gap");
    await client.close();
  }, 30000);
});
