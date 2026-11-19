import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    pool: "forks",
    // Each integration test boots a fresh in-process Postgres (PGlite) and applies every migration.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
