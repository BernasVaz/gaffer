/**
 * Characters that are invisible, or that change how the text around them reads.
 *
 * Zero-width joiners and spaces, the bidirectional overrides behind the
 * "Trojan Source" trick, and the Unicode tag block — which can carry a whole
 * hidden message inside what looks like one ordinary word.
 *
 * None of them belong in a display name or a feedback note, and all of them are
 * exactly what somebody reaches for when they want a reader to see one thing
 * and a machine to receive another.
 */
const INVISIBLE = [
  [0x00ad, 0x00ad], // soft hyphen
  [0x200b, 0x200f], // zero-width space … right-to-left mark
  [0x202a, 0x202e], // bidirectional embedding and overrides
  [0x2060, 0x2064], // word joiner, invisible operators
  [0x2066, 0x2069], // isolates
  [0xfeff, 0xfeff], // byte-order mark
  [0xe0000, 0xe007f], // Unicode tag characters
] as const;

/** Whether `text` contains anything invisible or direction-changing. */
export function hasHiddenCharacters(text: string): boolean {
  for (const character of text) {
    const point = character.codePointAt(0);
    if (point === undefined) continue;
    if (INVISIBLE.some(([low, high]) => point >= low && point <= high)) return true;
    /* C0 and C1 control characters, tab and newline excepted — those are
       ordinary in a note somebody typed. */
    if (
      (point < 0x20 && point !== 0x09 && point !== 0x0a && point !== 0x0d) ||
      (point >= 0x7f && point <= 0x9f)
    ) {
      return true;
    }
  }
  return false;
}

/** Strip anything invisible, leaving the text a reader would have seen. */
export function withoutHiddenCharacters(text: string): string {
  return [...text].filter((character) => !hasHiddenCharacters(character)).join("");
}

/**
 * One cell of a CSV, safe to open in a spreadsheet.
 *
 * Two separate problems, and the second is the one people forget.
 *
 * **Quoting** stops a comma or a newline from becoming a new column or row.
 * Every serialiser does this.
 *
 * **Formula injection** is the other one. Excel, Google Sheets and Numbers all
 * treat a cell beginning `=`, `+`, `-`, `@`, or a tab or carriage return as a
 * *formula* rather than as text — so a tester who writes
 * `=HYPERLINK("http://evil","click")` as their feedback has written a live link
 * into a spreadsheet somebody else opens. It is not an attack on the game; it is
 * an attack on whoever reads the export, which is us.
 *
 * Prefixing with an apostrophe is the conventional defence: spreadsheets treat
 * it as "this is text", and it survives a round trip.
 *
 * Hidden characters are removed too, so a cell cannot read one way and mean
 * another.
 */
export function csvCell(value: unknown): string {
  const text = withoutHiddenCharacters(value === null || value === undefined ? "" : String(value));
  const dangerous = /^[=+\-@\t\r]/.test(text);
  const quoted = (dangerous ? `'${text}` : text).replaceAll('"', '""');
  return `"${quoted}"`;
}

/** A whole CSV row, cells joined and each one made safe. */
export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(",");
}
