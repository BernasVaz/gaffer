import type { MatchState, Player, Role, Team } from "@gaffer/shared";

/** What a token shows: a shirt number and the name on the back of it. */
export interface Kit {
  /** Squad number, following the traditional positional numbering. */
  number: number;
  /** Surname printed on the shirt. */
  name: string;
}

/**
 * Shirt numbers, in the order a manager would hand them out.
 *
 * Traditional positional numbering — 1 in goal, 2 and 3 at full-back, 5 and 6
 * in the centre, 4 and 8 in midfield, 7 and 11 wide, 9 and 10 up top — so an
 * 11-a-side side reads as a football team at a glance rather than as a list.
 * Anyone beyond the list gets a squad number in the twenties, which is also
 * what happens in real life.
 */
const NUMBERS: Readonly<Record<Role, readonly number[]>> = {
  goalkeeper: [1, 13],
  defender: [2, 5, 6, 3],
  midfielder: [4, 8, 16],
  winger: [7, 11, 15],
  striker: [9, 10, 17],
};

/**
 * Names on the backs of the shirts.
 *
 * **Flavour only.** The engine knows about roles and stats; it has never heard
 * of a squad number or a surname, and nothing here may ever be read back into a
 * rule. It lives in the client for that reason — GDD §15 keeps the rules in the
 * engine and this is decoration on top of them.
 *
 * Enough of each role for the largest format, so an 11-a-side back four is four
 * different people rather than the same defender drawn four times.
 */
const NAMES: Readonly<Record<Team, Readonly<Record<Role, readonly string[]>>>> = {
  home: {
    goalkeeper: ["Marsh", "Vance"],
    defender: ["Duval", "Osei", "Brandt", "Kowal"],
    midfielder: ["Okonjo", "Reeve", "Salt"],
    winger: ["Reyes", "Finn", "Adeyemi"],
    striker: ["Pike", "Moss", "Traore"],
  },
  away: {
    goalkeeper: ["Novak", "Ilic"],
    defender: ["Halden", "Sarr", "Vogt", "Renzo"],
    midfielder: ["Amadi", "Petrov", "Quill"],
    winger: ["Corso", "Baptiste", "Lund"],
    striker: ["Bex", "Okafor", "Ferro"],
  },
};

/**
 * Which of its side's players of that role this one is, counting from one.
 *
 * Worked out from the squad rather than parsed out of the id. The id happens to
 * end in the same number today, but a name and a number are presentation and
 * should not depend on how the engine spells its identifiers.
 */
function indexOf(player: Player, state: MatchState): number {
  let seen = 0;
  for (const other of state.players) {
    if (other.team !== player.team || other.role !== player.role) continue;
    seen += 1;
    if (other.id === player.id) return seen;
  }
  return 1;
}

/** The number and name a given player wears. */
export function kitFor(player: Player, state: MatchState): Kit {
  const index = indexOf(player, state);
  const numbers = NUMBERS[player.role];
  const names = NAMES[player.team][player.role];

  return {
    number: numbers[index - 1] ?? 20 + index,
    name: names[index - 1] ?? `${names[0] ?? player.role} ${index}`,
  };
}

/** The first name and number for a role, for previews with no match behind them. */
export function sampleKit(team: Team, role: Role): Kit {
  return { number: NUMBERS[role][0] ?? 1, name: NAMES[team][role][0] ?? role };
}
