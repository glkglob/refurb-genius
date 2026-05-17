import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", ".vercel"] },
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
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Monorepo boundary enforcement — @repo/services files
  {
    files: ["packages/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
            {
              name: "@repo/ui",
              message:
                "@repo/services must not import UI components from @repo/ui. UI concerns belong in root app. See docs/architecture/dependency-rules.md",
            },
          ],
        },
      ],
    },
  },
  // Monorepo boundary enforcement — @repo/core files
  {
    files: ["packages/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
            {
              name: "@repo/services",
              message:
                "@repo/core must not import from @repo/services. Core is a dependency of services, not the reverse. See docs/architecture/dependency-rules.md",
            },
            {
              name: "@repo/ui",
              message:
                "@repo/core must not import UI components from @repo/ui. Core provides data layer only. See docs/architecture/dependency-rules.md",
            },
          ],
        },
      ],
    },
  },
  // Monorepo boundary enforcement — @repo/types files
  {
    files: ["packages/types/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
            {
              name: "@repo/core",
              message:
                "@repo/types must not import from @repo/core. Types are the bottom layer. See docs/architecture/dependency-rules.md",
            },
            {
              name: "@repo/services",
              message:
                "@repo/types must not import from @repo/services. Types are the bottom layer. See docs/architecture/dependency-rules.md",
            },
            {
              name: "@repo/ui",
              message:
                "@repo/types must not import from @repo/ui. Types are the bottom layer. See docs/architecture/dependency-rules.md",
            },
          ],
        },
      ],
    },
  },
  // Monorepo boundary enforcement — @repo/ui files
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
            {
              name: "@repo/services",
              message:
                "@repo/ui must not import business logic from @repo/services. UI package is for component re-exports only. See docs/architecture/dependency-rules.md",
            },
            {
              name: "@repo/core",
              message:
                "@repo/ui must not import constants from @repo/core. UI package is for component re-exports only. See docs/architecture/dependency-rules.md",
            },
          ],
        },
      ],
    },
  },
  eslintPluginPrettier,
);
