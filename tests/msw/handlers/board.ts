import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { DIRECTORY } from "@/mock/users";
import { appError, ServiceError, toAppError } from "@/services/errors";
import { boardFake, boardIdFor } from "../fake/board.fake";

const url = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Context `boards` — 44 endpoint, tất cả uỷ quyền cho `boardFake`.
 *
 * Fake vẫn ném `ServiceError` như hồi nó là service; `answer` dịch ngược chúng
 * thành envelope HTTP để client đi đúng con đường nó sẽ đi với backend thật —
 * kể cả đường lỗi, vốn là chỗ dễ lệch nhất.
 */
const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  validation: 400,
  permission_denied: 403,
  not_found: 404,
  conflict: 409,
};

async function answer(work: () => Promise<unknown>): Promise<Response> {
  try {
    const data = await work();

    return HttpResponse.json((data ?? null) as Record<string, unknown> | null);
  } catch (error: unknown) {
    const appError = toAppError(error);

    return HttpResponse.json(
      {
        error: {
          code: appError.code,
          message: appError.message,
          // `detail` là chỗ câu trả lời nói VÌ SAO — "cần vai trò Manager".
          // Bỏ nó đi thì UI chỉ còn "bạn không có quyền", và người dùng không
          // biết phải đi hỏi ai.
          detail: appError.detail,
          isRetryable: appError.isRetryable,
        },
      },
      { status: STATUS_BY_CODE[appError.code] ?? 400 },
    );
  }
}

/**
 * `nodeId` từ `boardId`.
 *
 * Fake định danh board bằng `brd_<nodeId>`; backend thật thì không, nhưng ở đây
 * điều đó không quan trọng — điều quan trọng là client CHỈ cầm `boardId` mà
 * server đã phát, và không bao giờ tự dựng nó.
 */
const nodeIdOf = (boardId: string): string =>
  boardId.startsWith("brd_") ? boardId.slice(4) : boardId;

