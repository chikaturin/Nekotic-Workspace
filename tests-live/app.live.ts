import { beforeAll, describe, expect, test } from "vitest";

import { installCookieJar } from "./cookie-jar";

installCookieJar();

import { refKey } from "@/lib/entity-ref";
import { authService } from "@/services/auth-service";
import { boardService } from "@/services/board-service";
import {
  boardApi,
  boardRowsApi,
  boardViewsApi,
  collabApi,
  devtoolsApi,
  documentApi,
  driveApi,
  governanceApi,
  insightsApi,
  workspaceApi,
} from "@/services/api";

/**
 * Phần còn lại của app, cũng chạy SỐNG: tài liệu, board, bình luận, thông báo,
 * tìm kiếm, dashboard, devtools, audit.
 *
 * `flow.live.ts` lo đường xương sống (đăng nhập → drive → upload). File này lo
 * bề rộng: mỗi context ít nhất một lần ghi và một lần đọc lại, vì một endpoint
 * chỉ đọc thì không chứng minh được là dữ liệu đã tới đúng chỗ.
 */

const RUN = Date.now().toString(36);
const EMAIL = `app_${RUN}@nekotic.test`;
const PASSWORD = "Live-Passw0rd!";

const ctx = {
  workspaceId: "",
  documentId: "",
  boardId: "",
  boardNodeId: "",
  configNodeId: "",
};

beforeAll(async () => {
  await authService.register({ email: EMAIL, password: PASSWORD, name: `App ${RUN}` });
  await authService.login({ email: EMAIL, password: PASSWORD });

  const workspace = await workspaceApi.create({ name: `App ${RUN}` });
  ctx.workspaceId = workspace.id;

  const [document, board, config] = await Promise.all([
    driveApi.create(workspace.id, { kind: "document", name: "Sổ tay", parentId: null }),
    driveApi.create(workspace.id, { kind: "board", name: "Roadmap", parentId: null }),
    driveApi.create(workspace.id, {
      kind: "document",
      name: "Cấu hình",
      parentId: null,
      documentKind: "config",
    }),
  ]);

  ctx.documentId = document.id;
  ctx.boardNodeId = board.id;
  ctx.configNodeId = config.id;
});

describe("tài liệu", () => {
  test("lưu block rồi đọc lại đúng nội dung", async () => {
    const before = await documentApi.get(ctx.documentId);

    const saved = await documentApi.save(ctx.documentId, {
      title: "Sổ tay",
      icon: "📓",
      blocks: [
        { id: "b1", type: "heading2", text: "Mục tiêu quý 3" },
        { id: "b2", type: "paragraph", text: "Đóng xong phần nối API." },
      ] as never,
      expectedVersion: before.version,
    });

    expect(saved.blocks).toHaveLength(2);
    expect(saved.version).toBeGreaterThan(before.version);

    const reread = await documentApi.get(ctx.documentId);
    expect(reread.blocks[0]).toMatchObject({ text: "Mục tiêu quý 3" });
  });

  test("lưu với version cũ bị từ chối, không đè lên người khác", async () => {
    const current = await documentApi.get(ctx.documentId);

    await expect(
      documentApi.save(ctx.documentId, {
        title: "Ghi đè",
        icon: "📓",
        blocks: [] as never,
        expectedVersion: current.version - 1,
      }),
    ).rejects.toThrow();

    // Và bản trên server KHÔNG bị đụng tới.
    const after = await documentApi.get(ctx.documentId);
    expect(after.title).toBe("Sổ tay");
  });

  test("mỗi lần lưu là một phiên bản khôi phục được", async () => {
    const page = await documentApi.versions(ctx.documentId);
    expect(page.items.length).toBeGreaterThan(0);

    const restored = await documentApi.restoreVersion(
      ctx.documentId,
      page.items.at(-1)!.id,
    );
    expect(restored).toBeTruthy();
  });

  test("ghim là cờ có hai động từ idempotent", async () => {
    const pinned = await documentApi.pin(ctx.documentId, true);
    expect(pinned.isPinned).toBe(true);

    const unpinned = await documentApi.pin(ctx.documentId, false);
    expect(unpinned.isPinned).toBe(false);
  });
});

