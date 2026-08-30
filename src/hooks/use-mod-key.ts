"use client";

import { useMounted } from "@/hooks/use-mounted";

/**
 * Nhãn của phím bổ trợ trên máy người dùng: ⌘ trên Mac, Ctrl ở nơi khác.
 *
 * Phần LOGIC vốn đã nhận cả hai — mọi chỗ đều kiểm `metaKey || ctrlKey`, nên
 * Ctrl luôn dùng được. Sai là ở phần HIỂN THỊ: gợi ý đóng cứng "⌘" khiến người
 * dùng Windows tưởng phím tắt chỉ có trên Mac và không bấm thử.
 *
 * Phải qua `useMounted` vì `navigator` không tồn tại lúc render trên server;
 * đọc thẳng sẽ làm lệch HTML giữa server và client.
 */
export function useModKeyLabel(): string {
  const isMounted = useMounted();

  return isMounted && navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
}
