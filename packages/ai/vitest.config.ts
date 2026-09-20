import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /*
     * The strongest tests here play whole matches, one action at a time, with
     * the opponent searching on every one of them. That is a second or two of
     * honest work rather than a hang, and it is the only way to assert what this
     * package actually claims — that nothing it proposes is ever refused. The
     * default five seconds is a limit written for unit tests, and a slower CI
     * runner crossing it produces a flake rather than a finding.
     */
    testTimeout: 30_000,
  },
});
