import type { Team } from "@gaffer/shared";

import { KITS } from "../board/kits";

/**
 * A club badge: a shield in the side's colours with its initial on it.
 *
 * Small, and doing a job the words cannot. "Home" and "Away" are the least
 * memorable labels in football, and a scoreboard that only names them makes a
 * player translate every time they read the score. A shape in the right colour
 * is recognised rather than read.
 */
export function Crest({ team, className }: { team: Team; className?: string }) {
  const kit = KITS[team].outfield;

  return (
    <svg viewBox="0 0 40 46" className={className} role="img" aria-label={`${team} crest`}>
      <path
        d="M4 4 h32 v22 q0 12 -16 17 Q4 38 4 26 z"
        fill={kit.shirt}
        stroke="#0b1410"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M4 4 h32 v10 H4 z" fill={kit.shirtShade} opacity="0.55" />
      <text
        x="20"
        y="28"
        textAnchor="middle"
        fontWeight="800"
        fontSize="20"
        fill={kit.trim}
        style={{ fontFamily: "inherit" }}
      >
        {team === "home" ? "H" : "A"}
      </text>
    </svg>
  );
}
