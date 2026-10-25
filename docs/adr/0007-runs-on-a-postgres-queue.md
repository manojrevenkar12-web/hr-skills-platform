# 0007: Skill runs on a PostgreSQL queue

## Status

Accepted, October 2026.

## Context

A skill run takes from milliseconds (simulated model) to a minute (real model, several tool
calls). It must survive a restart. It must be visible to its owner only. It must be auditable.
The client's delivery stack is TypeScript, Node.js and NestJS.

## Decision

- The API is NestJS. Runs are rows in `app.runs`.
- A worker in each API instance claims rows with `FOR UPDATE SKIP LOCKED`, so any number of
  instances share the work. A run left `running` by a crashed instance is requeued after
  `STALE_RUN_MS`, at most three attempts in all.
- No Redis or broker. PostgreSQL is already required for the HR data, the audit and the
  feedback, and the volume (an HR team's requests) is far below what it handles.

## Consequences

- One stateful dependency to operate and back up.
- If volume grows by orders of magnitude, the worker loop can move to a dedicated queue without
  changing the run records or the API.
