import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [
      ".next/**",
      "dist/**",
      "node_modules/**",
      ".playwright-cli/**",
      ".autonomous-agent-files/**",
      ".venv*/**",
      "vendor/**",
      "output/**",
      ".tools/**",
    ],
  },
  ...nextVitals,
  {
    rules: {
      "import/no-anonymous-default-export": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-page-custom-font": "off",
      // App uses traditional <a href> navigation instead of next/link.
      "@next/next/no-html-link-for-pages": "off",
      "react/no-unescaped-entities": "off",
      "react/no-danger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      // Existing streaming and virtualized-chat patterns intentionally keep
      // callback refs and state resets in effects. Enable these incrementally
      // once the legacy chat surfaces have been fully retired.
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
];

export default config;
