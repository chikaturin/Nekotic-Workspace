import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { CURRENT_USER } from "@/mock/users";
import { collabFake } from "../fake/collab.fake";
import type { Comment, EntityRef, WatchKind } from "@/types";

const url = (path: string) => `${API_BASE_URL}${path}`;

const fail = (status: number, code: string, message: string) =>
  HttpResponse.json(
    { error: { code, message, isRetryable: false } },
    { status },
  );

/**
 * Context `collab`.
 *
 * `POST /comments` là endpoint DUY NHẤT tạo ra thông báo cộng tác — fan-out
 * nằm trong `collabFake.addComment`. Nhờ vậy hộp thư không thể lệch với những
 * gì thật sự đã được nói.
 */
/** Bọc một mảng bình luận thành `CommentPageView` như backend thật. */
const page = (items: readonly Comment[]) => ({
  items,
  nextCursor: null,
  replyCountByRootId: Object.fromEntries(
    items.map((comment) => [comment.id, collabFake.replies(comment.id).length]),
  ),
});

export const collabHandlers = [
  // Ref đi rải thành query param, KHÔNG phải một chuỗi `targetKey`: backend thật
  // nhận `targetKind` + `targetNodeId` (+ `targetBoardId`/`targetRowId` cho row),
  // và trả về một TRANG chứ không phải mảng trần.
  http.get(url("/comments"), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const kind = params.get("targetKind") ?? "document";
    const nodeId = params.get("targetNodeId") ?? "";
    const rowId = params.get("targetRowId");

    const targetKey =
      kind === "row"
        ? `row:${params.get("targetBoardId") ?? nodeId}:${rowId ?? ""}`
        : `${kind}:${nodeId}`;

    return HttpResponse.json(page(collabFake.comments(targetKey)));
  }),

  http.get(url("/comments/:commentId/replies"), ({ params }) =>
    HttpResponse.json(page(collabFake.replies(params.commentId as string))),
  ),

  http.post(url("/comments"), async ({ request }) => {
    const body = (await request.json()) as {
      target: EntityRef;
      body: string;
      parentId?: string | null;
    };
    const result = collabFake.addComment(body);

    if ("invalid" in result) return fail(400, "validation", result.invalid);
    if ("missing" in result) {
      return fail(404, "not_found", "That comment could not be found");
    }

    return HttpResponse.json(result.comment);
  }),

  http.patch(url("/comments/:commentId"), async ({ params, request }) => {
    const { body } = (await request.json()) as { body: string };
    const result = collabFake.editComment(params.commentId as string, body);

    if ("forbidden" in result) {
      return fail(403, "permission_denied", result.forbidden);
    }
    if ("invalid" in result) return fail(400, "validation", result.invalid);
    if ("missing" in result) {
      return fail(404, "not_found", "That comment could not be found");
    }

    return HttpResponse.json(result.comment);
  }),

  http.get(url("/me/watches"), () =>
    HttpResponse.json(collabFake.watches(CURRENT_USER.id)),
  ),

  http.put(url("/me/watches"), async ({ request }) => {
    const body = (await request.json()) as {
      kind: WatchKind;
      targetId: string;
      ref?: EntityRef;
    };

    if (body.ref === undefined) {
      return fail(400, "validation", "A watch needs a target");
    }

    const result = collabFake.setWatch(body.ref, CURRENT_USER.id, true);

    return "invalid" in result
      ? fail(400, "validation", result.invalid)
      : HttpResponse.json(result.entries);
  }),

  http.delete(url("/me/watches"), async ({ request }) => {
    const body = (await request.json()) as { ref?: EntityRef };

    if (body.ref === undefined) {
      return fail(400, "validation", "A watch needs a target");
    }

    const result = collabFake.setWatch(body.ref, CURRENT_USER.id, false);

    return "invalid" in result
      ? fail(400, "validation", result.invalid)
      : HttpResponse.json(result.entries);
  }),

  http.get(url("/me/notifications"), () =>
    HttpResponse.json({
      items: collabFake.notifications(CURRENT_USER.id),
      nextCursor: null,
    }),
  ),

  http.get(url("/me/notifications/unread-count"), () =>
    HttpResponse.json({ unreadCount: collabFake.unreadCount(CURRENT_USER.id) }),
  ),

  http.post(url("/me/notifications/read"), async ({ request }) => {
    const { notificationIds } = (await request.json()) as {
      notificationIds: readonly string[];
    };

    collabFake.markRead(notificationIds, CURRENT_USER.id);

    return HttpResponse.json({
      items: collabFake.notifications(CURRENT_USER.id),
      nextCursor: null,
    });
  }),

  http.post(url("/me/notifications/read-all"), () => {
    collabFake.markAllRead(CURRENT_USER.id);

    return HttpResponse.json({
      items: collabFake.notifications(CURRENT_USER.id),
      nextCursor: null,
    });
  }),
];
