import { describe, expect, test } from "vitest";
import { MOCK_NOW } from "@/config/app";
import { formatBytes, formatCount, formatDate, formatPercent, formatRelativeTime } from "@/lib/format";
import { slugify, uniqueSlug } from "@/lib/utils";

describe("formatBytes", () => {
  test.each([
    [0, "0 B"],
    [-5, "0 B"],
    [512, "512 B"],
    [1024, "1.0 KB"],
    [1_572_864, "1.5 MB"],
    [123 * 1024 * 1024, "123 MB"],
  ])("formats %i as %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });

  test("handles non-finite input", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("formatRelativeTime", () => {
  const minutesAgo = (minutes: number) =>
    new Date(new Date(MOCK_NOW).getTime() - minutes * 60_000).toISOString();

  test.each([
    [0.2, "just now"],
    [12, "12m ago"],
    [180, "3h ago"],
    [60 * 24 * 3, "3d ago"],
  ])("formats %s minutes ago", (minutes, expected) => {
    expect(formatRelativeTime(minutesAgo(minutes))).toBe(expected);
  });

  test("falls back to an absolute date beyond a week", () => {
    expect(formatRelativeTime(minutesAgo(60 * 24 * 30))).toBe("27 Jul 2026");
  });

  test("returns a dash for an unparseable timestamp", () => {
    expect(formatRelativeTime("not-a-date")).toBe("—");
  });
});

describe("misc formatting", () => {
  test("formatDate is timezone-stable", () => {
    expect(formatDate("2026-08-26T09:30:00.000Z")).toBe("26 Aug 2026");
  });

  test("formatCount pluralises", () => {
    expect(formatCount(1, "item")).toBe("1 item");
    expect(formatCount(4, "item")).toBe("4 items");
  });

  test("formatPercent clamps to the 0–100 range", () => {
    expect(formatPercent(0.523)).toBe("52%");
    expect(formatPercent(1.4)).toBe("100%");
    expect(formatPercent(-1)).toBe("0%");
  });
});

describe("slugify", () => {
  test.each([
    ["Payment Gateway", "payment-gateway"],
    ["Thư mục Đặc biệt", "thu-muc-dac-biet"],
    ["  spaced  out  ", "spaced-out"],
    ["refund-service.ts", "refund-service-ts"],
    ["", ""],
  ])("slugifies %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  test("uniqueSlug appends a counter for collisions", () => {
    expect(uniqueSlug("payment", [])).toBe("payment");
    expect(uniqueSlug("payment", ["payment"])).toBe("payment-2");
    expect(uniqueSlug("payment", ["payment", "payment-2"])).toBe("payment-3");
  });

  test("uniqueSlug falls back to untitled for an empty base", () => {
    expect(uniqueSlug("", [])).toBe("untitled");
  });
});
