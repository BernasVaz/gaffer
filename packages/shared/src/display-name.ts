/**
 * The longest a display name may be.
 *
 * Forty is enough for a real name and short enough to sit on a scoreboard
 * without wrapping. Enforced in the database too, so the limit is a rule rather
 * than a suggestion the client happens to make.
 */
export const MAX_DISPLAY_NAME = 40;

/**
 * Words a display name may not contain.
 *
 * Deliberately short, and deliberately the obvious ones. A long list is a
 * maintenance burden that catches marginally more and starts rejecting
 * innocent names — "Scunthorpe" being the canonical demonstration, which is why
 * this matches on **word boundaries** rather than substrings.
 *
 * This is a speed bump, not moderation. It stops a name being thoughtlessly
 * offensive on somebody else's screen; it does not stop a determined person,
 * and it is not trying to. For an invited alpha the real control is that every
 * player was invited by name.
 */
const BARRED = [
  "fuck",
  "shit",
  "cunt",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "rape",
  "nazi",
  "paki",
  "spastic",
  "tranny",
] as const;

/** Characters people substitute to slip a word past a list like the one above. */
const LOOKALIKES: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

/** Collapse a name to the letters it is pretending not to be. */
function flatten(name: string): string {
  return name
    .toLowerCase()
    .split("")
    .map((character) => LOOKALIKES[character] ?? character)
    .join("")
    .replace(/[^a-z]+/g, " ");
}

/**
 * Tidy a name the way it will be stored.
 *
 * Collapses runs of whitespace and trims, so " Sam   Smith " and "Sam Smith"
 * are the same name rather than two players who look identical.
 */
export function normaliseDisplayName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * What is wrong with a display name, or `null` when nothing is.
 *
 * A sentence for a person to read, not an error code — this is shown under the
 * field somebody is typing in.
 *
 * Names are shown to an opponent, which is the whole reason this exists: a
 * field nobody else sees can say anything, and a field somebody else sees
 * cannot.
 */
export function displayNameProblem(name: string): string | null {
  const tidy = normaliseDisplayName(name);

  if (tidy.length === 0) return "Your opponent needs something to call you.";
  if (tidy.length > MAX_DISPLAY_NAME) {
    return `That is longer than ${MAX_DISPLAY_NAME} characters.`;
  }

  /*
   * Characters that will not render as the person expects: C0/C1 controls, the
   * combining marks a "zalgo" name is built from, and the zero-width and
   * bidirectional characters used to make two players look like one another.
   *
   * Checked by code point rather than by a regular expression character class,
   * because such a class is exactly what it looks like — a range of invisible
   * characters — and both the linter and the next reader are right to distrust
   * one.
   */
  const unrenderable = (point: number): boolean =>
    point < 0x20 ||
    (point >= 0x7f && point <= 0x9f) ||
    (point >= 0x0300 && point <= 0x036f) ||
    (point >= 0x200b && point <= 0x200f) ||
    (point >= 0x2028 && point <= 0x202e);

  for (const character of tidy) {
    const point = character.codePointAt(0);
    if (point !== undefined && unrenderable(point)) {
      return "That name uses characters that will not display properly.";
    }
  }

  const words = flatten(tidy).split(" ").filter(Boolean);
  if (words.some((word) => BARRED.some((barred) => word.startsWith(barred)))) {
    return "Please pick a name you would be happy for your opponent to read.";
  }

  return null;
}
