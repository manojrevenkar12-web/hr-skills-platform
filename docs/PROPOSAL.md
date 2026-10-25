# Proposal: an AI skills capability for HR and compensation

*An example of the proposal this platform would sit behind, written for a fictional client
(Nordwerk Mobility). Effort and impact figures are planning assumptions to be confirmed in
discovery, not results.*

## What we heard

- The Pay Transparency Directive will require gender pay gap reporting, by June 2027 in member
  states that have transposed it. Today the compensation team assembles the figures by hand from
  three systems.
- Merit cycles take the compensation partners about two weeks of checking spreadsheets against
  the guideline before sign-off.
- Recruiters level new roles by asking compensation partners, which takes days and is
  inconsistent.
- IT wants one governed way to use AI models, not one per team. The works council wants to know
  what data the AI sees.

## What we propose

A small AI capability built as **skills**: reviewed, versioned and measured units of
instructions, code and reference data. They are served to people through a workbench, and to AI
assistants such as Claude Code through one governed MCP server.

| Phase | Weeks | Scope | Team |
|---|---:|---|---|
| 1. Foundation and first skills | 8 | Skill standard and review rules; MCP server over the HR data with the data rules agreed with the DPO and works council; evaluation layer; the pay gap report and the merit cycle check; workbench | Architect + 2 lead engineers |
| 2. Pilot | 6 | 10-15 users from compensation and HR business partnering; weekly releases from pilot feedback; job levelling measured with the chosen model on a blind set before it is offered | Same team, 50% of one engineer on pilot support |
| 3. Scale | from week 15 | Handover of the skill standard to the client's engineers; new skills by the client team with our review; integration with the HR suite's API | Architect 50%, one engineer |

Effort: about 40 person-weeks for phases 1 and 2.

## How we will know it works

| Outcome | Measure | Target to confirm in discovery |
|---|---|---|
| Correct figures | Blind held-out sets: indicators and findings match hand calculations | 100% before release |
| Time saved | Minutes saved per run as reported by pilot users, compared with a timed baseline of the manual process | Pay gap report from days to hours; merit checking time halved |
| Adoption | People using a skill each week; share of runs rated useful | Most pilot users weekly by week 4; most runs useful as they are |
| Reliability | Share of runs that pass their checks; p95 duration | No held result reaches anyone unflagged |

## What we will not do

- No model decides pay, ratings, promotions or terminations (see docs/adr/0006). Skills advise;
  people decide.
- No individual-level pay goes to a model for aggregate reporting. No pay figure is shown for a
  group of fewer than six women or six men.
- No attrition predictions for named people without a works council agreement and a DPIA.

## Decisions we need from you

1. The model provider and region (EU data residency), and whether prompts may be logged by them.
2. The definition of categories of workers (work of equal value) from your job evaluation.
3. Who signs off a skill release on your side: compensation lead, DPO.
4. Pilot users and a baseline measurement of today's process.

## Risks

- **Model quality on job levelling is unknown until measured.** The skill stays unreleased
  until its blind set says otherwise.
- **National transposition may change details of the indicators.** Thresholds live in the
  skills' `assets/` and are a patch release to change.
- **Adoption depends on trust.** Every result shows which figures code computed and which checks
  passed, and the pilot is designed around feedback.
