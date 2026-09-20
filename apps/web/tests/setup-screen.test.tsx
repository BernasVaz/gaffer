import { DEFAULT_SETUP, parseSetup } from "@gaffer/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { SetupScreen } from "../src/setup/SetupScreen";

/** Point the address bar somewhere, the way a shared link would. */
const visit = (search: string) => window.history.replaceState(null, "", search || "/");

afterEach(() => visit("/"));

describe("the setup screen", () => {
  it("offers both modes, both sides and all three opponents", async () => {
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    for (const label of ["Solo", "Hotseat", "Home", "Away", "Casual", "Pro", "Elite"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it("says out loud that home kicks off", () => {
    // ADR 0007 puts the kickoff at about 62% of matches. A game built on visible
    // odds should not hide its largest one behind a side-picker.
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);
    expect(screen.getByRole("button", { name: /Home/ })).toHaveTextContent(/Kicks off/i);
  });

  it("hides the opponent controls in hotseat — there is no opponent", async () => {
    const user = userEvent.setup();
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    expect(screen.getByRole("button", { name: /Pro/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Hotseat/ }));

    expect(screen.queryByRole("button", { name: /Pro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Casual/ })).not.toBeInTheDocument();
  });

  it("hands back exactly what was chosen", async () => {
    const user = userEvent.setup();
    let chosen = null as unknown;
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={(setup) => (chosen = setup)} />);

    await user.click(screen.getByRole("button", { name: /Away/ }));
    await user.click(screen.getByRole("button", { name: /Elite/ }));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(chosen).toEqual({ mode: "solo", side: "away", difficulty: "elite", seed: 1 });
  });

  it("starts from whatever the link said", () => {
    render(
      <SetupScreen
        initial={{ mode: "solo", side: "away", difficulty: "casual", seed: 4242 }}
        onStart={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /Away/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Casual/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Match seed")).toHaveValue(4242);
  });

  it("shuffles to a seed the engine will accept", async () => {
    const user = userEvent.setup();
    render(<SetupScreen initial={DEFAULT_SETUP} onStart={() => {}} />);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await user.click(screen.getByRole("button", { name: /Shuffle/ }));
      const seed = Number((screen.getByLabelText("Match seed") as HTMLInputElement).value);
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("which screen you land on", () => {
  it("asks how you want to play when you just turn up", () => {
    visit("/");
    render(<App />);

    expect(screen.getByRole("button", { name: /Kick off/ })).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("starts the match straight away when a link named one", () => {
    // The whole point of sharing a link is that it is a match, not a form.
    visit("?seed=99&mode=hotseat");
    render(<App />);

    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kick off/ })).not.toBeInTheDocument();
  });

  it("puts the match in the address bar, so the link is always what is on screen", async () => {
    const user = userEvent.setup();
    visit("/");
    render(<App />);

    await user.click(screen.getByRole("button", { name: /Away/ }));
    await user.click(screen.getByRole("button", { name: /Kick off/ }));

    expect(parseSetup(window.location.search)).toEqual({
      mode: "solo",
      side: "away",
      difficulty: "pro",
      seed: 1,
    });
  });

  it("comes back to the setup screen on New match", async () => {
    const user = userEvent.setup();
    visit("?seed=3&mode=hotseat");
    render(<App />);

    await user.click(screen.getByRole("button", { name: /New match/ }));
    expect(screen.getByRole("button", { name: /Kick off/ })).toBeInTheDocument();
  });

  it("plays a mangled link rather than showing nothing", () => {
    visit("?seed=banana&mode=chess");
    render(<App />);

    // A link is typed, pasted and truncated. It should still be a match.
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });
});
