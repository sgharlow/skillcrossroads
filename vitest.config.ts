import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror apps/web's tsconfig `@/*` alias so tests can import route handlers directly.
    alias: {
      "@": fileURLToPath(new URL("./apps/web", import.meta.url)),
      // Resolve the workspace package to its source so CLI/web tests importing `@beacon/core`
      // run against src (no prior build needed) — matches how core's own tests import `../src`.
      "@beacon/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
