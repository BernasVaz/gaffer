import { GOAL_MOUTH_HEIGHT, type Board } from "@gaffer/shared";

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
 */
export function PitchMarkings({ board }: { board: Board }) {
  const { width, height } = board;
  const mouthTop = Math.floor((height - GOAL_MOUTH_HEIGHT) / 2);

  const line = "var(--color-turf-line)";
  const common = { fill: "none", stroke: line, strokeWidth: 0.045 } as const;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
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
    </svg>
  );
}

/**
 * The netting inside a goal mouth.
 *
 * Drawn per cell rather than as one shape across the three, because the mouth is
 * three separate cells to the grid and one of them may have a keeper standing in
 * it. A diagonal mesh reads as a net at any size, where a drawn frame does not.
 */
export function GoalNet({ side }: { side: "left" | "right" }) {
  /* A fine square mesh. Coarse diagonals read as chain-link fencing, which is
     the one thing a goal must not look like. */
  const step = 1.25;
  const lines = Array.from({ length: Math.round(10 / step) + 1 }, (_unused, i) => i * step);

  return (
    <svg
      aria-hidden
      viewBox="0 0 10 10"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      {/* Depth: the back of the net is darkest, the goal-line end lightest. */}
      <defs>
        <linearGradient
          id={`net-depth-${side}`}
          x1={side === "left" ? "1" : "0"}
          y1="0"
          x2={side === "left" ? "0" : "1"}
          y2="0"
        >
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
      <rect
        x={side === "left" ? 8.9 : 0}
        y="0"
        width="1.1"
        height="10"
        fill="#f4fbf6"
        opacity="0.9"
      />
    </svg>
  );
}
