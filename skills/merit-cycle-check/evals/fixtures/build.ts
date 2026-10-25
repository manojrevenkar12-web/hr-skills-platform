// Builds the golden-case datasets: `node skills/merit-cycle-check/evals/fixtures/build.ts`.
// Each case's expected findings follow from the guideline by hand (see golden.yaml).
import { writeFileSync } from "node:fs";

import { cycle, repeat, type Proposal } from "../../scripts/testkit.ts";

// rating 3 at compa 0.95 → guideline 2.5-3.5%
const ok: Proposal = { rating: 3, compa: 0.95, pct: 3 };
const sets: Record<string, Proposal[]> = {
  "all-within": repeat(6, ok),
  "above-no-reason": [...repeat(5, ok), { ...ok, pct: 4.2 }],
  "above-with-reason": [...repeat(5, ok), { ...ok, pct: 4.2, reason: "Took over the night-shift depot." }],
  "rating-one": [...repeat(5, ok), { rating: 1, compa: 1.0, pct: 1.5 }],
  "band-max": [...repeat(6, ok), { rating: 5, compa: 1.18, pct: 3.5 }],
  "over-budget": repeat(5, { rating: 5, compa: 0.85, pct: 7 }),
  "equity-gap": [...repeat(4, { ...ok, gender: "F", pct: 2.5 }), ...repeat(4, { ...ok, gender: "M", pct: 3.5 })],
  "below-guideline": [...repeat(5, ok), { ...ok, pct: 1 }],
  "two-units": [...repeat(4, { ...ok, orgUnit: "DE-OPS-1" }), ...repeat(3, { ...ok, orgUnit: "DE-OPS-2" }), { ...ok, orgUnit: "DE-OPS-2", pct: 6 }],
};
for (const [name, rows] of Object.entries(sets)) writeFileSync(new URL(`./${name}.json`, import.meta.url), `${JSON.stringify(cycle(rows), null, 1)}\n`);
console.log(`wrote ${Object.keys(sets).length} fixtures`);
