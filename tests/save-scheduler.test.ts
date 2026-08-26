import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { autosaveReducer, INITIAL_SAVE_STATE } from "@/lib/autosave";
import { createSaveScheduler } from "@/lib/save-scheduler";
import { ServiceError, appError } from "@/services/errors";
import type { AutosaveEvent } from "@/lib/autosave";
import type { SaveState } from "@/types";

const DELAY = 500;

interface Harness {
  readonly saved: string[];
  readonly events: AutosaveEvent[];
  /** Save state as the indicator would show it. */
  state: () => SaveState;
  resolveNext: () => void;
  rejectNext: (error: unknown) => void;
}

function createHarness(options: { enabled?: boolean } = {}) {
  const saved: string[] = [];
  const events: AutosaveEvent[] = [];
  const gates: { resolve: () => void; reject: (error: unknown) => void }[] = [];

  const scheduler = createSaveScheduler<string>({
    delayMs: DELAY,
    isEnabled: () => options.enabled ?? true,
    now: () => "2026-08-26T10:00:00.000Z",
    onEvent: (event) => events.push(event),
    save: (draft) =>
      new Promise<void>((resolve, reject) => {
        saved.push(draft);
        gates.push({
          resolve: () => resolve(),
          reject: (error) => reject(error),
        });
      }),
  });

  const harness: Harness = {
    saved,
    events,
    state: () => events.reduce(autosaveReducer, INITIAL_SAVE_STATE),
    resolveNext: () => gates.shift()?.resolve(),
    rejectNext: (error) => gates.shift()?.reject(error),
  };

  return { scheduler, harness };
}

/** Let queued promise callbacks run without advancing fake timers. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debounce", () => {
  test("nothing is sent before the debounce window closes", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY - 50);

    expect(harness.saved).toHaveLength(0);
    expect(harness.state().hasPendingChanges).toBe(true);
  });

  test("the save fires once the window closes", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(harness.saved).toEqual(["v1"]);
    expect(harness.state().status).toBe("saving");
  });

  test("rapid edits coalesce into a single save of the newest draft", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(100);
    scheduler.schedule("v2");
    await vi.advanceTimersByTimeAsync(100);
    scheduler.schedule("v3");
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(harness.saved).toEqual(["v3"]);
  });

  test("a successful save reports saved and clears the pending flag", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);
    harness.resolveNext();
    await settle();

    expect(harness.state().status).toBe("saved");
    expect(harness.state().hasPendingChanges).toBe(false);
    expect(scheduler.hasPending()).toBe(false);
  });
});

describe("edits during an in-flight save", () => {
  test("the newer draft is sent once the first request lands", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(harness.saved).toEqual(["v1"]);

    // Typed while the first save is still open.
    scheduler.schedule("v2");
    await vi.advanceTimersByTimeAsync(DELAY);
    expect(harness.saved).toEqual(["v1"]);

    harness.resolveNext();
    await settle();

    expect(harness.saved).toEqual(["v1", "v2"]);
  });

  test("only one request is ever in flight", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);
    scheduler.schedule("v2");
    await vi.advanceTimersByTimeAsync(DELAY);
    scheduler.schedule("v3");
    await vi.advanceTimersByTimeAsync(DELAY);

    expect(harness.saved).toEqual(["v1"]);

    harness.resolveNext();
    await settle();

    expect(harness.saved).toEqual(["v1", "v3"]);
  });
});

describe("failures", () => {
  test("a failed save reports the error and keeps the draft for a retry", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);
    harness.rejectNext(new ServiceError(appError("network", "Connection lost")));
    await settle();

    expect(harness.state().status).toBe("error");
    expect(harness.state().error).toBe("Connection lost");
    expect(scheduler.hasPending()).toBe(true);
  });

  test("retry sends the failed draft again", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);
    harness.rejectNext(new ServiceError(appError("network", "Connection lost")));
    await settle();

    void scheduler.retry();
    await settle();
    harness.resolveNext();
    await settle();

    expect(harness.saved).toEqual(["v1", "v1"]);
    expect(harness.state().status).toBe("saved");
  });

  test("a cancellation is not reported as an error", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY);
    harness.rejectNext(new ServiceError(appError("cancelled", "Aborted")));
    await settle();

    expect(harness.events.some((event) => event.type === "save-error")).toBe(false);
  });
});

describe("flush, disable and dispose", () => {
  test("flush skips the debounce", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    void scheduler.flush();
    await settle();

    expect(harness.saved).toEqual(["v1"]);
  });

  test("a disabled scheduler records edits but never sends them", async () => {
    const { scheduler, harness } = createHarness({ enabled: false });

    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY * 3);
    void scheduler.flush();
    await settle();

    expect(harness.saved).toHaveLength(0);
    expect(harness.state().hasPendingChanges).toBe(true);
  });

  test("dispose sends the pending draft exactly once, not once per timer", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(DELAY * 2);

    // Unmounting during the debounce window must not lose the edit — and the
    // cancelled timer must not fire a second save on top of it.
    expect(harness.saved).toEqual(["v1"]);
  });

  test("scheduling after dispose is ignored", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.dispose();
    scheduler.schedule("v1");
    await vi.advanceTimersByTimeAsync(DELAY * 2);

    expect(harness.saved).toHaveLength(0);
    expect(harness.events).toHaveLength(0);
  });
});

describe("read-only pages", () => {
  test("a page locked mid-debounce never sends the queued edit", async () => {
    const saved: string[] = [];
    let isEnabled = true;

    const scheduler = createSaveScheduler<string>({
      delayMs: DELAY,
      isEnabled: () => isEnabled,
      now: () => "2026-08-26T10:00:00.000Z",
      onEvent: () => {},
      save: (draft) => {
        saved.push(draft);
        return Promise.resolve();
      },
    });

    scheduler.schedule("v1");
    isEnabled = false;
    await vi.advanceTimersByTimeAsync(DELAY * 2);

    expect(saved).toHaveLength(0);
    expect(scheduler.hasPending()).toBe(true);
  });

  test("dispose still sends work that was waiting on the debounce", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    scheduler.dispose();
    await settle();

    expect(harness.saved).toEqual(["v1"]);
  });

  test("dispose without flushing drops the pending edit", async () => {
    const { scheduler, harness } = createHarness();

    scheduler.schedule("v1");
    scheduler.dispose({ flushPending: false });
    await vi.advanceTimersByTimeAsync(DELAY * 2);

    expect(harness.saved).toHaveLength(0);
  });
});
