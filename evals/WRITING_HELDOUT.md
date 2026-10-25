# Writing a held-out set

A held-out set measures a skill on cases its author never tuned it on. Whoever writes one must
**not** read the skills' `scripts/`, `evals/` (golden cases, simulated models, earlier held-out
sets), `SKILL.md` files or anything in `packages/`. Write from these documents only:

- `data/reference/job-architecture.yaml`, `data/reference/merit-policy-2026.yaml`,
  `data/reference/band-structure.yaml`
- `skills/job-levelling/references/levelling-guide.md`
- `skills/merit-cycle-check/references/policy.md`
- `skills/pay-gap-report/references/method.md` and `skills/pay-gap-report/assets/thresholds.json`
- this page

Everything is invented: no real companies, people or job adverts copied from anywhere.

Put a set in `skills/<skill>/evals/heldout/<set>/cases.yaml`. Its first run is recorded once
(`npm run hsp -- heldout <skill> <set>`) and never rewritten. Anyone who studies its failures
writes `regression` into `skills/<skill>/evals/heldout/<set>/STATUS`; a new set is then needed.

## job-levelling

Job descriptions as a company would write them for a new role: 3-8 sentences, varied quality
(some precise, some vague or inflated, some with a misleading title like "Senior" or "Head" on a
junior role), all five families and all six levels, a few in imperfect English. Level each by
hand with the job architecture and the levelling guide, as a careful compensation analyst would.
At least 40 cases.

```yaml
cases:
  - id: h-jl-001
    input: { jobTitle: "…", jobDescription: "…" }
    expect: { status: ok }
    truth: { family: operations, level: L3 }
```

`jobDescription` must be at least 50 characters. `family` is one of engineering, operations,
finance, people, sales; `level` is L1-L6.

## merit-cycle-check

Small merit cycles built from rows; each row is one employee's proposal:

```yaml
cases:
  - id: h-mc-001
    build:
      fn: scripts/testkit.ts#cycle
      rows:
        - { rating: 3, compa: 0.95, pct: 3.0 }                      # defaults below
        - { rating: 4, compa: 1.05, pct: 4.5, reason: "…", gender: F, orgUnit: DE-OPS-2 }
    input: { entity: test-co, cycle: "2026" }
    expect:
      status: ok
      same_set: { "findings[].code": [above_guideline] }          # every finding's code, any order
```

Row fields: `rating` (1-5), `compa` (base pay / band midpoint, e.g. 0.95), `pct` (proposed %
increase), and optionally `reason` (text), `gender` (F, M; default M), `orgUnit` (default
DE-OPS-1), `family` (default operations), `level` (default L3), `location` (default Berlin),
`fte` (default 1). Work out every finding the guideline produces, by hand, from the policy page
and the matrix: guideline range, reason rule, rating 1, band maximum (120% of midpoint), the
3.5% budget per org unit (cost and budget are weighted by each person's base pay), and the
equity comparison (within the same level and rating only, weighted by the smaller group of
each comparison, at least 4 in total weight, flagged at 1.0 point or more below). Codes:
above_guideline, below_guideline, rating_one_increase, above_band_max, budget_exceeded,
equity_gap. Use `same_set` for the codes, and `equals` with `"findings[].severity"` only when
the order is obvious. At least 15 cases, several with more than one finding, and some designed
to sit exactly on a boundary.

## pay-gap-report

Small companies built from rows; each row is one person:

```yaml
cases:
  - id: h-pg-001
    build:
      fn: scripts/testkit.ts#company
      rows:
        - { gender: F, hourly: 20 }
        - { gender: M, hourly: 25, family: finance, level: L2, extras: 1000, hours: 800 }
    input: { entity: test-co, year: 2026 }
    expect:
      status: ok
      equals: { indicators.meanGapPct: 20, findings.length: 1 }
```

Row fields: `gender` (F, M, X), `hourly` (base pay per hour), optionally `hours` (default 1000),
`extras` (annual complementary + variable pay, default 0), `family` (default operations),
`level` (default L3), `location`, `hireDate`. Compute the expected figures by hand from the
method page: mean and median gaps on total hourly pay ((base + extras) / hours), rounded to one
decimal; findings per category (family/level) at 5% or more either way; suppression below six
women or six men; a company with fewer than six women or six men in total fails
(`status: failed`). Paths: `indicators.meanGapPct`, `indicators.medianGapPct`,
`indicators.variableMeanGapPct`, `findings.length`, `"findings[].category"`,
`"categories[].suppressed"`. At least 12 cases.
