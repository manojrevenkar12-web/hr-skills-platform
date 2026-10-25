import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Ajv } from "ajv";

import type { HrSource } from "@hsp/hr-data";
import { createHrMcpServer, scriptToolName, type AuditEvent } from "@hsp/hr-mcp";
import type { Role, Skill } from "@hsp/skill-kit";

import { ProviderError, type Message, type Provider, type ToolCall, type ToolDef } from "./providers/types.js";
import { validate, type ValidatorFinding } from "./validators.js";

/**
 * Runs one skill for one request: the model reads the skill's instructions, calls its scripts and
 * the platform's tools over MCP, and submits a result; the result is then checked by the skill's
 * validators. Everything the model did is in the trace.
 */
export type RunStatus = "ok" | "held" | "failed" | "refused";
export interface TraceStep {
  turn: number;
  kind: "model" | "tool";
  name?: string;
  ok?: boolean;
  ms: number;
  detail?: string;
}
export interface RunResult {
  skill: string;
  version: string;
  status: RunStatus;
  output: unknown;
  findings: ValidatorFinding[];
  trace: TraceStep[];
  usage: { inputTokens: number; outputTokens: number };
  model: string;
  durationMs: number;
  error?: string;
  /** results of successful tool calls, as the validators saw them */
  toolResults: unknown[];
}
export interface RunOptions {
  skill: Skill;
  /** every skill, so the MCP server can expose their scripts (the run uses only its own) */
  skills: Skill[];
  input: Record<string, unknown>;
  role: Role;
  provider: Provider;
  source: HrSource;
  audit?: (e: AuditEvent) => void;
}

const PREAMBLE = `You are running a skill of the HR skills platform for a compensation and HR team.
Follow the skill's instructions below. Use only the tools you are given; numbers in your answer must
come from tool results or the input. Finish by calling submit_result exactly once with the result.
Write in English. Never mention individual employees' pay unless the skill explicitly allows it.`;

const ajv = new Ajv({ allErrors: true, strict: false });

export async function runSkill(opts: RunOptions): Promise<RunResult> {
  const { skill, input, role, provider } = opts;
  const t0 = performance.now();
  const trace: TraceStep[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const toolResults: unknown[] = [];
  /** the latest result of each script, by script id: what x-from output fields are filled from */
  const scriptResults = new Map<string, unknown>();
  const base = { skill: skill.name, version: skill.contract.version, trace, usage, model: provider.model, toolResults };
  const done = (status: RunStatus, output: unknown, findings: ValidatorFinding[] = [], error?: string): RunResult => ({
    ...base,
    status,
    output,
    findings,
    error,
    durationMs: Math.round(performance.now() - t0),
  });

  if (!skill.contract.audience.includes(role)) return done("refused", null, [], `role ${role} may not run ${skill.name}`);
  const checkInput = ajv.compile(skill.contract.inputs);
  if (!checkInput(input)) return done("refused", null, [], `invalid input: ${(checkInput.errors ?? []).map((e) => `${e.instancePath || "input"} ${e.message}`).join("; ")}`);

  const server = createHrMcpServer({ source: opts.source, role, skills: opts.skills, audit: opts.audit });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: "hsp-harness", version: "0.1.0" });
  await server.connect(serverT);
  await mcp.connect(clientT);

  try {
    const tools = await toolsFor(skill, mcp);
    const messages: Message[] = [{ role: "user", content: `Input:\n${JSON.stringify(input, null, 2)}` }];
    const system = `${PREAMBLE}\n\n# Skill: ${skill.name} ${skill.contract.version}\n\n${skill.body}`;
    let nudged = false;

    for (let turn = 1; turn <= skill.contract.maxTurns; turn++) {
      const m0 = performance.now();
      let reply;
      try {
        reply = await provider.chat({ system, messages, tools: tools.defs, skill: skill.name });
      } catch (err) {
        trace.push({ turn, kind: "model", ok: false, ms: Math.round(performance.now() - m0), detail: String(err) });
        return done("failed", null, [], err instanceof ProviderError ? err.message : `model error: ${String(err)}`);
      }
      usage.inputTokens += reply.usage.inputTokens;
      usage.outputTokens += reply.usage.outputTokens;
      trace.push({ turn, kind: "model", ok: true, ms: Math.round(performance.now() - m0), detail: reply.toolCalls.map((c) => c.name).join(", ") || "text" });
      messages.push({ role: "assistant", text: reply.text, toolCalls: reply.toolCalls });

      const submit = reply.toolCalls.find((c) => c.name === "submit_result");
      if (submit) {
        const { output, missing } = assemble(skill.contract.output, submit.input, scriptResults);
        const findings = [...missing.map((m) => ({ validator: "schema" as const, message: m })), ...validate(output, { skill, input, toolResults })];
        return done(findings.length ? "held" : "ok", output, findings);
      }
      if (!reply.toolCalls.length) {
        if (nudged) return done("failed", reply.text, [], "the model answered without submitting a result");
        nudged = true;
        messages.push({ role: "user", content: "Call submit_result with the result now." });
        continue;
      }
      const results = [];
      for (const call of reply.toolCalls) {
        const s0 = performance.now();
        const r = await tools.execute(call);
        trace.push({ turn, kind: "tool", name: call.name, ok: !r.isError, ms: Math.round(performance.now() - s0), detail: r.isError ? r.content.slice(0, 200) : undefined });
        if (!r.isError) {
          toolResults.push(parse(r.content));
          if (call.name === "run_script") scriptResults.set(String(call.input.script), parse(r.content));
        }
        results.push({ id: call.id, content: r.content, isError: r.isError });
      }
      messages.push({ role: "tool", results });
    }
    return done("failed", null, [], `no result after ${skill.contract.maxTurns} turns`);
  } finally {
    await mcp.close();
    await server.close();
  }
}