export const boardHandlers = [
  // E-047 trả CẢ snapshot — board + trang bản ghi đầu + danh bạ — chứ không chỉ
  // định nghĩa board. Handler này từng trả mỗi `.board`, và vì thế bộ test offline
  // vẫn xanh trong khi màn board hỏng trên backend thật.
  http.get(url("/nodes/:nodeId/board"), ({ params }) =>
    answer(() => boardFake.getBoard(params.nodeId as string)),
  ),

  // E-048 trả MÔ TẢ NGẮN, không trả `Board`: không column, không view, không
  // record. Handler này từng dựng nguyên một board cho mỗi dòng — vừa sai hình
  // dạng (FE đọc `id`, backend gửi `boardId`), vừa seed toàn bộ record của mọi
  // board chỉ để đọc tên chúng.
  http.get(url("/workspaces/:workspaceId/boards"), () =>
    answer(() => boardFake.listBoards()),
  ),

  http.get(url("/boards/:boardId/rows"), ({ params }) =>
    answer(async () => {
      const snapshot = await boardFake.getBoard(
        nodeIdOf(params.boardId as string),
      );

      return {
        items: snapshot.rows,
        nextCursor: snapshot.nextCursor,
      };
    }),
  ),

  http.get(url("/boards/:boardId/rows/search"), ({ params, request }) =>
    answer(() =>
      boardFake.searchRows(
        params.boardId as string,
        new URL(request.url).searchParams.get("q") ?? "",
      ),
    ),
  ),

  http.post(url("/boards/:boardId/rows"), async ({ params, request }) => {
    const body = (await request.json()) as {
      cells?: never;
      afterRowId?: string | null;
      parentRowId?: string | null;
    };

    return answer(() =>
      boardFake.createRow({ boardId: params.boardId as string, ...body }),
    );
  }),

  // `edits` phẳng + `baseRevisions` theo HÀNG — đúng `UpdateCellsDto`. Vắng một
  // hàng trong `baseRevisions` nghĩa là không kiểm tra hàng đó, khác hẳn gửi 0.
  http.patch(url("/boards/:boardId/rows/cells"), async ({ params, request }) => {
    const { edits, baseRevisions } = (await request.json()) as {
      edits: readonly { rowId: string; columnId: string; value: never }[];
      baseRevisions?: Readonly<Record<string, number>>;
    };

    return answer(() =>
      boardFake.updateCells({
        boardId: params.boardId as string,
        edits,
        ...(baseRevisions === undefined ? {} : { baseRevisions }),
      }),
    );
  }),

  http.post(url("/boards/:boardId/rows/:rowId/duplicate"), ({ params }) =>
    answer(() =>
      boardFake.duplicateRow(params.boardId as string, params.rowId as string),
    ),
  ),

  http.delete(url("/boards/:boardId/rows/:rowId"), ({ params }) =>
    answer(async () => {
      await boardFake.deleteRow(
        params.boardId as string,
        params.rowId as string,
      );

      return null;
    }),
  ),

  http.put(url("/boards/:boardId/rows/:rowId/parent"), async ({ params, request }) => {
    const { parentRowId } = (await request.json()) as {
      parentRowId: string | null;
    };

    return answer(() =>
      boardFake.setRowParent(
        params.boardId as string,
        params.rowId as string,
        parentRowId,
      ),
    );
  }),

  http.get(url("/boards/:boardId/rows/:rowId/subtasks"), ({ params }) =>
    answer(() =>
      boardFake.listSubtasks(params.boardId as string, params.rowId as string),
    ),
  ),

  http.get(url("/boards/:boardId/rows/:rowId/activity"), ({ params }) =>
    answer(() =>
      boardFake.listActivity(params.boardId as string, params.rowId as string),
    ),
  ),

  http.get(url("/boards/:boardId/rows/:rowId/backlinks"), ({ params }) =>
    answer(() => boardFake.listBacklinks(params.rowId as string)),
  ),

  http.post(url("/boards/:boardId/rows/bulk/update"), async ({ params, request }) => {
    const { rowIds, cells } = (await request.json()) as {
      rowIds: string[];
      cells: never;
    };

    return answer(() =>
      boardFake.bulkUpdate({
        boardId: params.boardId as string,
        rowIds,
        values: cells,
      }),
    );
  }),

  http.post(url("/boards/:boardId/rows/bulk/archive"), async ({ params, request }) => {
    const { rowIds, isArchived } = (await request.json()) as {
      rowIds: string[];
      isArchived: boolean;
    };

    return answer(() =>
      boardFake.bulkArchive({
        boardId: params.boardId as string,
        rowIds,
        isArchived,
      }),
    );
  }),

  http.post(url("/boards/:boardId/rows/bulk/delete"), async ({ params, request }) => {
    const { rowIds } = (await request.json()) as { rowIds: string[] };

    return answer(() =>
      boardFake.bulkDelete({ boardId: params.boardId as string, rowIds }),
    );
  }),

  http.post(url("/boards/:boardId/rows/bulk/move"), async ({ params, request }) => {
    const { rowIds, targetBoardId } = (await request.json()) as {
      rowIds: string[];
      targetBoardId: string;
    };

    return answer(() =>
      boardFake.bulkMove({
        boardId: params.boardId as string,
        rowIds,
        targetNodeId: nodeIdOf(targetBoardId),
      }),
    );
  }),

  http.get(url("/boards/:boardId/columns"), ({ params }) =>
    answer(
      async () =>
        (await boardFake.getBoard(nodeIdOf(params.boardId as string))).board
          .columns,
    ),
  ),

  http.post(url("/boards/:boardId/columns"), async ({ params, request }) => {
    const { type, name, atIndex, config } = (await request.json()) as {
      type: never;
      name: string;
      atIndex?: number;
      config?: never;
    };

    return answer(() =>
      boardFake.createColumn(params.boardId as string, type, name, atIndex, config),
    );
  }),

  http.patch(
    url("/boards/:boardId/columns/:columnId"),
    async ({ params, request }) => {
      const patch = (await request.json()) as never;

      return answer(() =>
        boardFake.updateColumn(
          params.boardId as string,
          params.columnId as string,
          patch,
        ),
      );
    },
  ),

  http.delete(url("/boards/:boardId/columns/:columnId"), ({ params }) =>
    answer(() =>
      boardFake.deleteColumn(
        params.boardId as string,
        params.columnId as string,
      ),
    ),
  ),

  http.post(url("/boards/:boardId/columns/:columnId/duplicate"), ({ params }) =>
    answer(
      async () =>
        (
          await boardFake.duplicateColumn(
            params.boardId as string,
            params.columnId as string,
          )
        ).column,
    ),
  ),

  http.post(url("/boards/:boardId/columns/:columnId/convert"), async ({ params, request }) => {
    const { type } = (await request.json()) as { type: never };

    return answer(async () => {
      const result = await boardFake.convertColumn(
        params.boardId as string,
        params.columnId as string,
        type,
      );

      return { column: result.column, affectedRows: result.preserved };
    });
  }),

  http.post(url("/boards/:boardId/columns/reorder"), async ({ params, request }) => {
    const { columnIds } = (await request.json()) as { columnIds: string[] };

    return answer(async () => {
      const snapshot = await boardFake.getBoard(
        nodeIdOf(params.boardId as string),
      );
      const byId = new Map(
        snapshot.board.columns.map((column) => [column.id, column] as const),
      );

      // Gửi TRỌN thứ tự: fake vẫn nghĩ theo "chuyển cái này tới chỗ kia", nên
      // ở đây thứ tự mong muốn được áp bằng một lần sắp xếp lại.
      for (const [index, columnId] of columnIds.entries()) {
        await boardFake.reorderColumn(params.boardId as string, columnId, index);
      }

      return columnIds
        .map((columnId) => byId.get(columnId))
        .filter((column) => column !== undefined);
    });
  }),

  http.post(url("/boards/:boardId/columns/:columnId/options"), async ({ params, request }) => {
    const { label, color } = (await request.json()) as {
      label: string;
      color: never;
    };

    return answer(async () => {
      await boardFake.createSelectOption(
        params.boardId as string,
        params.columnId as string,
        label,
        color,
      );

      const snapshot = await boardFake.getBoard(
        nodeIdOf(params.boardId as string),
      );

      return snapshot.board.columns.find(
        (column) => column.id === params.columnId,
      );
    });
  }),

  http.get(url("/boards/:boardId/views"), ({ params }) =>
    answer(
      async () =>
        (await boardFake.getBoard(nodeIdOf(params.boardId as string))).board
          .views,
    ),
  ),

  http.post(url("/boards/:boardId/views"), async ({ params, request }) => {
    const input = (await request.json()) as never;

    return answer(() => boardFake.createView(params.boardId as string, input));
  }),

  http.patch(
    url("/boards/:boardId/views/:viewId"),
    async ({ params, request }) => {
      const patch = (await request.json()) as never;

      return answer(() =>
        boardFake.updateView(
          params.boardId as string,
          params.viewId as string,
          patch,
        ),
      );
    },
  ),

  http.delete(url("/boards/:boardId/views/:viewId"), ({ params }) =>
    answer(() =>
      boardFake.deleteView(params.boardId as string, params.viewId as string),
    ),
  ),

  http.post(url("/boards/:boardId/views/reorder"), async ({ params, request }) => {
    const { viewIds } = (await request.json()) as { viewIds: string[] };

    return answer(async () => {
      for (const [index, viewId] of viewIds.entries()) {
        await boardFake.reorderView(params.boardId as string, viewId, index);
      }

      return (await boardFake.getBoard(nodeIdOf(params.boardId as string)))
        .board.views;
    });
  }),

  // E-085 là `multipart/form-data`: `file` là bảng tính, `request` là chuỗi JSON
  // mang phần còn lại. Handler này từng đọc `request.json()` và lấy ra `rows` —
  // hình dạng mà backend thật chưa bao giờ nhận.
  http.post(url("/boards/:boardId/import"), async ({ params, request }) => {
    const form = await request.formData();
    const file = form.get("file");
    const payload = JSON.parse(String(form.get("request") ?? "{}")) as {
      mappings: never[];
      invalidPolicy?: never;
      removeColumnIds?: readonly string[];
      hasHeaderRow?: boolean;
    };

    return answer(async () => {
      if (!(file instanceof File)) {
        throw new ServiceError(
          appError("validation", 'Attach a .csv or .xlsx file in the "file" field.'),
        );
      }

      return boardFake.importRows({
        boardId: params.boardId as string,
        file,
        mappings: payload.mappings,
        invalidPolicy: payload.invalidPolicy ?? "skip",
        ...(payload.removeColumnIds === undefined
          ? {}
          : { removeColumnIds: payload.removeColumnIds }),
        ...(payload.hasHeaderRow === undefined
          ? {}
          : { hasHeaderRow: payload.hasHeaderRow }),
      });
    });
  }),

  http.get(url("/boards/:boardId/relation-index"), ({ params, request }) =>
    answer(() =>
      boardFake.relationIndex(
        params.boardId as string,
        // `ids` rỗng → không giải gì. Đúng như backend: endpoint này GIẢI id
        // được hỏi, nó không liệt kê board.
        (new URL(request.url).searchParams.get("ids") ?? "")
          .split(",")
          .filter((id) => id.length > 0),
      ),
    ),
  ),

  http.get(url("/workspaces/:workspaceId/directory"), () =>
    HttpResponse.json(DIRECTORY),
  ),
];

export { boardIdFor };
