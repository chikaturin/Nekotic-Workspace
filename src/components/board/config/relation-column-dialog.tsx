"use client";

import { Link2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { useFolderBoards } from "@/hooks/use-folder-boards";
import type { BoardColumnOf, RelationConfig } from "@/types";

export interface RelationColumnDialogProps {
  readonly isOpen: boolean;
  readonly column: BoardColumnOf<"relation"> | null;
  readonly folderId: string | null;
  readonly currentNodeId: string;
  readonly onClose: () => void;
  readonly onSave: (patch: {
    readonly name: string;
    readonly config: RelationConfig;
  }) => void;
}

const DEFAULT_RELATION_NAME = "Related";

export function RelationColumnDialog({
  isOpen,
  column,
  folderId,
  currentNodeId,
  onClose,
  onSave,
}: RelationColumnDialogProps) {
  const { boards, isLoading, error } = useFolderBoards({ folderId, currentNodeId });

  const [name, setName] = useState(column?.name ?? DEFAULT_RELATION_NAME);
  const [boardId, setBoardId] = useState(column?.config.boardId ?? "");
  const [isMulti, setIsMulti] = useState(column?.config.isMulti ?? true);

  if (!isOpen) return null;

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && boardId !== "";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-muted-foreground" />
          {column === null ? "Cột liên kết bản ghi" : "Liên kết bản ghi"}
        </DialogTitle>
        <DialogDescription>
          Cột này trỏ tới bản ghi của một board khác trong cùng thư mục.
        </DialogDescription>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="relation-name">Tên cột</Label>
            <Input
              id="relation-name"
              value={name}
              placeholder="Related QA/QC"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="relation-board">Board đích</Label>

            {isLoading ? (
              <div className="flex h-8 items-center gap-2 text-body text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Đang tìm board…
              </div>
            ) : error ? (
              <p className="text-body text-danger">
                Không đọc được danh sách board. Chưa có gì thay đổi.
              </p>
            ) : boards.length === 0 ? (
              <p className="text-body text-muted-foreground">
                Thư mục này chưa có board nào khác. Tạo thêm một board rồi quay
                lại.
              </p>
            ) : (
              <Select
                id="relation-board"
                value={boardId}
                onValueChange={(value) => setBoardId(value ?? "")}
                placeholder="Chọn board…"
                options={boards.map((board) => ({
                  value: board.id,
                  label: board.name,
                  description: `${board.rowIdPrefix}-001`,
                }))}
              />
            )}
          </div>

          <div>
            <Label>Số bản ghi</Label>
            <RadioGroup
              value={isMulti ? "multiple" : "single"}
              onValueChange={(value) => setIsMulti(value === "multiple")}
              className="mt-1 space-y-1.5"
            >
              <RadioGroupItem
                value="single"
                label="Một bản ghi"
                description="Ô chỉ giữ được một liên kết."
              />
              <RadioGroupItem
                value="multiple"
                label="Nhiều bản ghi"
                description="Ví dụ: một Bug liên quan tới nhiều ca QA."
              />
            </RadioGroup>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant="default"
            disabled={!canSave}
            onClick={() =>
              onSave({
                name: trimmed,
                config: {
                  boardId,
                  displayColumnId: null,
                  isMulti,
                },
              })
            }
          >
            Lưu
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
