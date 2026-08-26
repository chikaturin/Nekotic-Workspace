import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/** Flat config — eslint-config-next 16 ships flat presets directly. */
const config = [
  ...coreWebVitals,
  ...typescriptConfig,
  { ignores: [".next/**", "coverage/**", "node_modules/**", "next-env.d.ts"] },
];

export default config;
