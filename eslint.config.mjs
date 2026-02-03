import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
    ],
  },
  {
    rules: {
      // Disable strict rules that the project doesn't follow
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-console": "off",
      "no-case-declarations": "off",
      "prefer-const": "off",
      "no-empty": "off",
      "no-undef": "off", // TypeScript handles this
      "no-unused-vars": "off", // TypeScript handles this
      "no-fallthrough": "off", // Intentional case fallthrough
      "no-unexpected-multiline": "off",
    },
  },
];
