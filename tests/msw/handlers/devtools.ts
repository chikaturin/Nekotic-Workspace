import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { toAppError } from "@/services/errors";
import { devtoolsFake } from "../fake/devtools.fake";
import type { ConfigFormat } from "@/types";

const url = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Context `devtools`.
 *
 * Fake vẫn ném `ServiceError` như hồi nó còn là một service; ở đây chúng được
 * dịch NGƯỢC lại thành envelope HTTP, để client đi đúng con đường mà nó sẽ đi
 * với backend thật — kể cả đường lỗi.
 */
async function answer(work: () => Promise<unknown>): Promise<Response> {
  try {
    return HttpResponse.json((await work()) as Record<string, unknown>);
  } catch (error: unknown) {
    const appError = toAppError(error);
    const status =
      appError.code === "permission_denied"
        ? 403
        : appError.code === "not_found"
          ? 404
          : appError.code === "conflict"
            ? 409
            : 400;

    return HttpResponse.json(
      {
        error: {
          code: appError.code,
          message: appError.message,
          detail: appError.detail,
          isRetryable: appError.isRetryable,
        },
      },
      { status },
    );
  }
}

/** Fake vẫn cần một vai trò để kiểm tra; e2e của backend mới là chỗ kiểm quyền thật. */
const ROLE = "admin" as const;

export const devtoolsHandlers = [
  http.get(url("/nodes/:nodeId/config"), ({ params }) =>
    answer(() => devtoolsFake.getConfig(params.nodeId as string)),
  ),

  http.put(url("/nodes/:nodeId/config"), async ({ params, request }) => {
    const body = (await request.json()) as {
      content: string;
      format?: ConfigFormat;
      environmentOptionId?: string;
      isAutosave?: boolean;
    };

    return answer(() =>
      devtoolsFake.saveConfig({ nodeId: params.nodeId as string, ...body }),
    );
  }),

  http.get(url("/nodes/:nodeId/config/versions"), ({ params }) =>
    answer(() => devtoolsFake.listConfigVersions(params.nodeId as string)),
  ),

  http.post(
    url("/nodes/:nodeId/config/versions/:versionId/restore"),
    ({ params }) =>
      answer(() =>
        devtoolsFake.restoreConfigVersion(
          params.nodeId as string,
          params.versionId as string,
        ),
      ),
  ),

  http.get(url("/nodes/:nodeId/secrets"), ({ params }) =>
    answer(() => devtoolsFake.getSecrets(params.nodeId as string)),
  ),

  http.put(url("/nodes/:nodeId/secrets"), async ({ params, request }) => {
    const { entries } = (await request.json()) as { entries: unknown[] };

    return answer(() =>
      devtoolsFake.saveSecrets({
        nodeId: params.nodeId as string,
        entries: entries as never,
        role: ROLE,
      }),
    );
  }),

  http.post(
    url("/nodes/:nodeId/secrets/:secretId/reveal"),
    ({ params }) =>
      answer(async () => ({
        value: await devtoolsFake.revealSecret({
          nodeId: params.nodeId as string,
          secretId: params.secretId as string,
          role: ROLE,
          action: "reveal",
        }),
      })),
  ),

  http.post(url("/nodes/:nodeId/secrets/copy"), async ({ params, request }) => {
    const { secretIds } = (await request.json()) as { secretIds: string[] };

    return answer(() =>
      devtoolsFake.copySecrets({
        nodeId: params.nodeId as string,
        secretIds,
        role: ROLE,
      }),
    );
  }),

  http.get(url("/nodes/:nodeId/secrets/audit"), ({ params }) =>
    answer(() => devtoolsFake.listSecretAudit(params.nodeId as string)),
  ),

  /**
   * Môi trường của workspace — id là UUID THẬT, như server.
   *
   * Fake cũ không có route này, nên FE lặng lẽ dùng hằng số mẫu `env_0` và bộ
   * test offline vẫn xanh trong khi app thật trả `400` ở mọi lần lưu secret.
   */
  http.get(url("/workspaces/:workspaceId/environments"), ({ params }) =>
    HttpResponse.json(
      ENVIRONMENTS.map((environment) => ({
        ...environment,
        workspaceId: params.workspaceId as string,
      })),
    ),
  ),
];

export const ENVIRONMENTS = [
  { id: "6f1d2c9e-1a4b-4c8d-9e7f-0a1b2c3d4e01", label: "Development", color: "cyan", position: 0 },
  { id: "6f1d2c9e-1a4b-4c8d-9e7f-0a1b2c3d4e02", label: "Staging", color: "amber", position: 1 },
  { id: "6f1d2c9e-1a4b-4c8d-9e7f-0a1b2c3d4e03", label: "Production", color: "red", position: 2 },
] as const;
