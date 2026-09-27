import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma Client — generated from prisma/schema.prisma, never hand-edited.
    "src/generated/**",
    // Local mail transport output.
    ".mail/**",
  ]),
  {
    rules: {
      // A leading underscore is the conventional marker for a parameter that exists to
      // satisfy a signature — React's useActionState always passes the previous state,
      // whether or not an action cares about it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
