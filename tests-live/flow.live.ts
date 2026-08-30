import { beforeAll, describe, expect, test } from "vitest";

import { installCookieJar, cookieJar } from "./cookie-jar";
import { makePng } from "./make-png";
import { resetRateLimit } from "./reset-rate-limit";

installCookieJar();

import { API_BASE_URL, API_ORIGIN } from "@/config/api";
import { authService } from "@/services/auth-service";
import { boardApi, boardRowsApi, driveApi, fileApi, workspaceApi } from "@/services/api";
import { boardService } from "@/services/board-service";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/services/http/access-token";
import { useSessionStore } from "@/store/session-store";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Luồng SỐNG: FE thật ↔ backend thật trong Docker.
 *
 * Bộ test kia chạy trên MSW, và MSW chỉ chứng minh service khớp với handler do
 * chính tui viết. Bộ này đi ra socket thật, nên nó là thứ duy nhất phát hiện
 * được kiểu sai "hai bên cùng đúng theo spec riêng của mình": sai tên field,
 * sai vỏ envelope, sai chỗ đặt cookie, CORS thiếu header.
 *
 * Không dựng dữ liệu bằng SQL: mọi thứ ở đây đi qua đúng những hàm mà UI gọi.
 */

/**
 * Origin mà `next dev` phục vụ — phải nằm trong `CORS_ORIGINS` của backend.
 *
 * Ghim ở đây có chủ đích: đây là thứ DUY NHẤT trong bộ test biết cổng của FE,
 * và nếu ai đổi cổng dev mà quên sửa `CORS_ORIGINS`, test này đỏ trước khi
 * trình duyệt kịp chặn request thật.
 */
const DEV_ORIGIN = "http://localhost:3311";

/** Mỗi lần chạy một tài khoản riêng — suite này KHÔNG dọn database. */
const RUN = Date.now().toString(36);
const EMAIL = `live_${RUN}@nekotic.test`;
const PASSWORD = "Live-Passw0rd!";

/**
 * Ảnh thật, sinh lúc chạy — xem `make-png.ts` về lý do không dùng base64 chép tay.
 *
 * 1200×800 để hai bản derivative khác nhau thật: thumbnail bị thu về 480px,
 * preview giữ nguyên vì chưa chạm trần 2048px.
 */
const png = (): Uint8Array<ArrayBuffer> => makePng(1200, 800);

/** Bytes MANG TIẾNG là PNG nhưng libpng không đọc nổi. */
const brokenPng = (): Uint8Array<ArrayBuffer> => {
  const bytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("not actually a png body"),
  ]);
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
};

interface Ctx {
  workspaceId: string;
  folderId: string;
  userId: string;
}

const ctx: Ctx = { workspaceId: "", folderId: "", userId: "" };

beforeAll(async () => {
  const user = await authService.register({
    email: EMAIL,
    password: PASSWORD,
    name: `Live ${RUN}`,
  });
  ctx.userId = user.id;
});

describe("phiên đăng nhập", () => {
  test("đăng nhập trả token trong bộ nhớ và refresh cookie ở header", async () => {
    const session = await authService.login({ email: EMAIL, password: PASSWORD });

    expect(session.user.email).toBe(EMAIL);
    // R-1: token KHÔNG được trả ra cho caller, nó nằm trong kho bộ nhớ.
    expect(getAccessToken()).not.toBeNull();
    expect(session).not.toHaveProperty("accessToken");

    // Refresh token phải là cookie do server đặt, không phải một field JSON.
    expect(cookieJar.names().length).toBeGreaterThan(0);
  });

  test("F5 khôi phục được phiên chỉ bằng cookie", async () => {
    // Đúng cái xảy ra khi tải lại trang: token bộ nhớ mất, cookie còn.
    clearAccessToken();
    expect(getAccessToken()).toBeNull();

    const restored = await authService.restore();

    expect(restored).not.toBeNull();
    expect(restored?.user.email).toBe(EMAIL);
    expect(getAccessToken()).not.toBeNull();
  });

  test("session store đi qua đúng đường đó và báo trạng thái ready", async () => {
    clearAccessToken();
    useSessionStore.setState({ status: "idle", user: null, workspaces: [] });

    const ok = await useSessionStore.getState().restore();

    expect(ok).toBe(true);
    expect(useSessionStore.getState().status).toBe("ready");
    expect(useSessionStore.getState().user?.email).toBe(EMAIL);
  });

  test("không token thì backend từ chối, không trả dữ liệu rỗng", async () => {
    const response = await fetch(`${API_BASE_URL}/me`, {
      headers: { authorization: "Bearer not-a-real-token" },
    });

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBeTruthy();
  });
});

