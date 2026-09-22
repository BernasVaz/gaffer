import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/**
 * Play the kickoff, which is the only thing a match will let you do first.
 *
 * ADR 0018 made a kickoff a pass, so a test that wants to move somebody, or
 * wants the board a few actions in, has to get past it — and doing that
 * through the interface rather than by building a state keeps these tests
 * testing the thing a player would actually see.
 *
 * Prefers an uncontested pass where one is offered, so the board a test
 * continues from does not depend on a die.
 */
export async function takeKickoff(user: UserEvent): Promise<void> {
  const carrier = screen
    .getAllByRole("gridcell")
    .find((cell) => (cell.getAttribute("aria-label") ?? "").includes("with the ball"));

  if (!carrier) throw new Error("nobody has the ball");

  const select = carrier.querySelector("button");
  if (!select) throw new Error("the carrier is not selectable");
  await user.click(select);

  const passes = screen.getAllByRole("button", { name: /^Pass to / });
  if (passes.length === 0) throw new Error("a kickoff with no pass on it");

  const safe = passes.find((button) => !/chance/.test(button.getAttribute("aria-label") ?? ""));
  await user.click(safe ?? passes[0]!);
}

/** Select whoever currently has the ball, so a test can act with the carrier. */
export async function selectCarrier(user: UserEvent): Promise<void> {
  const cell = screen
    .getAllByRole("gridcell")
    .find((candidate) => (candidate.getAttribute("aria-label") ?? "").includes("with the ball"));

  if (!cell) throw new Error("nobody has the ball");

  const select = cell.querySelector("button");
  if (!select) throw new Error("the carrier is not selectable");
  await user.click(select);
}

/**
 * Open the match's overflow menu.
 *
 * Everything you reach for *between* turns lives behind one button now, so the
 * pitch can have the height those two rows of controls were costing it.
 */
export async function openMore(user: UserEvent): Promise<void> {
  await user.click(screen.getByRole("button", { name: "More" }));
}
