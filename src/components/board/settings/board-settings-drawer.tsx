"use client";

import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useBoardPeople } from "@/hooks/use-board-people";
import { RelationColumnDialog } from "@/components/board/config/relation-column-dialog";
import { SelectColumnDialog } from "@/components/board/config/select-column-dialog";
import { StepNumberingDialog } from "@/components/board/config/step-numbering-dialog";
import { BoardSettingsActions } from "@/components/board/settings/board-settings-actions";
import { BoardSettingsColumns } from "@/components/board/settings/board-settings-columns";
import { BoardSettingsDisplay } from "@/components/board/settings/board-settings-display";
import { BoardSettingsGeneral } from "@/components/board/settings/board-settings-general";
import { BoardSettingsRelations } from "@/components/board/settings/board-settings-relations";
import { BoardSettingsRules } from "@/components/board/settings/board-settings-rules";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  boardCapabilities,
  settingsSections,
  type BoardSettingsSection,
} from "@/lib/board-settings";
import { cn } from "@/lib/utils";
import type { BoardViewModel } from "@/hooks/use-board-view";
import { useBoardStore } from "@/store/board-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { useFolderBoards } from "@/hooks/use-folder-boards";
import { useOpenNode } from "@/hooks/use-open-node";
import { hrefAfterRename } from "@/lib/rename-navigation";
import type { BoardColumnOf, DriveNode, PermissionResolver } from "@/types";

interface BoardSettingsDrawerProps {
  readonly isOpen: boolean;
  readonly model: BoardViewModel;
  /** Node của chính board này — các hành động cấp item xét quyền theo node. */
  readonly node: DriveNode;
  readonly folderId: string | null;
  readonly can: PermissionResolver;
  readonly onClose: () => void;
}

/**
 * Một cửa cho mọi thứ cấu hình được của board.
 *
 * Chủ ý là ĐIỂM VÀO, không phải kho chứa: từng mục đọc và ghi thẳng vào nơi
 * cấu hình đó vốn sống — tên đi qua node, cách bày đi qua saved view, luật đi
 * qua config của cột. Không có "state của Board Settings" để mà lệch pha với
 * bản gốc.
 */
