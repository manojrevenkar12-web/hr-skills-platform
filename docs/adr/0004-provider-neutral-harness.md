# 0004: Build the harness; adopt the standards

## Status

Accepted, October 2026.

## Context

Agent harnesses come in two kinds:

- frameworks: LangGraph, vendor agent SDKs;
- products: Claude Code, Copilot.

The engagement needs four things:

1. skills that run in Claude Code for people who use it;
2. the same skills behind an API for people who do not;
3. a choice of model per client, because data residency and contracts differ;
4. evaluation that runs offline in CI.

## Decision

- **Adopt** the standards: Agent Skills for the skill format, MCP for tools and data, and the
  Anthropic and OpenAI-compatible chat APIs for models. They are where the ecosystem is
  converging, and they keep the client free to change vendors.
- **Build** a small harness, about 250 lines (`packages/harness/src/run.ts`). It does five
  things:
  - loads a skill's instructions;
  - offers the model the skill's scripts, references and declared MCP tools;
  - copies `x-from` figures;
  - runs the validators;
  - records a trace.

  Owning it is cheaper than bending a framework to these guarantees, and its behaviour is
  fully tested.
- **Adopt, later**: an evaluation tool such as promptfoo or LangSmith, once there is a team
  outside engineering that needs its interface. Golden cases are plain YAML, so they can be
  exported.

## Consequences

- One model client per provider (`providers/`). Adding Azure OpenAI or a self-hosted vLLM model
  means configuration, not code.
- The simulated provider makes CI free and deterministic. It proves the checks, not a model's
  quality (see the README limits).
