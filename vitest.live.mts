import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Cấu hình cho test SỐNG: gọi thẳng backend thật đang chạy trong Docker.
 *
 * Khác `vitest.config.mts` đúng một điểm, và đó là điểm quan trọng nhất: KHÔNG
 * có `tests/msw/setup.ts`. Backend giả bị tắt hoàn toàn, nên mọi request trong
 * bộ này đi ra socket thật. Đây là thứ duy nhất chứng minh được lớp service
 * khớp với backend — một suite chạy trên MSW chỉ chứng minh nó khớp với handler
 * do chính mình viết.
 *
 * Chạy tách khỏi `pnpm test` vì nó cần Docker sống; xem `pnpm test:live`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests-live/**/*.live.ts"],
    // Hoàn lại hạn mức rate limit do chính suite này tiêu — xem setup.ts.
    globalSetup: ["tests-live/setup.ts"],
    // Tuần tự: các test dùng chung một tài khoản và một workspace, chạy song
    // song sẽ giẫm lên nhau.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
