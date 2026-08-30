import { http, HttpResponse } from "msw";
import { API_BASE_URL, API_ORIGIN } from "@/config/api";
import { CURRENT_USER } from "@/mock/users";
import { extensionOf, kindFromFileName } from "@/lib/node-visuals";
import { shouldFailUpload } from "@/services/simulation";
import { auditFake } from "../fake/audit.fake";
import { linkFake } from "../fake/link.fake";
import type { FileAsset } from "@/types";

const url = (path: string) => `${API_BASE_URL}${path}`;

/**
 * Context `files` — flow upload BA BƯỚC, chạy thật qua network layer.
 *
 * Bước 2 CÓ handler riêng: đó là điểm chính của việc kiểm nó. Mock bước gửi
 * bytes đi thì phần duy nhất đáng kiểm — URL server phát ra có gọi được không —
 * biến mất.
 */

interface PendingUpload {
  readonly uploadId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly folderId: string | null;
  sizeBytes: number;
  isReceived: boolean;
  /** Có nối vào cây Drive không — xem ghi chú ở handler tạo upload. */
  isDriveItem: boolean;
}

/**
 * Đủ để một lần huỷ chen vào được, đủ nhỏ để suite không chậm đi.
 *
 * Test huỷ chờ ~30ms rồi mới bấm Cancel, nên cửa sổ này phải rộng hơn con số
 * đó — nếu không thì upload đã xong trước khi có ai kịp huỷ.
 */
const TRANSFER_MS = 60;

const pending = new Map<string, PendingUpload>();
const assets = new Map<string, FileAsset>();
let sequence = 0;

const nextId = (prefix: string): string =>
  `${prefix}_${(sequence += 1).toString(36)}`;

export function resetFileFake(): void {
  pending.clear();
  assets.clear();
  sequence = 0;
}

/** Ảnh có bản webp; thứ khác thì không — đúng như backend thật. */
const derivativesFor = (
  assetId: string,
  fileName: string,
): { previewUrl: string | null; thumbnailUrl: string | null } =>
  kindFromFileName(fileName) === "image"
    ? {
        previewUrl: `${API_ORIGIN}/api/v1/images/${assetId}.preview.webp?signature=fake`,
        thumbnailUrl: `${API_ORIGIN}/api/v1/images/${assetId}.thumb.webp?signature=fake`,
      }
    : { previewUrl: null, thumbnailUrl: null };

export const fileHandlers = [
  http.post(url("/workspaces/:workspaceId/uploads"), async ({ request }) => {
    const body = (await request.json()) as {
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      folderId: string | null;
      createDriveNode?: boolean;
      reference?: { kind: string };
    };
    const uploadId = nextId("upl");

    // Server thật chỉ nối tệp vào cây khi đích đến là `drive`; tệp đính vào một
    // ô, một khối hay một bình luận thì thuộc về chỗ đó. Fake phải nói y hệt —
    // nói khác đi là bộ test offline xanh trong khi app thật rải ảnh ra Drive.
    const isDriveItem = body.reference === undefined && body.createDriveNode !== false;

    pending.set(uploadId, {
      uploadId,
      fileName: body.fileName,
      mimeType: body.mimeType,
      folderId: body.folderId,
      sizeBytes: body.sizeBytes,
      isReceived: false,
      isDriveItem,
    });

    return HttpResponse.json({
      uploadId,
      // URL TUYỆT ĐỐI, như server thật phát ra — client không tự ghép nó.
      uploadUrl: `${API_ORIGIN}/api/v1/storage/${uploadId}?signature=fake`,
      method: "PUT",
      headers: { "Content-Type": body.mimeType },
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      maxBytes: 100 * 1024 * 1024,
    });
  }),

  /** Bước 2 — bytes thô lên URL đã ký. Không token, không JSON. */
  http.put(`${API_ORIGIN}/api/v1/storage/:uploadId`, async ({ params, request }) => {
    const upload = pending.get(params.uploadId as string);

    if (upload === undefined) return new HttpResponse(null, { status: 403 });

    // Một backend giả trả lời tức thì thì KHÔNG kiểm được việc huỷ: người dùng
    // không kịp bấm Cancel trước khi upload xong. Một nhịp nhỏ ở đây trả lại
    // cửa sổ đó mà không làm suite chậm đi đáng kể.
    await new Promise((resolve) => setTimeout(resolve, TRANSFER_MS));

    if (shouldFailUpload(upload.fileName)) {
      return new HttpResponse(null, { status: 500 });
    }

    upload.sizeBytes = (await request.arrayBuffer()).byteLength;
    upload.isReceived = true;

    return HttpResponse.json({ ok: true });
  }),

  http.post(url("/uploads/:uploadId/complete"), ({ params }) => {
    const upload = pending.get(params.uploadId as string);

    if (upload === undefined) {
      return HttpResponse.json(
        {
          error: {
            code: "not_found",
            message: "That upload could not be found",
            isRetryable: false,
          },
        },
        { status: 404 },
      );
    }

    if (!upload.isReceived) {
      // Xác nhận một upload chưa gửi bytes là một `409`, không phải `404`: yêu
      // cầu có thật, chỉ là chưa tới lúc.
      return HttpResponse.json(
        {
          error: {
            code: "conflict",
            message: "The bytes have not arrived yet",
            isRetryable: false,
          },
        },
        { status: 409 },
      );
    }

    const assetId = nextId("asset");
    const asset = {
      id: assetId,
      name: upload.fileName,
      extension: extensionOf(upload.fileName),
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      kind: kindFromFileName(upload.fileName),
      owner: CURRENT_USER,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      folderId: upload.folderId,
      ...derivativesFor(assetId, upload.fileName),
    } as FileAsset;

    assets.set(assetId, asset);
    pending.delete(upload.uploadId);

    return HttpResponse.json({
      asset,
      node: upload.isDriveItem ? { id: assetId, name: asset.name } : null,
      storage: { usedBytes: asset.sizeBytes, totalBytes: 1024 ** 3 },
    });
  }),

  http.delete(url("/uploads/:uploadId"), ({ params }) => {
    pending.delete(params.uploadId as string);

    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url("/assets/:assetId/url"), ({ params }) => {
    const assetId = params.assetId as string;
    const asset = assets.get(assetId);

    // Server thật ký kèm link ảnh thu nhỏ khi asset có bản webp. Ô đính kèm
    // trong bảng sống bằng đúng trường này — thiếu nó là ô chỉ hiện biểu tượng.
    return HttpResponse.json({
      url: `${API_ORIGIN}/api/v1/storage/${assetId}?signature=fake`,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
      ...(asset?.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
    });
  }),

  http.get(url("/nodes/:nodeId/file/download"), ({ params }) =>
    HttpResponse.json({
      url: `${API_ORIGIN}/api/v1/storage/${params.nodeId as string}?signature=fake`,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    }),
  ),

  http.post(url("/links/resolve"), async ({ request }) => {
    const { url: target } = (await request.json()) as { url: string };

    return HttpResponse.json(await linkFake.resolve(target));
  }),

  http.get(url("/workspaces/:workspaceId/audit"), async ({ request }) => {
    const params = new URL(request.url).searchParams;

    return HttpResponse.json(
      await auditFake.list({
        module: (params.get("module") ?? undefined) as never,
        severity: (params.get("severity") ?? undefined) as never,
        actorId: params.get("actorId") ?? undefined,
        search: params.get("search") ?? undefined,
      }),
    );
  }),
];
