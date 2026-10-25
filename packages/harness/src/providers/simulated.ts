import type { ChatRequest, Message, ModelTurn, Provider, ToolCall } from "./types.js";

/**
 * A deterministic stand-in for a model, so tests and the evaluation run offline, free and the same
 * every time. Each skill brings its own behaviour (skills/<name>/evals/simulated.ts): what a
 * careful model would do with that skill. Faults make it misbehave in named ways, which is how the
 * evaluation proves the validators catch each kind of mistake.
 */
export interface SimContext {
  input: Record<string, unknown>;
  /** results of earlier tool calls, by tool name (run_script results by script id) */
  results: Map<string, unknown>;
  turn: number;
  faults: ReadonlySet<string>;
}
export type Step = { call: string; input: Record<string, unknown> } | { submit: Record<string, unknown> } | { text: string };
export type Behaviour = (ctx: SimContext) => Step;

export class SimulatedProvider implements Provider {
  readonly model: string;
  constructor(
    private readonly behaviours: Record<string, Behaviour>,
    private readonly faults: string[] = [],
  ) {
    this.model = faults.length ? `simulated-1+${faults.join("+")}` : "simulated-1";
  }

  async chat(req: ChatRequest): Promise<ModelTurn> {
    const behaviour = this.behaviours[req.skill];
    if (!behaviour) throw new Error(`the simulated model has no behaviour for ${req.skill}`);
    const first = req.messages[0];
    const input = first?.role === "user" ? (JSON.parse(first.content.replace(/^Input:\n/, "")) as Record<string, unknown>) : {};
    const step = behaviour({ input, results: results(req.messages), turn: req.messages.filter((m) => m.role === "assistant").length + 1, faults: new Set(this.faults) });
    const id = `call_${req.messages.length}`;
    const usage = { inputTokens: 0, outputTokens: 0 };
    if ("text" in step) return { text: step.text, toolCalls: [], usage };
    const call: ToolCall = "submit" in step ? { id, name: "submit_result", input: step.submit } : { id, name: step.call, input: step.input };
    return { text: "", toolCalls: [call], usage };
  }
}

function results(messages: Message[]): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const calls = new Map<string, ToolCall>();
  for (const m of messages) {
    if (m.role === "assistant") for (const c of m.toolCalls) calls.set(c.id, c);
    if (m.role === "tool")
      for (const r of m.results) {
        const c = calls.get(r.id);
        if (!c || r.isError) continue;
        const key = c.name === "run_script" ? String(c.input.script) : c.name;
        try {
          out.set(key, JSON.parse(r.content));
        } catch {
          out.set(key, r.content);
        }
      }
  }
  return out;
}
