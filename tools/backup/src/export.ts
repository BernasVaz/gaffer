/**
 * Export `matches` and `feedback` to timestamped files.
 *
 * The free Supabase tier has **no automated backups** — no daily snapshot, no
 * point-in-time recovery. Everything a wave of testers produces lives in one
 * database with no copy of it anywhere. This is the copy.
 *
 * ```bash
 * SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node tools/backup/export.mjs ~/gaffer-backups
 * ```
 *
 * Needs the **service key**, because `feedback` has no select policy and is not
 * meant to be readable by a client — which is the point. The key is read from
 * the environment and never written anywhere; run this by hand or from a
 * scheduled job that holds its own secret.
 *
 * Writes two files per run: JSON, which is the faithful copy, and CSV, which is
 * the one a person opens. **Every CSV cell goes through `csvCell`**, so a note
 * beginning `=HYPERLINK(...)` arrives as text rather than as a live formula in
 * whatever spreadsheet reads it — the export is the moment somebody else's
 * typing meets our tooling, and it is the moment it has to stop being code.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { csvRow, hasHiddenCharacters } from "@gaffer/shared";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_KEY"];
const out = process.argv[2] ?? "backups";

if (!url || !key) {
  console.error("set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}

/** Read a whole table through PostgREST, a page at a time. */
async function readAll(table: string): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  const size = 1000;

  for (let from = 0; ; from += size) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&order=created_at.asc`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + size - 1}`,
      },
    });

    if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);

    const page = (await response.json()) as Array<Record<string, unknown>>;
    rows.push(...page);
    if (page.length < size) return rows;
  }
}

/** A CSV of whatever columns the rows actually have. */
function toCsv(rows: ReadonlyArray<Record<string, unknown>>): string {
  if (rows.length === 0) return "";

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [csvRow(columns)];

  for (const row of rows) {
    lines.push(
      csvRow(
        columns.map((column) => {
          const value = row[column];
          return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
        }),
      ),
    );
  }

  return lines.join("\n");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(out, { recursive: true });

for (const table of ["matches", "feedback"]) {
  const rows = await readAll(table);

  writeFileSync(join(out, `${table}-${stamp}.json`), JSON.stringify(rows, null, 2));
  writeFileSync(join(out, `${table}-${stamp}.csv`), toCsv(rows));

  /* Flagged rather than silently stripped: a note written with invisible
     characters in it is worth *knowing about*, and the JSON copy keeps it
     exactly as it arrived. */
  const hidden = rows.filter(
    (row) => typeof row["body"] === "string" && hasHiddenCharacters(row["body"]),
  );

  console.log(`${table}: ${rows.length} rows`);
  if (hidden.length > 0) {
    console.log(`  ⚠ ${hidden.length} row(s) contain invisible or direction-changing characters`);
    for (const row of hidden) console.log(`    ${row["id"]}`);
  }
}

console.log(`written to ${out}`);
