# 0003: One MCP server is the data boundary

## Status

Accepted, October 2026.

## Context

Compensation data is among the most sensitive data an employer holds:

- pay is personal data under GDPR;
- a pay gap figure for a group of three can identify someone;
- in Germany, technical systems that can monitor employees are subject to the works council's
  co-determination (BetrVG §87(1) no. 6).

Several clients will want this data: the platform's harness, Claude Code, IDE assistants and
future agents.

## Decision

- All access goes through one MCP server (`packages/hr-mcp`), whatever the client:
  - over stdio for local clients;
  - over Streamable HTTP for remote ones, authenticated as the API is;
  - in-process for the platform's own harness.
- The server is created per caller role. Each skill script becomes a tool only for the roles in
  that skill's audience. Reference tools (job architecture, bands, merit policy, headcount)
  return no individual pay.
- The results of aggregate skills pass the aggregate policy, or the server withholds them:
  - no employee id;
  - no pay figure for a group with fewer than six women or six men (the German expert
    commission's recommendation, November 2025).
- Every call is audited by tool, role, outcome and duration, never with its arguments or
  results.

## Consequences

- Data rules are enforced once, in code, for every client. A new client needs no new review of
  data handling, only of its role mapping.
- Scripts still read individual records to compute aggregates. What crosses the boundary to a
  model or a user is checked.
- The works council can be shown one place where the rules live, and one audit trail.
