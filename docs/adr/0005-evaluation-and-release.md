# 0005: Evaluation and release

## Status

Accepted, October 2026.

## Context

Non-deterministic systems pass the tests their authors write. The levelling skill shows it: its
heuristic baseline scored 73% exact on its author's golden cases and 28% on a blind set. A
release process must measure on data the author did not tune on, and must not let anyone
quietly re-run a measurement until it looks better.

## Decision

Every skill passes four layers before release:

1. **Golden cases**: expectations worked out by hand from the policy. All must pass
   (`acceptance.golden_pass_rate`).
2. **Injected faults**: the skill's simulated model makes each named mistake on every case it
   applies to. Every one must be held (`fault_catch_rate`). A fault that changes nothing in a
   case is skipped, because it tests nothing.
3. **Blind held-out set**: written by someone who has not seen the code, from the reference
   documents only (`evals/WRITING_HELDOUT.md`).
   - Its first run is recorded once. The report refuses to be rewritten, and CI checks the
     history.
   - Whoever studies its failures marks it a regression set, and a new blind set is written.
4. **Release**: `hsp release` runs lint, the release check, the golden cases and the faults,
   and the gate. The gate covers the skill's thresholds and no regression against its last
   release. It then appends to `registry/`.

Pilot feedback closes the loop. A run that taught something is proposed as a case candidate,
reviewed in a pull request, and becomes a golden case.

## Consequences

- A skill can be "green" and still not released. job-levelling is the example: its blind
  first run must be repeated with a real model.
- The records are append-only, so the history of what was measured and released can be shown
  to the client's auditors.
