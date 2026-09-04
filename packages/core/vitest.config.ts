import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Tests exercise shared singleton rows (pixel_cursor, campaign_totals) against a real
    // Postgres instance — concurrency is deliberately created *within* a test (T2.6), not
    // an accident of multiple test files racing each other across worker processes.
    fileParallelism: false,
  },
});
