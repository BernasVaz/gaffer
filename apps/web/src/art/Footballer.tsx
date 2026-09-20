import type { Role, Team } from "@gaffer/shared";

import { kitFor, LOOKS } from "../board/kits";

/** Which way a player is looking, as a fraction of a full turn of the eyes. */
export interface Gaze {
  /** −1 hard left, 1 hard right. */
  x: number;
  /** −1 hard up, 1 hard down. */
  y: number;
}

export interface FootballerProps {
  /** Which side, which decides the kit. */
  team: Team;
  /** Which role, which decides the kit, the build and the props. */
  role: Role;
  /** The number on the back. */
  number: number;
  /** Where to look. Defaults to straight ahead. */
  gaze?: Gaze;
  /** Whether this player has the ball, which lights them from above. */
  hasBall?: boolean;
  /** A stable id, so two players' gradients cannot collide in one document. */
  id: string;
}

/** Clamp a gaze component and scale it to pixels in the 100-wide viewBox. */
const look = (value: number | undefined, range: number) =>
  Math.max(-1, Math.min(1, value ?? 0)) * range;

/**
 * One player, drawn rather than represented.
 *
 * A token with a number on it tells you everything the rules need and nothing
 * the game wants. This is the other half: a chunky little footballer with a
 * build, a kit, and a face that watches the ball — heavy outlines, saturated
 * colour and slightly exaggerated proportions, which is the vocabulary that
 * survives being rendered at sixty pixels on a phone.
 *
 * **Everything here is a function of the board.** No randomness, no state, no
 * time: the same player in the same position always draws identically, which is
 * what keeps the client as reproducible as the engine it is drawing. The eyes
 * are the clearest case — they follow the ball because the ball's position is an
 * input, not because anything is animating them.
 *
 * Roles are distinguishable at a glance without reading the number, which is the
 * point of giving them props at all:
 *
 * - **Goalkeeper** — its own kit, a cap, and gloves. The only player allowed in
 *   a goal, and it should look like the odd one out, because it is.
 * - **Defender** — broader in the shoulder and stands wider.
 * - **Midfielder** — the captain's armband.
 * - **Winger** — slighter, with a headband.
 * - **Striker** — gold boots, and a fraction taller.
 */