describe("board", () => {
  test("một request là đủ để vẽ cả board — không phải ba", async () => {
    const snapshot = await boardApi.byNode(ctx.boardNodeId);
    ctx.boardId = snapshot.board.id;

    // E-047 gộp sẵn: định nghĩa board + trang bản ghi đầu + danh bạ người dùng.
    // Đây chính là chỗ FE từng đọc sai vỏ response và làm hỏng cả màn board.
    expect(snapshot.board.id).toBeTruthy();
    expect(snapshot.board.columns.length).toBeGreaterThan(0);
    expect(Array.isArray(snapshot.rows)).toBe(true);
    expect(Array.isArray(snapshot.people)).toBe(true);
  });

  test("board mới đã có cột chính và đủ bốn tab, Table đứng đầu", async () => {
    const columns = await boardApi.columns(ctx.boardId);
    expect(columns.some((column) => column.isPrimary)).toBe(true);

    // Dải tab người dùng nhìn thấy CHÍNH LÀ danh sách này, theo đúng thứ tự.
    const views = await boardViewsApi.list(ctx.boardId);

    expect(views.map((view) => view.type)).toEqual([
      "table",
      "kanban",
      "calendar",
      "gantt",
    ]);
  });

  test("danh sách board của workspace trả đúng hình dạng picker cần", async () => {
    // E-048 KHÔNG trả `Board`: nó trả `boardId`, không có `id`, và không kèm
    // column hay view. FE từng khai nó là `Board[]`, nên `board.id` về
    // `undefined` — id đó đi thẳng vào hàm dựng DOM id và picker board kéo sập
    // cả trang. Không có test nào bắt được, vì không bộ nào từng gọi endpoint
    // này.
    const boards = await boardApi.list(ctx.workspaceId);
    const [first] = boards;

    expect(boards.length).toBeGreaterThan(0);
    expect(first?.boardId).toBeTruthy();
    expect(first?.nodeId).toBeTruthy();
    expect(first?.name).toBeTruthy();
    // Mã hiển thị của board — picker dùng nó để phân biệt hai board trùng tên.
    expect(first?.rowIdPrefix).toBeTruthy();
  });

  test("tab Kanban ra đời đã biết nhóm theo cột nào", async () => {
    // Không thì mở nó ra chỉ thấy một panel hỏi "chọn cột để nhóm".
    const [columns, views] = await Promise.all([
      boardApi.columns(ctx.boardId),
      boardViewsApi.list(ctx.boardId),
    ]);

    const kanban = views.find((view) => view.type === "kanban");
    const status = columns.find((column) => column.name === "Status");

    expect(kanban?.groupByColumnId).toBe(status?.id);
  });

  test("import nhận FILE thật, và ghi đủ dòng", async () => {
    // Endpoint là `multipart/form-data` (E-085). FE từng POST `{rows: [...]}`
    // dưới dạng JSON và luôn ăn 400 — nút Import chưa từng chạy được lần nào,
    // và không bộ test nào bắt được vì chưa bộ nào gọi endpoint này.
    const columns = await boardApi.columns(ctx.boardId);
    const primary = columns.find((column) => column.isPrimary)!;
    const before = (await boardRowsApi.list(ctx.boardId, {})).items.length;

    const outcome = await boardService.importRows({
      boardId: ctx.boardId,
      file: new File(
        ["Name\nNhập một\nNhập hai\n"],
        "import.csv",
        { type: "text/csv" },
      ),
      mappings: [{ sourceIndex: 0, target: { kind: "existing", columnId: primary.id } }],
      invalidPolicy: "skip",
    });

    expect(outcome.created).toBe(2);
    expect(outcome.rowIds).toHaveLength(2);

    const after = await boardRowsApi.list(ctx.boardId, {});
    expect(after.items.length).toBe(before + 2);

    const titles = after.items
      .filter((row) => outcome.rowIds.includes(row.id))
      .map((row) => {
        const cell = row.cells[primary.id];
        return cell?.kind === "text" ? cell.value : null;
      });

    expect(titles).toEqual(["Nhập một", "Nhập hai"]);
  });

  test("import dựng luôn cột mà file yêu cầu", async () => {
    const outcome = await boardService.importRows({
      boardId: ctx.boardId,
      file: new File(["Nguồn\nGoogle\n"], "src.csv", { type: "text/csv" }),
      mappings: [
        { sourceIndex: 0, target: { kind: "create", name: "Nguồn", type: "text" } },
      ],
      invalidPolicy: "skip",
    });

    expect(outcome.created).toBe(1);

    const columns = await boardApi.columns(ctx.boardId);
    expect(columns.some((column) => column.name === "Nguồn")).toBe(true);
  });

  test("server cấp displayId — client không tự đặt", async () => {
    const first = await boardRowsApi.create(ctx.boardId, {});
    const second = await boardRowsApi.create(ctx.boardId, {});

    expect(first.displayId).toBeTruthy();
    expect(second.displayId).not.toBe(first.displayId);
  });

  test("bỏ trống baseRevisions nghĩa là KHÔNG kiểm tra, không phải revision 0", async () => {
    const row = await boardRowsApi.create(ctx.boardId, {});
    const columns = await boardApi.columns(ctx.boardId);
    const column = columns.find((c) => c.type === "text") ?? columns[0]!;

    const result = await boardRowsApi.updateCells(ctx.boardId, [
      { rowId: row.id, columnId: column.id, value: { kind: "text", value: "Nối API" } },
    ]);

    expect(result.rows).toHaveLength(1);
    // `conflicts` PHẢI có mặt kể cả khi rỗng: UI đọc nó vô điều kiện.
    expect(result.conflicts).toEqual([]);
  });

  test("revision cũ thành conflict chứ không làm hỏng cả batch", async () => {
    const row = await boardRowsApi.create(ctx.boardId, {});
    const columns = await boardApi.columns(ctx.boardId);
    const column = columns.find((c) => c.type === "text") ?? columns[0]!;

    const edit = (value: string) => ({
      rowId: row.id,
      columnId: column.id,
      value: { kind: "text", value } as const,
    });

    const first = await boardRowsApi.updateCells(
      ctx.boardId,
      [edit("lần một")],
      { [row.id]: row.revision },
    );
    expect(first.conflicts).toEqual([]);

    // Gửi lại ĐÚNG revision cũ — người khác đã ghi đè trong lúc đó.
    const stale = await boardRowsApi.updateCells(
      ctx.boardId,
      [edit("lần hai")],
      { [row.id]: row.revision },
    );

    expect(stale.conflicts.length).toBeGreaterThan(0);
    // Và hàng trên server vẫn giữ giá trị của lần ghi hợp lệ.
    const reread = await boardRowsApi.get(ctx.boardId, row.id);
    expect(JSON.stringify(reread.cells)).toContain("lần một");
  });

  test("subtask là bản ghi đầy đủ, không phải một cờ trên hàng cha", async () => {
    const parent = await boardRowsApi.create(ctx.boardId, {});
    const child = await boardRowsApi.create(ctx.boardId, {
      parentRowId: parent.id,
    });

    expect(child.parentRowId).toBe(parent.id);
    expect(child.displayId).toBeTruthy();

    const subtasks = await boardRowsApi.subtasks(ctx.boardId, parent.id);
    expect(subtasks.some((r) => r.id === child.id)).toBe(true);
  });

  test("thao tác hàng loạt nói rõ đã làm bao nhiêu và bỏ qua bao nhiêu", async () => {
    const page = await boardRowsApi.list(ctx.boardId);
    const ids = page.items.slice(0, 2).map((row) => row.id);

    const result = await boardRowsApi.bulkArchive(ctx.boardId, ids, true);

    // `requested` vs `skipped`: UI cần phân biệt "xong 2/2" với "xong 1, bỏ 1".
    expect(result.requested).toBe(ids.length);
    expect(result).toHaveProperty("skipped");
  });

  test("view lưu được cấu hình riêng", async () => {
    const view = await boardViewsApi.create(ctx.boardId, {
      name: "Của tôi",
      type: "table",
    } as never);

    expect(view.name).toBe("Của tôi");

    const listed = await boardViewsApi.list(ctx.boardId);
    expect(listed.some((v) => v.id === view.id)).toBe(true);
  });
});

