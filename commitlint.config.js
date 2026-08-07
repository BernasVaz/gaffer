/**
 * Conventional Commits enforcement.
 *
 * Master Plan §6 requires commit messages to read `feat:`, `fix:`, `test:`,
 * `chore:`, `docs:` or `refactor:`. Those are the six we use day to day.
 *
 * We extend `@commitlint/config-conventional` rather than hard-coding that list,
 * because its default type set is a superset — it also permits `ci:`, `build:`,
 * `perf:`, `style:` and `revert:`, all of which describe real work that would
 * otherwise have to masquerade as `chore:`. Narrowing the list would make the
 * changelog *less* informative, which is the opposite of the point.
 *
 * The prefix is not decoration: Changesets reads it to build CHANGELOG.md.
 */
export default {
  extends: ["@commitlint/config-conventional"],
};
