import { hydrate, type NodeSpec } from "@/mock/factory";
import type { DriveNode, TrashEntry, Workspace } from "@/types";

/**
 * Trạng thái mà handler MSW đọc và ghi — một "backend" tối giản cho test.
 *
 * Vì sao có nó thay vì handler trả hằng số: phần lớn test là một CHUỖI thao tác
 * (tạo thư mục → đổi tên → chuyển vào thùng rác → khôi phục), và một handler
 * không nhớ gì sẽ biến mọi assertion sau bước đầu tiên thành vô nghĩa.
 *
 * Cố tình KHÔNG phải bản sao của backend: nó không kiểm quyền, không kiểm ràng
 * buộc, không sinh audit. Những thứ đó được kiểm ở e2e của backend, nơi có
 * Postgres thật. Ở đây nó chỉ cần trả về đúng HÌNH DẠNG mà FE phải xử lý.
 */
export interface MockDb {
  workspaces: Workspace[];
  treeByWorkspace: Record<string, readonly DriveNode[]>;
  trashByWorkspace: Record<string, readonly TrashEntry[]>;
}

const emptyDb = (): MockDb => ({
  workspaces: [],
  treeByWorkspace: {},
  trashByWorkspace: {},
});

let db: MockDb = emptyDb();

export function getDb(): MockDb {
  return db;
}

/** Gọi trong `beforeEach`: mỗi test bắt đầu từ một backend sạch. */
export function resetDb(): void {
  db = emptyDb();
}

export interface SeedInput {
  readonly workspace: Workspace;
  readonly specs?: readonly NodeSpec[];
  readonly nodes?: readonly DriveNode[];
}

/** Nạp một workspace kèm cây của nó, dùng chính factory mà test vẫn dùng. */
export function seedWorkspace({ workspace, specs, nodes }: SeedInput): void {
  db.workspaces = [
    ...db.workspaces.filter((item) => item.id !== workspace.id),
    workspace,
  ];

  db.treeByWorkspace = {
    ...db.treeByWorkspace,
    [workspace.id]:
      nodes ??
      (specs === undefined
        ? []
        : hydrate(specs, {
            workspaceId: workspace.id,
            parentId: null,
            idPrefix: workspace.id,
          })),
  };

  db.trashByWorkspace = { ...db.trashByWorkspace, [workspace.id]: [] };
}
