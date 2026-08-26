import { isWatchable, refKey } from "@/lib/entity-ref";
import { SEED_WATCHES } from "@/mock/collab";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import { nowIso, readDelay, writeDelay } from "@/services/backend";
import { appError, ServiceError } from "@/services/errors";
import type { EntityRef, WatchEntry } from "@/types";

/**
 * Who follows what (CO-WAT-28).
 *
 * Watches are stored per user, exactly as a backend would, so the comment
 * fan-out can ask "who should hear about this?" without the UI having to
 * assemble a recipient list.
 */

/** userId → targetKey → entry. */
const byUser = new Map<string, Map<string, WatchEntry>>();

function inbox(userId: string): Map<string, WatchEntry> {
  const existing = byUser.get(userId);
  if (existing) return existing;

  const created = new Map<string, WatchEntry>();
  byUser.set(userId, created);
  return created;
}

let isSeeded = false;

function seed(): void {
  if (isSeeded) return;
  isSeeded = true;

  const since = nowIso();
  for (const ref of SEED_WATCHES) {
    inbox(CURRENT_USER.id).set(refKey(ref), { targetKey: refKey(ref), ref, since });
  }

  // Teammates follow the sprint record too, so the fan-out has real recipients.
  const shared = SEED_WATCHES[0];
  if (shared) {
    for (const person of DIRECTORY.slice(1, 3)) {
      inbox(person.id).set(refKey(shared), { targetKey: refKey(shared), ref: shared, since });
    }
  }
}

/** Everything one user follows. */
async function list(userId: string, signal?: AbortSignal): Promise<readonly WatchEntry[]> {
  await readDelay(signal);
  seed();
  return [...inbox(userId).values()];
}

export interface SetWatchInput {
  readonly ref: EntityRef;
  readonly userId: string;
  readonly isWatching: boolean;
}

/**
 * Follow or unfollow a target. Only records, documents and boards can be
 * watched — anything else is rejected rather than silently ignored.
 */
async function setWatching(
  { ref, userId, isWatching }: SetWatchInput,
  signal?: AbortSignal,
): Promise<readonly WatchEntry[]> {
  await writeDelay(signal);
  seed();

  if (!isWatchable(ref)) {
    throw new ServiceError(
      appError("validation", `A ${ref.kind} has no activity to follow`, { isRetryable: false }),
    );
  }

  const key = refKey(ref);
  const entries = inbox(userId);

  if (isWatching) entries.set(key, { targetKey: key, ref, since: nowIso() });
  else entries.delete(key);

  return [...entries.values()];
}

/**
 * Users following a target, minus `exceptUserId`.
 *
 * Synchronous because it is a server-side lookup inside another write, not a
 * request the client makes on its own.
 */
function watchersOf(targetKey: string, exceptUserId?: string): readonly string[] {
  seed();

  const followers: string[] = [];
  for (const [userId, entries] of byUser) {
    if (userId === exceptUserId || !entries.has(targetKey)) continue;
    followers.push(userId);
  }

  return followers;
}

/** Follow on first comment — the behaviour that keeps "Following" meaningful. */
function autoWatch(ref: EntityRef, userId: string): void {
  if (!isWatchable(ref)) return;
  seed();

  const key = refKey(ref);
  const entries = inbox(userId);
  if (entries.has(key)) return;

  entries.set(key, { targetKey: key, ref, since: nowIso() });
}

/** Test seam. */
function reset(): void {
  byUser.clear();
  isSeeded = false;
}

export const watchService = { list, setWatching, watchersOf, autoWatch, reset };
