import { z } from "zod";

/**
 * A skill's contract: what it takes, what it returns, what data it touches and what it may use.
 * It is the part of a skill other code depends on, so it is what versioning protects
 * (compat.ts) and what the harness enforces at run time.
 */
const JsonSchema: z.ZodType<Record<string, unknown>> = z.record(z.string(), z.unknown());

export const VALIDATORS = [
  "schema", // the output matches `output`
  "grounded_numbers", // every number in the output's prose is one a tool returned or the input contained
  "aggregate_policy", // no employee id, no pay for small groups (hr-data policy.ts)
  "covers_findings", // every blocking finding a script returned is mentioned by id in the output
  "no_invented_findings", // the output names no finding id the scripts did not return
  "quotes_in_input", // every evidence quote is found in the input text
  "known_levels", // levels and families exist in the job architecture
] as const;
export type ValidatorName = (typeof VALIDATORS)[number];

export const ROLES = ["comp_partner", "hr_business_partner", "hr_leadership", "people_analytics", "recruiter"] as const;
export type Role = (typeof ROLES)[number];

export const Contract = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "semantic version, e.g. 1.2.0"),
    owner: z.string().min(1),
    /** aggregate: only group figures leave the scripts; individual: pseudonymous per-employee findings */
    classification: z.enum(["aggregate", "individual"]),
    /** who may run the skill and read its output */
    audience: z.array(z.enum(ROLES)).min(1),
    inputs: JsonSchema,
    output: JsonSchema,
    scripts: z.record(z.string(), z.object({ file: z.string(), export: z.string(), description: z.string().min(10) })).default({}),
    /** platform tools the model may call besides the skill's scripts, e.g. mcp:job_architecture */
    tools: z.array(z.string()).default([]),
    validators: z.array(z.enum(VALIDATORS)).min(1),
    maxTurns: z.number().int().min(1).max(20).default(8),
    /** numbers prose may use without a tool having returned them (thresholds, article numbers) */
    allowedNumbers: z.array(z.number()).default([]),
    acceptance: z.object({
      golden_pass_rate: z.number().min(0).max(1),
      fault_catch_rate: z.number().min(0).max(1),
      /** optional metric thresholds, e.g. { level_exact: 0.8 } */
      metrics: z.record(z.string(), z.number()).default({}),
    }),
  })
  .strict();
export type Contract = z.infer<typeof Contract>;
