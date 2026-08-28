import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "supabase/functions/**",  // Deno runtime, different globals — use `deno check`
      "android/**",
      "ios/**",
      "app/**",                 // not part of the Vite build
      "__pycache__/**",
      "**/*.timestamp-*.mjs",   // Vite config build artifacts
      "**/*.min.js",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // Large pre-existing debt. Kept visible as warnings rather than errors so
      // the gate is usable from day one — a permanently-red CI gets ignored,
      // which is how this accumulated. Tighten to "error" as the count falls.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",

      // Re-enabled. This was "off", which meant unused imports, variables and
      // parameters could not produce a warning — the mechanism by which
      // abandoned parallel implementations stayed invisible. `_` opts out.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
