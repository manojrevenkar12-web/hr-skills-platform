// Builds the golden-case datasets: `node skills/pay-gap-report/evals/fixtures/build.ts`.
// Each is small enough that its expected figures can be checked by hand (see golden.yaml).
import { writeFileSync } from "node:fs";

import { company, many, type Person } from "../../scripts/testkit.ts";

const sets: Record<string, Person[]> = {
  "twenty-pct": [...many(6, { gender: "F", hourly: 20 }), ...many(6, { gender: "M", hourly: 25 })],
  "equal-pay": [...many(8, { gender: "F", hourly: 22 }), ...many(8, { gender: "M", hourly: 22 })],
  "small-category": [
    ...many(6, { gender: "F", hourly: 20 }), ...many(6, { gender: "M", hourly: 20 }),
    ...many(5, { gender: "F", hourly: 30, level: "L5" }), ...many(9, { gender: "M", hourly: 40, level: "L5" }),
  ],
  "just-below": [...many(6, { gender: "F", hourly: 95.1 }), ...many(6, { gender: "M", hourly: 100 })],
  "exactly-five": [...many(6, { gender: "F", hourly: 95 }), ...many(6, { gender: "M", hourly: 100 })],
  "women-higher": [...many(6, { gender: "F", hourly: 106 }), ...many(6, { gender: "M", hourly: 100 })],
  "variable-only": [...many(6, { gender: "F", hourly: 20 }), ...many(6, { gender: "M", hourly: 20, extras: 1000 })],
  "two-categories": [
    ...many(6, { gender: "F", hourly: 30, family: "finance", level: "L3" }), ...many(6, { gender: "M", hourly: 30, family: "finance", level: "L3" }),
    ...many(7, { gender: "F", hourly: 18, family: "operations", level: "L2" }), ...many(7, { gender: "M", hourly: 20, family: "operations", level: "L2" }),
  ],
  "too-few-women": [...many(3, { gender: "F", hourly: 20 }), ...many(9, { gender: "M", hourly: 20 })],
};

for (const [name, people] of Object.entries(sets)) {
  writeFileSync(new URL(`./${name}.json`, import.meta.url), `${JSON.stringify(company(people), null, 1)}\n`);
}
console.log(`wrote ${Object.keys(sets).length} fixtures`);
