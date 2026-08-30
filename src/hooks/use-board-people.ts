"use client";

import { useMemo } from "react";
import { useDirectory } from "@/hooks/use-directory";
import { useBoardStore } from "@/store/board-store";
import type { DirectoryUser } from "@/types";

/**
 * Những người có thể được gán việc và được nhắc tên trên một board.
 *
 * Board snapshot chỉ trả về người ĐÃ XUẤT HIỆN trong các hàng — người tạo hàng
 * và người nằm trong ô kiểu "user". Danh sách đó đủ để vẽ avatar, nhưng dùng nó
 * làm danh sách chọn thì thành vòng luẩn quẩn: người chưa từng được gán sẽ
 * không có trong danh sách, nên không gán được, nên mãi mãi không có trong danh
 * sách. Một workspace mới chỉ hiện đúng mỗi người tạo ra nó.
 *
 * Danh bạ workspace là danh sách chọn đúng. Snapshot vẫn được ghép vào để
 * người đã rời workspace không biến thành "Unknown user" trên các hàng cũ.
 */
export function useBoardPeople(): readonly DirectoryUser[] {
  const directory = useDirectory();
  const referenced = useBoardStore((state) => state.people);

  return useMemo(() => {
    const byId = new Map<string, DirectoryUser>();

    for (const person of referenced) byId.set(person.id, person);
    for (const person of directory) byId.set(person.id, person);

    return [...byId.values()];
  }, [directory, referenced]);
}
