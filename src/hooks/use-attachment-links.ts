"use client";

import { useEffect, useState } from "react";
import { fileApi } from "@/services/api/file.api";
import type { CellAttachment } from "@/types";

/**
 * Link để MỞ và để XEM TRƯỚC một tệp đính kèm, hỏi server theo id của asset.
 *
 * Ô đính kèm trong bảng chỉ cất id, tên, kiểu và kích thước — server cố tình
 * xoá mọi `url` client gửi lên (`parseAttachment` trong Board đặt cứng `null`),
 * vì nếu không thì bất kỳ ai sửa được một ô cũng nhét được link tuỳ ý vào đó.
 *
 * Hệ quả là ngay sau khi tải lên thì ảnh hiện, nhưng tải lại trang là mất sạch:
 * giá trị trong máy có url, giá trị từ server thì không. Chỗ còn thiếu chính là
 * bước hỏi lại link này — server ký theo từng người xem, và tự kiểm quyền.
 */
export interface AttachmentLinks {
  readonly url: string;
  readonly thumbnailUrl: string | null;
  readonly expiresAt: number;
}

/** Xin link mới sớm hơn hạn một chút, để ảnh không chết giữa lúc đang xem. */
const RENEW_MARGIN_MS = 60_000;

const cache = new Map<string, AttachmentLinks>();
const inFlight = new Map<string, Promise<AttachmentLinks | null>>();

function fresh(assetId: string): AttachmentLinks | null {
  const entry = cache.get(assetId);
  if (!entry) return null;

  if (entry.expiresAt - RENEW_MARGIN_MS <= Date.now()) {
    cache.delete(assetId);
    return null;
  }

  return entry;
}

async function fetchLinks(assetId: string): Promise<AttachmentLinks | null> {
  const running = inFlight.get(assetId);
  if (running) return running;

  const request = fileApi
    .assetUrl(assetId)
    .then((signed): AttachmentLinks => {
      const links: AttachmentLinks = {
        url: signed.url,
        thumbnailUrl: signed.thumbnailUrl ?? null,
        expiresAt: Date.parse(signed.expiresAt),
      };

      cache.set(assetId, links);
      return links;
    })
    // Tệp bị xoá, hoặc người này không có quyền xem: hiện biểu tượng thay ảnh,
    // đừng để cả ô hỏng theo.
    .catch(() => null)
    .finally(() => inFlight.delete(assetId));

  inFlight.set(assetId, request);
  return request;
}

/** Trả lại đúng danh sách đó, nhưng đã điền link cho những tệp còn thiếu. */
export function useAttachmentLinks(
  files: readonly CellAttachment[],
): readonly CellAttachment[] {
  const [, setTick] = useState(0);

  const missing = files
    .filter((file) => !file.url && !fresh(file.id))
    .map((file) => file.id)
    .join(",");

  useEffect(() => {
    if (missing === "") return;

    let isActive = true;

    void Promise.all(missing.split(",").map((id) => fetchLinks(id))).then(() => {
      if (isActive) setTick((count) => count + 1);
    });

    return () => {
      isActive = false;
    };
  }, [missing]);

  return files.map((file) => {
    if (file.url) return file;

    const links = fresh(file.id);
    if (!links) return file;

    return { ...file, url: links.url, thumbnailUrl: links.thumbnailUrl };
  });
}

/** Chỉ dùng cho test: quên hết link đã xin. */
export function resetAttachmentLinks(): void {
  cache.clear();
  inFlight.clear();
}
