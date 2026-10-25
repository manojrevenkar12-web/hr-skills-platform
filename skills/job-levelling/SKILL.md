---
name: job-levelling
description: Proposes the job family and level (L1-L6) of a job from its description, against the client's job architecture, citing the description's own words for each criterion and saying how sure it is. Use when a recruiter or compensation partner asks what level a new or changed role should be, or to check a role's level before a salary band is attached.
license: Proprietary (client engagement)
metadata:
  version: "1.0.0"
  owner: compensation
---

# Job levelling

Levels are decided by scope, autonomy, complexity and impact, not by title or years alone. The
script `extract_signals` finds the facts in the description (years asked for, people managed,
budget, scope and autonomy phrases) with their exact words. You weigh them against the job
architecture and propose a family and level. A compensation partner decides; you advise.

## Steps

In the platform's harness the script is `run_script` with `"script": "extract_signals"`; in Claude Code
and other MCP clients it is the `skill_job_levelling_extract_signals` tool of the `hr` MCP server, with the same
arguments under `args`.

1. Run `extract_signals` with `{"jobDescription": <the description>}`.
2. Call `job_architecture` for the families and the level definitions.
3. Read [the levelling guide](references/levelling-guide.md) for how to weigh conflicting
   signals and for worked examples.
4. Decide the family, the level and, if the evidence also fits a neighbouring level, that
   level as `alternativeLevel`. Then call `submit_result` once.

## Output

- `family` and `level` from the job architecture (`L1` to `L6`).
- `evidence`: 2-5 items `{ "criterion", "quote", "pointsTo" }`, where `quote` is copied exactly
  from the job description and `criterion` is scope, autonomy, complexity, impact or experience.
- `confidence`: `high` when scope, autonomy and impact point to the same level; `medium` when one
  of them is missing or one level apart; `low` when the description does not say enough.
- `needsReview`: true whenever confidence is low, the evidence spans more than one level, or the
  title suggests a level the content does not support.
- `rationale`: 40-150 words in plain language, using only numbers that appear in the description.

## Boundaries

- Level the job, never a person: ignore names, ages, gender words and anything about a current
  holder of the role.
- Titles and years are supporting evidence only. "Senior" in a title does not make a role L4.
- If the description is too thin to level, say so with `confidence: low` and `needsReview: true`
  rather than guessing.
- No salary figures: the band comes from the level, by a separate lookup.
