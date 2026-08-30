import { DRIVE_ROOT_PATH } from "@/config/app";
import { chainOf } from "@/lib/exported-routes";
import { findPathToId } from "@/lib/tree";
import { getActiveTree } from "@/store/workspace-store";

/**
 * Địa chỉ của một node SAU khi đổi tên.
 *
 * Slug đi theo tên, nên đổi tên là đổi cả URL: đứng yên tại chỗ cũ sẽ ra màn
 * hình "That path no longer exists" — người dùng vừa đổi tên xong thì board
 * biến mất dưới chân họ. Trả `null` khi node không còn trong cây, và khi đó
 * người gọi cứ đứng yên.
 */
export function hrefAfterRename(pathname: string, nodeId: string): string | null {
  const root = chainOf(pathname)?.root ?? DRIVE_ROOT_PATH;
  const path = findPathToId(getActiveTree(), nodeId);

  if (path.length === 0) return null;

  return `${root}/${path.map((node) => node.slug).join("/")}`;
}
