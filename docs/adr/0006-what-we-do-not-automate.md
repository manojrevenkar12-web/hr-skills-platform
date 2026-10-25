# 0006: What we do not automate

## Status

Accepted, October 2026.

## Context

The client asked for ideas across HR and compensation. Some are worth automating. Some are not,
or not yet. The law also draws lines:

- AI used for decisions on promotion, termination, task allocation or performance monitoring is
  high-risk under the AI Act (Annex III, point 4). Those obligations apply from 2 December 2027
  after Omnibus Regulation (EU) 2026/1744.
- Emotion recognition in the workplace is prohibited already.
- In Germany the works council co-determines technical systems that can monitor employees.

## Decision

| Request | Answer | Why |
|---|---|---|
| Compute pay gap indicators | **Yes, in code** | Deterministic; the model only explains |
| Check merit proposals against the guideline | **Yes, in code**, with the model drafting notes | The rules are written down; managers still decide |
| Propose a job level from a description | **Yes, advisory**, with mandatory review when unsure | Reading text is what models are good at; levels affect pay, so a person confirms |
| Write performance ratings or reviews | **No** | High-risk use, and it erodes the manager's responsibility; offer writing help for the manager's own draft instead |
| Recommend individual raises or bonuses | **No** | A decision on terms of employment; the guideline already gives the range |
| Predict attrition for named employees | **Not now** | Monitoring of individuals: needs a works council agreement and a DPIA first; aggregate trends are possible |
| Answer employees' pay questions (Art. 7 right to information) | **Later, as a script** | The answer is a lookup over the categories, not a generation task |

## Consequences

- Each skill's Boundaries section states these limits, and review rejects skills that cross
  them (docs/SKILL_STANDARD.md).
- Saying no is part of the proposal (docs/PROPOSAL.md), not a surprise in delivery.
