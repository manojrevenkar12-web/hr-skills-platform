import "reflect-metadata";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { INestApplication } from "@nestjs/common";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RunsWorker } from "../src/runs/runs.worker.js";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("API (PostgreSQL)", () => {
  let app: INestApplication;
  let worker: RunsWorker;
  let base: string;
  const tokens: Record<string, string> = {};
  const as = (who: string) => ({ authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    const pool = new pg.Pool({ connectionString: url });
    await pool.query("DROP SCHEMA IF EXISTS app CASCADE; DROP SCHEMA IF EXISTS hr CASCADE;");
    await pool.end();
    Object.assign(process.env, { DATABASE_URL: url, DEMO_LOGIN: "1", RUN_WORKER: "0", LOG_QUIET: "1" });
    const { createApp } = await import("../src/main.js");
    app = (await createApp()).app;
    await app.listen(0);
    base = await app.getUrl();
    worker = app.get(RunsWorker);
    for (const [who, email] of Object.entries({ clara: "clara@nordwerk.example", farid: "farid@nordwerk.example", lena: "lena@nordwerk.example", ines: "ines@nordwerk.example" })) {
      const r = await request(base).post("/api/session/demo").send({ email });
      tokens[who] = r.body.token;
    }
  }, 60000);

  afterAll(async () => {
    await app?.close();
  });

  it("answers health checks without a session, and nothing else", async () => {
    expect((await request(base).get("/health")).body).toMatchObject({ status: "ok", skills: 3 });
    expect((await request(base).get("/api/skills")).status).toBe(401);
    expect((await request(base).get("/api/skills").set({ authorization: "Bearer nope" })).status).toBe(401);
  });

  it("lists the skills with what the caller's role may run", async () => {
    const r = await request(base).get("/api/skills").set(as("lena"));
    const can = Object.fromEntries(r.body.skills.map((s: { name: string; canRun: boolean }) => [s.name, s.canRun]));
    expect(can).toEqual({ "job-levelling": true, "merit-cycle-check": false, "pay-gap-report": false });
  });

  it("queues a run, executes it in the worker, and shows it only to its owner", async () => {
    const q = await request(base).post("/api/runs").set(as("farid")).send({ skill: "pay-gap-report", input: { entity: "nordwerk-de", year: 2026 } });
    expect(q.status).toBe(202);
    expect(q.body.status).toBe("queued");
    await worker.drain();
    const done = await request(base).get(`/api/runs/${q.body.id}`).set(as("farid"));
    expect(done.body).toMatchObject({ status: "ok", model: "simulated-1" });
    expect(done.body.output.findings.map((f: { category: string }) => f.category)).toContain("operations/L3");
    expect((await request(base).get(`/api/runs/${q.body.id}`).set(as("clara"))).status).toBe(404);
  });

  it("refuses a run the role may not do, and audits the refusal", async () => {
    const r = await request(base).post("/api/runs").set(as("ines")).send({ skill: "merit-cycle-check", input: { entity: "nordwerk-de", cycle: "2026" } });
    expect(r.status).toBe(403);
    const audit = await request(base).get("/api/audit").set(as("farid"));
    expect(audit.body.events.some((e: { action: string; ok: boolean }) => e.action === "run.refused" && !e.ok)).toBe(true);
  });

  it("takes pilot feedback, but never with personal data in it", async () => {
    const q = await request(base).post("/api/runs").set(as("clara")).send({ skill: "merit-cycle-check", input: { entity: "nordwerk-de", cycle: "2026", orgUnit: "DE-OPS-2" } });
    await worker.drain();
    const bad = await request(base).post(`/api/runs/${q.body.id}/feedback`).set(as("clara")).send({ rating: "partly", comment: "E-00412 should get more, ask anna.schulz@nordwerk.de" });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/e-mail address outside .example, employee id/);
    const ok = await request(base).post(`/api/runs/${q.body.id}/feedback`).set(as("clara")).send({ rating: "useful", minutesSaved: 45, issues: ["unclear"], comment: "Notes were clear enough to send." });
    expect(ok.body.feedback).toEqual({ rating: "useful", minutesSaved: 45, issues: ["unclear"], comment: "Notes were clear enough to send." });
    const cand = await request(base).post(`/api/runs/${q.body.id}/case-candidate`).set(as("clara")).send({ expectedStatus: "ok", note: "Equity gap in an operations unit must be found" });
    expect(cand.body.yaml).toContain("orgUnit: DE-OPS-2");
  });

  it("summarises the pilot for the people who steer it", async () => {
    expect((await request(base).get("/api/pilot/summary").set(as("lena"))).status).toBe(403);
    const s = await request(base).get("/api/pilot/summary").set(as("ines"));
    const merit = s.body.skills.find((x: { skill: string }) => x.skill === "merit-cycle-check");
    expect(merit).toMatchObject({ runs: 1, useful: 1, minutesSaved: 45, issues: [{ issue: "unclear", n: 1 }] });
  });

  it("serves the HR MCP server over HTTP with the caller's role", async () => {
    const client = new Client({ name: "test", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: as("lena") } }));
    const tools = (await client.listTools()).tools.map((t) => t.name);
    expect(tools).toContain("skill_job_levelling_extract_signals");
    expect(tools).not.toContain("skill_pay_gap_report_compute_indicators");
    await client.close();
  });

  it("keeps the audit trail append-only", async () => {
    const pool = new pg.Pool({ connectionString: url });
    await expect(pool.query("UPDATE app.audit SET action = 'x'")).rejects.toThrow(/append-only/);
    await pool.end();
  });

  it("puts a run lost by a crashed worker back in the queue", async () => {
    const q = await request(base).post("/api/runs").set(as("lena")).send({ skill: "job-levelling", input: { jobTitle: "Dispatcher", jobDescription: "You plan daily routes for drivers at one depot and handle routine changes independently. 2 years of experience in dispatch." } });
    const pool = new pg.Pool({ connectionString: url });
    await pool.query("UPDATE app.runs SET status = 'running', started_at = now() - interval '1 hour', attempts = 1 WHERE id = $1", [q.body.id]);
    await pool.end();
    await worker.drain();
    expect((await request(base).get(`/api/runs/${q.body.id}`).set(as("lena"))).body.status).toBe("ok");
  });
});
