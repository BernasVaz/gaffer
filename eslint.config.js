import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },

  js.configs.recommended,
  tseslint.configs.recommended,

  /*
   * Machine-enforce Principle #1: the engine is pure and deterministic.
   * These rules make it impossible to accidentally introduce a source of
   * non-determinism, which would silently break replays and multiplayer.
   */
  {
    files: ["packages/engine/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "Date",
          message:
            "The engine must be deterministic. Take time as an explicit input instead of reading the clock.",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "The engine must be deterministic. Use the injected seeded RNG instead.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["node:*", "fs", "path", "crypto", "http", "https"],
              message: "The engine must be framework- and platform-free. No Node built-ins.",
            },
            {
              group: ["react", "react-*", "@gaffer/web", "@gaffer/server"],
              message:
                "The engine must not depend on rendering or networking. Keep the layers separate.",
            },
          ],
        },
      ],
    },
  },

  /* Tests may use whatever they need to set up scenarios. */
  {
    files: ["**/tests/**/*.ts", "**/*.test.ts"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
    },
  },

  /* Must stay last: turns off any rule that would fight Prettier. */
  prettier,
);
