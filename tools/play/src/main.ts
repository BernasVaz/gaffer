/**
 * Watch a match play out, or run a few hundred and look at the aggregate.
 *
 * A development tool, never shipped. It exists so a design change can be *seen*
 * rather than inferred from test names — how often shots happen, what the odds
 * look like when they do, whether matches reach penalties, and above all how
 * many goals a match actually produces.
 *
 * ```bash
 * pnpm play                                    # one match, seed 1, narrated
 * pnpm play -- --seed 42                       # a different match
 * pnpm play -- --matches 200                   # balance run: 200 matches, aggregate only
 * pnpm play -- --format 11v11 --matches 50     # the same, at another game type
 * pnpm play -- --matches 200 --home casual     # a mismatch, to check the levels are real
 * pnpm play -- --seed 42 --keeper-def 5        # the same match with stronger keepers
 * pnpm play -- --seed 42 --quiet               # result only
 * ```
 *
 * Both sides are played by `@gaffer/ai`, which is the same opponent the client
 * uses — so what this measures is what a player will meet, not a straw man.
 *
 * `--keeper-def` overrides the keepers' DEF **for this run only**. It edits the
 * state the engine is handed, never the locked role table in `@gaffer/shared`,
 * so it is a way to eyeball a tuning question without pre-empting the answer.
 *
 * @packageDocumentation
 */

import process from "node:process";

import { chooseCommand } from "@gaffer/ai";
import { applyAction, createInitialState, createRng, legalActions } from "@gaffer/engine";
import {
  DEFAULT_FORMAT,
  DIFFICULTIES,
  FORMATS,
  parseSeed,
  ROLE_PROFILES,
  totalTurns,
  type DecisionMethod,
  type Difficulty,
  type Duel,
  type MatchFormat,
  type MatchCommand,
  type MatchState,
  type Player,
  type Position,
  type Team,
} from "@gaffer/shared";

// ---------------------------------------------------------------- arguments

const ARGV = process.argv.slice(2);

/** Read `--name value` or `--name=value` from the command line. */
function rawArg(name: string): string | undefined {
  const index = ARGV.findIndex((entry) => entry === `--${name}` || entry.startsWith(`--${name}=`));
  if (index === -1) return undefined;
  return ARGV[index]!.includes("=") ? ARGV[index]!.split("=")[1] : ARGV[index + 1];
}

function numberArg(name: string, fallback: number): number {
  const value = Number(rawArg(name));
  return Number.isFinite(value) ? value : fallback;
}

function difficultyArg(name: string, fallback: Difficulty): Difficulty {
  const raw = rawArg(name);
  return DIFFICULTIES.includes(raw as Difficulty) ? (raw as Difficulty) : fallback;
}

function formatArg(): MatchFormat {
  const raw = rawArg("format");
  return FORMATS.includes(raw as MatchFormat) ? (raw as MatchFormat) : DEFAULT_FORMAT;
}

const FORMAT = formatArg();
const SEED = numberArg("seed", 1);
const MATCHES = Math.max(1, Math.trunc(numberArg("matches", 1)));
const KEEPER_DEF = numberArg("keeper-def", ROLE_PROFILES.goalkeeper.stats.def);
const ACTIONS = numberArg("actions", 0);
const SHOT_RANGE = numberArg("shot-range", 0);
/* 1 is the floor the schema allows, and it is below every keeper's PAS — so
   `--launch-range 1` is how you play a match with the verb switched off. */
const LAUNCH_RANGE = numberArg("launch-range", 0);
const TURN_CAP = numberArg("turn-cap", 0);
const EXTRA_TIME = numberArg("extra-time", 0);
const QUIET = process.argv.includes("--quiet") || MATCHES > 1;
const KICKOFF: Team = rawArg("kickoff") === "away" ? "away" : "home";
const LEVELS: Record<Team, Difficulty> = {
  home: difficultyArg("home", "pro"),
  away: difficultyArg("away", "pro"),
};

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
    case "launch":
      return `${who} LAUNCH   -> ${command.target}`;
    case "tackle":
      return `${who} tackle   -> ${command.target}`;
    case "shoot":
      return `${who} SHOOT`;
  }
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

