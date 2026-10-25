// Screenshots of the workbench against a running demo deployment (DEMO_LOGIN=1, scripts/demo-activity.mjs).
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = new URL("../../../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function as(name, opts = {}) {
  const page = await browser.newPage({ viewport: { width: opts.width ?? 1380, height: opts.height ?? 900 }, colorScheme: opts.scheme ?? "light", reducedMotion: "reduce" });
  await page.goto(`${BASE}/sign-in`);
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  return page;
}
async function shot(page, name, full = true) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
  console.log(`wrote ${name}.png`);
}
async function run(page, skill, fill = async () => {}) {
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: new RegExp(skill) }).click();
  await fill(page);
  await page.getByRole("button", { name: "Run skill" }).click();
  await page.getByText(/Passed checks|Held by checks|Failed|Refused/).first().waitFor({ timeout: 20000 });
}

const signIn = await browser.newPage({ viewport: { width: 1380, height: 900 } });
await signIn.goto(`${BASE}/sign-in`);
await shot(signIn, "01-sign-in", false);

const clara = await as("Clara Becker");
await clara.getByRole("button", { name: /Merit cycle check/ }).click();
await shot(clara, "02-run-a-skill");
await run(clara, "Merit cycle check", async (p) => p.getByLabel("Org unit (optional)").fill("DE-OPS-2"));
await shot(clara, "03-merit-cycle-result");

const farid = await as("Farid Haddad");
await run(farid, "Pay gap report");
await shot(farid, "04-pay-gap-result");

const lena = await as("Lena Vogel");
await run(lena, "Job levelling", async (p) => {
  await p.getByLabel("Job title").fill("Maintenance Planner");
  await p.getByLabel("Job description").fill("You plan the maintenance programme for the vehicles of one depot independently, choose how the workshop schedules its work and decide within your area. You guide two apprentices informally. 4 years of experience in vehicle maintenance.");
});
await shot(lena, "05-job-levelling-result");

await farid.goto(`${BASE}/skills`);
await shot(farid, "06-skills-release-ladder");

const ines = await as("Ines Moreira");
await ines.goto(`${BASE}/pilot`);
await shot(ines, "07-pilot");

await farid.goto(`${BASE}/audit`);
await shot(farid, "08-audit-trail", false);

const phone = await as("Clara Becker", { width: 390, height: 844 });
await run(phone, "Merit cycle check", async (p) => p.getByLabel("Org unit (optional)").fill("DE-OPS-2"));
await shot(phone, "09-merit-result-phone");

const dark = await as("Farid Haddad", { scheme: "dark" });
await run(dark, "Pay gap report", async (p) => p.getByLabel("Legal entity").fill("nordwerk-pt"));
await shot(dark, "10-pay-gap-dark");

await browser.close();
