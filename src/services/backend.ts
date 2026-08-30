import { cancelled, networkError, permissionDenied } from "@/services/errors";
import { getSimulation, LATENCY_MS } from "@/services/simulation";

let sequence = 0;

export function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelled("Request"));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(cancelled("Request"));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function readDelay(signal?: AbortSignal): Promise<void> {
  return delay(LATENCY_MS[getSimulation().latency], signal);
}

export function writeDelay(signal?: AbortSignal): Promise<void> {
  return delay(Math.round(LATENCY_MS[getSimulation().latency] * 0.6), signal);
}

export function assertNoSimulatedListFailure(subject: string): void {
  const { listFailure } = getSimulation();

  if (listFailure === "network") {
    throw networkError(`Simulated failure while loading ${subject}`);
  }
  if (listFailure === "permission") {
    throw permissionDenied(
      `You do not have access to ${subject}`,
      "Simulated permission failure — switch it off in the simulation menu.",
    );
  }
}

export function isSimulatedEmpty(): boolean {
  return getSimulation().listFailure === "empty";
}

export function nowIso(): string {
  return new Date().toISOString();
}
