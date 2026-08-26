import { describe, expect, test } from "vitest";
import {
  ALL_ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  partitionUploads,
  validateUpload,
} from "@/lib/file-validation";
import {
  createUploadTask,
  isTaskActive,
  isTaskFinished,
  summarizeUploads,
  uploadQueueReducer,
} from "@/lib/upload-queue";
import { fileMetadataEntries, fileSummaryLine } from "@/lib/file-metadata";
import { buildPdf, pdfToBytes } from "@/lib/pdf";
import { findNodeById } from "@/lib/tree";
import { appError } from "@/services/errors";
import { isFile, type FileNode, type UploadTask } from "@/types";
import { buildTestTree, ID } from "./helpers";

function makeFile(name: string, size = 1024, type = "text/plain"): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("upload validation", () => {
  test.each(["notes.txt", "report.pdf", "photo.png", "sheet.xlsx", "data.csv", "service.ts"])(
    "accepts %s",
    (name) => {
      expect(validateUpload(makeFile(name))).toBeNull();
    },
  );

  test("rejects an empty file", () => {
    expect(validateUpload(makeFile("empty.txt", 0))?.code).toBe("validation");
  });

  test("rejects a file over the size limit", () => {
    const error = validateUpload(makeFile("huge.pdf", MAX_UPLOAD_BYTES + 1));

    expect(error?.code).toBe("validation");
    expect(error?.message).toContain("25 MB");
    expect(error?.isRetryable).toBe(false);
  });

  test("rejects an unsupported extension", () => {
    expect(validateUpload(makeFile("virus.exe"))?.message).toContain("not an accepted file type");
  });

  test("the accepted list covers every advertised type", () => {
    for (const extension of ["pdf", "png", "jpg", "xlsx", "csv", "txt"]) {
      expect(ALL_ACCEPTED_EXTENSIONS).toContain(extension);
    }
  });

  test("partition splits a mixed drop", () => {
    const { accepted, rejected } = partitionUploads([
      makeFile("a.txt"),
      makeFile("b.exe"),
      makeFile("c.png"),
    ]);

    expect(accepted.map((file) => file.name)).toEqual(["a.txt", "c.png"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.error.code).toBe("validation");
  });
});

describe("upload queue", () => {
  const task = (id: string): UploadTask => createUploadTask(id, makeFile(`${id}.txt`, 2048), "folder");

  test("tasks start queued at zero progress", () => {
    const created = task("t1");

    expect(created.status).toBe("queued");
    expect(created.progress).toBe(0);
    expect(created.folderId).toBe("folder");
    expect(isTaskActive(created)).toBe(true);
  });

  test("enqueue appends to the queue", () => {
    const tasks = uploadQueueReducer([], { type: "enqueue", tasks: [task("t1"), task("t2")] });
    expect(tasks).toHaveLength(2);
  });

  test("progress clamps to the 0–1 range", () => {
    const tasks = uploadQueueReducer([task("t1")], { type: "progress", id: "t1", progress: 4 });

    expect(tasks[0]?.progress).toBe(1);
    expect(tasks[0]?.status).toBe("uploading");
  });

  test("progress on a cancelled task is ignored", () => {
    const cancelled = uploadQueueReducer([task("t1")], { type: "cancel", id: "t1" });
    const after = uploadQueueReducer(cancelled, { type: "progress", id: "t1", progress: 0.5 });

    expect(after[0]?.status).toBe("cancelled");
    expect(after[0]?.progress).toBe(0);
  });

  test("success records the asset and completes the bar", () => {
    const tasks = uploadQueueReducer([task("t1")], { type: "success", id: "t1", assetId: "asset_1" });

    expect(tasks[0]?.status).toBe("success");
    expect(tasks[0]?.progress).toBe(1);
    expect(tasks[0]?.assetId).toBe("asset_1");
    expect(isTaskFinished(tasks[0]!)).toBe(true);
  });

  test("failure keeps the error for the retry button", () => {
    const error = appError("upload_failed", "Upload failed");
    const tasks = uploadQueueReducer([task("t1")], { type: "error", id: "t1", error });

    expect(tasks[0]?.status).toBe("error");
    expect(tasks[0]?.error?.isRetryable).toBe(true);
  });

  test("retry resets progress and clears the error", () => {
    const failed = uploadQueueReducer([task("t1")], {
      type: "error",
      id: "t1",
      error: appError("network", "Down"),
    });
    const retried = uploadQueueReducer(failed, { type: "retry", id: "t1" });

    expect(retried[0]?.status).toBe("queued");
    expect(retried[0]?.progress).toBe(0);
    expect(retried[0]?.error).toBeNull();
  });

  test("a completed task cannot be cancelled after the fact", () => {
    const done = uploadQueueReducer([task("t1")], { type: "success", id: "t1", assetId: "a" });
    const after = uploadQueueReducer(done, { type: "cancel", id: "t1" });

    expect(after[0]?.status).toBe("success");
  });

  test("remove and clear-finished prune the queue", () => {
    const queued = uploadQueueReducer([], { type: "enqueue", tasks: [task("t1"), task("t2")] });
    const finished = uploadQueueReducer(queued, { type: "success", id: "t1", assetId: "a" });

    expect(uploadQueueReducer(finished, { type: "remove", id: "t2" })).toHaveLength(1);
    expect(uploadQueueReducer(finished, { type: "clear-finished" }).map((item) => item.id)).toEqual([
      "t2",
    ]);
  });

  test("unknown ids leave the queue untouched", () => {
    const tasks = uploadQueueReducer([task("t1")], { type: "progress", id: "nope", progress: 1 });
    expect(tasks[0]?.progress).toBe(0);
  });

  test("summary aggregates the queue", () => {
    const queued = uploadQueueReducer([], { type: "enqueue", tasks: [task("a"), task("b"), task("c")] });
    const withSuccess = uploadQueueReducer(queued, { type: "success", id: "a", assetId: "x" });
    const withFailure = uploadQueueReducer(withSuccess, {
      type: "error",
      id: "b",
      error: appError("network", "Down"),
    });

    const summary = summarizeUploads(withFailure);

    expect(summary).toMatchObject({ total: 3, completed: 1, failed: 1, active: 1 });
    expect(summary.progress).toBeCloseTo(1 / 3);
  });

  test("an empty queue reports zero progress", () => {
    expect(summarizeUploads([])).toMatchObject({ total: 0, progress: 0 });
  });
});

describe("file metadata", () => {
  const node = (): FileNode => {
    const found = findNodeById(buildTestTree(), ID.spec);
    if (!found || !isFile(found)) throw new Error("fixture missing");
    return found;
  };

  test("exposes the required metadata contract", () => {
    const labels = fileMetadataEntries(node()).map((entry) => entry.label);

    expect(labels).toEqual(["Name", "Type", "Size", "Owner", "Created", "Modified", "Version"]);
  });

  test("values are rendered, never raw", () => {
    const entries = fileMetadataEntries(node());
    const size = entries.find((entry) => entry.label === "Size");

    expect(size?.value).toMatch(/\d/);
    expect(fileSummaryLine(node())).toContain("PDF");
  });
});

describe("pdf generation", () => {
  test("produces a parseable single-page document", () => {
    const pdf = buildPdf({ title: "Spec", lines: ["one", "two"] });

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Page");
  });

  test("the xref offset points at the xref table", () => {
    const pdf = buildPdf({ title: "Spec", lines: [] });
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);

    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  });

  test("escapes parentheses so the content stream stays valid", () => {
    const pdf = buildPdf({ title: "Spec (v2)", lines: [] });
    expect(pdf).toContain("\\(v2\\)");
  });

  test("bytes match the string length", () => {
    const pdf = buildPdf({ title: "Spec", lines: [] });
    expect(pdfToBytes(pdf)).toHaveLength(pdf.length);
  });
});
