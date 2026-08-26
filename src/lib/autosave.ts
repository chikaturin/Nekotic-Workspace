import type { SaveState } from "@/types";

export const AUTOSAVE_DEBOUNCE_MS = 500;

export const INITIAL_SAVE_STATE: SaveState = {
  status: "idle",
  lastSavedAt: null,
  error: null,
  hasPendingChanges: false,
};

export type AutosaveEvent =
  | { readonly type: "edit" }
  | { readonly type: "save-start" }
  | { readonly type: "save-success"; readonly savedAt: string }
  | { readonly type: "save-error"; readonly message: string }
  | { readonly type: "reset"; readonly savedAt: string | null };

/**
 * Save-indicator state machine. Kept pure so the debounce timing (the React
 * side) and the reported status can be reasoned about — and tested — apart.
 */
export function autosaveReducer(state: SaveState, event: AutosaveEvent): SaveState {
  switch (event.type) {
    case "edit":
      return {
        ...state,
        // A save already in flight keeps reporting "saving" while the new edit
        // queues behind it.
        status: state.status === "saving" ? "saving" : "idle",
        error: null,
        hasPendingChanges: true,
      };

    case "save-start":
      return { ...state, status: "saving", error: null, hasPendingChanges: false };

    case "save-success":
      return {
        status: state.hasPendingChanges ? "idle" : "saved",
        lastSavedAt: event.savedAt,
        error: null,
        hasPendingChanges: state.hasPendingChanges,
      };

    case "save-error":
      return {
        ...state,
        status: "error",
        error: event.message,
        // The edit is still unsaved, so a retry has something to send.
        hasPendingChanges: true,
      };

    case "reset":
      return { ...INITIAL_SAVE_STATE, lastSavedAt: event.savedAt };
  }
}

/** True when a save should be kicked off for the current state. */
export function shouldSave(state: SaveState): boolean {
  return state.hasPendingChanges && state.status !== "saving";
}

/** True when leaving the page would lose work. */
export function hasUnsavedWork(state: SaveState): boolean {
  return state.hasPendingChanges || state.status === "saving" || state.status === "error";
}
