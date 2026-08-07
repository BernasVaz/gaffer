import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",

      /*
       * Measured against the whole of src, not only the files a test happened to
       * import. Otherwise a module nobody tests simply disappears from the
       * denominator and the percentage flatters us.
       */
      include: ["src/**/*.ts"],
      reporter: ["text-summary", "lcov"],

      /*
       * Master Plan §7: the engine is the crown jewel, so it carries a coverage
       * floor while the UI stays lighter. CI runs `pnpm test`, so falling under
       * this fails the build rather than producing a report nobody reads.
       */
      thresholds: {
        lines: 90,
      },
    },
  },
});
