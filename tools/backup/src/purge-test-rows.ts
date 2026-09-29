/**
 * Delete rows the end-to-end suite wrote to the real project.
 *
 * The cloud suite runs against production on purpose — a local copy cannot tell
 * you whether the hosted auth service, the real publication and a websocket over
 * the internet behave. The cost is test identities, test matches and test
 * feedback sitting beside real ones.
 *
 * ```bash
 * SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node tools/backup/src/purge-test-rows.ts --dry-run
 * SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node tools/backup/src/purge-test-rows.ts --delete
 * ```
 *
 * **It deletes only what a test marked at the time it was written.** It does not
 * guess from a name that looks synthetic, or a date, or a pattern — a purge that
 * infers what is disposable is a purge that eventually throws away somebody's
 * feedback. Rows with no marker are never touched, which means anything written
 * before marking existed has to be dealt with by hand, and that is the right way
 * round.
 *
 * Dry run by default. `--delete` is required, and deletion is not reversible —
 * take a backup first (`export.ts`).
 */
import process from "node:process";

import { TEST_MARKER } from "@gaffer/shared";

const url = process.env["SUPABASE_URL"];
const key = process.env["SUPABASE_SERVICE_KEY"];
const doDelete = process.argv.includes("--delete");

if (!url || !key) {
  console.error("set SUPABASE_URL and SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function ask(path: string): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(`${url}/rest/v1/${path}`, { headers });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return (await response.json()) as Array<Record<string, unknown>>;
}

async function remove(path: string): Promise<number> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation" },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return ((await response.json()) as unknown[]).length;
}

/* Identities first, because matches and feedback point at them — and the
   database cascades from `auth.users`, which is what actually owns them. */
const marked = await ask(`profiles?select=id,display_name&display_name=like.${TEST_MARKER}:*`);
const ids = marked.map((row) => row["id"] as string);

console.log(`test identities: ${ids.length}`);
for (const row of marked) console.log(`  ${String(row["display_name"])}`);

if (ids.length === 0) {
  console.log("nothing marked — nothing to purge");
  process.exit(0);
}

const inList = `(${ids.join(",")})`;
const matches = await ask(`matches?select=id&or=(home_user.in.${inList},away_user.in.${inList})`);
const feedback = await ask(`feedback?select=id&author=in.${inList}`);

console.log(`their matches:   ${matches.length}`);
console.log(`their feedback:  ${feedback.length}`);

if (!doDelete) {
  console.log("\ndry run — pass --delete to actually remove these");
  process.exit(0);
}

console.log(`\nfeedback removed: ${await remove(`feedback?author=in.${inList}`)}`);
console.log(
  `matches removed:  ${await remove(`matches?or=(home_user.in.${inList},away_user.in.${inList})`)}`,
);
console.log(`profiles removed: ${await remove(`profiles?id=in.${inList}`)}`);
console.log("\nthe auth.users rows behind these remain; remove them in the dashboard if wanted");
