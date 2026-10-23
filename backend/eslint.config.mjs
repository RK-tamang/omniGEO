import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// Flat config for the Fastify backend.
//
// The backend was on ESLint 9 with no config at all, so `npm run lint`
// failed outright. This mirrors the frontend's rule set closely enough to
// catch real problems without the `next/*` presets, which assume React and
// do not apply here.
export default [
  {
    ignores: ["node_modules/**", "dist/**", "data/**", "*.config.js"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Node runtime globals the backend relies on.
        process: "readonly",
        Buffer: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortSignal: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        structuredClone: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "writable",
        exports: "writable",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // The codebase intentionally uses `any` at the request/response
      // boundary where the payload is untyped.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          // Fastify handlers take (request, reply) — `reply` is often unused
          // when the handler only returns a value.
          args: "none",
        },
      ],
      // Unused function parameters are common in Fastify route handlers
      // (the request is not always needed) — keep them out of the way.
      "no-unused-vars": "off",
    },
  },
];
