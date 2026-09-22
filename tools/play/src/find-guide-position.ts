/**
 * Search for a board the guided introduction can teach the whole lesson on.
 *
 * Kept in the repo rather than thrown away, because it has already been needed
 * twice: the position is *content* pinned in `apps/web/src/guide/position.ts`,
 * and a rules change can invalidate it — ADR 0018 made a kickoff a pass, which
 * made the previous command list illegal at its very first entry.
 *
 * ```bash
 * pnpm --filter @gaffer/play exec node src/find-guide-position.ts
 * ```
 *
 * Paste the printed command list into `guide/position.ts`. The tests in
 * `apps/web/tests/guide.test.tsx` assert every property this searches for, so a
 * bad paste fails rather than ships.
 *
 * Only `move` and *uncontested* `pass` are ever played, so the command list
 * rolls no dice and reaches the same board from any seed.
 */
import {
  applyAction,
  createInitialState,
  createRng,
  legalActions,
  previewDuel,
} from "@gaffer/engine";
import {
  areAdjacent,
  attackingGoalMouth,
  chebyshevDistance,
  defendingGoalMouth,
  parseSeed,
  type MatchCommand,
  type MatchState,
} from "@gaffer/shared";

const FORMAT = "5v5" as const;
const ACTIONS = 2;

const keeperOnItsLine = (state: MatchState, team: "home" | "away") => {
  const keeper = state.players.find((p) => p.team === team && p.role === "goalkeeper");
  if (!keeper) return false;
  return defendingGoalMouth(team, state.board).some(
    (c) => c.x === keeper.position.x && c.y === keeper.position.y,
  );
};

/** Everything the guide needs one position to be able to show. */
function teaches(state: MatchState) {
  if (state.result !== null || state.activeTeam !== "home") return null;
  if (state.actionsRemaining !== ACTIONS) return null;
  if (state.kickoffPending !== null) return null;
  if (!keeperOnItsLine(state, "home") || !keeperOnItsLine(state, "away")) return null;

  const carrier = state.players.find((p) => p.id === state.ball.carrierId);
  if (!carrier || carrier.team !== "home" || carrier.role === "goalkeeper") return null;
  if (carrier.position.x < state.board.width - 3) return null;

  // One or two closing it down, not a ruck: surrounded by three, every covering
  // bonus stacks and the whole option list reads 0%, which teaches despair.
  const pressing = state.players.filter(
    (p) =>
      p.team === "away" && p.role !== "goalkeeper" && areAdjacent(p.position, carrier.position),
  );
  if (pressing.length < 1 || pressing.length > 2) return null;

  // A defence that has not simply run away: this has to look like football.
  const defending = state.players.filter(
    (p) => p.team === "away" && p.role !== "goalkeeper" && p.position.x >= 3,
  );
  if (defending.length < 2) return null;

  const priced = legalActions(state)
    .filter((a) => a.playerId === carrier.id)
    .map((action) => ({ action, duel: previewDuel(state, action) }));

  const contested = priced.filter((p) => p.duel !== null);
  const free = priced.filter((p) => p.duel === null);
  if (contested.length < 2 || free.length === 0) return null;
  if (contested.filter((p) => p.duel!.winChance > 0).length < 2) return null;
  if (!contested.some((p) => p.duel!.winChance >= 0.3)) return null;

  // The carrier can shoot — and the pass below must make the shot better,
  // which is the whole game in one move.
  const carrierShot = priced.find((p) => p.action.type === "shoot");
  if (!carrierShot?.duel) return null;

  const mouth = attackingGoalMouth("home", state.board);

  for (const pass of priced) {
    if (pass.action.type !== "pass" || pass.duel !== null) continue;
    const receiver = state.players.find((p) => p.id === pass.action.target);
    if (!receiver || receiver.role === "goalkeeper") continue;
    if (!mouth.some((c) => chebyshevDistance(receiver.position, c) <= state.rules.shotRange))
      continue;

    const after = applyAction(state, pass.action, createRng(parseSeed(1)));
    if (!after.ok || after.duel !== null) continue;

    const receiverShot = legalActions(after.state)
      .filter((a) => a.playerId === receiver.id && a.type === "shoot")
      .map((a) => previewDuel(after.state, a))[0];
    if (!receiverShot || receiverShot.winChance <= carrierShot.duel.winChance) continue;

    return {
      carrier: carrier.id,
      receiver: receiver.id,
      pressing: pressing.length,
      carrierShot: Math.round(carrierShot.duel.winChance * 100),
      receiverShot: Math.round(receiverShot.winChance * 100),
    };
  }

  return null;
}

