
import { describe, expect, it } from "vitest";

import { generate, MemorySource, repoRoot } from "@hsp/hr-data";
import { loadSkill, skillDirs } from "@hsp/skill-kit";

import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleProvider } from "./providers/openai.js";
import { SimulatedProvider, type Behaviour } from "./providers/simulated.js";
import { ProviderError, type Provider } from "./providers/types.js";
import { assemble, modelSchema, runSkill } from "./run.js";

const skills = skillDirs(repoRoot()).map(loadSkill);
const payGap = skills.find((s) => s.name === "pay-gap-report")!;
const source = new MemorySource(generate());
const run = (provider: Provider, input: Record<string, unknown> = { entity: "nordwerk-de", year: 2026 }, role = "people_analytics" as const) =>
  runSkill({ skill: payGap, skills, input, role, provider, source });
const sim = (b: Behaviour) => new SimulatedProvider({ "pay-gap-report": b });

describe("runSkill", () => {
  it("refuses a role outside the skill's audience and invalid input before any model call", async () => {
    let called = false;
    const p = sim(() => ((called = true), { text: "x" }));
    expect((await runSkill({ skill: payGap, skills, input: { entity: "x", year: 2026 }, role: "recruiter", provider: p, source })).status).toBe("refused");
    expect((await run(p, { entity: "nordwerk-de", year: "2026" })).error).toMatch(/invalid input: \/year must be integer/);
    expect(called).toBe(false);
  });

  it("attaches the script's figures itself, so the model cannot alter them", async () => {
    const p = sim(({ results, turn }) =>
      turn === 1
        ? { call: "run_script", input: { script: "compute_indicators", args: { entity: "nordwerk-de", year: 2026 } } }
        : { submit: { indicators: { meanGapPct: 0 }, memo: "x".repeat(400), findingsAddressed: (results.get("compute_indicators") as { findings: { id: string }[] }).findings.map((f) => f.id), caveats: ["Categories are a proxy for work of equal value."] } },
    );
    const r = await run(p);
    expect((r.output as { indicators: { meanGapPct: number } }).indicators.meanGapPct).toBeGreaterThan(5);
    expect(r.findings.map((f) => f.validator)).not.toContain("schema");
  });

  it("holds a result that skipped the script", async () => {
    const r = await run(sim(() => ({ submit: { memo: "x".repeat(400), findingsAddressed: [], caveats: ["A caveat that is long enough."] } })));
    expect(r.status).toBe("held");
    expect(r.findings[0]!.message).toMatch(/never called successfully/);
  });

  it("fails after the turn limit, and on a provider error, with the reason", async () => {
    const loop = await run(sim(() => ({ call: "run_script", input: { script: "compute_indicators", args: { entity: "nordwerk-de", year: 2026 } } })));
    expect(loop).toMatchObject({ status: "failed", error: "no result after 6 turns" });
    const broken: Provider = { model: "broken", chat: async () => { throw new ProviderError("Anthropic 529: overloaded", true); } };
    expect(await run(broken)).toMatchObject({ status: "failed", error: "Anthropic 529: overloaded" });
  });

  it("gives the model no tool the skill did not declare", async () => {
    const r = await run(sim(({ turn }) => (turn === 1 ? { call: "merit_policy", input: {} } : { text: "done" })));
    expect(r.trace.find((t) => t.kind === "tool")).toMatchObject({ name: "merit_policy", ok: false });
  });
});

describe("output assembly", () => {
  it("leaves x-from fields out of the model's schema and fills them from scripts", () => {
    const schema = modelSchema(payGap.contract.output);
    expect(Object.keys(schema.properties as object)).toEqual(["memo", "findingsAddressed", "caveats"]);
    const { output } = assemble(payGap.contract.output, { memo: "m" }, new Map([["compute_indicators", { entity: "e", year: 2026, indicators: {}, categories: [], findings: [], population: {} }]]));
    expect(output).toMatchObject({ entity: "e", year: 2026, memo: "m" });
  });
});

describe("providers", () => {
  const req = { system: "s", skill: "x", tools: [{ name: "t", description: "d", inputSchema: { type: "object" } }], messages: [
    { role: "user" as const, content: "hi" },
    { role: "assistant" as const, text: "", toolCalls: [{ id: "c1", name: "t", input: { a: 1 } }] },
    { role: "tool" as const, results: [{ id: "c1", content: "42", isError: false }] },
  ] };

  it("speaks the Anthropic Messages API", async () => {
    let body: Record<string, unknown> = {};
    const fetchFn = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ content: [{ type: "tool_use", id: "c2", name: "t", input: { b: 2 } }], usage: { input_tokens: 10, output_tokens: 3 } }));
    }) as typeof fetch;
    const turn = await new AnthropicProvider("claude-sonnet-5-5", "k", "https://api.example", 1000, fetchFn).chat(req);
    expect(turn.toolCalls).toEqual([{ id: "c2", name: "t", input: { b: 2 } }]);
    expect((body.messages as { content: unknown }[])[2]!.content).toEqual([{ type: "tool_result", tool_use_id: "c1", content: "42", is_error: false }]);
    expect((body.tools as { input_schema: unknown }[])[0]!.input_schema).toEqual({ type: "object" });
  });

  it("speaks OpenAI-compatible chat completions, and marks rate limits retryable", async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: "c2", function: { name: "t", arguments: "{\"b\":2}" } }] } }] }))) as unknown as typeof fetch;
    expect((await new OpenAICompatibleProvider("m", "k", "https://llm.example/v1", fetchFn).chat(req)).toolCalls[0]!.input).toEqual({ b: 2 });
    const limited = (async () => new Response("slow down", { status: 429 })) as unknown as typeof fetch;
    await expect(new OpenAICompatibleProvider("m", "k", "https://llm.example/v1", limited).chat(req)).rejects.toMatchObject({ retryable: true });
  });
});