describe("workspace và cây drive", () => {
  test("tạo workspace rồi thấy nó trong danh sách", async () => {
    const created = await workspaceApi.create({ name: `Live ${RUN}` });
    ctx.workspaceId = created.id;

    const all = await workspaceApi.list();
    expect(all.some((w) => w.id === created.id)).toBe(true);
  });

  test("server tự đặt slug — client không gửi lên", async () => {
    const folder = await driveApi.create(ctx.workspaceId, {
      kind: "folder",
      name: "Ảnh chiến dịch",
      parentId: null,
    });
    ctx.folderId = folder.id;

    // Dấu tiếng Việt bị bỏ, khoảng trắng thành gạch nối — do BACKEND làm.
    expect(folder.slug).toBe("anh-chien-dich");
    expect(folder.type).toBe("folder");
  });

  test("cây trả về đúng node vừa tạo", async () => {
    const tree = await driveApi.tree(ctx.workspaceId);
    expect(tree.some((node) => node.id === ctx.folderId)).toBe(true);
  });

  test("resolve theo đường dẫn tìm được node và dựng breadcrumb", async () => {
    const found = await driveApi.resolve(ctx.workspaceId, "anh-chien-dich");

    expect(found.isNotFound).toBe(false);
    expect(found.node?.id).toBe(ctx.folderId);
  });

  test("tạo document và board trong thư mục đó", async () => {
    const document = await driveApi.create(ctx.workspaceId, {
      kind: "document",
      name: "Ghi chú chiến dịch",
      parentId: ctx.folderId,
    });
    const board = await driveApi.create(ctx.workspaceId, {
      kind: "board",
      name: "Kế hoạch",
      parentId: ctx.folderId,
    });

    expect(document.type).toBe("document");
    expect(board.type).toBe("board");

    const children = await driveApi.children(ctx.folderId);
    expect(children.length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Kho lưu trữ có HAI backend, và chúng KHÔNG hứa giống nhau khi ĐỌC.
 *
 * Ghi thì giống: mọi lần tải lên đều PUT vào route `/storage/*` của API, bất kể
 * bytes cuối cùng rơi xuống đĩa hay lên R2. Nên link tải lên KHÔNG còn nhận ra
 * được backend nữa — trước đây nó nhận ra được, vì R2 bắn thẳng vào bucket.
 *
 * Đọc mới là chỗ khác nhau: đĩa local tự phục vụ bytes qua route của mình nên
 * áp được nosniff, octet-stream và chữ ký buộc vào verb; R2 với tên miền công
 * khai thì Cloudflare phục vụ, không có bảo đảm nào trong số đó — chốt chặn
 * chuyển sang lúc SERVER GHI object.
 *
 * Vậy nên cờ dưới đây đọc từ link ẢNH, không phải link tải lên.
 */
const servedFromCdn = (url: string): boolean => !url.includes("/api/v1/");

describe("upload ảnh → webp", () => {
  let uploadedNodeId = "";
  let thumbnailUrl = "";
  let onR2 = false;

  test("ba bước upload chạy trọn qua đúng hàm mà UI gọi", async () => {
    const bytes = png();

    const ticket = await fileApi.requestUpload(ctx.workspaceId, {
      fileName: "banner.png",
      sizeBytes: bytes.byteLength,
      mimeType: "image/png",
      folderId: ctx.folderId,
      createDriveNode: true,
    });

    expect(ticket.method).toBe("PUT");

    // Bytes đi qua API, KHÔNG bắn thẳng vào bucket — đúng với cả hai backend.
    // Link ký sẵn của R2 thì nhanh hơn, nhưng bucket phải mở CORS cho từng
    // origin và API không bao giờ nhìn thấy tệp để mà kiểm.
    expect(ticket.uploadUrl).toContain("/api/v1/storage/");
    expect(ticket.uploadUrl).not.toContain("r2.cloudflarestorage.com");

    const seen: number[] = [];
    await fileApi.sendBytes(ticket, new Blob([bytes]), (f) => seen.push(f));
    expect(seen.at(-1)).toBe(1);

    const done = await fileApi.completeUpload(ticket.uploadId);

    expect(done.node).toBeTruthy();
    expect(done.asset.mimeType).toBe("image/png");
    // Server sniff magic number chứ không tin `mimeType` client khai.
    expect(done.asset.kind).toBe("image");

    // NODE và ASSET là hai id khác nhau. Store từng lấy `asset.id` làm id node,
    // nên thao tác đầu tiên trên file vừa tải lên là một 404.
    expect(done.node!.id).not.toBe(done.asset.id);

    // Hạn mức đi kèm ngay trong câu trả lời — không cần gọi thêm để vẽ thanh
    // Storage.
    expect(done.storage.usedBytes).toBeGreaterThan(0);

    uploadedNodeId = done.node!.id;
  });

  test("node id server trả về dùng được ngay cho request tiếp theo", async () => {
    // Đây là điều `asset.id` KHÔNG làm được, và là cách bug cũ lộ ra.
    const detail = await driveApi.get(uploadedNodeId);

    expect(detail.node.id).toBe(uploadedNodeId);
    expect(detail.node.type).toBe("file");
    // Quyền đi kèm ngay — màn hình không phải gọi thêm để biết vẽ nút nào.
    // Là BẢN ĐỒ sáu cờ, không phải mảng khoá.
    expect(detail.capabilities.view).toBe(true);
    expect(typeof detail.capabilities.manage).toBe("boolean");

    // Và endpoint riêng phải nói y hệt — cùng một phán quyết, hai cách hỏi.
    const only = await driveApi.capabilities(uploadedNodeId);
    expect(only).toEqual(detail.capabilities);
  });

  test("cả hai bản webp có mặt ngay khi upload xong", async () => {
    const listed = await fileApi.listInFolder(ctx.folderId);
    const uploaded = listed.find((node) => node.id === uploadedNodeId);

    expect(uploaded).toBeTruthy();
    thumbnailUrl = (uploaded as { thumbnailUrl?: string }).thumbnailUrl ?? "";

    expect(thumbnailUrl).toContain(".thumb.webp");

    // Backend nào đang chạy chỉ nhìn ra được từ đây trở đi.
    onR2 = servedFromCdn(thumbnailUrl);

    // `/images/` chứ không phải `/storage/`: hai route khác nhau có chủ đích.
    if (!onR2) expect(thumbnailUrl).toContain("/images/");
  });

  test("link đó phục vụ image/webp thật, kèm nosniff", async () => {
    const response = await fetch(thumbnailUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/webp");

    // nosniff là header do route ảnh của mình đặt. Qua cdn thì Cloudflare phục
    // vụ, không ai đặt nó — an toàn ở đây đến từ chỗ khác: kiểu nội dung của
    // object do SERVER ghi (webp), client không chạm vào được.
    if (!onR2) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }

    const body = await response.arrayBuffer();
    // Chữ ký RIFF….WEBP — bytes đúng là webp, không phải PNG đổi tên.
    const magic = Buffer.from(body.slice(0, 12));
    expect(magic.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(magic.subarray(8, 12).toString("ascii")).toBe("WEBP");

    // Và nó NHỎ hơn hẳn ảnh gốc — resize thật sự đã chạy, không phải copy.
    expect(body.byteLength).toBeLessThan(png().byteLength / 10);
  });

  test("preview là bản webp riêng, không phải cùng một file với thumbnail", async () => {
    const preview = await fileApi.preview(uploadedNodeId);

    expect(preview.kind).toBe("image");
    const url = (preview as { url: string }).url;

    expect(url).toContain(".preview.webp");
    expect(url).not.toBe(thumbnailUrl);

    const response = await fetch(url);
    expect(response.headers.get("content-type")).toContain("image/webp");
  });

  test("bytes gốc vẫn phục vụ dưới dạng octet-stream — đây là chốt chặn XSS", async () => {
    // Bảo đảm này thuộc về route của mình. Trên R2 chốt tương đương nằm ở bài
    // "không tải lên được text/html" phía dưới.
    if (onR2) return;

    const { url } = await fileApi.downloadUrl(uploadedNodeId);
    const response = await fetch(url);

    expect(response.status).toBe(200);
    // KHÔNG BAO GIỜ image/png hay text/html: bytes người dùng gửi lên mà trình
    // duyệt chịu render là đường XSS. Route ảnh riêng tồn tại chính vì vậy.
    expect(response.headers.get("content-type")).toContain(
      "application/octet-stream",
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("chữ ký buộc vào VERB — link ảnh không dùng lại được cho route tải file", async () => {
    if (onR2) return;

    const swapped = thumbnailUrl.replace("/images/", "/storage/");
    const response = await fetch(swapped);

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  test("sửa một ký tự trong chữ ký là hỏng cả link", async () => {
    const tampered = onR2
      ? thumbnailUrl
      : thumbnailUrl.replace(/signature=(.)/, (_m, c: string) =>
          `signature=${c === "a" ? "b" : "a"}`,
        );

    // Link cdn không mang chữ ký để mà sửa — nó công khai theo thiết kế.
    if (onR2) return;

    const response = await fetch(tampered);

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  /**
   * Chốt chặn XSS của R2, dựng lại đúng cuộc tấn công đã chạy được trên môi
   * trường thật: xin ticket khai `text/html`, PUT một thẻ script, rồi mở bằng
   * tên miền công khai. Trước khi sửa, cdn trả về HTTP 200 kèm
   * `content-type: text/html` và trình duyệt chạy đoạn script đó.
   *
   * Chốt đã ĐỔI CHỖ. Hồi bytes bắn thẳng vào bucket, cách duy nhất là ký
   * Content-Type vào link — client gửi sai thì R2 trả 403. Giờ bytes đi qua
   * API, nên API tự quyết kiểu lưu trữ: PUT vẫn được nhận, nhưng thứ nằm trong
   * bucket không phải thứ kẻ tấn công khai.
   */
  test("client khai text/html cũng không lưu thành text/html", async () => {
    const evil = new TextEncoder().encode("<script>alert(1)</script>");

    const ticket = await fileApi.requestUpload(ctx.workspaceId, {
      fileName: "payload.html",
      sizeBytes: evil.byteLength,
      mimeType: "text/html",
      folderId: ctx.folderId,
      createDriveNode: true,
    });

    // Vé đã hạ xuống octet-stream.
    expect(ticket.headers["Content-Type"]).toBe("application/octet-stream");

    // Client bỏ qua vé, tự khai text/html như cũ.
    const response = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/html" },
      body: evil,
    });

    expect(response.status).toBe(200);

    const done = await fileApi.completeUpload(ticket.uploadId);
    const { url } = await fileApi.downloadUrl(done.node!.id);
    const served = await fetch(url);

    // Điều PHẢI đúng ở cả hai backend: bytes người dùng gửi lên không bao giờ
    // được phục vụ dưới một kiểu mà trình duyệt chịu thực thi.
    const type = served.headers.get("content-type") ?? "";
    expect(type).not.toContain("text/html");
    expect(type).toContain("application/octet-stream");
  });

  /**
   * Ảnh dán vào một ô của board KHÔNG phải một mục trong Drive, nhưng vẫn phải
   * xem được — hai vế này từng hỏng cùng lúc theo hai cách ngược nhau.
   */
  test("tệp của một ô không tạo mục Drive, mà vẫn xin được link để hiện ra", async () => {
    const bytes = png();

    const ticket = await fileApi.requestUpload(ctx.workspaceId, {
      fileName: "trong-o.png",
      sizeBytes: bytes.byteLength,
      mimeType: "image/png",
      folderId: ctx.folderId,
      createDriveNode: false,
      reference: { kind: "cell" },
    });

    await fileApi.sendBytes(ticket, new Blob([bytes]), () => {});
    const done = await fileApi.completeUpload(ticket.uploadId);

    // Không có mục nào trong cây.
    expect(done.node).toBeNull();

    // Nhưng ô vẫn vẽ được ảnh: giá trị ô chỉ cất id, link thì hỏi lại theo
    // từng người xem. Thiếu bước này là ảnh biến mất sau mỗi lần tải lại trang.
    const links = await fileApi.assetUrl(done.asset.id);

    expect(links.url).toBeTruthy();
    expect(links.thumbnailUrl).toBeTruthy();

    const shown = await fetch(links.thumbnailUrl as string);
    expect(shown.status).toBe(200);
    expect(shown.headers.get("content-type")).toContain("image/webp");
  });

  test("ảnh hỏng vẫn upload được, chỉ là không có webp — không làm hỏng cả lần tải lên", async () => {
    // Tui vấp đúng ca này khi viết bộ test: fixture PNG hỏng, libvips từ chối
    // đọc, và đường sinh webp nuốt lỗi rồi trả `null`. Hành vi đó ĐÚNG — mất
    // thumbnail không đáng để mất luôn file người dùng vừa tải lên — nhưng nó
    // im lặng đến mức trông y hệt "tính năng chưa chạy", nên phải có test ghim.
    const bytes = brokenPng();

    const ticket = await fileApi.requestUpload(ctx.workspaceId, {
      fileName: "broken.png",
      sizeBytes: bytes.byteLength,
      mimeType: "image/png",
      folderId: ctx.folderId,
      createDriveNode: true,
    });

    await fileApi.sendBytes(ticket, new Blob([bytes]), () => {});
    const done = await fileApi.completeUpload(ticket.uploadId);

    // File vẫn vào kho, node vẫn được tạo.
    expect(done.node).toBeTruthy();
    // Chỉ derivative là vắng.
    expect(done.asset.thumbnailUrl ?? null).toBeNull();
    expect(done.asset.previewUrl ?? null).toBeNull();
  });
});

describe("CORS cho trình duyệt", () => {
  test("preflight từ origin của FE được chấp nhận, kèm credentials", async () => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "OPTIONS",
      headers: {
        origin: DEV_ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(DEV_ORIGIN);
    // Bắt buộc: refresh token là HttpOnly cookie, thiếu dòng này thì F5 mất phiên.
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  test("origin lạ không được cấp quyền", async () => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "OPTIONS",
      headers: {
        origin: "http://evil.example",
        "access-control-request-method": "POST",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).not.toBe(
      "http://evil.example",
    );
  });
});

describe("quản trị viên lập tài khoản cho thành viên", () => {
  const MEMBER_EMAIL = `member_${RUN}@nekotic.test`;
  const MEMBER_PASSWORD = "Member-Passw0rd!";

  test("tạo được tài khoản và người đó thành member ngay", async () => {
    // Lời mời giả định người kia tự đăng ký, mà bản này chưa có hộp thư — nên
    // đây là con đường duy nhất thêm được người mà không treo ở bước chấp nhận.
    const member = await workspaceApi.createMemberAccount(ctx.workspaceId, {
      email: MEMBER_EMAIL,
      name: "Thành Viên",
      password: MEMBER_PASSWORD,
      role: "member",
    });

    expect(member.email).toBe(MEMBER_EMAIL);
    expect(member.role).toBe("member");
    // Mật khẩu chỉ đi một chiều — lên.
    expect(Object.keys(member)).not.toContain("password");

    const members = await workspaceApi.members(ctx.workspaceId);
    expect(members.some((entry) => entry.email === MEMBER_EMAIL)).toBe(true);
  });

  test("tài khoản vừa lập ĐĂNG NHẬP được và thấy workspace", async () => {
    // Đây mới là câu hỏi thật: "đã tạo" khác "dùng được".
    const session = await authService.login({
      email: MEMBER_EMAIL,
      password: MEMBER_PASSWORD,
    });

    expect(session.user.email).toBe(MEMBER_EMAIL);
    expect(session.workspaces.map((entry) => entry.id)).toContain(ctx.workspaceId);

    // Trả phiên về cho người đang chạy suite.
    await authService.login({ email: EMAIL, password: PASSWORD });
  });

  test("email đã có tài khoản thì bị TỪ CHỐI, không bị ghi đè mật khẩu", async () => {
    await expect(
      workspaceApi.createMemberAccount(ctx.workspaceId, {
        email: MEMBER_EMAIL,
        name: "Kẻ mạo danh",
        password: "Another-Passw0rd!",
        role: "admin",
      }),
    ).rejects.toThrow();

    // Mật khẩu cũ vẫn nguyên giá trị.
    await authService.login({ email: MEMBER_EMAIL, password: MEMBER_PASSWORD });
    await authService.login({ email: EMAIL, password: PASSWORD });
  });
});

/**
 * "Chỉ những người được liệt kê" — từ hộp thoại phân quyền tới mắt người khác.
 *
 * Chỗ này phải chạy SỐNG và phải đi qua đúng action mà hộp thoại gọi. Gọi thẳng
 * `driveApi.setAccessMode` sẽ xanh ngay cả khi giao diện không hề gọi tới nó —
 * và đó chính là lỗi: nút Restricted từng chỉ ghi vào bộ nhớ của tab đang mở,
 * nên trang vẫn nằm nguyên đó cho mọi người khác.
 *
 * Câu hỏi được hỏi bằng một PHIÊN KHÁC, vì "tui không thấy nó nữa" không chứng
 * minh được gì: người vừa đặt hạn chế luôn được vào.
 */
describe("hạn chế quyền xem một node", () => {
  const OUTSIDER_EMAIL = `outsider_${RUN}@nekotic.test`;
  const OUTSIDER_PASSWORD = "Outsider-Passw0rd!";

  const secret = { id: "", name: `Bí mật ${RUN}` };
  const open = { id: "", name: `Công khai ${RUN}` };

  /** Token của hai người, lấy MỘT lần — `/auth/login` có hạn mức 10 lần/5 phút. */
  const token = { admin: "", outsider: "" };

  /** Hỏi một câu bằng phiên của người kia, rồi trả phiên về chỗ cũ. */
  async function asOutsider<T>(ask: () => Promise<T>): Promise<T> {
    setAccessToken(token.outsider);

    try {
      return await ask();
    } finally {
      setAccessToken(token.admin);
    }
  }

  beforeAll(async () => {
    // Hai lần đăng nhập nữa là chạm trần 10 lần/5 phút của `/auth/login`, và
    // cả file sẽ đỏ vì 429 chứ không vì thứ đang test. Hoàn lại phần budget
    // suite này đã tiêu — hạn mức thật trong `.env` không bị đụng tới.
    resetRateLimit();

    const [secretNode, openNode] = await Promise.all([
      driveApi.create(ctx.workspaceId, { kind: "document", name: secret.name, parentId: null }),
      driveApi.create(ctx.workspaceId, { kind: "document", name: open.name, parentId: null }),
    ]);

    secret.id = secretNode.id;
    open.id = openNode.id;

    await workspaceApi.createMemberAccount(ctx.workspaceId, {
      email: OUTSIDER_EMAIL,
      name: "Người ngoài",
      password: OUTSIDER_PASSWORD,
      role: "member",
    });

    await authService.login({ email: OUTSIDER_EMAIL, password: OUTSIDER_PASSWORD });
    token.outsider = getAccessToken() ?? "";

    await authService.login({ email: EMAIL, password: PASSWORD });
    token.admin = getAccessToken() ?? "";

    // Store phải biết cây trước đã: action bên dưới đọc node ra khỏi cây đang
    // mở, đúng như khi hộp thoại chạy trong trình duyệt.
    useWorkspaceStore.setState({
      activeWorkspaceId: ctx.workspaceId,
      treeByWorkspace: { [ctx.workspaceId]: await driveApi.tree(ctx.workspaceId) },
    });
  });

  test("member thấy được cả hai khi chưa ai hạn chế gì", async () => {
    const visible = await asOutsider(async () =>
      (await driveApi.tree(ctx.workspaceId)).map((node) => node.id),
    );

    expect(visible).toContain(secret.id);
    expect(visible).toContain(open.id);
  });

  test("đặt Restricted là một lần GHI LÊN SERVER, không phải một cờ trong tab", async () => {
    await useWorkspaceStore.getState().setNodeAccessMode(secret.id, "restricted");

    // Store NUỐT lỗi để hộp thoại không vỡ, nên hỏi nó trước: không có câu này
    // thì một lần ghi hỏng chỉ hiện ra dưới dạng "accessMode là undefined", và
    // lý do thật nằm im trong một feedback không ai đọc.
    expect(useWorkspaceStore.getState().feedback?.message ?? "").not.toContain("Could not");

    // Hỏi lại server, không đọc lại store: store chắc chắn nói đúng thứ vừa
    // ghi vào nó, kể cả khi chưa ai gửi đi đâu cả.
    const reread = await driveApi.get(secret.id);
    expect(reread.node.accessMode).toBe("restricted");
  });

  test("và người không có tên trong danh sách KHÔNG còn thấy nó", async () => {
    const visible = await asOutsider(async () =>
      (await driveApi.tree(ctx.workspaceId)).map((node) => node.id),
    );

    expect(visible).not.toContain(secret.id);
    // Hạn chế đúng một node, không phải cả workspace.
    expect(visible).toContain(open.id);
  });

  test("mở thẳng bằng id cũng không được — và trả 404, không phải 403", async () => {
    // 403 sẽ xác nhận rằng node đó có thật (S-8).
    const status = await asOutsider(async () => {
      const response = await fetch(`${API_BASE_URL}/nodes/${secret.id}`, {
        headers: { authorization: `Bearer ${getAccessToken() ?? ""}` },
      });

      return response.status;
    });

    expect(status).toBe(404);
  });

  test("mở lại cho cả workspace thì nó quay về", async () => {
    await useWorkspaceStore.getState().setNodeAccessMode(secret.id, "workspace");

    const visible = await asOutsider(async () =>
      (await driveApi.tree(ctx.workspaceId)).map((node) => node.id),
    );

    expect(visible).toContain(secret.id);
  });
});

describe("đăng xuất", () => {
  test("logout thu hồi cookie và token", async () => {
    await authService.logout();

    expect(getAccessToken()).toBeNull();

    // Cookie đã bị server xoá → restore phải trả null, không phải phiên cũ.
    const restored = await authService.restore();
    expect(restored).toBeNull();
  });
});

test("FE đang trỏ vào backend đang chạy", () => {
  expect(API_ORIGIN).toBe("http://localhost:1133");
  expect(API_BASE_URL).toBe("http://localhost:1133/api/v1");
});

/**
 * Cột Select do import dựng ra, chạy trên backend THẬT.
 *
 * Nhãn của nó lấy từ chính file, và điều đáng kiểm là chúng KHỚP được với dữ
 * liệu sinh ra chúng: trước đây cột mới ra đời rỗng nhãn nên mọi ô đều rơi.
 * Chỗ này chỉ chứng minh được khi ghi thật, vì client và server đúc nhãn ở hai
 * nơi khác nhau và phải ra cùng một kết quả.
 */
describe("import dựng cột Select từ giá trị trong file", () => {
  const board = { id: "", nodeId: "" };

  beforeAll(async () => {
    // Khối này chạy SAU bài đăng xuất, nên phiên đã bị thu hồi — lấy lại đúng
    // bằng đường mà UI dùng.
    await authService.login({ email: EMAIL, password: PASSWORD });

    const node = await driveApi.create(ctx.workspaceId, {
      kind: "board",
      name: `Select ${RUN}`,
      parentId: null,
    });

    board.nodeId = node.id;
    board.id = (await boardApi.byNode(node.id)).board.id;
  });

  test("ô của cột đó đọc được, và board mọc ra đúng những nhãn có trong file", async () => {
    const csv = ["Ticket,Stage", "T-1,Open", "T-2,Closed", "T-3,Open", "T-4,Blocked"].join("\n");
    const file = new File([csv], "tickets.csv", { type: "text/csv" });

    const outcome = await boardService.importRows({
      boardId: board.id,
      file,
      hasHeaderRow: true,
      invalidPolicy: "skip",
      mappings: [
        { sourceIndex: 0, target: { kind: "create", name: "Ticket", type: "text" } },
        { sourceIndex: 1, target: { kind: "create", name: "Stage", type: "select" } },
      ],
    });

    // Không dòng nào bị bỏ: nếu nhãn chưa được dựng thì cả bốn dòng đã rơi.
    expect(outcome.created).toBe(4);
    expect(outcome.skipped).toBe(0);

    const columns = await boardService.listColumns(board.id);
    const status = columns.find((column) => column.name === "Stage");

    expect(status?.type).toBe("select");

    const labels =
      status?.type === "select" ? status.config.options.map((o) => o.label) : [];

    // Đúng ba nhãn — "Open" xuất hiện hai lần trong file, không thành hai nhãn.
    expect([...labels].sort()).toEqual(["Blocked", "Closed", "Open"]);
  });
});

/**
 * Lịch sử hoạt động của một dòng.
 *
 * Bug thật: FE khai endpoint này trả về MẢNG, backend trả về TRANG
 * `{ items, nextCursor }`. Fake trong MSW cũng trả mảng, nên 1367 test offline
 * xanh hết trong khi app thật nổ "entries is not iterable" ngay khi mở drawer.
 *
 * Đó là lý do bài này phải sống ở đây: chỉ có socket thật mới phân xử được ai
 * đúng khi hai bên cùng nhất quán với spec riêng của mình.
 */
describe("lịch sử hoạt động của dòng", () => {
  const activity = { boardId: "", rowId: "" };

  beforeAll(async () => {
    // Chạy sau bài đăng xuất — lấy lại phiên bằng đúng đường UI dùng.
    await authService.login({ email: EMAIL, password: PASSWORD });

    const node = await driveApi.create(ctx.workspaceId, {
      kind: "board",
      name: `Nhật ký ${RUN}`,
      parentId: null,
    });

    activity.boardId = (await boardApi.byNode(node.id)).board.id;
    activity.rowId = (await boardService.createRow({ boardId: activity.boardId })).id;
  });

  test("service trả về MẢNG, không phải cái vỏ envelope", async () => {
    const entries = await boardService.listActivity(activity.boardId, activity.rowId);

    // `[...entries]` là đúng thao tác đã nổ trong groupActivityByDay.
    expect(Array.isArray(entries)).toBe(true);
    expect(() => [...entries]).not.toThrow();
  });

  test("và tầng api nói đúng hình dạng dây mà server thật gửi", async () => {
    const page = await boardRowsApi.activity(activity.boardId, activity.rowId);

    expect(Array.isArray(page.items)).toBe(true);
    expect(page).toHaveProperty("nextCursor");
  });

  test("mọi bản ghi có createdAt phân giải được — nếu không thì gom theo ngày sai", async () => {
    const entries = await boardService.listActivity(activity.boardId, activity.rowId);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
    }
  });
});