function walk(seed: number, steps: number) {
  const rng = createRng(parseSeed(seed));
  let state = createInitialState({ format: FORMAT, rules: { actionsPerTurn: ACTIONS } });
  const commands: MatchCommand[] = [];

  for (let n = 0; n < steps; n += 1) {
    const found = teaches(state);
    if (found && commands.length >= 4) return { state, commands: [...commands], found };

    const ball = state.ball.position;

    /* Moves and uncontested passes only — both free of dice. The pass is not
       optional: the carrier is pressed from the kickoff onwards, so every
       carrier move is a dribble, and without a pass the ball never advances. */
    const safe = legalActions(state).filter((action) => {
      const mover = state.players.find((p) => p.id === action.playerId)!;
      if (mover.role === "goalkeeper") return false;
      if (action.type === "move") return true;
      return action.type === "pass" && previewDuel(state, action) === null;
    });

    const scored = safe.map((action) => {
      const mover = state.players.find((p) => p.id === action.playerId)!;

      if (action.type === "pass") {
        const receiver = state.players.find((p) => p.id === action.target)!;
        if (receiver.role === "goalkeeper") return { action, rank: -99 };
        const gain = (receiver.position.x - mover.position.x) * (mover.team === "home" ? 1 : -1);
        return { action, rank: gain * 2 };
      }

      /* Home pushes up the pitch; away holds its shape and closes the ball
         down, which is what stops the search producing a rout with one side
         camped in a corner. */
      const rank =
        mover.team === "home"
          ? action.target.x - mover.position.x
          : (mover.position.x >= 3 ? 0 : -4) +
            (chebyshevDistance(mover.position, ball) - chebyshevDistance(action.target, ball)) * 2 +
            (action.target.x >= 3 ? 1 : -3);

      return { action, rank };
    });

    scored.sort((a, b) => b.rank - a.rank);
    const pool = scored.slice(0, Math.max(1, Math.min(4, scored.length)));
    const pick = pool.length > 0 ? pool[Math.floor(rng.next() * pool.length)]!.action : null;

    const command: MatchCommand = pick ?? { type: "endTurn", team: state.activeTeam };
    const result = applyAction(state, command, rng);
    if (!result.ok) break;

    commands.push(command);
    state = result.state;
  }

  return null;
}

type Hit = {
  seed: number;
  commands: MatchCommand[];
  state: MatchState;
  found: NonNullable<ReturnType<typeof teaches>>;
};
let best: Hit | null = null;

for (let seed = 1; seed <= 4000; seed += 1) {
  const hit = walk(seed, 40);
  if (!hit || !hit.found) continue;
  if (best === null || hit.commands.length < best.commands.length) {
    best = { seed, commands: hit.commands, state: hit.state, found: hit.found };
  }
  if (best.commands.length <= 8) break;
}

if (!best) {
  console.log("nothing found — loosen `teaches` or widen the seed range");
} else {
  console.log(
    JSON.stringify({ seed: best.seed, length: best.commands.length, ...best.found }, null, 1),
  );
  console.log();
  for (const command of best.commands) console.log(`  ${JSON.stringify(command)},`);
  console.log("\n---- board (x right, y down; H home, a away, * ball) ----");
  for (let y = 0; y < best.state.board.height; y += 1) {
    let row = "";
    for (let x = 0; x < best.state.board.width; x += 1) {
      const p = best.state.players.find((q) => q.position.x === x && q.position.y === y);
      row += p
        ? (p.team === "home" ? "H" : "a") + (p.id === best.state.ball.carrierId ? "*" : p.role[0]!)
        : " . ";
    }
    console.log(row);
  }
}