export function BoardSettingsDrawer({
  isOpen,
  model,
  node,
  folderId,
  can,
  onClose,
}: BoardSettingsDrawerProps) {
  const { board, columns } = model;

  const renameNode = useWorkspaceStore((state) => state.renameNode);
  const openNode = useOpenNode();
  const pathname = usePathname();
  const updateColumnConfig = useBoardStore((state) => state.updateColumnConfig);
  const people = useBoardPeople();

  const [section, setSection] = useState<BoardSettingsSection>("general");
  const [steps, setSteps] = useState<BoardColumnOf<"longText"> | null>(null);
  const [select, setSelect] = useState<BoardColumnOf<"select"> | null>(null);
  const [relation, setRelation] = useState<BoardColumnOf<"relation"> | null>(null);

  // Chỉ mục General dùng nút Save tường minh, nên chỉ nó mới có thể "bẩn".
  // Những mục còn lại ghi thẳng khi bấm, không có gì để mất.
  const [isDirty, setIsDirty] = useState(false);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);

  const onDirtyChange = useCallback((dirty: boolean) => setIsDirty(dirty), []);

  const requestClose = () => {
    if (isDirty) {
      setIsConfirmingDiscard(true);
      return;
    }

    onClose();
  };

  const discard = () => {
    setIsConfirmingDiscard(false);
    setIsDirty(false);
    onClose();
  };

  const capabilities = useMemo(() => boardCapabilities(columns), [columns]);
  const sections = useMemo(() => settingsSections(capabilities), [capabilities]);

  // Một quyền cho toàn bộ schema của board, và nó là quyền đã có sẵn — không
  // đọc vai trò trong component, không đẻ khoá mới mà backend chưa biết tới.
  const canEditSchema = can("board.manage");
  const canEditColumns = can("board.column.update");

  // `RelationConfig.boardId` là id của BOARD, không phải id của node — tra
  // nhầm bảng thì mọi quan hệ đều hiện "Another board" mà không ai báo lỗi.
  // Dùng chung nguồn với hộp thoại quan hệ để hai chỗ không thể lệch nhau.
  const { boards } = useFolderBoards({
    folderId,
    currentNodeId: board?.nodeId ?? "",
    allowSelf: true,
  });

  const boardNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const item of boards) names[item.id] = item.name;
    return names;
  }, [boards]);

  const active = sections.some((item) => item.id === section) ? section : "general";

  return (
    <>
      <Drawer open={isOpen} onOpenChange={(open) => !open && requestClose()}>
        <DrawerContent side="right" className="w-[34rem] max-w-[calc(100vw-2rem)]">
          <DrawerHeader>
            <DrawerTitle>Board settings</DrawerTitle>
            <DrawerDescription>{board?.name}</DrawerDescription>
          </DrawerHeader>

          <nav className="flex gap-1 border-b border-border px-4" aria-label="Board settings">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={active === item.id ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-ui transition-colors",
                  active === item.id
                    ? "border-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <DrawerBody className="space-y-4">
            {active === "general" && board && (
              <BoardSettingsGeneral
                name={board.name}
                canEdit={canEditSchema && can("node.rename")}
                onRename={(name) => {
                  renameNode(board.nodeId, name);

                  // Slug đi theo tên: không chuyển địa chỉ thì người dùng ở lại
                  // một URL vừa chết và thấy "That path no longer exists".
                  const next = hrefAfterRename(pathname, board.nodeId);
                  if (next) openNode(next);
                }}
                onDirtyChange={onDirtyChange}
              />
            )}

            {active === "general" && (
              <BoardSettingsActions
                node={node}
                href={pathname}
                onDone={() => {
                  setIsDirty(false);
                  onClose();
                }}
              />
            )}

            {active === "display" && <BoardSettingsDisplay model={model} canEdit={can("board.view.manage")} />}

            {active === "rules" && (
              <BoardSettingsRules
                capabilities={capabilities}
                canEdit={canEditColumns}
                onOpenSteps={setSteps}
                onOpenSelect={setSelect}
              />
            )}

            {active === "columns" && (
              <BoardSettingsColumns columns={columns} canEdit={can("board.view.manage")} />
            )}

            {active === "relations" && (
              <BoardSettingsRelations
                columns={capabilities.relationColumns}
                boardNames={boardNames}
                canEdit={canEditColumns}
                onOpen={setRelation}
              />
            )}
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        isOpen={isConfirmingDiscard}
        title="Discard your changes?"
        description="The board name you typed has not been saved yet. Closing now loses it."
        confirmLabel="Discard"
        isDestructive
        onClose={() => setIsConfirmingDiscard(false)}
        onConfirm={discard}
      />

      <StepNumberingDialog
        column={steps}
        onClose={() => setSteps(null)}
        onSave={(stepNumbering) => {
          if (steps) void updateColumnConfig(steps.id, { config: { stepNumbering } });
        }}
      />

      <SelectColumnDialog
        column={select}
        columns={columns}
        people={people}
        canEdit={canEditColumns}
        onClose={() => setSelect(null)}
        onSave={(config) => {
          if (select) void updateColumnConfig(select.id, { config });
        }}
      />

      <RelationColumnDialog
        key={relation?.id ?? "closed"}
        isOpen={relation !== null}
        column={relation}
        folderId={folderId}
        currentNodeId={board?.nodeId ?? ""}
        onClose={() => setRelation(null)}
        onSave={({ name, config }) => {
          if (relation) void updateColumnConfig(relation.id, { name, config });
          setRelation(null);
        }}
      />
    </>
  );
}
