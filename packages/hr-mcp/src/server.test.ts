import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { generate, MemorySource, repoRoot } from "@hsp/hr-data";
import { loadSkill, skillDirs, type Role } from "@hsp/skill-kit";

import { copySkill } from "../../skill-kit/src/testing.js";
import { createHrMcpServer, type AuditEvent } from "./server.js";

const skills = skillDirs(repoRoot()).map(loadSkill);
const source = new MemorySource(generate());

async function connect(role: Role, audit: AuditEvent[] = [], s = skills) {
  const server = createHrMcpServer({ source, role, skills: s, audit: (e) => audit.push(e) });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await server.connect(b);
  await client.connect(a);
  return client;
}
const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0]!.text);

describe("the HR MCP server", () => {
  it("offers each role the reference tools and only the skill scripts of skills it may run", async () => {
    const names = async (role: Role) => (await (await connect(role)).listTools()).tools.map((t) => t.name).sort();
    expect(await names("recruiter")).toEqual(["band_lookup", "headcount", "job_architecture", "merit_policy", "skill_job_levelling_extract_signals"]);
    expect(await names("comp_partner")).toContain("skill_merit_cycle_check_check_proposals");
    expect(await names("hr_leadership")).not.toContain("skill_merit_cycle_check_check_proposals");
  });

  it("returns headcounts, never pay, and audits each call without its arguments", async () => {
    const audit: AuditEvent[] = [];
    const c = await connect("people_analytics", audit);
    const r = JSON.parse(text(await c.callTool({ name: "headcount", arguments: { entity: "nordwerk-de", by: "level" } })));
    expect(r[0]).toEqual({ group: "L1", women: expect.any(Number), men: expect.any(Number), diverse: expect.any(Number) });
    expect(audit).toEqual([{ tool: "headcount", role: "people_analytics", ok: true, ms: expect.any(Number) }]);
  });

  it("runs an aggregate skill's script and withholds a result that breaks the aggregate policy", async () => {
    const c = await connect("people_analytics");
    const ok = await c.callTool({ name: "skill_pay_gap_report_compute_indicators", arguments: { args: { entity: "nordwerk-de", year: 2026 } } });
    expect(ok.isError).toBeFalsy();
    // a deliberately leaky copy of a skill: its script returns an employee id
    const copy = copySkill(join(repoRoot(), "skills", "job-levelling"));
    copy.edit("scripts/signals.ts", (s) => s.replace("    yearsMin:", '    leaked: "E-00042",\n    yearsMin:'));
    const lc = await connect("recruiter", [], [loadSkill(copy.dir)]);
    const r = await lc.callTool({ name: "skill_job_levelling_extract_signals", arguments: { args: { jobDescription: "You lead a team of 4 drivers at one depot and plan the routes independently." } } });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/withheld: .*employee_id_in_aggregate/);
  });

  it("refuses an unknown role", () => {
    expect(() => createHrMcpServer({ source, role: "intern" as Role, skills })).toThrow(/unknown role/);
  });
});
