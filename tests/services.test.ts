import { beforeEach, describe, expect, test } from "vitest";
import { blockIcon, BLOCK_PLACEHOLDER, TEXT_BLOCK_CLASS } from "@/lib/block-visuals";
import { BLOCK_COMMANDS } from "@/lib/block-commands";
import { fileService } from "@/services/file-service";
import { linkService } from "@/services/link-service";
import {
  appError,
  isCancellation,
  isServiceError,
  ServiceError,
  toAppError,
} from "@/services/errors";
import { delay, nextId } from "@/services/backend";
import { resetSimulation, setSimulation, shouldFailSave, shouldFailUpload } from "@/services/simulation";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isFile, type FileNode } from "@/types";
import { buildTestTree, ID } from "./helpers";
import { findNodeById } from "@/lib/tree";
import { CURRENT_USER } from "@/mock/users";

const WORKSPACE_ID = "ws_test";

function makeFile(name: string, size = 512, type = "text/plain"): File {
  const file = new File(["content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });
  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    selectedIds: [],
    feedback: null,
    seed: 0,
  });
});

describe("errors", () => {
  test("normalises service errors, DOM aborts and unknowns", () => {
    const service = new ServiceError(appError("network", "Down"));

    expect(toAppError(service).code).toBe("network");
    expect(toAppError(new DOMException("aborted", "AbortError")).code).toBe("cancelled");
    expect(toAppError(new Error("boom")).code).toBe("unknown");
    expect(toAppError("weird").code).toBe("unknown");
  });

  test("retryability follows the error code unless overridden", () => {
    expect(appError("network", "x").isRetryable).toBe(true);
    expect(appError("validation", "x").isRetryable).toBe(false);
    expect(appError("validation", "x", { isRetryable: true }).isRetryable).toBe(true);
  });

  test("cancellations are recognisable", () => {
    expect(isCancellation(appError("cancelled", "x"))).toBe(true);
    expect(isServiceError(new Error("plain"))).toBe(false);
  });
});

describe("backend helpers", () => {
  test("ids are unique", () => {
    expect(nextId("asset")).not.toBe(nextId("asset"));
  });

  test("delay rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(delay(5, controller.signal)).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "cancelled",
    );
  });

  test("delay rejects when the signal aborts mid-flight", async () => {
    const controller = new AbortController();
    const pending = delay(200, controller.signal);
    controller.abort();

    await expect(pending).rejects.toThrow();
  });
});

describe("simulation switches", () => {
  test("uploads fail by name or by switch", () => {
    expect(shouldFailUpload("please-fail.txt")).toBe(true);
    expect(shouldFailUpload("ok.txt")).toBe(false);

    setSimulation({ failUploads: true });
    expect(shouldFailUpload("ok.txt")).toBe(true);
  });

  test("saves fail by title or by switch", () => {
    expect(shouldFailSave("this will FAIL")).toBe(true);
    expect(shouldFailSave("fine")).toBe(false);

    setSimulation({ failSaves: true });
    expect(shouldFailSave("fine")).toBe(true);
  });
});

describe("file service uploads", () => {
  test("reports progress and returns an asset", async () => {
    const progress: number[] = [];

    const asset = await fileService.upload({
      file: makeFile("report.txt", 2048),
      folderId: ID.frontend,
      owner: CURRENT_USER,
      onProgress: (value) => progress.push(value),
    });

    expect(asset.name).toBe("report.txt");
    expect(asset.sizeBytes).toBe(2048);
    expect(asset.kind).toBe("document");
    expect(asset.folderId).toBe(ID.frontend);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toHaveLength(12);
  });

  test("rejects a file the workspace does not accept", async () => {
    await expect(
      fileService.upload({
        file: makeFile("virus.exe"),
        folderId: null,
        owner: CURRENT_USER,
        onProgress: () => {},
      }),
    ).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "validation",
    );
  });

  test("fails late for a file marked to fail", async () => {
    await expect(
      fileService.upload({
        file: makeFile("will-fail.txt"),
        folderId: null,
        owner: CURRENT_USER,
        onProgress: () => {},
      }),
    ).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "upload_failed",
    );
  });

  test("aborts when the caller cancels", async () => {
    const controller = new AbortController();
    const pending = fileService.upload({
      file: makeFile("slow.txt"),
      folderId: null,
      owner: CURRENT_USER,
      onProgress: () => controller.abort(),
      signal: controller.signal,
    });

    await expect(pending).rejects.toThrow();
  });
});

