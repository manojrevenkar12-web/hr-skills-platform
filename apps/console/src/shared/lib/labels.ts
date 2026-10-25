import type { Role, RunStatus } from "../api/types";

/** Plain names for codes the API sends, in one place. */
export const roleName: Record<Role, string> = {
  comp_partner: "Compensation partner",
  hr_business_partner: "HR business partner",
  hr_leadership: "HR leadership",
  people_analytics: "People analytics",
  recruiter: "Recruiter",
};

export const statusName: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  ok: "Passed checks",
  held: "Held by checks",
  failed: "Failed",
  refused: "Refused",
};

export const skillTitle: Record<string, string> = {
  "pay-gap-report": "Pay gap report",
  "merit-cycle-check": "Merit cycle check",
  "job-levelling": "Job levelling",
};
export const titleOf = (skill: string) => skillTitle[skill] ?? skill;

/** What each validator guarantees, said for the people reading a result. */
export const validatorName: Record<string, string> = {
  schema: "Result has the agreed shape",
  grounded_numbers: "Every number in the text comes from the data",
  aggregate_policy: "No individual or small-group pay shown",
  covers_findings: "Every blocking finding is addressed",
  no_invented_findings: "No finding was made up",
  quotes_in_input: "Evidence is quoted from the input",
  known_levels: "Levels and families exist",
};

export const issueName: Record<string, string> = {
  wrong_numbers: "Wrong numbers",
  missed_something: "Missed something",
  unclear: "Hard to understand",
  wrong_level: "Wrong level",
  too_slow: "Too slow",
  not_needed: "Didn't need it",
  other: "Other",
};

export const fieldLabel: Record<string, string> = {
  entity: "Legal entity",
  year: "Reporting year",
  cycle: "Merit cycle",
  orgUnit: "Org unit (optional)",
  jobTitle: "Job title",
  jobDescription: "Job description",
  familyHint: "Job family (optional)",
};
