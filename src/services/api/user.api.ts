import { apiFetch } from "@/services/http/client";
import type { UserSummary } from "@/types";

export const userApi = {
  byEmail: (email: string, signal?: AbortSignal) =>
    apiFetch<UserSummary | null>("/users", { query: { email }, signal }),

  updateProfile: (
    patch: {
      readonly name?: string;
      readonly avatarUrl?: string;
      readonly accentColor?: string;
      readonly timezone?: string;
    },
  ) => apiFetch<UserSummary>("/me", { method: "PATCH", body: patch }),
};