/** What one match produced, for the aggregate to add up. */
interface MatchReport {
  /** The finished board. */
  state: MatchState;
  /** Shot commands sent, both sides. */
  shots: number;
  /** Goals scored, both sides. */
  goals: number;
  /** Contested actions resolved. */
  duels: number;
  /** Commands sent before the match ended. */
  commands: number;
  /** Launches attempted, both sides. */
  launches: number;
  /** Launches an opponent read and took. */
  launchesLost: number;
  /** Launches that went down a lane nobody was covering. */
  launchesClear: number;
  /** Launches that were on offer at a moment a side chose something else. */
  launchesDeclined: number;
}

/** Play one match to its result, narrating unless asked not to. */
function playMatch(seed: number): MatchReport {
  const rng = createRng(parseSeed(seed));
  /*
   * The rule overrides go through the engine rather than being patched onto the
   * state afterwards: `createInitialState` validates the result, so an
   * impossible set — an odd turn cap, which hands one side an extra go — is
   * refused here rather than quietly measured for the rest of the session.
   */
  let state = withKeeperDef(
    createInitialState({
      format: FORMAT,
      kickingOff: KICKOFF,
      rules: {
        ...(ACTIONS > 0 ? { actionsPerTurn: ACTIONS } : {}),
        ...(SHOT_RANGE > 0 ? { shotRange: SHOT_RANGE } : {}),
        ...(LAUNCH_RANGE > 0 ? { launchRange: LAUNCH_RANGE } : {}),
        ...(TURN_CAP > 0 ? { turnCap: TURN_CAP } : {}),
        ...(EXTRA_TIME > 0 ? { extraTimeTurns: EXTRA_TIME } : {}),
      },
    }),
    KEEPER_DEF,
  );

  const say = (line = "") => {
    if (!QUIET) console.log(line);
  };

  let shownTurn = -1;
  let shots = 0;
  let goals = 0;
  let duels = 0;
  let commands = 0;
  let launches = 0;
  let launchesLost = 0;
  let launchesClear = 0;
  let launchesDeclined = 0;

  while (!state.result && commands < 5000) {
    if (state.turn !== shownTurn) {
      shownTurn = state.turn;
      say(
        `── turn ${String(state.turn).padStart(2)}/${totalTurns(state.rules)}  ${state.activeTeam.padEnd(4)}` +
          `  score ${state.score.home}-${state.score.away}` +
          (state.turn > state.rules.turnCap ? "   [extra time]" : ""),
      );
      say(board(state));
    }

    const command = chooseCommand(state, { difficulty: LEVELS[state.activeTeam], variety: seed });

    /* Counted at the moment of choice, not afterwards: "how often was the long
       ball there and passed up" is a different question from "how often was it
       played", and only the first says whether the verb is worth its rules. */
    const offered = legalActions(state).some((action) => action.type === "launch");

    const result = applyAction(state, command, rng);
    commands += 1;

    if (!result.ok) {
      throw new Error(`engine refused a command the opponent believed legal: ${result.reason}`);
    }

    if (command.type === "shoot") shots += 1;
    if (result.duel) duels += 1;
    if (command.type === "launch") {
      launches += 1;
      if (result.duel === null) launchesClear += 1;
      else if (!result.duel.attackerWon) launchesLost += 1;
    } else if (offered) {
      launchesDeclined += 1;
    }

    const scored =
      result.state.score.home !== state.score.home || result.state.score.away !== state.score.away;
    if (scored) goals += 1;

    say(
      `   ${describeCommand(command)}` +
        (result.duel ? `   ${describeDuel(result.duel)}` : "") +
        (scored ? "   *** GOAL ***" : ""),
    );

    state = result.state;
  }

  if (!state.result) throw new Error("match did not finish — this should be impossible");
  return {
    state,
    shots,
    goals,
    duels,
    commands,
    launches,
    launchesLost,
    launchesClear,
    launchesDeclined,
  };
}

// --------------------------------------------------------------- the reports

