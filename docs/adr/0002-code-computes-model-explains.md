# 0002: Code computes, the model explains, checks guard

## Status

Accepted, October 2026.

## Context

HR and compensation outputs are full of numbers that people act on: pay gaps, budgets, guideline
ranges. A model that recomputes, rounds or "improves" a figure creates a wrong number with a
confident sentence around it. Checking the model's arithmetic after the fact is not enough:
copying is already a chance to change a number.

## Decision

- Every figure is computed by a skill script. The contract marks the output fields that come
  from a script with `x-from: <script>.<path>`. The harness leaves them out of the model's
  `submit_result` schema and copies them from the script result itself. A result whose script
  never ran is held.
- The model writes prose. Validators then check it:
  - `grounded_numbers`: every number in the prose appears in a tool result, the input, or the
    skill's short list of allowed constants;
  - `covers_findings` and `no_invented_findings`: findings referenced by id;
  - `quotes_in_input`: evidence quoted exactly;
  - `known_levels`;
  - `aggregate_policy`;
  - `schema`.
- A failed check holds the result. The console says which check failed, and a held result
  cannot be mistaken for a usable one.

## Consequences

- A whole class of errors cannot happen: transcription, rounding, and figures from "memory".
- Validators are deterministic and cheap, so they run on every run, not on a sample.
- Known gap: a recommendation that reuses an allowed number passes the number check, for example
  proposing the top of the guideline range as "fair". The skill's boundaries and human review
  cover it. A phrase blocklist would be easy to write and easy to evade.
