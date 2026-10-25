import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clara, lena, meritRun, skill } from "../../test/fixtures";
import { fakeApi, renderApp } from "../../test/render";

describe("running a skill", () => {
  it("builds the form from the skill's inputs, requires what is required, and starts the run", async () => {
    const run = meritRun({ status: "queued", output: null });
    const calls = fakeApi({
      "GET /api/session": [200, { user: clara }],
      "GET /api/skills": [200, { model: "simulated-1", skills: [skill()] }],
      "GET /api/runs": [200, { runs: [] }],
      "POST /api/runs": [202, run],
      [`GET /api/runs/${run.id}`]: [200, run],
    });
    renderApp("/");
    expect(await screen.findByText(/runs the simulated model/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Merit cycle (required)"));
    await userEvent.click(screen.getByRole("button", { name: "Run skill" }));
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /api/runs")).toBe(false);
    await userEvent.type(screen.getByLabelText("Merit cycle (required)"), "2026");
    await userEvent.type(screen.getByLabelText(/Org unit/), "DE-OPS-2");
    await userEvent.click(screen.getByRole("button", { name: "Run skill" }));
    expect(calls.find((c) => c.key === "POST /api/runs")?.body).toEqual({ skill: "merit-cycle-check", input: { entity: "nordwerk-de", cycle: "2026", orgUnit: "DE-OPS-2" } });
    expect(await screen.findByText("Waiting for a worker.")).toBeInTheDocument();
  });

  it("tells a role with no skills what to do, and lists past runs when there are none", async () => {
    fakeApi({
      "GET /api/session": [200, { user: lena }],
      "GET /api/skills": [200, { model: "claude-sonnet-5-5", skills: [skill({ canRun: false })] }],
      "GET /api/runs": [200, { runs: [] }],
    });
    renderApp("/");
    expect(await screen.findByText("No skills for your role yet")).toBeInTheDocument();
    expect(await screen.findByText("No runs yet")).toBeInTheDocument();
  });

  it("offers a retry when the catalogue cannot load", async () => {
    let fail = true;
    fakeApi({
      "GET /api/session": [200, { user: clara }],
      "GET /api/skills": () => (fail ? [503, { message: "database unreachable" }] : [200, { model: "simulated-1", skills: [skill()] }]),
      "GET /api/runs": [200, { runs: [] }],
    });
    renderApp("/");
    expect(await screen.findByText("database unreachable")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: /Merit cycle check/ })).toBeInTheDocument();
  });
});
