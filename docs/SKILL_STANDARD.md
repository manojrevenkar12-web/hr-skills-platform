# What a well-formed skill is

A skill is a folder in `skills/` that any Agent Skills client can load and that this platform
can test, version and release. `npm run hsp -- lint` checks every rule marked with an id. An
**error** blocks the merge; a **warning** is for the reviewer.

## Shape

```
skills/<name>/
  SKILL.md          instructions: frontmatter + Steps, Output, Boundaries
  contract.yaml     what the skill takes, returns, touches and may use (packages/skill-kit/src/contract.ts)
  CHANGELOG.md      one entry per version
  scripts/          deterministic code, each with a test next to it
  references/       documents the model reads on demand
  assets/           thresholds and other data the scripts read
  evals/            golden.yaml, fixtures, simulated.ts (the offline model), heldout/<set>/
```

## The rules

| Rule | What it requires | Why |
|---|---|---|
| S01 | `name` is 1-64 lowercase letters, digits and single hyphens, equal to the folder name | Agent Skills spec; clients find skills by name |
| S02 | `description` is 1-1024 characters and says **when** to use the skill ("Use when ...") | It is the only text a client reads before deciding to load the skill |
| S03 | The body is under 500 lines and about 5,000 tokens; detail goes to `references/` | Progressive disclosure: the body is loaded on every use |
| S04 | The body has `## Steps`, `## Output` and `## Boundaries`; every link resolves, one level deep | Structured instructions are reviewable; boundaries are where safety lives |
| S05 | One version: `contract.yaml` and `metadata.version` agree; no frontmatter fields outside the spec | The version is what callers and the registry depend on |
| S06 | Every script in the contract exists, exports its function, has a test, and is named in the body | A script the model does not know about is dead code; an untested one is a liability |
| S07 | At least 8 golden cases, unique ids, each with an input and an expectation | No skill without acceptance criteria |
| S08 | Every skill validates its schema; aggregate skills use `aggregate_policy`; individual-pay skills go only to compensation and HR business partners; prose outputs use `grounded_numbers` | Data handling is decided by classification, not by each author |
| S09 | `CHANGELOG.md` has an entry for the current version | Reviewers and users see what changed |
| S10 | Only platform tools in `contract.tools` | Every tool goes through the MCP server, its roles and its audit |
| S11 | No e-mail addresses (outside `.example`), IBANs, phone or tax numbers in any file | Skills ship invented data only |
| S12 | No API keys or credentials in any file | Secrets live in the deployment, never in a skill |

## What gets rejected in review (beyond the linter)

- Arithmetic in a prompt. If a result has a number, a script computes it and the contract marks
  the field `x-from`, so the platform copies it.
- A model deciding something about a person: pay, rating, promotion, termination. Skills advise
  and people decide (ADR 0006).
- Scripts that return more than the audience may see. An aggregate script must never return a
  row per person, even if a later step summarises it.
- Golden cases that copy the skill's output as the expectation. Expectations are worked out by
  hand, from the policy.
- A new tool added to the MCP server for one skill, when a script in the skill would do.
  Shared infrastructure is for what at least two skills need.

## Versions and releases

- **Major**: a caller could break. A removed or renamed output field; an output field that may
  now be missing; a new value callers may receive; a new or newly required input; a narrower
  audience; a change of classification.
- **Minor**: a caller is unaffected. A new optional input, a new output field, a wider audience,
  a removed check.
- **Patch**: content changed but the contract did not.

A wider audience, a change of classification or a removed check also needs a data-protection
review (`hsp release ... --reviewed-by`). `hsp release` runs lint, the release check, the golden
cases and faults, and the gate. It then appends to `registry/<skill>.json` with the content hash,
the evaluation report and the approver. Nothing in `registry/` or in a recorded report is edited
by hand.
