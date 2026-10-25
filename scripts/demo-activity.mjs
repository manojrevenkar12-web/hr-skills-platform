// Fills a demo deployment with pilot activity through the public API (runs and feedback), then,
// with DATABASE_URL, spreads the runs over the last four weeks. Invented people and data only.
//   BASE_URL=http://localhost:3000 DATABASE_URL=postgres://... node scripts/demo-activity.mjs
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

async function call(path, { token, body, method } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
const signIn = async (email) => (await call("/api/session/demo", { body: { email } })).token;
const wait = async (token, id) => {
  for (;;) {
    const r = await call(`/api/runs/${id}`, { token });
    if (!["queued", "running"].includes(r.status)) return r;
    await new Promise((x) => setTimeout(x, 200));
  }
};

const JDS = [
  ["Dispatcher", "You plan daily routes for delivery drivers at one depot and handle routine changes during the shift independently; unusual cases go to the shift lead. 2 years of experience in dispatch."],
  ["Engineering Team Lead", "You lead a team of 6 engineers responsible for payments, set priorities for the area and coach others. 7 years of experience in software engineering."],
  ["Head of Fleet", "You manage the depot managers of all depots in the region and set the fleet strategy for the function. You are accountable for a budget of EUR 30 million. 12 years of experience in logistics."],
  ["Payroll Specialist", "You run the monthly payroll independently and own the payroll area including year-end processes. 5 years of experience in payroll."],
];
const plan = [
  ["clara@nordwerk.example", "merit-cycle-check", { entity: "nordwerk-de", cycle: "2026" }, { rating: "useful", minutesSaved: 90, issues: [] }],
  ["clara@nordwerk.example", "merit-cycle-check", { entity: "nordwerk-de", cycle: "2026", orgUnit: "DE-OPS-2" }, { rating: "useful", minutesSaved: 30, issues: ["unclear"] }],
  ["jonas@nordwerk.example", "merit-cycle-check", { entity: "nordwerk-de", cycle: "2026", orgUnit: "DE-ENG-1" }, { rating: "partly", minutesSaved: 15, issues: ["missed_something"] }],
  ["farid@nordwerk.example", "pay-gap-report", { entity: "nordwerk-de", year: 2026 }, { rating: "useful", minutesSaved: 240, issues: [] }],
  ["farid@nordwerk.example", "pay-gap-report", { entity: "nordwerk-pt", year: 2026 }, { rating: "useful", minutesSaved: 180, issues: [] }],
  ["ines@nordwerk.example", "pay-gap-report", { entity: "nordwerk-de", year: 2026 }, { rating: "partly", minutesSaved: 20, issues: ["unclear"] }],
  ...JDS.map(([t, d], i) => ["lena@nordwerk.example", "job-levelling", { jobTitle: t, jobDescription: d }, { rating: i === 1 ? "not_useful" : "useful", minutesSaved: i === 1 ? 0 : 20, issues: i === 1 ? ["wrong_level"] : [] }]),
  ["clara@nordwerk.example", "job-levelling", { jobTitle: JDS[3][0], jobDescription: JDS[3][1] }, null],
];

const ids = [];
for (const [email, skill, input, feedback] of plan) {
  const token = await signIn(email);
  const run = await call("/api/runs", { token, body: { skill, input } });
  const done = await wait(token, run.id);
  ids.push(done.id);
  if (feedback) await call(`/api/runs/${done.id}/feedback`, { token, body: { ...feedback, comment: "" } });
  console.log(`${skill} for ${email}: ${done.status}`);
}

if (process.env.DATABASE_URL) {
  const pg = require("pg");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  for (const [i, id] of ids.entries()) {
    const days = (i * 7) % 26;
    await pool.query("UPDATE app.runs SET created_at = created_at - make_interval(days => $2) WHERE id = $1", [id, days]);
    await pool.query("UPDATE app.feedback SET created_at = created_at - make_interval(days => $2) WHERE run_id = $1", [id, days]);
  }
  await pool.end();
  console.log("spread the runs over four weeks");
}
