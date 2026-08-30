/**
 * Phím này có phải là phím ĐANG GHÉP CHỮ của bộ gõ không.
 *
 * Bộ gõ tiếng Việt (Telex, VNI) và mọi IME khác ghép nhiều phím thành một chữ.
 * Bấm Enter lúc còn đang ghép sẽ bắn `keydown` để CHỐT chữ đang ghép, rồi bắn
 * tiếp một `keydown` nữa cho chính phím Enter. Handler chạy hai lần trên cùng
 * một cú bấm — đủ để gửi đi một bình luận mà người viết còn chưa gõ xong.
 *
 * Người gõ tiếng Anh không bao giờ gặp, và trình duyệt tự động hoá cũng không —
 * nó bắn phím thẳng, không qua bộ gõ. Nên lỗi này chỉ hiện ra với người dùng
 * thật, và chỉ với người gõ tiếng Việt.
 *
 * `keyCode === 229` là cách các trình duyệt cũ (và Safari) báo cùng một việc.
 */
export function isComposingKey(event: {
  readonly isComposing?: boolean;
  readonly keyCode?: number;
}): boolean {
  return event.isComposing === true || event.keyCode === 229;
}
