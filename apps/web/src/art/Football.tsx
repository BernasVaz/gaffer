/**
 * The ball.
 *
 * A proper truncated-icosahedron panelling rather than a dot, for one practical
 * reason as well as a cosmetic one: the panels are what make the roll visible.
 * A plain circle spinning looks exactly like a plain circle at rest, so all the
 * work `Pieces` does to spin the ball in proportion to how far it travelled
 * would land on nothing.
 *
 * Drawn once, static, in its own viewBox. The spin and the arc are applied by
 * the layer above — this is the thing being moved, not the movement.
 */
export function Football() {
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="#fdfdfb" stroke="#1d2b22" strokeWidth="2.5" />
      {/* The centre panel and its five neighbours: enough to read as a football. */}
      <path d="M20 9 l7.2 5.2 l-2.8 8.5 h-8.8 l-2.8 -8.5 z" fill="#1d2b22" />
      <path d="M20 4.6 l-4 -1.4 M20 4.6 l4 -1.4" stroke="#1d2b22" strokeWidth="1.6" fill="none" />
      <path d="M12.8 14.2 l-7.4 -1.1" stroke="#1d2b22" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M27.2 14.2 l7.4 -1.1" stroke="#1d2b22" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.6 22.7 l-4.4 6.6" stroke="#1d2b22" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24.4 22.7 l4.4 6.6" stroke="#1d2b22" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M20 9 v-4.4" stroke="#1d2b22" strokeWidth="1.8" strokeLinecap="round" />
      {/* A highlight, so it reads as a sphere rather than a sticker. */}
      <ellipse cx="14" cy="13" rx="6" ry="4.4" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}
