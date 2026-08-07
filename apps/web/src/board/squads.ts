import type { Role, Team } from "@gaffer/shared";

/** What a token shows: a shirt number and the name on the back of it. */
export interface Kit {
  /** Squad number, following the traditional positional numbering. */
  number: number;
  /** Surname printed on the shirt. */
  name: string;
}

/**
 * Names and numbers for the two sides.
 *
 * **Flavour only.** The engine knows about roles and stats; it has never heard of
 * a squad number or a surname, and nothing here may ever be read back into a
 * rule. It lives in the client for that reason — GDD §15 keeps the rules in the
 * engine and this is decoration on top of them.
 *
 * Numbers follow the traditional shorthand — 1 in goal, 4 at the back, 8 in
 * midfield, 7 wide, 9 up top — so the shape reads as football at a glance.
 *
 * v1 gives both sides the same five roles (GDD §14), so these are two fixed
 * squads rather than anything the player picks. Squad-building arrives later.
 */
export const SQUADS: Readonly<Record<Team, Readonly<Record<Role, Kit>>>> = {
  home: {
    goalkeeper: { number: 1, name: "Marsh" },
    defender: { number: 4, name: "Duval" },
    midfielder: { number: 8, name: "Okonjo" },
    winger: { number: 7, name: "Reyes" },
    striker: { number: 9, name: "Pike" },
  },
  away: {
    goalkeeper: { number: 1, name: "Novak" },
    defender: { number: 4, name: "Halden" },
    midfielder: { number: 8, name: "Amadi" },
    winger: { number: 7, name: "Corso" },
    striker: { number: 9, name: "Bex" },
  },
};