export function Footballer({ team, role, number, gaze, hasBall = false, id }: FootballerProps) {
  const kit = kitFor(team, role);
  const { skin, hair } = LOOKS[role];
  const keeper = role === "goalkeeper";

  /* Build, as a single number: positive is broader, negative is slighter. */
  const bulk = role === "defender" ? 4 : role === "winger" ? -3 : role === "striker" ? 1 : 0;
  const headR = role === "striker" ? 20 : 19;

  const eyeX = look(gaze?.x, 2.4);
  const eyeY = look(gaze?.y, 1.8);

  const outline = "#0b1410";
  const shirtId = `shirt-${id}`;
  const skinId = `skin-${id}`;

  return (
    <svg viewBox="0 0 100 112" className="h-full w-full overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={shirtId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={kit.shirt} />
          <stop offset="100%" stopColor={kit.shirtShade} />
        </linearGradient>
        <linearGradient id={skinId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skin} />
          <stop offset="100%" stopColor={skin} stopOpacity="0.82" />
        </linearGradient>
      </defs>

      {/* Grounding. Without it the piece floats and the pitch stops being a surface. */}
      <ellipse cx="50" cy="105" rx={24 + bulk} ry="5.5" fill="#06210f" opacity="0.32" />

      {/* Legs and boots. The striker's are gold, because of course they are. */}
      <rect x={36 - bulk * 0.3} y="70" width="12" height="21" rx="6" fill={skin} />
      <rect x={52 + bulk * 0.3} y="70" width="12" height="21" rx="6" fill={skin} />
      <rect
        x={34 - bulk * 0.3}
        y="86"
        width="17"
        height="11"
        rx="5"
        fill={role === "striker" ? "#fbbf24" : "#161b17"}
        stroke={outline}
        strokeWidth="1.6"
      />
      <rect
        x={49 + bulk * 0.3}
        y="86"
        width="17"
        height="11"
        rx="5"
        fill={role === "striker" ? "#fbbf24" : "#161b17"}
        stroke={outline}
        strokeWidth="1.6"
      />

      <path
        d={`M${31 - bulk} 64 h${38 + bulk * 2} v10 q0 6 -7 6 h-6 q-4 0 -5 -4 l-1 -4 l-1 4 q-1 4 -5 4 h-6 q-7 0 -7 -6 z`}
        fill={kit.shorts}
        stroke={outline}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      <rect
        x={20 - bulk}
        y="44"
        width="11"
        height="26"
        rx="5.5"
        fill={`url(#${skinId})`}
        stroke={outline}
        strokeWidth="1.6"
      />
      <rect
        x={69 + bulk}
        y="44"
        width="11"
        height="26"
        rx="5.5"
        fill={`url(#${skinId})`}
        stroke={outline}
        strokeWidth="1.6"
      />

      {keeper && (
        <>
          <rect
            x={18 - bulk}
            y="57"
            width="15"
            height="15"
            rx="5"
            fill={kit.trim}
            stroke={outline}
            strokeWidth="1.6"
          />
          <rect
            x={67 + bulk}
            y="57"
            width="15"
            height="15"
            rx="5"
            fill={kit.trim}
            stroke={outline}
            strokeWidth="1.6"
          />
        </>
      )}

      <path
        d={`M${30 - bulk} 46 q0 -8 8 -10 l6 -2 q6 5 12 0 l6 2 q8 2 8 10 v20 q0 4 -4 4 h${-32 - bulk * 2} q-4 0 -4 -4 z`}
        fill={`url(#${shirtId})`}
        stroke={outline}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* The captain's armband — the midfielder is the one who links play. */}
      {role === "midfielder" && (
        <rect x={67 + bulk} y="47" width="11" height="5" rx="2.5" fill={kit.trim} opacity="0.95" />
      )}

      <text
        x="50"
        y="64"
        textAnchor="middle"
        fontWeight="800"
        fontSize="19"
        fill={kit.number}
        style={{ fontFamily: "inherit" }}
      >
        {number}
      </text>

      <circle cx="50" cy="32" r={headR} fill={`url(#${skinId})`} stroke={outline} strokeWidth="2" />
      <path
        d={`M${50 - headR} 30 q2 -${headR} ${headR} -${headR} q${headR - 2} 1 ${headR} ${headR} q-6 -7 -${headR} -7 q-10 0 -${headR} 7 z`}
        fill={hair}
      />

      {role === "winger" && (
        <rect x={50 - headR} y="23.5" width={headR * 2} height="6" rx="3" fill={kit.trim} />
      )}

      {keeper && (
        <>
          <path
            d={`M${50 - headR - 1} 22 q${headR + 1} -13 ${(headR + 1) * 2} 0 z`}
            fill={kit.shirt}
            stroke={outline}
            strokeWidth="1.6"
          />
          <rect
            x={50 - headR - 5}
            y="20.5"
            width={(headR + 5) * 2}
            height="5"
            rx="2.5"
            fill={kit.shirtShade}
            stroke={outline}
            strokeWidth="1.4"
          />
        </>
      )}

      {/* The face. The eyes are the whole trick — they point at the ball. */}
      <ellipse cx={43 + eyeX} cy={34 + eyeY} rx="4.6" ry="5.2" fill="#fdfdfd" />
      <ellipse cx={57 + eyeX} cy={34 + eyeY} rx="4.6" ry="5.2" fill="#fdfdfd" />
      <circle cx={43.8 + eyeX * 1.6} cy={34.8 + eyeY * 1.5} r="2.4" fill="#141d26" />
      <circle cx={57.8 + eyeX * 1.6} cy={34.8 + eyeY * 1.5} r="2.4" fill="#141d26" />
      <path
        d="M38 26.5 q5 -3 9 -1"
        stroke={outline}
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M62 26.5 q-5 -3 -9 -1"
        stroke={outline}
        strokeWidth="2.1"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M46 43 q4 3 8 0"
        stroke={outline}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Whoever has the ball is lit from above, so possession reads at a glance. */}
      {hasBall && (
        <>
          <ellipse cx="50" cy="32" rx={headR} ry={headR} fill="#fde68a" opacity="0.16" />
          <path
            d={`M${30 - bulk} 46 q0 -8 8 -10 l6 -2 q6 5 12 0 l6 2 q8 2 8 10`}
            fill="none"
            stroke="#fde68a"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </>
      )}
    </svg>
  );
}
