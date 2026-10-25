import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { clara, meritRun, skill } from "../../test/fixtures";
import { fakeApi, renderApp } from "../../test/render";

const base = (run = meritRun()) => ({
  "GET /api/session": [200, { user: clara }] as [number, unknown],
  "GET /api/skills": [200, { model: "simulated-1", skills: [skill()] }] as [number, unknown],
  [`GET /api/runs/${run.id}`]: [200, run] as [number, unknown],
});

describe("a run", () => {
  it("shows the checks, what code computed and what the model wrote, as separate layers", async () => {
    fakeApi(base());
    renderApp(`/runs/${meritRun().id}`);
    const checks = await screen.findByRole("region", { name: "Checks" });
    expect(within(checks).getAllByRole("listitem")).toHaveLength(4);
    expect(within(checks).getByText(/Every number in the text comes from the data/)).toHaveTextContent("passed");
    const computed = screen.getByRole("region", { name: /Computed by code/ });
    expect(within(computed).getByText("MC-001")).toBeInTheDocument();
    expect(within(computed).getByText(/1 proposals to confirm/)).toBeInTheDocument();
    const prose = screen.getByRole("region", { name: /Written by the model/ });
    // figures are marked as coming from the data; finding ids are not figures
    expect(within(prose).getByText("5.5%")).toHaveAttribute("title", "From the computed figures");
    expect(within(prose).queryByText("001")).not.toBeInTheDocument();
    expect(within(prose).getByText("3-4.5%")).toHaveAttribute("title", "From the computed figures");
  });

  it("says plainly when a result is held, and which check stopped it", async () => {
    const held = meritRun({ status: "held", findings: [{ validator: "grounded_numbers", message: "the number 2.75 in the text does not come from the data or the input" }] });
    fakeApi(base(held));
    renderApp(`/runs/${held.id}`);
    expect(await screen.findByRole("note")).toHaveTextContent("must not be used as it is");
    expect(screen.getByText(/2.75 in the text does not come from the data/)).toBeInTheDocument();
    expect(screen.getByText("5.5%")).toHaveAttribute("title", "Not confirmed by the checks");
  });

  it("shows why a run produced nothing", async () => {
    const failed = meritRun({ status: "failed", output: null, error: "no merit proposals for nordwerk-de in cycle 2027" });
    fakeApi(base(failed));
    renderApp(`/runs/${failed.id}`);
    expect(await screen.findByRole("alert")).toHaveTextContent("no merit proposals for nordwerk-de in cycle 2027");
  });

  it("sends feedback, and shows the server's refusal of personal data", async () => {
    const run = meritRun();
    const calls = fakeApi({
      ...base(run),
      [`POST /api/runs/${run.id}/feedback`]: (body) =>
        (body as { comment: string }).comment.includes("E-0") ? [400, { message: "Remove personal data before sending (employee id)" }] : [200, { ...run, feedback: body }],
    });
    renderApp(`/runs/${run.id}`);
    await userEvent.click(await screen.findByLabelText("Useful with changes"));
    await userEvent.type(screen.getByLabelText(/Comment for the platform team/), "E-00138 is wrong");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Remove personal data");
    await userEvent.clear(screen.getByLabelText(/Comment for the platform team/));
    await userEvent.type(screen.getByLabelText(/Minutes it saved you/), "30");
    await userEvent.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(calls.at(-1)?.body).toEqual({ rating: "partly", minutesSaved: 30, issues: [], comment: "" });
  });
});
