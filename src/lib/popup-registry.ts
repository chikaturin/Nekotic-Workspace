/**
 * Sổ đăng ký popup đang mở — chỉ MỘT nhánh được mở tại một thời điểm.
 *
 * Trước đây mỗi menu tự quản trạng thái của nó, nên hai menu cạnh nhau —
 * "Status" và "Assign" trên thanh chọn hàng loạt — mở chồng lên nhau và che
 * mất nhau. Radix có tự đóng một lớp khi bấm ra ngoài, nhưng đó là chuyện của
 * riêng lớp đó; không có ai giữ luật "mở cái này thì cái kia phải tắt".
 *
 * Sổ này giữ luật đó, và nằm ở tầng nguyên thuỷ (`DropdownMenu`, `Popover`)
 * nên mọi nơi trong app đều theo mà không phải sửa từng chỗ gọi.
 */
export type PopupLayerId = string;

interface OpenLayer {
  readonly ancestors: readonly PopupLayerId[];
  readonly close: () => void;
}

const openLayers = new Map<PopupLayerId, OpenLayer>();

/**
 * Ghi nhận một popup vừa mở, và đóng mọi popup không phải tổ tiên của nó.
 *
 * Tổ tiên phải được tha: bộ chọn ngày nằm bên trong bảng lọc, và đóng bảng lọc
 * ngay khi người dùng vừa bấm mở bộ chọn ngày trong đó thì cả hai cùng biến
 * mất. Quan hệ cha–con lấy từ context của React, nên vẫn đúng dù Radix đưa nội
 * dung popup ra `document.body` bằng portal.
 */
export function openPopupLayer(
  id: PopupLayerId,
  ancestors: readonly PopupLayerId[],
  close: () => void,
): void {
  for (const [otherId, layer] of [...openLayers]) {
    if (otherId === id || ancestors.includes(otherId)) continue;

    openLayers.delete(otherId);
    layer.close();
  }

  openLayers.set(id, { ancestors, close });
}

export function closePopupLayer(id: PopupLayerId): void {
  openLayers.delete(id);
}

export function openPopupLayerIds(): readonly PopupLayerId[] {
  return [...openLayers.keys()];
}

/** Dọn sổ giữa các lần chạy test. */
export function resetPopupLayers(): void {
  openLayers.clear();
}
