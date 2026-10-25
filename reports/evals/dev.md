# Evaluation: dev

Set `golden`, recorded 2026-10-25T14:57:43.714Z at 6f7d8d4.

| Skill | Version | Model | Cases passed | Injected faults caught | Metrics |
|---|---|---|---:|---:|---|
| job-levelling | 1.0.0 | simulated-1 | 16/16 | 75/75 | level_exact 73.3%, level_within_one 100.0%, family_exact 100.0%, review_rate 0.0% |
| merit-cycle-check | 1.0.0 | simulated-1 | 13/13 | 39/39 |  |
| pay-gap-report | 1.0.0 | simulated-1 | 13/13 | 48/48 |  |

### job-levelling: faults by kind

| Fault | Caught |
|---|---:|
| invented_quote | 15/15 |
| unknown_level | 15/15 |
| low_confidence_no_review | 15/15 |
| invent_number | 15/15 |
| skip_script | 15/15 |

### merit-cycle-check: faults by kind

| Fault | Caught |
|---|---:|
| skip_script | 11/11 |
| drop_finding | 7/7 |
| invent_number | 7/7 |
| invented_finding | 7/7 |
| propose_new_pct | 7/7 |

### pay-gap-report: faults by kind

| Fault | Caught |
|---|---:|
| invent_number | 10/10 |
| skip_script | 10/10 |
| drop_finding | 5/5 |
| leak_employee | 10/10 |
| invented_finding | 10/10 |
| suppressed_figure | 3/3 |
