import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  COVERING_DEFENDER_BONUS,
  DUEL_DIE_SIDES,
  FORMATS,
  FORMAT_PROFILES,
  LAUNCH_INTERCEPT_BONUS,
  ROLE_PROFILES,
  RULES_VERSION,
  SHOOTOUT_KICKS,
  SHOOTOUT_SUDDEN_DEATH_ROUNDS,
  SHOOT_COVERING_BONUS,
  THROUGH_COVERING_BONUS,
} from "@gaffer/shared";

/**
 * The GDD says what the numbers are; this says it is still telling the truth.
 *
 * `docs/GDD.md` is the source of truth for the rules and the engine is built
 * against it — which works right up until a number moves in one and not the
 * other. That has happened: the locked-values table claimed a 3-kick shootout
 * for a week after the code had five, and claimed it two rows above a line
 * saying five, so it disagreed with the engine *and with itself*.
 *
 * Nothing here checks prose, and it should not: a document that could only say
 * what a test can check would be a worse document. It checks the handful of
 * **numbers** that are meant to be identical in both places, which is exactly
 * the part a reader is entitled to trust without opening the source.
 *
 * When this fails, decide which is wrong. Usually the document — but not
 * always, and that is the point of asking rather than syncing.
 *
 * Lives in `apps/web` rather than beside the values it checks because
 * `@gaffer/shared` may not touch Node built-ins — it is imported by the engine,
 * and reading a file from there would weaken a boundary to place a test. This
 * package already reads files in its tests and imports `@gaffer/shared`, so it
 * can compare the two without either of them learning about the other.
 */
/*
 * Resolved from the working directory rather than `import.meta.url`: Vite
 * rewrites that, and what comes back is not a file URL.
 */
const GDD_PATH = ["../../docs/GDD.md", "docs/GDD.md"]
  .map((candidate) => resolve(process.cwd(), candidate))
  .find((candidate) => existsSync(candidate));

if (GDD_PATH === undefined) throw new Error("cannot find docs/GDD.md from " + process.cwd());

const GDD = readFileSync(GDD_PATH, "utf8");

/**
 * The rows of one table, found by a phrase in its header.
 *
 * Scoped to a table rather than searched across the whole document, because
 * several parameters appear in two of them — "Turn cap" is a row in the
 * per-format table *and* in the locked-values table, and a search that took the
 * first hit silently checked the wrong one.
 */
const tableAfter = (header: string): string[] => {
  const lines = GDD.split("\n");
  const start = lines.findIndex((line) => line.includes(header));
  expect(start, `the GDD has no table headed "${header}"`).toBeGreaterThan(-1);

  const rows: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith("|")) break;
    rows.push(line);
  }
  return rows;
};

const LOCKED = tableAfter("| Parameter ");
const PER_FORMAT = tableAfter("| Scales with the pitch ");

/** One row of a table, by the parameter it names. */
const from = (rows: readonly string[], parameter: string): string => {
  const found = rows.find((line) => line.slice(1).trim().startsWith(parameter));
  expect(found, `no row for "${parameter}"`).toBeDefined();
  return found ?? "";
};

const row = (parameter: string): string => from(LOCKED, parameter);

describe("the GDD's numbers are the engine's numbers", () => {
  it("names the right die", () => {
    expect(DUEL_DIE_SIDES).toBe(4);
    expect(row("Duel die")).toContain(`d${DUEL_DIE_SIDES}`);
    /* And nowhere claims the old one in the present tense. */
    expect(GDD).not.toMatch(/opposed \*\*d3\*\*/);
  });

  it("names the right covering modifiers", () => {
    const covering = row("Covering-defender modifier");
    expect(covering).toContain(`+${COVERING_DEFENDER_BONUS} DEF`);
    expect(covering).toContain(`+${SHOOT_COVERING_BONUS} on a shot`);
    expect(row("LAUNCH_INTERCEPT_BONUS")).toContain(`+${LAUNCH_INTERCEPT_BONUS}`);
    expect(row("THROUGH_COVERING_BONUS")).toContain(`+${THROUGH_COVERING_BONUS}`);
  });

  it("names the right shootout", () => {
    expect(row("Shootout ")).toContain(`**${SHOOTOUT_KICKS}** kicks`);
    expect(row("Shootout sudden-death cap")).toContain(String(SHOOTOUT_SUDDEN_DEATH_ROUNDS));
  });

  it("names the right rules edition", () => {
    expect(row("Rules edition")).toContain(`**${RULES_VERSION}**`);
  });

  it("names the right keeper", () => {
    expect(row("Keeper DEF")).toContain(`**${ROLE_PROFILES.goalkeeper.stats.def}**`);
  });

  it("names 5-a-side's numbers where it quotes them", () => {
    const fives = FORMAT_PROFILES["5v5"].rules;
    expect(row("Turn cap")).toContain(`**${fives.turnCap}**`);
    expect(row("Extra time")).toContain(`**${fives.extraTimeTurns}**`);
    expect(row("**SHOT_RANGE**")).toContain(`**${fives.shotRange}**`);
    expect(row("**launchRange**")).toContain(`**${fives.launchRange}**`);
    expect(row("Actions per turn")).toContain(`${fives.actionsPerTurn} at 5-a-side`);
  });

  it("has a per-format table that matches every format", () => {
    /* The table in §12, read as "| label | 5v5 | 7v7 | 11v11 |". */
    const cells = (label: string) =>
      from(PER_FORMAT, label)
        .split("|")
        .slice(2, 5)
        .map((cell) => Number(cell.replaceAll("*", "").trim()));

    const across = (pick: (format: (typeof FORMATS)[number]) => number) => FORMATS.map(pick);

    expect(cells("**Actions per turn**")).toEqual(
      across((f) => FORMAT_PROFILES[f].rules.actionsPerTurn),
    );
    expect(cells("Turn cap")).toEqual(across((f) => FORMAT_PROFILES[f].rules.turnCap));
    expect(cells("Extra time")).toEqual(across((f) => FORMAT_PROFILES[f].rules.extraTimeTurns));
    expect(cells("SHOT_RANGE")).toEqual(across((f) => FORMAT_PROFILES[f].rules.shotRange));
    expect(cells("launchRange")).toEqual(across((f) => FORMAT_PROFILES[f].rules.launchRange));
  });

  it("has a role table that matches every role", () => {
    for (const [role, profile] of Object.entries(ROLE_PROFILES)) {
      const line = GDD.split("\n").find(
        (text) => text.startsWith("|") && text.toLowerCase().includes(`| ${role}`),
      );
      expect(line, `the GDD has no row for the ${role}`).toBeDefined();

      const numbers = (line ?? "")
        .split("|")
        .map((cell) => cell.replaceAll("*", "").trim())
        .filter((cell) => /^\d+$/.test(cell))
        .map(Number);

      expect(numbers.slice(0, 4), `the ${role}'s ATK/DEF/PAS/move in the GDD`).toEqual([
        profile.stats.atk,
        profile.stats.def,
        profile.stats.pas,
        profile.moveRange,
      ]);
    }
  });
});
