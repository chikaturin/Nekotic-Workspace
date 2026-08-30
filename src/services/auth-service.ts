import { apiFetch, apiSend, refreshAccessToken } from "@/services/http/client";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/services/http/access-token";
import type { UserSummary, Workspace } from "@/types";

interface LoginResponse {
  readonly user: UserSummary;
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly workspaces: readonly Workspace[];
}

interface CurrentUserResponse {
  readonly user: UserSummary;
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string | null;
  readonly sessionExpiresAt: string;
}

export interface Session {
  readonly user: UserSummary;
  readonly workspaces: readonly Workspace[];
  readonly activeWorkspaceId: string | null;
}

export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export interface RegistrationInput extends Credentials {
  readonly name: string;
}

export const authService = {
  async register(input: RegistrationInput): Promise<UserSummary> {
    return apiFetch<UserSummary>("/users", { method: "POST", body: input });
  },

  async login(credentials: Credentials): Promise<Session> {
    const response = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: credentials,
      skipRefresh: true,
    });

    setAccessToken(response.accessToken);

    return {
      user: response.user,
      workspaces: response.workspaces,
      activeWorkspaceId: response.workspaces[0]?.id ?? null,
    };
  },

  async logout(): Promise<void> {
    try {
      await apiSend("/auth/logout", { method: "POST" });
    } finally {
      clearAccessToken();
    }
  },

  async restore(): Promise<Session | null> {
    if (getAccessToken() === null && !(await refreshAccessToken())) return null;

    try {
      return await this.current();
    } catch {
      clearAccessToken();

      return null;
    }
  },

  async current(): Promise<Session> {
    const response = await apiFetch<CurrentUserResponse>("/me");

    return {
      user: response.user,
      workspaces: response.workspaces,
      activeWorkspaceId: response.activeWorkspaceId,
    };
  },
};