describe("file service listing", () => {
  test("returns the files of a folder", async () => {
    const files = await fileService.listFiles({ folderId: ID.payment, canView: true });

    expect(files.map((file) => file.name).sort()).toEqual(["flow.png", "spec.pdf"]);
  });

  test("lists the workspace root when no folder is given", async () => {
    const files = await fileService.listFiles({ folderId: null, canView: true });
    expect(files.every(isFile)).toBe(true);
  });

  test("refuses when the caller cannot view the folder", async () => {
    await expect(
      fileService.listFiles({ folderId: ID.payment, canView: false }),
    ).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "permission_denied",
    );
  });

  test("reports an unknown folder as not found", async () => {
    await expect(fileService.listFiles({ folderId: "nope", canView: true })).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "not_found",
    );
  });

  test("honours the simulated failure modes", async () => {
    setSimulation({ listFailure: "network" });
    await expect(fileService.listFiles({ folderId: null, canView: true })).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "network",
    );

    setSimulation({ listFailure: "permission" });
    await expect(fileService.listFiles({ folderId: null, canView: true })).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "permission_denied",
    );

    setSimulation({ listFailure: "empty" });
    expect(await fileService.listFiles({ folderId: null, canView: true })).toHaveLength(0);
  });
});

describe("file service previews", () => {
  const fileNode = (id: string): FileNode => {
    const node = findNodeById(useWorkspaceStore.getState().treeByWorkspace[WORKSPACE_ID] ?? [], id);
    if (!node || !isFile(node)) throw new Error("fixture missing");
    return node;
  };

  test("images resolve to an image preview", async () => {
    const preview = await fileService.getPreview(
      fileNode("t_development_backend_payment_flow_png"),
    );

    expect(preview.kind).toBe("image");
  });

  test("PDFs resolve to a pdf preview with a usable url", async () => {
    const preview = await fileService.getPreview(
      fileNode("t_development_backend_payment_spec_pdf"),
    );

    expect(preview.kind).toBe("pdf");
    if (preview.kind === "pdf") expect(preview.url.length).toBeGreaterThan(0);
  });

  test("uploaded text files preview their real content", async () => {
    const asset = await fileService.upload({
      file: new File(["hello from the upload"], "notes.txt", { type: "text/plain" }),
      folderId: null,
      owner: CURRENT_USER,
      onProgress: () => {},
    });

    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      id: asset.id,
      name: asset.name,
      kind: "document",
      extension: "txt",
      mimeType: "text/plain",
    };

    const preview = await fileService.getPreview(node);

    expect(preview.kind).toBe("text");
    if (preview.kind === "text") expect(preview.content).toContain("hello from the upload");
  });

  test("unknown kinds fall back to the unsupported card", async () => {
    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      kind: "video",
      extension: "mp4",
    };

    const preview = await fileService.getPreview(node);

    expect(preview.kind).toBe("unsupported");
    if (preview.kind === "unsupported") expect(preview.reason).toContain("MP4");
  });

  test("editing a text file stores the new bytes", async () => {
    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      id: "text_node",
      name: "runbook.md",
      kind: "document",
      extension: "md",
      mimeType: "text/markdown",
    };

    const result = await fileService.saveText(node, "# Edited in place");

    expect(result.sizeBytes).toBeGreaterThan(0);

    const preview = await fileService.getPreview(node);
    expect(preview.kind).toBe("text");
    if (preview.kind === "text") expect(preview.content).toBe("# Edited in place");
  });

  test("a file that cannot be previewed as text refuses the edit", async () => {
    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      id: "binary_node",
      name: "sheet.xlsx",
      kind: "spreadsheet",
      extension: "xlsx",
      mimeType: "application/vnd.ms-excel",
    };

    await expect(fileService.saveText(node, "nope")).rejects.toSatisfy(
      (error: unknown) => toAppError(error).code === "conflict",
    );
  });

  test("the save-failure switch surfaces a retryable error", async () => {
    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      id: "flaky_node",
      name: "always-fail.txt",
      kind: "document",
      extension: "txt",
      mimeType: "text/plain",
    };

    await expect(fileService.saveText(node, "content")).rejects.toSatisfy(
      (error: unknown) => toAppError(error).isRetryable,
    );
  });

  test("spreadsheets resolve to a grid", async () => {
    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      id: "sheet_node",
      name: "budget.csv",
      kind: "spreadsheet",
      extension: "csv",
      mimeType: "text/csv",
    };

    const preview = await fileService.getPreview(node);

    expect(preview.kind).toBe("sheet");
    if (preview.kind === "sheet") expect(preview.rows.length).toBeGreaterThan(1);
  });

  test("editing a spreadsheet round-trips through the file's own format", async () => {
    const rows = [
      ["Provider", "Limit"],
      ["Stripe", "50,000 USD"],
    ];

    for (const [name, extension] of [
      ["budget.csv", "csv"],
      ["budget.xlsx", "xlsx"],
    ] as const) {
      const node: FileNode = {
        ...fileNode("t_development_backend_payment_spec_pdf"),
        id: `sheet_${extension}`,
        name,
        kind: "spreadsheet",
        extension,
        mimeType: "application/octet-stream",
      };

      const result = await fileService.saveSheet(node, rows);
      expect(result.sizeBytes).toBeGreaterThan(0);

      const preview = await fileService.getPreview(node);
      expect(preview.kind).toBe("sheet");
      if (preview.kind === "sheet") expect(preview.rows).toEqual(rows);
    }
  });

  test("a file that is not a spreadsheet refuses a grid save", async () => {
    const node: FileNode = {
      ...fileNode("t_development_backend_payment_spec_pdf"),
      id: "not_a_sheet",
      name: "notes.txt",
      kind: "document",
      extension: "txt",
      mimeType: "text/plain",
    };

    await expect(fileService.saveSheet(node, [["a"]])).rejects.toSatisfy(
      (error: unknown) => toAppError(error).code === "conflict",
    );
  });


  test("a download url is produced for any file", async () => {
    const url = await fileService.getDownloadUrl(fileNode("t_development_backend_payment_spec_pdf"));
    expect(url.length).toBeGreaterThan(0);
  });

  test("releasing every cached url is safe to call twice", () => {
    expect(() => {
      fileService.releaseAll();
      fileService.releaseAll();
    }).not.toThrow();
  });
});

describe("link service", () => {
  test("resolves metadata from a url", async () => {
    const metadata = await linkService.resolve("https://stripe.com/docs/webhook-signatures");

    expect(metadata.siteName).toBe("stripe.com");
    expect(metadata.title).toBe("Webhook Signatures");
    expect(metadata.url).toContain("https://stripe.com");
  });

  test("adds a protocol when the user omits it", async () => {
    const metadata = await linkService.resolve("example.com/pricing");
    expect(metadata.url.startsWith("https://")).toBe(true);
  });

  test("rejects input that is not a url", async () => {
    await expect(linkService.resolve("not a url")).rejects.toSatisfy(
      (error: unknown) => isServiceError(error) && error.appError.code === "validation",
    );
    await expect(linkService.resolve("   ")).rejects.toThrow();
  });
});

describe("block visuals", () => {
  test("every block type has an icon", () => {
    for (const command of BLOCK_COMMANDS) {
      expect(blockIcon(command.type)).toBeTruthy();
    }
  });

  test("text blocks have typography and placeholders", () => {
    expect(TEXT_BLOCK_CLASS.heading1).toContain("font-semibold");
    expect(BLOCK_PLACEHOLDER.paragraph).toContain("/");
  });
});