interface ToolSet {
  defs: ToolDef[];
  execute(call: ToolCall): Promise<{ content: string; isError: boolean }>;
}

async function toolsFor(skill: Skill, mcp: Client): Promise<ToolSet> {
  const listed = (await mcp.listTools()).tools;
  const scriptIds = Object.keys(skill.contract.scripts);
  const refs = listReferences(skill);
  const mcpNames = skill.contract.tools.filter((t) => t.startsWith("mcp:")).map((t) => t.slice(4));
  const defs: ToolDef[] = [];

  if (scriptIds.length)
    defs.push({
      name: "run_script",
      description: `Run one of this skill's scripts:\n${scriptIds.map((id) => `- ${id}: ${skill.contract.scripts[id]!.description}`).join("\n")}`,
      inputSchema: { type: "object", properties: { script: { type: "string", enum: scriptIds }, args: { type: "object" } }, required: ["script", "args"] },
    });
  if (refs.length)
    defs.push({
      name: "read_reference",
      description: "Read one of this skill's reference documents.",
      inputSchema: { type: "object", properties: { path: { type: "string", enum: refs } }, required: ["path"] },
    });
  for (const name of mcpNames) {
    const t = listed.find((x) => x.name === name);
    if (t) defs.push({ name, description: t.description ?? name, inputSchema: t.inputSchema as Record<string, unknown> });
  }
  defs.push({
    name: "submit_result",
    description: "Submit the skill's result. Call exactly once, at the end. Figures computed by scripts are attached by the platform; do not copy them.",
    inputSchema: modelSchema(skill.contract.output),
  });

  return {
    defs,
    async execute(call) {
      try {
        if (call.name === "run_script") {
          const id = String(call.input.script ?? "");
          if (!scriptIds.includes(id)) return { content: `unknown script ${id}`, isError: true };
          return fromMcp(await mcp.callTool({ name: scriptToolName(skill.name, id), arguments: { args: (call.input.args as object) ?? {} } }));
        }
        if (call.name === "read_reference") {
          const path = String(call.input.path ?? "");
          if (!refs.includes(path)) return { content: `unknown reference ${path}`, isError: true };
          return { content: readFileSync(join(skill.dir, path), "utf8"), isError: false };
        }
        if (mcpNames.includes(call.name)) return fromMcp(await mcp.callTool({ name: call.name, arguments: call.input }));
        return { content: `tool ${call.name} is not available to this skill`, isError: true };
      } catch (err) {
        return { content: err instanceof Error ? err.message : String(err), isError: true };
      }
    },
  };
}

function fromMcp(r: unknown): { content: string; isError: boolean } {
  const res = r as { content?: { type: string; text?: string }[]; isError?: boolean };
  return { content: (res.content ?? []).map((c) => c.text ?? "").join(""), isError: Boolean(res.isError) };
}

function listReferences(skill: Skill): string[] {
  const dir = join(skill.dir, "references");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => `references/${f}`).sort() : [];
}

function parse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

/**
 * Output fields marked "x-from": "<script>" or "<script>.<path>" are filled by the platform from the
 * script's result, never written by the model: numbers are computed and copied by code. The model's
 * submit_result schema leaves them out.
 */
export function modelSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const fromKeys = Object.keys(props).filter((k) => typeof props[k]?.["x-from"] === "string");
  const clean = JSON.parse(JSON.stringify(schema, (k, v) => (k.startsWith("x-") ? undefined : v))) as Record<string, unknown>;
  const cp = clean.properties as Record<string, unknown> | undefined;
  for (const k of fromKeys) delete cp?.[k];
  if (Array.isArray(clean.required)) clean.required = (clean.required as string[]).filter((k) => !fromKeys.includes(k));
  return clean;
}

export function assemble(schema: Record<string, unknown>, submitted: Record<string, unknown>, scripts: Map<string, unknown>): { output: Record<string, unknown>; missing: string[] } {
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const output: Record<string, unknown> = { ...submitted };
  const missing: string[] = [];
  for (const [k, p] of Object.entries(props)) {
    const from = p["x-from"];
    if (typeof from !== "string") continue;
    const [script, ...path] = from.split(".");
    if (!scripts.has(script!)) {
      missing.push(`${k} comes from script ${script}, which the run never called successfully`);
      delete output[k];
      continue;
    }
    output[k] = path.reduce<unknown>((v, key) => (v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined), scripts.get(script!));
  }
  return { output, missing };
}
