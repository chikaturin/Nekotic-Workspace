import { createTransport } from "@/lib/realtime/transport";
import type {
  RealtimeEvent,
  RealtimeHandler,
  RealtimePayload,
  RealtimeStatus,
  RealtimeTransport,
} from "@/types";

/**
 * Realtime client.
 *
 * Its one job beyond forwarding frames is **exactly-once delivery**: every
 * event carries an id and an id already delivered is dropped. Combined with
 * id-keyed upserts in the stores, a redelivered frame — a reconnect replay, a
 * server echo of a write this tab already applied optimistically — can never
 * duplicate cached state.
 */

/** How many delivered ids to remember. Well past any reconnect replay window. */
const SEEN_LIMIT = 512;

let sequence = 0;

function nextEventId(): string {
  sequence += 1;
  return `evt_${sequence.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

export interface RealtimeClient {
  readonly transportName: string;
  readonly status: RealtimeStatus;
  /** Frames dropped as duplicates — surfaced in diagnostics and asserted in tests. */
  readonly duplicatesDropped: number;
  connect: () => void;
  close: () => void;
  subscribe: (handler: RealtimeHandler) => () => void;
  /** Publish a payload produced by this tab. Returns the frame that was sent. */
  emit: (payload: RealtimePayload) => RealtimeEvent;
  reset: () => void;
}

export function createRealtimeClient(transport: RealtimeTransport): RealtimeClient {
  const handlers = new Set<RealtimeHandler>();
  const seenOrder: string[] = [];
  const seen = new Set<string>();

  let duplicatesDropped = 0;
  let unsubscribe: (() => void) | null = null;

  /** True the first time an id is seen; false — and remembered — afterwards. */
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

      // Publish through the transport rather than calling handlers directly, so
      // a local write and a remote one travel the identical code path.
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

/** The client every store and service shares. Connected on first import. */
export const realtime: RealtimeClient = createRealtimeClient(createTransport());

realtime.connect();
