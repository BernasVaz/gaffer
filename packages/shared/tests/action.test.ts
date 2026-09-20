import { describe, expect, it } from "vitest";

import { ActionSchema, ACTION_TYPES, ActionTypeSchema } from "../src/index.js";

describe("ACTION_TYPES", () => {
  it("is the five verbs from GDD §7", () => {
    expect(ACTION_TYPES).toEqual(["move", "pass", "dribble", "tackle", "shoot"]);
  });

  it("agrees with ActionTypeSchema", () => {
    for (const type of ACTION_TYPES) {
      expect(ActionTypeSchema.safeParse(type).success).toBe(true);
    }
    expect(ActionTypeSchema.safeParse("header").success).toBe(false);
  });
});

describe("ActionSchema", () => {
  it("accepts a move at a cell", () => {
    const action = { type: "move", playerId: "home-winger-1", target: { x: 2, y: 3 } };
    expect(ActionSchema.safeParse(action).success).toBe(true);
  });

  it("accepts a dribble at a cell", () => {
    const action = { type: "dribble", playerId: "home-striker-1", target: { x: 4, y: 2 } };
    expect(ActionSchema.safeParse(action).success).toBe(true);
  });

  it("accepts a pass at a team-mate", () => {
    const action = { type: "pass", playerId: "home-striker-1", target: "home-winger-1" };
    expect(ActionSchema.safeParse(action).success).toBe(true);
  });

  it("accepts a tackle on the carrier", () => {
    const action = { type: "tackle", playerId: "away-defender-1", target: "home-striker-1" };
    expect(ActionSchema.safeParse(action).success).toBe(true);
  });

  it("accepts a shot, which has no target — v1 shots are not aimed", () => {
    expect(
      ActionSchema.safeParse({ type: "shoot", playerId: "home-striker-1", target: null }).success,
    ).toBe(true);
  });

  it("rejects a move whose target is a player rather than a cell", () => {
    const action = { type: "move", playerId: "home-winger-1", target: "home-striker-1" };
    expect(ActionSchema.safeParse(action).success).toBe(false);
  });

  it("rejects a pass whose target is a cell rather than a player", () => {
    const action = { type: "pass", playerId: "home-striker-1", target: { x: 1, y: 1 } };
    expect(ActionSchema.safeParse(action).success).toBe(false);
  });

  it("rejects an unknown action type", () => {
    const action = { type: "header", playerId: "home-striker-1", target: null };
    expect(ActionSchema.safeParse(action).success).toBe(false);
  });

  it("rejects an action with no player", () => {
    expect(ActionSchema.safeParse({ type: "shoot", target: null }).success).toBe(false);
  });
});
