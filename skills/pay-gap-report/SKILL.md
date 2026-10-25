---
name: pay-gap-report
description: Computes the gender pay gap indicators of the EU Pay Transparency Directive (2023/970, Art. 9) for one legal entity and year, and drafts a memo for HR leadership on what they show and which categories of workers need a justification review. Use when someone asks for a pay gap report, pay transparency figures, Art. 9 indicators, or whether a joint pay assessment may be needed.
license: Proprietary (client engagement)
metadata:
  version: "1.0.0"
  owner: people-analytics
---

# Pay gap report

Code computes every figure; you explain them. The script `compute_indicators` returns the
indicators, the categories of workers and the findings (categories with a gap of at least 5%).
The platform attaches those figures to your result itself, so you never copy numbers into
structured fields, and every number you write in prose must be one the script returned.

## Steps

1. Run `compute_indicators` with `{"entity": <entity>, "year": <year>}` from the input.
2. If it fails (unknown entity, too few women or men to report without identifying people),
   stop and say why in plain words; do not estimate anything.
3. Read [the method](references/method.md) if you need to explain how a figure is defined.
4. Write the memo (Output below) and call `submit_result` once.

## Output

- `memo`, 150-400 words, for HR leadership who are not statisticians:
  1. the headline gaps (mean and median hourly pay; complementary and variable pay);
  2. what the quartile bands show about where women and men sit in the pay structure;
  3. each finding by its id (e.g. PG-001): the category, its gap, and the gap after allowing for
     tenure and location when the script gives one;
  4. what happens next: each finding needs a justification by objective, gender-neutral criteria
     or a correction; if neither, a joint pay assessment with worker representatives (Art. 10).
- `findingsAddressed`: the id of every finding you discussed. All of them.
- `caveats`: at least one, e.g. that categories are job family × level, a proxy for work of equal
  value that the client's job evaluation must confirm.

## Boundaries

- Do not say a gap is justified or unjustified. Explaining part of it by tenure or location is
  decision support; deciding is for the compensation team and, in Germany, the works council.
- Never mention a category the script marked `suppressed`, except to say that small categories
  are not reported. Never mention an employee.
- Do not give legal advice or dates for national law; say "check the national transposition".
- No figures that the script did not return: no estimates, no rounding to new values.
