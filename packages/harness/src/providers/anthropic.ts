import { ProviderError, type ChatRequest, type Message, type ModelTurn, type Provider } from "./types.js";

/** Claude through the Messages API, with tool use. */
export class AnthropicProvider implements Provider {
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.anthropic.com",
    private readonly maxTokens = 4096,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async chat(req: ChatRequest): Promise<ModelTurn> {
    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: req.system,
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema })),
      messages: req.messages.map(toAnthropic),
    };
    const res = await this.fetchFn(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new ProviderError(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status === 429 || res.status >= 500);
    const json = (await res.json()) as {
      content: ({ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> })[];
      usage: { input_tokens: number; output_tokens: number };
    };
    return {
      text: json.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join(""),
      toolCalls: json.content.filter((c) => c.type === "tool_use").map((c) => {
        const u = c as { id: string; name: string; input: Record<string, unknown> };
        return { id: u.id, name: u.name, input: u.input };
      }),
      usage: { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens },
    };
  }
}

function toAnthropic(m: Message) {
  if (m.role === "user") return { role: "user", content: m.content };
  if (m.role === "assistant")
    return {
      role: "assistant",
      content: [...(m.text ? [{ type: "text", text: m.text }] : []), ...m.toolCalls.map((t) => ({ type: "tool_use", id: t.id, name: t.name, input: t.input }))],
    };
  return { role: "user", content: m.results.map((r) => ({ type: "tool_result", tool_use_id: r.id, content: r.content, is_error: r.isError })) };
}
