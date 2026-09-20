import type { Role, Team } from "@gaffer/shared";

/** Every colour one player is drawn in. */
export interface Kit {
  /** The shirt, and the brighter half of its gradient. */
  shirt: string;
  /** The shaded half of the shirt, and the sleeve cuffs. */
  shirtShade: string;
  /** Shorts. */
  shorts: string;
  /** Trim: collar, armband, headband — whatever needs to read against the shirt. */
  trim: string;
  /** The squad number printed on the back. */
  number: string;
}

/**
 * The two kits, plus a keeper's.
 *
 * Blue and red because they are the two colours nobody has to be told apart, and
 * because both hold up against grass — which a second green or a white-on-light
 * kit would not. The keepers get colours of their own for the same reason a real
 * one does: the keeper is the only player on the pitch who does a different job,
 * and on this pitch it is the only one who can stand in a goal. Amber and violet
 * both separate cleanly from their own outfielders *and* from the turf.
 *
 * Colour only. The engine has never heard of any of it — it knows roles and
 * stats, and a kit is decoration laid on top (GDD §15).
 */
export const KITS: Readonly<Record<Team, { outfield: Kit; keeper: Kit }>> = {
  home: {
    outfield: {
      shirt: "#3b82f6",
      shirtShade: "#1d4ed8",
      shorts: "#15305f",
      trim: "#dbeafe",
      number: "#f8fbff",
    },
    keeper: {
      shirt: "#f5b301",
      shirtShade: "#c07f02",
      shorts: "#4a3204",
      trim: "#fff4d1",
      number: "#3b2a02",
    },
  },
  away: {
    outfield: {
      shirt: "#ef4444",
      shirtShade: "#b91c1c",
      shorts: "#661513",
      trim: "#fee2e2",
      number: "#fff6f5",
    },
    keeper: {
      shirt: "#a855f7",
      shirtShade: "#7c2fd4",
      shorts: "#3b1263",
      trim: "#f3e8ff",
      number: "#fbf5ff",
    },
  },
};

/** The kit a given player wears. */
export function kitFor(team: Team, role: Role): Kit {
  return role === "goalkeeper" ? KITS[team].keeper : KITS[team].outfield;
}

/**
 * Skin and hair, chosen per role so the five players read as five people.
 *
 * Fixed per role rather than random: the board has to look the same every time
 * it is drawn, and the client is careful to own no source of randomness at all.
 */
export const LOOKS: Readonly<Record<Role, { skin: string; hair: string }>> = {
  goalkeeper: { skin: "#f0c9a4", hair: "#2f2118" },
  defender: { skin: "#8d5a35", hair: "#141010" },
  midfielder: { skin: "#c78d5e", hair: "#4a2c18" },
  winger: { skin: "#5f3a22", hair: "#100c0a" },
  striker: { skin: "#f7d9bb", hair: "#8a4a1c" },
};
