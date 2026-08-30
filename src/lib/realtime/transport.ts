import { REALTIME_ENDPOINT } from "@/config/app";
import type { RealtimeEvent, RealtimeHandler, RealtimeStatus, RealtimeTransport } from "@/types";

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

export function createTransport(): RealtimeTransport {
  if (REALTIME_ENDPOINT === null) return createLocalTransport();

  return createLocalTransport();
}
