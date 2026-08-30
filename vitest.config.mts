import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Backend giả bật cho MỌI test: một service gọi ra mạng mà không có handler
    // sẽ fail ngay tại chỗ, thay vì im lặng chạm vào backend thật trên máy.
    setupFiles: ["tests/msw/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/store/**", "src/services/**", "src/mock/factory.ts"],
      // DOM-only helpers are exercised through the editor, not in node tests.
      exclude: ["src/lib/dom/**"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
