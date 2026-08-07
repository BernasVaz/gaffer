/**
 * Watch a whole match play out.
 *
 * A development tool, never shipped. It exists so a design change can be *seen*
 * rather than inferred from test names — how often shots happen, what the odds
 * look like when they do, whether matches reach penalties.
 *
 * ```bash
 * pnpm play                                # seed 1, keeper DEF as designed
 * pnpm play -- --seed 42                   # a different match
 * pnpm play -- --seed 42 --keeper-def 4    # the same match with weaker keepers
 * pnpm play -- --seed 42 --quiet           # result only
 * ```
 *
 * `--keeper-def` overrides the keepers' DEF **for this run only**. It edits the
 * state the engine is handed, never the locked role table in `@gaffer/shared`,
 * so it is a way to eyeball a tuning question without pre-empting the answer.
 *
 * @packageDocumentation
 */

import process from "node:process";

import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  previewDuel,
} from "@gaffer/engine";
import {
  parseSeed,
  ROLE_PROFILES,
  TOTAL_TURNS,
  type Action,
  type Duel,
  type MatchCommand,
  type MatchState,
  type Player,
  type Position,
  type Team,
} from "@gaffer/shared";

// ---------------------------------------------------------------- arguments

/** Read `--name value` or `--name=value` from the command line. */
function numberArg(name: string, fallback: number): number {
  const argv = process.argv.slice(2);
  const index = argv.findIndex((entry) => entry === `--${name}` || entry.startsWith(`--${name}=`));
  if (index === -1) return fallback;

  const raw = argv[index]!.includes("=") ? argv[index]!.split("=")[1] : argv[index + 1];
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const SEED = numberArg("seed", 1);
const KEEPER_DEF = numberArg("keeper-def", ROLE_PROFILES.goalkeeper.stats.def);
const QUIET = process.argv.includes("--quiet");

// ------------------------------------------------------------------ display

const GLYPH: Record<Player["role"], string> = {
  goalkeeper: "G",
  defender: "D",
  midfielder: "M",
  winger: "W",
  striker: "S",
};

const cell = (position: Position) => `(${position.x},${position.y})`;

/** The pitch as text. Home is upper-case and attacks right; `*` has the ball. */
function board(state: MatchState): string {
  const occupied = new Map(state.players.map((p) => [`${p.position.x},${p.position.y}`, p]));
  const lines = [
    "        " + [...Array(state.board.width).keys()].map((x) => ` ${x}  `).join(""),
    "      +" + "----".repeat(state.board.width) + "+",
  ];

  for (let y = 0; y < state.board.height; y += 1) {
    let row = `   ${y}  |`;
    for (let x = 0; x < state.board.width; x += 1) {
      const player = occupied.get(`${x},${y}`);
      if (!player) {
        row += " .  ";
        continue;
      }
      const glyph = player.team === "home" ? GLYPH[player.role] : GLYPH[player.role].toLowerCase();
      row += ` ${glyph}${state.ball.carrierId === player.id ? "*" : " "} `;
    }
    lines.push(row + "|");
  }

  lines.push("      +" + "----".repeat(state.board.width) + "+");
  return lines.join("\n");
}

/** One line describing a duel: the odds shown, then what the dice actually did. */
function describeDuel(duel: Duel): string {
  const score = (side: Duel["attacker"]) =>
    side.modifier === 0 ? `${side.stat}` : `${side.stat}+${side.modifier}`;

  const odds = `${Math.round(duel.winChance * 100)}%`.padStart(4);
  const cover =
    duel.coveringPlayerIds.length > 0 ? ` (+${duel.coveringPlayerIds.length} cover)` : "";

  return (
    `${odds}  ${score(duel.attacker)} v ${score(duel.defender)}${cover}` +
    `  rolled ${duel.attackerRoll}-${duel.defenderRoll}  ${duel.attackerWon ? "WON " : "LOST"}`
  );
}

/** One line describing what a side did with an action. */
function describeCommand(command: MatchCommand): string {
  if (command.type === "endTurn") return `${command.team} ends the turn`;

  const who = command.playerId.padEnd(18);
  switch (command.type) {
    case "move":
    case "dribble":
      return `${who} ${command.type.padEnd(8)} -> ${cell(command.target)}`;
    case "pass":
      return `${who} pass     -> ${command.target}`;
    case "tackle":
      return `${who} tackle   -> ${command.target}`;
    case "shoot":
      return `${who} SHOOT`;
  }
}

// -------------------------------------------------------------- the solo bot

/** How far a cell is up the pitch for `team`, in cells from its own goal-line. */
const advanced = (team: Team, position: Position, width: number) =>
  team === "home" ? position.x : width - 1 - position.x;

/**
 * A deliberately small greedy chooser, allowed by GDD §14 as "a basic solo-test
 * opponent".
 *
 * Random play would almost never shoot, which would make this tool useless for
 * the question it exists to answer. This one shoots whenever a shot is worth
 * taking, and otherwise picks whichever action moves the ball furthest up the
 * pitch, discounted by the odds of actually pulling it off.
 *
 * It is not meant to be good. It is meant to produce a match with football in it.
 */
function chooseCommand(state: MatchState): MatchCommand {
  const options = legalActions(state);
  if (options.length === 0) return { type: "endTurn", team: state.activeTeam };

  const find = (id: string) => state.players.find((player) => player.id === id);
  const width = state.board.width;

  const value = (action: Action): number => {
    const actor = find(action.playerId);
    if (!actor) return -Infinity;

    const odds = previewDuel(state, action)?.winChance ?? 1;
    const from = advanced(actor.team, actor.position, width);
    const hasBall = state.ball.carrierId === actor.id;

    switch (action.type) {
      // Scaled by the odds rather than fixed, so a hopeless effort — a Defender
      // with ATK 2 against a keeper on DEF 5 is a literal 0% — ranks below doing
      // something useful. A shot worth taking still outranks everything else.
      case "shoot":
        return odds * 1000;
      case "tackle":
        return odds * 8;
      case "pass": {
        const receiver = find(action.target);
        if (!receiver) return -Infinity;
        return odds * (2 + (advanced(actor.team, receiver.position, width) - from) * 3);
      }
      case "move":
      case "dribble": {
        const gain = advanced(actor.team, action.target, width) - from;
        return odds * (gain * (hasBall ? 3 : 1) + (hasBall ? 2 : 0));
      }
    }
  };

  // Stable ordering first, so an equal-value tie always resolves the same way.
  const ranked = [...options].sort((a, b) => {
    const byValue = value(b) - value(a);
    if (byValue !== 0) return byValue;
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });

  return ranked[0]!;
}

// ----------------------------------------------------------------- the match

/** Apply the keeper-DEF override, which touches this run's state and nothing else. */
function withKeeperDef(state: MatchState, def: number): MatchState {
  if (def === ROLE_PROFILES.goalkeeper.stats.def) return state;
  return {
    ...state,
    players: state.players.map((player) =>
      player.role === "goalkeeper" ? { ...player, stats: { ...player.stats, def } } : player,
    ),
  };
}

function main(): void {
  const rng = createRng(parseSeed(SEED));
  let state = withKeeperDef(createInitialState(), KEEPER_DEF);

  const say = (line = "") => {
    if (!QUIET) console.log(line);
  };

  console.log(`\nGaffer — match playthrough`);
  console.log(
    `seed ${SEED} · keeper DEF ${KEEPER_DEF}${KEEPER_DEF === ROLE_PROFILES.goalkeeper.stats.def ? "" : "  (overridden for this run)"}\n`,
  );

  let shownTurn = -1;
  let shots = 0;
  let duels = 0;
  let guard = 0;

  while (!state.result && guard < 5000) {
    guard += 1;

    if (state.turn !== shownTurn) {
      shownTurn = state.turn;
      say(
        `── turn ${String(state.turn).padStart(2)}/${TOTAL_TURNS}  ${state.activeTeam.padEnd(4)}` +
          `  score ${state.score.home}-${state.score.away}` +
          (state.turn > 20 ? "   [extra time]" : ""),
      );
      say(board(state));
    }

    const command = chooseCommand(state);
    const result = applyAction(state, command, rng);

    if (!result.ok) {
      console.error(`engine refused its own legal command: ${result.reason}`);
      process.exitCode = 1;
      return;
    }

    if (command.type === "shoot") shots += 1;
    if (result.duel) duels += 1;

    const scored =
      result.state.score.home !== state.score.home || result.state.score.away !== state.score.away;

    say(
      `   ${describeCommand(command)}` +
        (result.duel ? `   ${describeDuel(result.duel)}` : "") +
        (scored ? "   *** GOAL ***" : ""),
    );

    state = result.state;
  }

  const { result } = state;
  if (!result) {
    console.error("match did not finish — this should be impossible");
    process.exitCode = 1;
    return;
  }

  say();
  console.log(`FINAL  ${state.score.home}-${state.score.away}  ·  ${result.winner} win`);
  console.log(`decided by ${result.decidedBy} after ${state.turn - 1} turns`);

  if (result.shootout) {
    const { home, away, kicks } = result.shootout;
    console.log(`penalties ${home}-${away} in ${kicks.length} kicks`);
    console.log(
      "   " +
        kicks
          .map((kick) => `${kick.team === "home" ? "H" : "A"}${kick.scored ? "o" : "x"}`)
          .join(" "),
    );
  }

  console.log(
    `\nshots ${state.stats.shotsAttempted.home}-${state.stats.shotsAttempted.away}` +
      ` · duels won ${state.stats.duelsWon.home}-${state.stats.duelsWon.away}` +
      ` · ${shots} shots and ${duels} duels seen\n`,
  );
}

main();
