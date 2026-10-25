# 0001: Skills are the unit of reuse and of release

## Status

Accepted, October 2026.

## Context

The client wants an AI capability, not a set of chatbots. Work arrives as requests like "check
this merit cycle" or "what level is this role". Each request needs:

- instructions;
- deterministic code;
- reference data;
- tests.

All of these change together. Teams also use more than one AI client: Claude Code, IDE
assistants and the platform's own runs.

## Decision

- A skill is a folder in the open Agent Skills format: `SKILL.md`, `scripts/`, `references/`,
  `assets/`. Any client that reads the format can load it, and Claude Code loads it through the
  plugin in this repository.
- We add a `contract.yaml` that the spec leaves out: inputs, output, data classification,
  audience, scripts, validators, acceptance thresholds. The contract is what other code depends
  on. So it is what versioning protects (`compat.ts`) and what the harness enforces at run time.
- A skill is released as a whole, pinned by a hash of its runtime files (everything but
  `evals/`).

## Consequences

- One review and one release process for every skill, whatever it does.
- Authors write a contract as well as a prompt. That is deliberate: the contract is where data
  handling is decided.
- What the spec does not cover (classification, audience) lives in our contract, not in
  frontmatter extensions that other clients would ignore or reject.