describe("bình luận và thông báo", () => {
  const docRef = () =>
    ({ kind: "document", nodeId: ctx.documentId, label: "Sổ tay" }) as const;

  test("bình luận vào tài liệu rồi đọc lại", async () => {
    const comment = await collabApi.createComment({
      target: docRef(),
      body: "Chốt phần này nhé",
    });

    expect(comment.id).toBeTruthy();
    // Server tự dựng `targetKey` từ `target` — client không gửi nó lên.
    expect(comment.targetKey).toBe(refKey(docRef()));

    const thread = await collabApi.comments(docRef());
    expect(thread.items.some((entry) => entry.id === comment.id)).toBe(true);
  });

  test("nhắc tên ai đó thì server tự tách ra, không phải client", async () => {
    const comment = await collabApi.createComment({
      target: docRef(),
      body: "Nhờ @[Probe](usr_unknown) xem hộ",
    });

    // Kể cả khi không khớp người nào, trường vẫn phải có mặt để UI đọc.
    expect(Array.isArray(comment.mentionedUserIds)).toBe(true);
  });

  test("giải quyết một bình luận là đổi trạng thái, không phải xoá", async () => {
    const thread = await collabApi.comments(docRef());
    const target = thread.items[0]!;

    await collabApi.resolveComment(target.id, true);

    const after = await collabApi.comments(docRef());
    // Vẫn còn trong luồng — giải quyết KHÔNG được làm mất nội dung.
    expect(after.items.some((entry) => entry.id === target.id)).toBe(true);
  });

  test("theo dõi một node bật rồi tắt được", async () => {
    const watching = await collabApi.setWatch(docRef(), true);
    expect(watching.some((w) => w.targetKey === refKey(docRef()))).toBe(true);

    const stopped = await collabApi.setWatch(docRef(), false);
    expect(stopped.some((w) => w.targetKey === refKey(docRef()))).toBe(false);
  });

  test("số chưa đọc là con số server tính, không phải client đếm", async () => {
    // Chỗ này từng sai: FE đọc `.count` trong khi backend trả `unreadCount`,
    // nên huy hiệu trên sidebar luôn là `undefined`.
    const { unreadCount } = await collabApi.unreadCount();
    expect(typeof unreadCount).toBe("number");

    const page = await collabApi.notifications();
    expect(Array.isArray(page.items)).toBe(true);
  });
});

