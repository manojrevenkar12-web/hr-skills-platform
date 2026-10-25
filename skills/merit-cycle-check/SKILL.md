---
name: merit-cycle-check
description: Checks the merit-increase proposals of a pay review cycle against the merit guideline, salary bands, budgets and a same-level, same-rating comparison of women's and men's proposals, and drafts one note per org unit telling its manager what to fix. Use when a compensation partner asks to review, check or sign off merit proposals or a salary review cycle.
license: Proprietary (client engagement)
metadata:
  version: "1.0.1"
  owner: compensation
---

# Merit cycle check

The script `check_proposals` applies the guideline and returns findings with ids (MC-001, ...)
and a summary per org unit. Your job is to turn the findings into clear notes for each manager.
The platform attaches the findings and the summary to your result; you write only the notes.

## Steps

In the platform's harness the script is `run_script` with `"script": "check_proposals"`; in Claude Code
and other MCP clients it is the `skill_merit_cycle_check_check_proposals` tool of the `hr` MCP server, with the same
arguments under `args`.

1. Run `check_proposals` with `{"entity": ..., "cycle": ...}` and, if the input names one,
   `"orgUnit"`.
2. If it fails, stop and say why; do not check anything by hand.
3. Read [the guideline](references/policy.md) when you need to explain a rule.
4. Write one note per org unit that has at least one blocking finding, then call
   `submit_result` once.

## Output

- `notes`: one item per org unit with blocking findings, `{ "orgUnit": ..., "note": ... }`.
  Each note, 60-250 words, addressed to the unit's manager:
  1. what must change before sign-off, finding by finding, by id (blocking first);
  2. for each, the rule and the guideline range from the finding, e.g. "MC-004: 5.2% is above
     the 3.0-4.0% range for rating 4; lower it or add a reason";
  3. warnings briefly at the end, as things to confirm.
- `findingsAddressed`: the id of every blocking finding you covered. All of them.

## Boundaries

- You do not decide anyone's increase. Say what the guideline allows; never propose a new
  percentage of your own, and never comment on an employee's performance.
- Refer to employees only by the pseudonymous id in the finding. No names, no guesses about who
  someone is.
- An equity finding is about the unit's pattern, not about one person: explain it as "compare
  the proposals for women and men at the same level and rating", never single anyone out.
- Use only numbers from the findings and the summary.
