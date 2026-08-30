import { resetRateLimit } from "./reset-rate-limit";

/** Vitest `globalSetup`: chạy một lần cho cả suite, trước file test đầu tiên. */
export function setup(): void {
  resetRateLimit();
}