describe("tìm kiếm và dashboard", () => {
  test("tìm được tài liệu vừa tạo, và server là bên chấm điểm", async () => {
    const groups = await insightsApi.search(ctx.workspaceId, "Sổ tay");

    const hits = groups.flatMap((group) => group.results);
    expect(hits.length).toBeGreaterThan(0);
    // `score` do backend tính; gộp và xếp hạng ở client sẽ ra thứ tự khác.
    expect(typeof hits[0]!.score).toBe("number");
  });

  test("dashboard do server tổng hợp, không phải client gộp", async () => {
    const dashboard = await insightsApi.dashboard(ctx.workspaceId);

    expect(dashboard.widgets.length).toBeGreaterThan(0);
    // Mỗi widget tự mang tổng của nó — client không cộng lại từ các bucket.
    expect(typeof dashboard.widgets[0]!.total).toBe("number");
  });

  test("id widget của dashboard ĐÚNG như FE tra bảng icon", async () => {
    // FE tra icon bằng `widget.id`. Trượt một lần là `undefined` rơi vào một
    // thẻ JSX và cả trang chết với "Element type is invalid" — đúng chuyện đã
    // xảy ra khi FE viết `task`/`deadline` số ít còn server gửi số nhiều.
    const dashboard = await insightsApi.dashboard(ctx.workspaceId);

    expect(dashboard.widgets.map((widget) => widget.id)).toEqual([
      "tasks",
      "qa",
      "deadlines",
    ]);
  });

  test("id bucket cũng vậy — màu và nhãn đi theo nó", async () => {
    const dashboard = await insightsApi.dashboard(ctx.workspaceId);
    const byId = new Map(dashboard.widgets.map((widget) => [widget.id, widget]));

    expect(byId.get("tasks")?.buckets.map((bucket) => bucket.id)).toEqual([
      "todo",
      "inProgress",
      "blocked",
      "done",
    ]);
    expect(byId.get("deadlines")?.buckets.map((bucket) => bucket.id)).toEqual([
      "overdue",
      "today",
      "thisWeek",
      "later",
      "none",
    ]);
  });

  test("my-work gom việc của chính người đang đăng nhập", async () => {
    const widgets = await insightsApi.myWork(ctx.workspaceId);
    expect(Array.isArray(widgets)).toBe(true);
  });

  test("id widget của my-work cũng phải khớp bảng icon", async () => {
    const widgets = await insightsApi.myWork(ctx.workspaceId);

    expect(widgets.map((widget) => widget.id)).toEqual([
      "overdue",
      "dueToday",
      "dueThisWeek",
      "unscheduled",
    ]);
  });
});

