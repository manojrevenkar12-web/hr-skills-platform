/**
 * The harness speaks one small message format and translates it per provider, so a skill does not
 * care which model runs it (Anthropic, any OpenAI-compatible endpoint, or the simulated model the
 * tests and the evaluation use).
 */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; results: { id: string; content: string; isError: boolean }[] };

export interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface ChatRequest {
  system: string;
  messages: Message[];
  tools: ToolDef[];
  /** the skill being run: only the simulated model uses it, to pick its scripted behaviour */
  skill: string;
}

export interface Provider {
  readonly model: string;
  chat(req: ChatRequest): Promise<ModelTurn>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
