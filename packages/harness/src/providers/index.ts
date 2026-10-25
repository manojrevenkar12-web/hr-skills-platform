import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openai.js";
import type { Provider } from "./types.js";

export * from "./types.js";
export * from "./anthropic.js";
export * from "./openai.js";
export * from "./simulated.js";

/** A real model from the environment, or null when none is configured (the simulated model is used then). */
export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): Provider | null {
  if (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY)
    return new AnthropicProvider(env.AI_MODEL ?? "claude-sonnet-5-5", env.ANTHROPIC_API_KEY, env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com");
  if (env.AI_PROVIDER === "openai_compatible" && env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL)
    return new OpenAICompatibleProvider(env.AI_MODEL, env.AI_API_KEY, env.AI_BASE_URL);
  return null;
}
