import { beforeAll, describe, expect, test } from "vitest";

import { installCookieJar } from "./cookie-jar";

installCookieJar();

import { authService } from "@/services/auth-service";
import {
  boardApi,
  boardRowsApi,
  driveApi,
  workspaceApi,
} from "@/services/api";

/**
 * Cross-board relation, chạy thật với backend trong Docker.
 *
 * Đây là bộ duy nhất trả lời được câu hỏi thật sự quan trọng của PHẦN A: liên
 * kết có SỐNG QUA refresh không, và backlink có tự có mà không phải tạo lần hai
 * không. Một bộ test trên MSW chỉ chứng minh handler do chính tui viết chịu
 * nhận cái tui gửi.
 *
 * Dựng đúng thư mục trong đề bài:
 *
 *   Payment
 *   ├── QA / QC
 *   └── Bug
 */

const RUN = Date.now().toString(36);
const EMAIL = `rel_${RUN}@nekotic.test`;
const PASSWORD = "Live-Passw0rd!";

const ctx = {
  workspaceId: "",
  folderId: "",
  qaBoardId: "",
  qaNodeId: "",
  bugBoardId: "",
  bugNodeId: "",
  relationColumnId: "",
  qaRows: [] as string[],
  bugRowId: "",
};

beforeAll(async () => {
  await authService.register({ email: EMAIL, password: PASSWORD, name: `Rel ${RUN}` });
  await authService.login({ email: EMAIL, password: PASSWORD });

  const workspace = await workspaceApi.create({ name: `Rel ${RUN}` });
  ctx.workspaceId = workspace.id;

  const folder = await driveApi.create(workspace.id, {
    kind: "folder",
    name: "Payment",
    parentId: null,
  });
  ctx.folderId = folder.id;

  const [qa, bug] = await Promise.all([
    driveApi.create(workspace.id, {
      kind: "board",
      name: "QA / QC",
      parentId: folder.id,
    }),
    driveApi.create(workspace.id, {
      kind: "board",
      name: "Bug",
      parentId: folder.id,
    }),
  ]);

  ctx.qaNodeId = qa!.id;
  ctx.bugNodeId = bug!.id;

  const [qaSnapshot, bugSnapshot] = await Promise.all([
    boardApi.byNode(qa!.id),
    boardApi.byNode(bug!.id),
  ]);

  ctx.qaBoardId = qaSnapshot.board.id;
  ctx.bugBoardId = bugSnapshot.board.id;

  // Ba ca QA, đúng như ví dụ.
  for (const name of ["Payment success", "Payment timeout", "Retry callback"]) {
    const row = await boardRowsApi.create(ctx.qaBoardId, {});
    const primary = qaSnapshot.board.primaryColumnId;

    await boardRowsApi.updateCells(ctx.qaBoardId, [
      { rowId: row.id, columnId: primary, value: { kind: "text", value: name } },
    ]);

    ctx.qaRows.push(row.id);
  }

  const bugRow = await boardRowsApi.create(ctx.bugBoardId, {});
  ctx.bugRowId = bugRow.id;
});

describe("tạo Relation Column trỏ sang board khác", () => {
  test("board đích lưu bằng ID, không phải tên", async () => {
    const column = await boardApi.addColumn(ctx.bugBoardId, {
      name: "Related QA/QC",
      type: "relation",
      config: { boardId: ctx.qaBoardId, displayColumnId: null, isMulti: true },
    });

    ctx.relationColumnId = column.id;

    expect(column.type).toBe("relation");

    // A18: đổi tên board không được phá liên kết, nên cấu hình phải giữ ID.
    if (column.type === "relation") {
      expect(column.config.boardId).toBe(ctx.qaBoardId);
    }
  });

  test("đổi tên board đích KHÔNG động tới cấu hình cột", async () => {
    await driveApi.update(ctx.qaNodeId, { name: "Kiểm thử" });

    const columns = await boardApi.columns(ctx.bugBoardId);
    const relation = columns.find((column) => column.id === ctx.relationColumnId);

    expect(relation?.type).toBe("relation");
    if (relation?.type === "relation") {
      expect(relation.config.boardId).toBe(ctx.qaBoardId);
    }
  });
});

