import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/config/api";
import { documentFake } from "../fake/document.fake";

const url = (path: string) => `${API_BASE_URL}${path}`;

const notFound = (what: string) =>
  HttpResponse.json(
    {
      error: {
        code: "not_found",
        message: `${what} could not be found`,
        isRetryable: false,
      },
    },
    { status: 404 },
  );

const conflict = (message: string) =>
  HttpResponse.json(
    { error: { code: "conflict", message, isRetryable: false } },
    { status: 409 },
  );

/** Context `documents`: nội dung, khoá/ghim và lịch sử phiên bản. */
export const documentHandlers = [
  http.get(url("/nodes/:nodeId/document"), ({ params }) => {
    const document = documentFake.find(params.nodeId as string);

    return document === null
      ? notFound("That document")
      : HttpResponse.json(document);
  }),

  http.put(url("/nodes/:nodeId/document"), async ({ params, request }) => {
    const draft = (await request.json()) as Parameters<
      typeof documentFake.save
    >[1];
    const result = documentFake.save(params.nodeId as string, draft);

    return "conflict" in result
      ? conflict(result.conflict)
      : HttpResponse.json(result.document);
  }),

  http.put(url("/nodes/:nodeId/document/pin"), ({ params }) =>
    answer(documentFake.setPinned(params.nodeId as string, true)),
  ),
  http.delete(url("/nodes/:nodeId/document/pin"), ({ params }) =>
    answer(documentFake.setPinned(params.nodeId as string, false)),
  ),
  http.put(url("/nodes/:nodeId/document/lock"), ({ params }) =>
    answer(documentFake.setLocked(params.nodeId as string, true)),
  ),
  http.delete(url("/nodes/:nodeId/document/lock"), ({ params }) =>
    answer(documentFake.setLocked(params.nodeId as string, false)),
  ),

  http.get(url("/nodes/:nodeId/versions"), ({ params }) =>
    HttpResponse.json({
      items: documentFake.versions(params.nodeId as string),
      nextCursor: null,
    }),
  ),

  http.get(url("/nodes/:nodeId/versions/:versionId"), ({ params }) => {
    const document = documentFake.find(params.nodeId as string);
    const blocks = documentFake.snapshot(params.versionId as string);

    if (document === null || blocks === null) return notFound("That version");

    return HttpResponse.json({ ...document, blocks });
  }),

  http.post(
    url("/nodes/:nodeId/versions/:versionId/restore"),
    ({ params }) => {
      const nodeId = params.nodeId as string;
      const document = documentFake.find(nodeId);
      const blocks = documentFake.snapshot(params.versionId as string);

      if (document === null || blocks === null) return notFound("That version");

      // Khôi phục đi qua `save`, nên một trang đang khoá từ chối khôi phục vì
      // đúng lý do nó từ chối một lần sửa.
      const result = documentFake.save(nodeId, {
        title: document.title,
        icon: document.icon,
        blocks,
      });

      return "conflict" in result
        ? conflict(result.conflict)
        : HttpResponse.json(result.document);
    },
  ),
];

function answer(document: unknown): Response {
  return document === null
    ? notFound("That document")
    : HttpResponse.json(document);
}
