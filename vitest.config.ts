import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["backend/tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      exclude: ["tests/**", "backend/tests/**", "**/*.d.ts"],
    },
  },
});
