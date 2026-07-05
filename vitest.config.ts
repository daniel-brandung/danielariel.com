import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Agent worktrees live inside the repo; without this their duplicate
    // test files get scanned and fail when run from the main checkout.
    exclude: ["**/node_modules/**", "**/.claude/**"],
  },
});