/** Narrate the end of a single match. */
function reportOne(report: MatchReport): void {
  const { state, shots, duels } = report;
  const result = state.result!;

  if (!QUIET) console.log();
  console.log(`FINAL  ${state.score.home}-${state.score.away}  ·  ${result.winner} win`);
  console.log(`decided by ${result.decidedBy} after ${state.turn} turns`);

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

const pct = (part: number, whole: number) =>
  `${whole === 0 ? "0.0" : ((part / whole) * 100).toFixed(1)}%`;

/**
 * The balance run: the numbers GDD §13 is argued over.
 *
 * Goals per match is the headline. Everything else is there to explain it — a
 * low rate with plenty of shots is a conversion problem, a low rate with no
 * shots is a build-up problem, and they want different levers (ADR 0004).
 */
function reportMany(reports: MatchReport[]): void {
  const matches = reports.length;
  const goals = reports.reduce((total, r) => total + r.goals, 0);
  const shots = reports.reduce((total, r) => total + r.shots, 0);
  const duels = reports.reduce((total, r) => total + r.duels, 0);
  const turns = reports.reduce((total, r) => total + r.state.turn, 0);
  const commands = reports.reduce((total, r) => total + r.commands, 0);

  const decisions = new Map<DecisionMethod, number>();
  let homeWins = 0;
  let goalless = 0;
  const distribution = new Map<number, number>();

  for (const { state, goals: scored } of reports) {
    const result = state.result!;
    decisions.set(result.decidedBy, (decisions.get(result.decidedBy) ?? 0) + 1);
    if (result.winner === "home") homeWins += 1;
    if (scored === 0) goalless += 1;
    distribution.set(scored, (distribution.get(scored) ?? 0) + 1);
  }

  console.log(
    `\n${matches} matches · home ${LEVELS.home} v away ${LEVELS.away} · ${KICKOFF} kicks off\n`,
  );
  console.log(`goals per match      ${(goals / matches).toFixed(2)}`);
  console.log(`shots per match      ${(shots / matches).toFixed(2)}`);
  console.log(`shot conversion      ${pct(goals, shots)}`);
  console.log(`goalless matches     ${pct(goalless, matches)}`);
  console.log(`duels per match      ${(duels / matches).toFixed(2)}`);
  console.log(`actions per match    ${(commands / matches).toFixed(1)}`);
  const end = totalTurns(reports[0]!.state.rules);
  console.log(`turns per match      ${(turns / matches).toFixed(1)} of ${end}`);
  console.log(`home win rate        ${pct(homeWins, matches)}`);

  const launches = reports.reduce((total, r) => total + r.launches, 0);
  const lost = reports.reduce((total, r) => total + r.launchesLost, 0);
  const clear = reports.reduce((total, r) => total + r.launchesClear, 0);
  const declined = reports.reduce((total, r) => total + r.launchesDeclined, 0);

  console.log(`\nkeeper distribution`);
  console.log(`  launches per match ${(launches / matches).toFixed(2)}`);
  console.log(`  down a clear lane  ${pct(clear, launches)}`);
  console.log(`  intercepted        ${pct(lost, launches)}`);
  console.log(`  offered, declined  ${declined} moments`);

  console.log(`\ngoals in a match`);
  for (const count of [...distribution.keys()].sort((a, b) => a - b)) {
    const many = distribution.get(count)!;
    console.log(
      `  ${String(count).padStart(2)}  ${pct(many, matches).padStart(6)}  ${"#".repeat(Math.round((many / matches) * 40))}`,
    );
  }

  console.log(`\ndecided by`);
  for (const [method, count] of [...decisions].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${method.padEnd(22)} ${pct(count, matches).padStart(6)}  (${count})`);
  }
  console.log();
}

function main(): void {
  if (MATCHES === 1) {
    console.log(`\nGaffer — match playthrough`);
    console.log(
      `seed ${SEED} · ${FORMAT} · ${LEVELS.home} v ${LEVELS.away} · keeper DEF ${KEEPER_DEF}` +
        `${KEEPER_DEF === ROLE_PROFILES.goalkeeper.stats.def ? "" : "  (overridden for this run)"}\n`,
    );
    reportOne(playMatch(SEED));
    return;
  }

  console.log(`\nGaffer — balance run`);
  console.log(
    `seeds ${SEED}..${SEED + MATCHES - 1} · ${FORMAT} · keeper DEF ${KEEPER_DEF}` +
      `${KEEPER_DEF === ROLE_PROFILES.goalkeeper.stats.def ? "" : "  (overridden for this run)"}`,
  );

  const started = performance.now();
  const reports = Array.from({ length: MATCHES }, (_unused, index) => playMatch(SEED + index));
  const elapsed = performance.now() - started;

  reportMany(reports);
  console.log(`${(elapsed / MATCHES).toFixed(0)} ms per match\n`);
}

main();
