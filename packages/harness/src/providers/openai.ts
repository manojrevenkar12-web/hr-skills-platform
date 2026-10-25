import { ProviderError, type ChatRequest, type Message, type ModelTurn, type Provider } from "./types.js";

/** Any OpenAI-compatible chat-completions endpoint with function calling (OpenAI, Azure, vLLM, Ollama, a gateway). */
export class OpenAICompatibleProvider implements Provider {
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async chat(req: ChatRequest): Promise<ModelTurn> {
    const messages = [{ role: "system", content: req.system }, ...req.messages.flatMap(toOpenAI)];
    const res = await this.fetchFn(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages,
        tools: req.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
      }),
    });
    if (!res.ok) throw new ProviderError(`${this.baseUrl} ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status === 429 || res.status >= 500);
    const json = (await res.json()) as {
      choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const msg = json.choices[0]?.message;
    if (!msg) throw new ProviderError("no choices in the response", true);
    return {
      text: msg.content ?? "",
      toolCalls: (msg.tool_calls ?? []).map((t) => ({ id: t.id, name: t.function.name, input: safeJson(t.function.arguments) })),
      usage: { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 },
    };
  }
}

function toOpenAI(m: Message): Record<string, unknown>[] {
  if (m.role === "user") return [{ role: "user", content: m.content }];
  if (m.role === "assistant")
    return [{ role: "assistant", content: m.text || null, tool_calls: m.toolCalls.length ? m.toolCalls.map((t) => ({ id: t.id, type: "function", function: { name: t.name, arguments: JSON.stringify(t.input) } })) : undefined }];
  return m.results.map((r) => ({ role: "tool", tool_call_id: r.id, content: r.content }));
}

function safeJson(s: string): Record<string, unknown> {
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : { _raw: s };
  } catch {
    return { _raw: s };
  }
}
