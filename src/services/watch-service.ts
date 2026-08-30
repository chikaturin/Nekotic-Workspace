import { isWatchable } from "@/lib/entity-ref";
import { collabApi } from "@/services/api/collab.api";
import { appError, ServiceError } from "@/services/errors";
import type { EntityRef, WatchEntry } from "@/types";

export const watchService = {
  list: (signal?: AbortSignal): Promise<readonly WatchEntry[]> =>
    collabApi.watches(signal),

  setWatching: (ref: EntityRef, isWatching: boolean) => {
    if (!isWatchable(ref)) {
      return Promise.reject(
        new ServiceError(
          appError("validation", `A ${ref.kind} has no activity to follow`, {
            isRetryable: false,
          }),
        ),
      );
    }

    return collabApi.setWatch(ref, isWatching);
  },
};
