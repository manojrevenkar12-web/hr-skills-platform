# Working on this repository

## Fast feedback

- `npm run build`: the packages, which the API and Node-run skill scripts need.
- `npx vitest run`: unit, MCP and harness tests. API tests run with `TEST_DATABASE_URL`.
- `npm run hsp -- lint`, `npm run hsp -- eval dev`, `npm run hsp -- gate dev`,
  `npm run hsp -- release-check`
- `cd apps/console && npx tsc --noEmit -p . && npx eslint src && npx vitest run --config vite.config.ts`

## Invariants

Each one has a test, a lint rule or a CI step.

- **Code computes, the model explains.** Figures come from scripts and are copied by the harness
  (`x-from`). Prose numbers must be grounded. Never ask a model to compute or copy a figure.
- **One data boundary.** Models and clients reach HR data only through `packages/hr-mcp`. Script
  tools are gated by the skill's audience. Aggregate results pass the aggregate policy (no ids,
  no pay for groups under six women or six men).
- **Skills advise, people decide.** No skill decides pay, ratings, promotions or terminations
  (docs/adr/0006).
- **The review standard is code** (`docs/SKILL_STANDARD.md`). Change the rule and the doc
  together.
- **Releases only through `hsp release`.** `registry/` and every `reports/evals/release-*` and
  `heldout-*` file are append-only. CI checks their history.
- **Held-out sets.** Never change a skill to pass `evals/heldout/<set>` before its first run is
  recorded. If you study a set's failures, write `regression` into its `STATUS`, and have
  someone who has not seen the code write a new set from `evals/WRITING_HELDOUT.md` only.
- **Settings live in files, not in code**: thresholds in `skills/*/assets`, policies in
  `data/reference`.
- **Invented data only.** E-mail domains end in `.example`. Lint S11 and S12 refuse personal
  data and secrets.
