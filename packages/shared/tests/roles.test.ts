import { describe, expect, it } from "vitest";

import { ROLE_PROFILES, ROLES, RoleSchema, StatsSchema } from "../src/index.js";

describe("ROLES", () => {
  it("is the five v1 roles, defence to attack", () => {
    expect(ROLES).toEqual(["goalkeeper", "defender", "midfielder", "winger", "striker"]);
  });

  it("agrees with RoleSchema", () => {
    for (const role of ROLES) {
      expect(RoleSchema.safeParse(role).success).toBe(true);
    }
    expect(RoleSchema.safeParse("sweeper").success).toBe(false);
  });
});

describe("ROLE_PROFILES", () => {
  /*
   * The GDD §6 table, transcribed. If a balance change edits the table, this test
   * is the thing that says so out loud — the numbers are a contract the engine's
   * duel maths depends on, not incidental data.
   */
  it.each([
    { role: "goalkeeper", atk: 1, def: 4, pas: 2, moveRange: 1 },
    { role: "defender", atk: 2, def: 4, pas: 3, moveRange: 2 },
    { role: "midfielder", atk: 3, def: 3, pas: 4, moveRange: 3 },
    { role: "winger", atk: 4, def: 2, pas: 3, moveRange: 3 },
    { role: "striker", atk: 5, def: 1, pas: 2, moveRange: 2 },
  ] as const)("$role matches the GDD §6 line", ({ role, atk, def, pas, moveRange }) => {
    expect(ROLE_PROFILES[role]).toEqual({
      role,
      stats: { atk, def, pas },
      moveRange,
    });
  });

  it("covers every role exactly once", () => {
    expect(Object.keys(ROLE_PROFILES).sort()).toEqual([...ROLES].sort());
  });

  it("holds only stats in the legal 1–5 band", () => {
    for (const role of ROLES) {
      expect(StatsSchema.safeParse(ROLE_PROFILES[role].stats).success).toBe(true);
    }
  });

  it("keeps the striker the best attacker outright", () => {
    const best = (key: "atk" | "def") =>
      [...ROLES].sort((a, b) => ROLE_PROFILES[b].stats[key] - ROLE_PROFILES[a].stats[key])[0];
    expect(best("atk")).toBe("striker");
  });

  it("ties the keeper with the defender at the back", () => {
    // Since keeper DEF dropped to 4 the goalkeeper is no longer the outright
    // best defender: it is level with the Defender. That is the point — the best
    // striker now beats it two times in three from a clean position.
    const best = Math.max(...ROLES.map((role) => ROLE_PROFILES[role].stats.def));
    expect(ROLE_PROFILES.goalkeeper.stats.def).toBe(best);
    expect(ROLE_PROFILES.defender.stats.def).toBe(best);
  });
});
