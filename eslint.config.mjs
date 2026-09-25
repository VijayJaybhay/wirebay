/**
 * ESLint configuration. Policy: zero errors and zero warnings, and no suppressions.
 * Inline lint directives are switched off (`noInlineConfig`), TypeScript suppression comments
 * are banned (`ban-ts-comment`), and formatter or coverage escape comments are reported
 * (`no-warning-comments`). Fix the code instead; if a rule seems wrong, discuss it in an issue.
 */

import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Only generated or build output is ignored.
  { ignores: ["dist/", "docs-api/", "coverage/", "wirebay-export/", "node_modules/"] },
  {
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.mjs"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false }],
      "no-warning-comments": [
        "error",
        {
          terms: [
            "prettier-ignore",
            "eslint-disable",
            "eslint-enable",
            "@ts-ignore",
            "@ts-expect-error",
            "@ts-nocheck",
            "c8 ignore",
            "istanbul ignore",
          ],
          location: "anywhere",
        },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/explicit-function-return-type": ["error", { allowExpressions: true, allowTypedFunctionExpressions: true }],
      "@typescript-eslint/explicit-member-accessibility": ["error", { accessibility: "no-public" }],
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["error"] }],
      "prefer-const": "error",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["eslint.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
