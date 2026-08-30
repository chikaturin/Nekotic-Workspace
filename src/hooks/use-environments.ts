"use client";

import { useCallback } from "react";
import { useAsyncResource } from "@/hooks/use-async-resource";
import { devtoolsService } from "@/services/devtools-service";
import type { Environment } from "@/services/api/devtools.api";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { ListboxOption } from "@/components/ui/listbox";
import type { SelectColor } from "@/types";

/**
 * Danh sách môi trường THẬT của workspace.
 *
 * Trước đây các bộ chọn dùng `ENVIRONMENT_OPTIONS` trong `board-templates.ts` —
 * dữ liệu mẫu, id là `env_0`, `env_1`. Server thì lưu `environment_id` là khoá
 * ngoại UUID sang bảng `environments`, và DTO khai `@IsUUID()`. Nên mọi lần gửi
 * đều bị chặn: thêm secret mới là `400`, và cái id giả không bao giờ tới được
 * cơ sở dữ liệu.
 *
 * Route `GET /workspaces/:id/environments` đã có sẵn, chỉ là chưa ai gọi.
 */
export interface EnvironmentList {
  readonly options: readonly ListboxOption[];
  readonly defaultId: string | null;
  readonly isLoading: boolean;
}

export function useEnvironments(): EnvironmentList {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const loader = useCallback(
    (signal: AbortSignal) =>
      workspaceId === ""
        ? Promise.resolve([] as readonly Environment[])
        : devtoolsService.environments(workspaceId, signal),
    [workspaceId],
  );

  const { state } = useAsyncResource<readonly Environment[]>(loader);
  const list = state.status === "success" ? state.data : [];

  return {
    options: [...list]
      .sort((a, b) => a.position - b.position)
      .map((environment) => ({
        value: environment.id,
        label: environment.label,
        color: environment.color as SelectColor,
      })),
    defaultId: list[0]?.id ?? null,
    isLoading: state.status === "loading",
  };
}
