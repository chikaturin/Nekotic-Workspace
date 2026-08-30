"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

export interface CellCommit {
  /** Ghi bản nháp đi, nếu chưa ghi. Gọi bao nhiêu lần cũng chỉ ghi một. */
  readonly finish: () => void;
  /** Bỏ bản nháp: sau lệnh này sẽ KHÔNG ghi gì nữa. */
  readonly discard: () => void;
}

/**
 * Giữ cho bản nháp trong một ô không biến mất khi bấm ra ngoài.
 *
 * Bug thật: sửa một ô rồi bấm sang ô KHÁC là mất trắng — không có cả request
 * gửi đi. `onBlur` là chỗ duy nhất gọi lệnh ghi, nhưng bấm sang ô khác làm bảng
 * đổi ô đang sửa và React gỡ editor xuống TRƯỚC khi blur kịp chạy. Bấm ra chỗ
 * trống thì không ai đổi ô, blur chạy, mọi thứ có vẻ ổn — nên lỗi trông như lúc
 * được lúc không.
 *
 * Cách chữa là chốt bản nháp ở `pointerdown` pha CAPTURE trên document: pha này
 * chạy trước mọi handler của React, nên bản nháp được ghi xong rồi bảng mới kịp
 * đổi ô.
 *
 * KHÔNG dùng cleanup lúc unmount cho việc này. StrictMode ở dev chạy effect
 * theo chu trình setup → cleanup → setup, nên cleanup ấy nổ ngay lúc editor vừa
 * mở: ô tự lưu rồi tự đóng, và trông như không bấm vào sửa được.
 */
export function useCellCommit(
  commit: () => void,
  surface: RefObject<HTMLElement | null>,
): CellCommit {
  // Lúc chốt phải ghi bản nháp MỚI NHẤT, không phải bản đóng băng ở lần render
  // đầu — nên ref được cập nhật sau mỗi lần render, trong effect chứ không phải
  // giữa lúc render.
  const latest = useRef(commit);

  useEffect(() => {
    latest.current = commit;
  });

  const isSettled = useRef(false);

  const finish = useCallback(() => {
    if (isSettled.current) return;

    isSettled.current = true;
    latest.current();
  }, []);

  const discard = useCallback(() => {
    isSettled.current = true;
  }, []);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const host = surface.current;
      const target = event.target;

      // Bấm bên trong chính editor — nút Format, nút mở rộng — không phải là
      // rời ô, nên không chốt gì cả.
      if (!host || (target instanceof Node && host.contains(target))) return;

      finish();
    }

    document.addEventListener("pointerdown", onPointerDown, true);

    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [finish, surface]);

  return { finish, discard };
}
