"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/**
 * Việc tạo đang chờ một cái tên.
 *
 * `run` giữ lại đúng thao tác cần chạy — tạo trang, thư mục, board theo mẫu,
 * hay tài liệu config — nên hộp thoại không cần biết gì về từng loại.
 */
export interface PendingCreate {
  readonly title: string;
  readonly label: string;
  readonly suggestion: string;
  readonly run: (name: string) => void;
}

interface CreateNameDialogProps {
  readonly pending: PendingCreate | null;
  readonly onClose: () => void;
}

export function CreateNameDialog({ pending, onClose }: CreateNameDialogProps) {
  if (!pending) return null;

  // `key` cho mỗi việc: mở lần khác là một component MỚI, nên ô tên bắt đầu lại
  // từ gợi ý mà không cần đồng bộ state trong effect.
  return <NameForm key={pending.title} pending={pending} onClose={onClose} />;
}

function NameForm({
  pending,
  onClose,
}: {
  readonly pending: PendingCreate;
  readonly onClose: () => void;
}) {
  const [name, setName] = useState(pending.suggestion);

  const trimmed = name.trim();

  const submit = () => {
    // Để trống thì dùng gợi ý — người dùng bấm Enter cho nhanh vẫn ra tên hợp lý,
    // không ra một mục tên rỗng.
    pending.run(trimmed.length > 0 ? trimmed : pending.suggestion);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending.title}</DialogTitle>
          <DialogDescription>
            Đặt tên bây giờ, đổi lúc nào cũng được.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Input
            autoFocus
            value={name}
            aria-label={pending.label}
            placeholder={pending.suggestion}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              submit();
            }}
            onFocus={(event) => event.currentTarget.select()}
          />
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
