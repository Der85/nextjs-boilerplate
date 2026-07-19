import next from "eslint-config-next/core-web-vitals";

// eslint-config-next 16 ships a native flat-config array — no FlatCompat needed.
const eslintConfig = [
  ...next,
  {
    ignores: ["public/sw.js", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
