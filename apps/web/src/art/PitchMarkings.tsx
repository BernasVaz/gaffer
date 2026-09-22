import { GOAL_MOUTH_HEIGHT, type Board } from "@gaffer/shared";

import { svgTransform, type Orientation } from "../board/orientation";

/**
 * The white lines, drawn over the turf and under everything else.
 *
 * Purely atmospheric — the rules know nothing about a centre circle, and a
 * penalty box is not a place anything happens in this game. They are here
 * because a green rectangle with a grid on it is a diagram, and the same
 * rectangle with a halfway line and a centre circle is a pitch. That one shift
 * is most of what makes the board read as football before a single piece moves.
 *
 * Laid out in the grid's own units — one unit per cell — so it lines up with
 * the cells whatever the board size, and scales with the container rather than
 * needing a pixel measurement. The goal areas are derived from the real
 * {@link GOAL_MOUTH_HEIGHT} so the lines and the rules cannot drift apart.
 *
 * A portrait board turns the whole drawing rather than redrawing it: one
 * transform on the group, and every line below stays written in the engine's
 * own coordinates. A second set of lines for the second orientation would be a
 * second thing to keep in step with the rules, and it would drift.
 */
export function PitchMarkings({
  board,
  orientation = "landscape",
}: {
  board: Board;
  orientation?: Orientation;
}) {
  const { width, height } = board;
  const mouthTop = Math.floor((height - GOAL_MOUTH_HEIGHT) / 2);
  const portrait = orientation === "portrait";

  const line = "var(--color-turf-line)";
  const common = { fill: "none", stroke: line, strokeWidth: 0.045 } as const;

  return (
    <svg
      aria-hidden
      viewBox={portrait ? `0 0 ${height} ${width}` : `0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <g transform={svgTransform(board, orientation)}>
        {/* Touchlines and goal-lines, inset so they sit inside the playing area. */}
        <rect x={0.09} y={0.09} width={width - 0.18} height={height - 0.18} rx={0.1} {...common} />

        {/* The halfway line and the centre circle. */}
        <line x1={width / 2} y1={0.09} x2={width / 2} y2={height - 0.09} {...common} />
        <circle cx={width / 2} cy={height / 2} r={height * 0.19} {...common} />
        <circle cx={width / 2} cy={height / 2} r={0.075} fill={line} stroke="none" />

        {/*
          A box in front of each goal.

          It starts at the goal-line — the far edge of the goal column, one cell
          in — rather than at the touchline, because the goal itself occupies that
          first column. Drawing the box over the netting is the difference between
          a pitch and a diagram with a pitch pattern on it.
        */}
        {[0, 1].map((side) => {
          const boxDepth = 1.15;
          const x = side === 0 ? 1 : width - 1 - boxDepth;
          return (
            <g key={side}>
              <rect
                x={x}
                y={mouthTop - 0.5}
                width={boxDepth}
                height={GOAL_MOUTH_HEIGHT + 1}
                {...common}
              />
              {/* The penalty spot. */}
              <circle
                cx={side === 0 ? 1 + boxDepth * 0.62 : width - 1 - boxDepth * 0.62}
                cy={height / 2}
                r={0.07}
                fill={line}
                stroke="none"
              />
            </g>
          );
        })}

        {/* Corner arcs — the smallest detail, and the one that sells the rest. */}
        {[
          [0.09, 0.09, 0, 1],
          [width - 0.09, 0.09, -1, 1],
          [0.09, height - 0.09, 0, -1],
          [width - 0.09, height - 0.09, -1, -1],
        ].map(([cx, cy, sx, sy], index) => (
          <path
            key={index}
            d={`M ${cx! + (sx! === 0 ? 0.3 : -0.3)} ${cy} A 0.3 0.3 0 0 ${sx! === 0 ? (sy! === 1 ? 1 : 0) : sy! === 1 ? 0 : 1} ${cx} ${cy! + sy! * 0.3}`}
            {...common}
          />
        ))}
      </g>
    </svg>
  );
}

/** Which edge of the pitch a goal sits on, from the viewer's side of the glass. */
export type GoalSide = "left" | "right" | "top" | "bottom";

/**
 * Where the net's two directional features go, per side.
 *
 * `gradient` runs from the goal-line (lightest) to the back of the net
 * (darkest), and `post` is the solid bar laid along the goal-line itself. Both
 * are the same fact — which way the goal faces — so they are written down once
 * instead of being derived twice from the same conditional.
 */
const NET_FACING: Record<
  GoalSide,
  {
    gradient: { x1: string; y1: string; x2: string; y2: string };
    post: { x: number; y: number; width: number; height: number };
  }
> = {
  left: {
    gradient: { x1: "1", y1: "0", x2: "0", y2: "0" },
    post: { x: 8.9, y: 0, width: 1.1, height: 10 },
  },
  right: {
    gradient: { x1: "0", y1: "0", x2: "1", y2: "0" },
    post: { x: 0, y: 0, width: 1.1, height: 10 },
  },
  top: {
    gradient: { x1: "0", y1: "1", x2: "0", y2: "0" },
    post: { x: 0, y: 8.9, width: 10, height: 1.1 },
  },
  bottom: {
    gradient: { x1: "0", y1: "0", x2: "0", y2: "1" },
    post: { x: 0, y: 0, width: 10, height: 1.1 },
  },
};

/**
 * The netting inside a goal mouth.
 *
 * Drawn per cell rather than as one shape across the three, because the mouth is
 * three separate cells to the grid and one of them may have a keeper standing in
 * it. A diagonal mesh reads as a net at any size, where a drawn frame does not.
 *
 * It is told which way the goal faces rather than working it out, because on a
 * portrait board the goals are at the top and bottom of the screen while the
 * engine still has them at `x = 0` and `x = width − 1`.
 */
export function GoalNet({ side }: { side: GoalSide }) {
  /* A fine square mesh. Coarse diagonals read as chain-link fencing, which is
     the one thing a goal must not look like. */
  const step = 1.25;
  const lines = Array.from({ length: Math.round(10 / step) + 1 }, (_unused, i) => i * step);
  const facing = NET_FACING[side];

  return (
    <svg
      aria-hidden
      viewBox="0 0 10 10"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Depth: the back of the net is darkest, the goal-line end lightest. */}
      <defs>
        <linearGradient id={`net-depth-${side}`} {...facing.gradient}>
          <stop offset="0%" stopColor="#000" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="10" height="10" fill={`url(#net-depth-${side})`} />

      <g stroke="var(--color-net)" strokeWidth="0.16" opacity="0.5">
        {lines.map((offset) => (
          <line key={`v${offset}`} x1={offset} y1={0} x2={offset} y2={10} />
        ))}
        {lines.map((offset) => (
          <line key={`h${offset}`} x1={0} y1={offset} x2={10} y2={offset} />
        ))}
      </g>

      {/* The post: a solid bar on the goal-line, where the net meets the pitch. */}
      <rect {...facing.post} fill="#f4fbf6" opacity="0.9" />
    </svg>
  );
}
