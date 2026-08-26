import { beforeEach, describe, expect, test } from "vitest";
import { findNodeById } from "@/lib/tree";
import { resetSimulation, setSimulation } from "@/services/simulation";
import { useUploadStore } from "@/store/upload-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { childrenOf } from "@/types";
import { buildTestTree, ID } from "./helpers";

const WORKSPACE_ID = "ws_test";

function makeFile(name: string, size = 1024, type = "text/plain"): File {
  const file = new File(["payload"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const uploads = () => useUploadStore.getState();
const tree = () => useWorkspaceStore.getState().treeByWorkspace[WORKSPACE_ID] ?? [];

beforeEach(() => {
  resetSimulation();
  setSimulation({ latency: "fast" });

  useUploadStore.setState({ tasks: [], isPanelOpen: false });
  useWorkspaceStore.setState({
    activeWorkspaceId: WORKSPACE_ID,
    treeByWorkspace: { [WORKSPACE_ID]: buildTestTree() },
    feedback: null,
    seed: 0,
  });
});

describe("startUploads", () => {
  test("uploads several files and files them in the target folder", async () => {
    const assets = await uploads().startUploads(
      [makeFile("one.txt"), makeFile("two.md")],
      ID.frontend,
    );

    expect(assets).toHaveLength(2);
    expect(childrenOf(findNodeById(tree(), ID.frontend)!)).toHaveLength(2);
    expect(uploads().tasks.every((task) => task.status === "success")).toBe(true);
    expect(uploads().isPanelOpen).toBe(true);
  });

  test("rejected files never reach the queue but do report an error", async () => {
    const assets = await uploads().startUploads([makeFile("virus.exe")], ID.frontend);

    expect(assets).toHaveLength(0);
    expect(uploads().tasks).toHaveLength(0);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });

  test("an empty selection does nothing", async () => {
    expect(await uploads().startUploads([], null)).toHaveLength(0);
    expect(uploads().tasks).toHaveLength(0);
  });

  test("a failing upload lands in the error state and can be retried", async () => {
    await uploads().startUploads([makeFile("will-fail.txt")], ID.frontend);

    const failed = uploads().tasks[0];
    expect(failed?.status).toBe("error");
    expect(failed?.error?.isRetryable).toBe(true);
    expect(childrenOf(findNodeById(tree(), ID.frontend)!)).toHaveLength(0);
  });

  test("retrying a fixed upload succeeds", async () => {
    setSimulation({ failUploads: true });
    await uploads().startUploads([makeFile("report.txt")], ID.frontend);
    expect(uploads().tasks[0]?.status).toBe("error");

    setSimulation({ failUploads: false });
    const taskId = uploads().tasks[0]!.id;
    uploads().retryUpload(taskId);

    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(uploads().tasks[0]?.status).toBe("success");
    expect(childrenOf(findNodeById(tree(), ID.frontend)!)).toHaveLength(1);
  });

  test("mixed batches upload what they can", async () => {
    const assets = await uploads().startUploads(
      [makeFile("good.txt"), makeFile("bad.exe"), makeFile("will-fail.md")],
      null,
    );

    expect(assets).toHaveLength(1);
    expect(uploads().tasks.map((task) => task.status).sort()).toEqual(["error", "success"]);
  });
});

describe("queue management", () => {
  test("uploadOne resolves with the single asset", async () => {
    const asset = await uploads().uploadOne(makeFile("solo.txt"), null);
    expect(asset?.name).toBe("solo.txt");
  });

  test("uploadOne resolves null when the file is rejected", async () => {
    expect(await uploads().uploadOne(makeFile("nope.exe"), null)).toBeNull();
  });

  test("cancelling an in-flight upload marks it cancelled", async () => {
    const pending = uploads().startUploads([makeFile("slow.txt")], null);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const taskId = uploads().tasks[0]?.id;
    if (taskId) uploads().cancelUpload(taskId);
    await pending;

    expect(uploads().tasks[0]?.status).toBe("cancelled");
  });

  test("finished tasks can be removed and cleared", async () => {
    await uploads().startUploads([makeFile("a.txt")], null);
    const taskId = uploads().tasks[0]!.id;

    uploads().removeTask(taskId);
    expect(uploads().tasks).toHaveLength(0);

    await uploads().startUploads([makeFile("b.txt")], null);
    uploads().clearFinished();
    expect(uploads().tasks).toHaveLength(0);
  });

  test("the panel can be collapsed", () => {
    uploads().setPanelOpen(true);
    expect(uploads().isPanelOpen).toBe(true);

    uploads().setPanelOpen(false);
    expect(uploads().isPanelOpen).toBe(false);
  });
});

describe("permission gate", () => {
  test("uploads into a restricted folder someone else owns are refused", async () => {
    const tree = buildTestTree();
    const restricted = tree.map((node) =>
      node.id === ID.development
        ? { ...node, isRestricted: true, owner: { ...node.owner, id: "usr_someone_else" } }
        : node,
    );

    useWorkspaceStore.setState({
      activeWorkspaceId: WORKSPACE_ID,
      treeByWorkspace: { [WORKSPACE_ID]: restricted },
      feedback: null,
    });

    const assets = await uploads().startUploads([makeFile("notes.txt")], ID.development);

    expect(assets).toHaveLength(0);
    expect(uploads().tasks).toHaveLength(0);
    expect(useWorkspaceStore.getState().feedback?.message).toContain("permission");
  });

  test("uploads to a folder that no longer exists are refused", async () => {
    const assets = await uploads().startUploads([makeFile("notes.txt")], "ghost_folder");

    expect(assets).toHaveLength(0);
    expect(useWorkspaceStore.getState().feedback?.tone).toBe("error");
  });
});