describe("liên kết BUG-001 → QA", () => {
  test("chọn hai ca QA và lưu được", async () => {
    const [qa1, , qa3] = ctx.qaRows;

    const result = await boardRowsApi.updateCells(ctx.bugBoardId, [
      {
        rowId: ctx.bugRowId,
        columnId: ctx.relationColumnId,
        value: { kind: "relation", rowIds: [qa1!, qa3!] },
      },
    ]);

    expect(result.conflicts).toEqual([]);
    const saved = result.rows[0]?.cells[ctx.relationColumnId];
    expect(saved?.kind).toBe("relation");
  });

  test("liên kết SỐNG QUA refresh — đọc lại từ server", async () => {
    // TEST 3: đây là khác biệt giữa "UI có hiện" và "đã lưu thật".
    const row = await boardRowsApi.get(ctx.bugBoardId, ctx.bugRowId);
    const cell = row.cells[ctx.relationColumnId];

    expect(cell?.kind).toBe("relation");
    if (cell?.kind === "relation") {
      expect(cell.rowIds).toEqual([ctx.qaRows[0], ctx.qaRows[2]]);
    }
  });

  test("relation-index giải id thành mã và tiêu đề, kèm tên board", async () => {
    const targets = await boardApi.relationIndex(ctx.bugBoardId, ctx.qaRows.slice(0, 1));
    const [first] = targets;

    expect(first?.rowId).toBe(ctx.qaRows[0]);
    expect(first?.displayId).toBeTruthy();
    expect(first?.boardId).toBe(ctx.qaBoardId);
  });

  test("chọn lại đúng ca đó KHÔNG tạo liên kết trùng", async () => {
    // A11: `rowIds` là tập hợp có thứ tự; gửi trùng thì server chỉ giữ một.
    const [qa1, , qa3] = ctx.qaRows;

    await boardRowsApi.updateCells(ctx.bugBoardId, [
      {
        rowId: ctx.bugRowId,
        columnId: ctx.relationColumnId,
        value: { kind: "relation", rowIds: [qa1!, qa3!, qa1!] },
      },
    ]);

    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, qa1!);
    const fromThisBug = backlinks.filter((link) => link.rowId === ctx.bugRowId);

    expect(fromThisBug).toHaveLength(1);
  });
});

describe("backlink tự có, không cần tạo lần hai", () => {
  test("QA-001 thấy BUG-001 đang trỏ tới mình", async () => {
    // TEST 4. Người dùng chỉ khai một chiều; chiều còn lại là việc của server.
    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, ctx.qaRows[0]!);
    const [link] = backlinks;

    expect(link?.rowId).toBe(ctx.bugRowId);
    expect(link?.boardId).toBe(ctx.bugBoardId);
    expect(link?.columnName).toBe("Related QA/QC");
  });

  test("QA-003 cũng vậy", async () => {
    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, ctx.qaRows[2]!);

    expect(backlinks.some((link) => link.rowId === ctx.bugRowId)).toBe(true);
  });

  test("ca QA KHÔNG được chọn thì không có backlink nào", async () => {
    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, ctx.qaRows[1]!);

    expect(backlinks).toEqual([]);
  });
});

describe("gỡ liên kết", () => {
  test("bỏ QA-003 ở Bug thì backlink bên QA cũng mất", async () => {
    // A12: không được để lại backlink mồ côi.
    await boardRowsApi.updateCells(ctx.bugBoardId, [
      {
        rowId: ctx.bugRowId,
        columnId: ctx.relationColumnId,
        value: { kind: "relation", rowIds: [ctx.qaRows[0]!] },
      },
    ]);

    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, ctx.qaRows[2]!);

    expect(backlinks).toEqual([]);
  });

  test("QA-001 vẫn còn liên kết — chỉ cái bị gỡ mới mất", async () => {
    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, ctx.qaRows[0]!);

    expect(backlinks.some((link) => link.rowId === ctx.bugRowId)).toBe(true);
  });
});

describe("Fill Handle ghi hàng loạt qua MỘT request", () => {
  test("chép relation sang nhiều Bug và tạo backlink cho từng cái", async () => {
    // C1: kéo fill trên cột relation phải tạo THAM CHIẾU thật, không phải chép
    // chữ. Đây đúng là payload mà `planFill` sinh ra.
    const extraBugs = await Promise.all([
      boardRowsApi.create(ctx.bugBoardId, {}),
      boardRowsApi.create(ctx.bugBoardId, {}),
      boardRowsApi.create(ctx.bugBoardId, {}),
    ]);

    const result = await boardRowsApi.updateCells(
      ctx.bugBoardId,
      extraBugs.map((row) => ({
        rowId: row.id,
        columnId: ctx.relationColumnId,
        value: { kind: "relation" as const, rowIds: [ctx.qaRows[0]!] },
      })),
    );

    expect(result.rows).toHaveLength(3);
    expect(result.conflicts).toEqual([]);

    const backlinks = await boardRowsApi.backlinks(ctx.qaBoardId, ctx.qaRows[0]!);

    // Bug gốc + ba Bug vừa điền.
    expect(backlinks.length).toBeGreaterThanOrEqual(4);
  });
});

describe("bản ghi đích bị xoá", () => {
  test("xoá QA-001 không làm hỏng ô relation bên Bug", async () => {
    // A16: đọc lại phải chạy được, không ném.
    await boardRowsApi.remove(ctx.qaBoardId, ctx.qaRows[0]!);

    const row = await boardRowsApi.get(ctx.bugBoardId, ctx.bugRowId);

    expect(row.id).toBe(ctx.bugRowId);

    // Id đã chết không giải được nữa — UI vẽ `[Deleted Item]` từ chỗ này.
    const targets = await boardApi.relationIndex(ctx.bugBoardId, [ctx.qaRows[0]!]);
    expect(targets).toEqual([]);
  });
});
