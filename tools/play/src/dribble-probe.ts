/**
 * How much dribbling actually happens, and what it is worth.
 *
 * Run against a **built** engine — `tools/play` imports `@gaffer/engine`'s
 * emitted `dist`, so a source-only change measures nothing and comes back
 * looking exactly like the baseline. Treat "identical to baseline" as a
 * suspected no-op, not a pass.
 *
 * ```bash
 * pnpm --filter @gaffer/engine build
 * node tools/play/src/dribble-probe.ts 5v5 60
 * ```
 */
import { chooseCommand } from "@gaffer/ai";
import { applyAction, createInitialState, createRng } from "@gaffer/engine";
import { chebyshevDistance, parseSeed, type MatchFormat, type MatchState } from "@gaffer/shared";

const FORMAT = (process.argv[2] ?? "5v5") as MatchFormat;
const MATCHES = Number(process.argv[3] ?? 60);
const pct = (n: number, d: number) => (d === 0 ? "  n/a" : `${((n / d) * 100).toFixed(1)}%`);

let dribbles = 0,
  dribblesWon = 0,
  through = 0,
  throughWon = 0;
let goals = 0,
  shots = 0,
  actions = 0;
let progressedByDribble = 0,
  progressedByPass = 0;
const turnsEnded: number[] = [];

/** Whether a dribble goes through somebody — two cells on a ray, a body between. */
function isThrough(state: MatchState, playerId: string, target: { x: number; y: number }) {
  const actor = state.players.find((p) => p.id === playerId);
  if (!actor || chebyshevDistance(actor.position, target) !== 2) return false;

  const dx = Math.sign(target.x - actor.position.x);
  const dy = Math.sign(target.y - actor.position.y);
  if (actor.position.x + dx * 2 !== target.x || actor.position.y + dy * 2 !== target.y)
    return false;

  const between = { x: actor.position.x + dx, y: actor.position.y + dy };
  return state.players.some(
    (p) => p.team !== actor.team && p.position.x === between.x && p.position.y === between.y,
  );
}

for (let seed = 1; seed <= MATCHES; seed += 1) {
  const rng = createRng(parseSeed(seed));
  let state = createInitialState({ format: FORMAT });

  for (let n = 0; n < 6000 && state.result === null; n += 1) {
    const command = chooseCommand(state, { difficulty: "pro", variety: seed });
    const actor = state.players.find((p) => p.id === (command as { playerId?: string }).playerId);
    const forward = actor?.team === "home" ? 1 : -1;
    const from = actor?.position;

    const result = applyAction(state, command, rng);
    if (!result.ok) throw new Error(result.reason);
    actions += 1;

    if (command.type === "shoot") shots += 1;
    if (result.state.score.home + result.state.score.away > state.score.home + state.score.away) {
      goals += 1;
    }

    if (command.type === "dribble") {
      dribbles += 1;
      const went = isThrough(state, command.playerId, command.target);
      if (went) through += 1;
      if (result.duel?.attackerWon) {
        dribblesWon += 1;
        if (went) throughWon += 1;
        if (from && (command.target.x - from.x) * forward > 0) progressedByDribble += 1;
      }
    }

    if (command.type === "pass" && from) {
      const to = result.state.players.find((p) => p.id === command.target);
      if (to && (to.position.x - from.x) * forward > 0) progressedByPass += 1;
    }

    state = result.state;
  }

  turnsEnded.push(state.turn);
}

console.log(`\n${FORMAT}, ${MATCHES} matches`);
console.log(`  goals per match           ${(goals / MATCHES).toFixed(2)}`);
console.log(`  shots per match           ${(shots / MATCHES).toFixed(2)}`);
console.log(`  shot conversion           ${pct(goals, shots)}`);
console.log(`  actions per match         ${(actions / MATCHES).toFixed(1)}`);
console.log(
  `  average finishing turn    ${(turnsEnded.reduce((a, b) => a + b, 0) / MATCHES).toFixed(1)}`,
);
console.log(`  --- dribbling`);
console.log(`  dribbles per match        ${(dribbles / MATCHES).toFixed(2)}`);
console.log(`  ...won                    ${pct(dribblesWon, dribbles)}`);
console.log(`  through the man per match ${(through / MATCHES).toFixed(2)}`);
console.log(`  ...won                    ${pct(throughWon, through)}`);
console.log(`  --- progression (forward moves of the ball)`);
console.log(`  by a won dribble          ${(progressedByDribble / MATCHES).toFixed(2)} per match`);
console.log(`  by a pass                 ${(progressedByPass / MATCHES).toFixed(2)} per match`);
console.log(
  `  dribble share of progress ${pct(progressedByDribble, progressedByDribble + progressedByPass)}`,
);
