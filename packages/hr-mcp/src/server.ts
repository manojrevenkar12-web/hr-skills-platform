import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { bands, checkAggregate, FAMILIES, jobArchitecture, LEVELS, meritPolicy, type HrSource } from "@hsp/hr-data";
import { loadScript, ROLES, type Role, type Skill } from "@hsp/skill-kit";

/**
 * The shared MCP server over HR data. Any MCP client (Claude Code, an IDE assistant, the
 * platform's own harness) gets the same tools and the same rules:
 *
 * - reference tools (job architecture, bands, merit policy, headcount) for every HR role;
 * - each skill script as a tool `skill_<skill>_<script>`, only for the roles in the skill's
 *   audience, and for aggregate skills only if the result passes the aggregate policy;
 * - every call is audited (tool, role, outcome, duration; never arguments or results).
 */
export interface AuditEvent {
  tool: string;
  role: Role;
  ok: boolean;
  ms: number;
  error?: string;
}
export interface HrMcpOptions {
  source: HrSource;
  role: Role;
  skills: Skill[];
  audit?: (e: AuditEvent) => void;
}

export const REFERENCE_TOOLS = ["job_architecture", "band_lookup", "merit_policy", "headcount"] as const;
export const scriptToolName = (skill: string, script: string) => `skill_${skill.replace(/-/g, "_")}_${script}`;

export function createHrMcpServer(opts: HrMcpOptions): McpServer {
  if (!ROLES.includes(opts.role)) throw new Error(`unknown role ${opts.role}`);
  const server = new McpServer({ name: "hr-skills-platform", version: "0.1.0" });
  // registerTool's generic inference over zod shapes is too deep for tsc; the handlers below type their own args
  type Result = { content: { type: "text"; text: string }[]; isError?: boolean };
  const register = server.registerTool.bind(server) as unknown as (
    name: string,
    config: { description: string; inputSchema: Record<string, z.ZodTypeAny> },
    handler: (args: never) => Promise<Result>,
  ) => void;
  const audited =
    <A>(tool: string, fn: (args: A) => Promise<unknown>) =>
    async (args: A) => {
      const t0 = performance.now();
      try {
        const value = await fn(args);
        opts.audit?.({ tool, role: opts.role, ok: true, ms: Math.round(performance.now() - t0) });
        return { content: [{ type: "text" as const, text: JSON.stringify(value) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        opts.audit?.({ tool, role: opts.role, ok: false, ms: Math.round(performance.now() - t0), error: message });
        return { content: [{ type: "text" as const, text: message }], isError: true };
      }
    };

  register(
    "job_architecture",
    { description: "The job families and the six levels with their scope, autonomy, complexity and impact criteria.", inputSchema: {} },
    audited("job_architecture", async () => jobArchitecture()),
  );

  register(
    "band_lookup",
    {
      description: "The salary band (annual full-time base pay, EUR) for a job family, level and location.",
      inputSchema: { family: z.enum(FAMILIES as [string, ...string[]]), level: z.enum(LEVELS as [string, ...string[]]), location: z.string() },
    },
    audited("band_lookup", async ({ family, level, location }: { family: string; level: string; location: string }) => {
      const b = bands().find((x) => x.family === family && x.level === level && x.location === location);
      if (!b) throw new Error(`no band for ${family} ${level} in ${location}`);
      return b;
    }),
  );

  register(
    "merit_policy",
    { description: "The merit cycle guideline: increase ranges by rating and compa-ratio zone, budget, reason and equity rules.", inputSchema: {} },
    audited("merit_policy", async () => meritPolicy()),
  );

  register(
    "headcount",
    {
      description: "Headcount of an entity by gender, grouped by family, level or location. Counts only, never pay.",
      inputSchema: { entity: z.string(), by: z.enum(["family", "level", "location"]) },
    },
    audited("headcount", async ({ entity, by }: { entity: string; by: "family" | "level" | "location" }) => {
      const groups = new Map<string, { women: number; men: number; diverse: number }>();
      for (const e of await opts.source.employees(entity)) {
        const g = groups.get(e[by]) ?? { women: 0, men: 0, diverse: 0 };
        if (e.gender === "F") g.women++;
        else if (e.gender === "M") g.men++;
        else g.diverse++;
        groups.set(e[by], g);
      }
      if (!groups.size) throw new Error(`no employees in entity ${entity}`);
      return [...groups.entries()].sort().map(([group, c]) => ({ group, ...c }));
    }),
  );

  for (const skill of opts.skills) {
    if (!skill.contract.audience.includes(opts.role)) continue;
    for (const [id, s] of Object.entries(skill.contract.scripts)) {
      const name = scriptToolName(skill.name, id);
      register(
        name,
        { description: `${skill.name}: ${s.description}`, inputSchema: { args: z.record(z.unknown()).describe("the script's arguments as JSON") } },
        audited(name, async ({ args }: { args: Record<string, unknown> }) => {
          const fn = await loadScript(skill, id);
          const value = await fn(args ?? {}, { source: opts.source });
          if (skill.contract.classification === "aggregate") {
            const v = checkAggregate(value);
            if (v.length) throw new Error(`withheld: the result breaks the aggregate policy (${v.map((x) => `${x.rule} at ${x.path}`).join("; ")})`);
          }
          return value;
        }),
      );
    }
  }
  return server;
}