describe("devtools", () => {
  test("lưu config rồi đọc lại", async () => {
    const saved = await devtoolsApi.saveConfig(ctx.configNodeId, {
      format: "env",
      content: "API_URL=http://localhost:1133\n",
    } as never);

    expect(saved).toBeTruthy();

    const config = await devtoolsApi.config(ctx.configNodeId);
    expect(config.content).toContain("API_URL");
  });

  test("mỗi lần lưu config để lại một phiên bản khôi phục được", async () => {
    await devtoolsApi.saveConfig(ctx.configNodeId, {
      format: "env",
      content: "API_URL=http://localhost:1133\nDEBUG=1\n",
    } as never);

    const versions = await devtoolsApi.configVersions(ctx.configNodeId);
    expect(versions.length).toBeGreaterThanOrEqual(2);

    const restored = await devtoolsApi.restoreConfigVersion(
      ctx.configNodeId,
      versions.at(-1)!.id,
    );
    // Khôi phục đi qua đúng đường lưu, nên nó CŨNG được audit.
    expect(restored).toBeTruthy();
  });

  test("environment tạo và liệt kê được", async () => {
    const created = await devtoolsApi.createEnvironment(ctx.workspaceId, {
      label: `staging-${RUN}`,
      color: "amber",
    });

    // `label`, không phải `name` — và server cấp `position`.
    expect(created.label).toContain("staging");
    expect(typeof created.position).toBe("number");

    const all = await devtoolsApi.environments(ctx.workspaceId);
    expect(all.some((e) => e.id === created.id)).toBe(true);
  });
});

describe("nhật ký kiểm toán", () => {
  test("những việc vừa làm đã nằm trong nhật ký — do server ghi", async () => {
    const page = await governanceApi.page(ctx.workspaceId, {});

    expect(page.events.length).toBeGreaterThan(0);
    expect(page.total).toBeGreaterThan(0);
  });

  test("xuất CSV trả về BYTES để tải về, không phải JSON", async () => {
    const blob = await governanceApi.exportCsv(ctx.workspaceId, {});

    // `Blob` chứ không phải chuỗi: nó đi thẳng cho trình duyệt tải xuống.
    expect(blob).toBeInstanceOf(Blob);

    const text = await blob.text();
    expect(text.split("\n")[0]).toContain(",");
  });
});
