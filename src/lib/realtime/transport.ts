import { REALTIME_ENDPOINT } from "@/config/app";
import type { RealtimeEvent, RealtimeHandler, RealtimeStatus, RealtimeTransport } from "@/types";

/**
 * Transport abstraction for realtime.
 *
 * The backend has no realtime endpoint yet, so the transport that ships is the
 * in-process one: publishing a frame delivers it to every subscriber in this
 * tab and nothing leaves the browser. That is the honest amount of realtime
 * this deployment can support — the point of the abstraction is that adding a
 * socket later is a new implementation of this interface plus one line in
 * `createTransport`, with no change above it.
 */

/**
 * Same-tab event bus.
 *
 * Delivery is synchronous, and a handler added during a delivery does not
 * receive the frame in flight — the subscriber set is snapshotted first.
 */
export function createLocalTransport(): RealtimeTransport {
  const handlers = new Set<RealtimeHandler>();
  let status: RealtimeStatus = "idle";

  return {
    name: "local",

    get status() {
      return status;
    },

    connect() {
      status = "open";
    },

    close() {
      status = "closed";
      handlers.clear();
    },

    publish(event: RealtimeEvent) {
      if (status !== "open") return;
      for (const handler of [...handlers]) handler(event);
    },

    subscribe(handler: RealtimeHandler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

/**
 * The transport this deployment uses.
 *
 * `REALTIME_ENDPOINT` is null until the backend exposes a socket; when it does
 * not, building a speculative socket client would be inventing a realtime
 * architecture the server cannot answer, so the local bus is used instead.
 */
export function createTransport(): RealtimeTransport {
  if (REALTIME_ENDPOINT === null) return createLocalTransport();

  // A socket transport plugs in here once the endpoint exists. Until then the
  // branch is unreachable by construction rather than by accident.
  return createLocalTransport();
}
