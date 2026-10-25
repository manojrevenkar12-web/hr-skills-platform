import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { session } from "../../shared/api/client";
import { clara, skill } from "../../test/fixtures";
import { fakeApi, renderApp } from "../../test/render";

describe("sign-in", () => {
  it("signs in as a demo person and lands on the run page", async () => {
    fakeApi({
      "GET /api/session/demo-users": [200, { users: [clara] }],
      "POST /api/session/demo": [201, { token: "abc", user: clara }],
      "GET /api/session": [200, { user: clara }],
      "GET /api/skills": [200, { model: "simulated-1", skills: [skill()] }],
      "GET /api/runs": [200, { runs: [] }],
    });
    renderApp("/", null);
    await userEvent.click(await screen.findByRole("button", { name: /Clara Becker/ }));
    expect(await screen.findByRole("heading", { name: "Run a skill" })).toBeInTheDocument();
    expect(session.get()).toBe("abc");
  });

  it("explains a deployment without demo people", async () => {
    fakeApi({ "GET /api/session/demo-users": [200, { users: [] }] });
    renderApp("/sign-in", null);
    expect(await screen.findByText("No demo people")).toBeInTheDocument();
  });
});
