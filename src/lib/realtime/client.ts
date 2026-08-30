import { createTransport } from "@/lib/realtime/transport";
import type {
  RealtimeEvent,
  RealtimeHandler,
  RealtimePayload,
  RealtimeStatus,
  RealtimeTransport,
} from "@/types";

const SEEN_LIMIT = 512;

let sequence = 0;

function nextEventId(): string {
  sequence += 1;
  return `evt_${sequence.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

export interface RealtimeClient {
  readonly transportName: string;
  readonly status: RealtimeStatus;
  readonly duplicatesDropped: number;
  connect: () => void;
  close: () => void;
  subscribe: (handler: RealtimeHandler) => () => void;
  emit: (payload: RealtimePayload) => RealtimeEvent;
  reset: () => void;
}

export function createRealtimeClient(transport: RealtimeTransport): RealtimeClient {
  const handlers = new Set<RealtimeHandler>();
  const seenOrder: string[] = [];
  const seen = new Set<string>();

  let duplicatesDropped = 0;
  let unsubscribe: (() => void) | null = null;

  function admit(eventId: string): boolean {
    if (seen.has(eventId)) {
      duplicatesDropped += 1;
      return false;
    }

    seen.add(eventId);
    seenOrder.push(eventId);

    while (seenOrder.length > SEEN_LIMIT) {
      const oldest = seenOrder.shift();
      if (oldest !== undefined) seen.delete(oldest);
    }

    return true;
  }

  function deliver(event: RealtimeEvent) {
    if (!admit(event.id)) return;
    for (const handler of [...handlers]) handler(event);
  }

  return {
    get transportName() {
      return transport.name;
    },

    get status() {
      return transport.status;
    },

    get duplicatesDropped() {
      return duplicatesDropped;
    },

    connect() {
      if (unsubscribe) return;
      transport.connect();
      unsubscribe = transport.subscribe(deliver);
    },

    close() {
      unsubscribe?.();
      unsubscribe = null;
      transport.close();
    },

    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },

    emit(payload) {
      const event: RealtimeEvent = {
        id: nextEventId(),
        at: new Date().toISOString(),
        origin: "local",
        payload,
      };

      transport.publish(event);
      return event;
    },

    reset() {
      handlers.clear();
      seenOrder.length = 0;
      seen.clear();
      duplicatesDropped = 0;
    },
  };
}

export const realtime: RealtimeClient = createRealtimeClient(createTransport());

realtime.connect();
