"use client";

import { create } from "zustand";
import { sameSubject } from "@/lib/permissions";
import { nowIso } from "@/services/backend";
import type { AccessRule, AccessSubject, DriveNode, WorkspaceRole } from "@/types";
import { driveApi } from "@/services/api/drive.api";
import { currentUser } from "@/store/session-store";

export type RulesByNode = Readonly<Record<string, readonly AccessRule[]>>;

export const EMPTY_RULES: RulesByNode = Object.freeze({});

interface PermissionState {
  readonly rulesByWorkspace: Readonly<Record<string, RulesByNode>>;
  readonly previewRole: WorkspaceRole | null;
  readonly seed: number;
}

interface PermissionActions {
  setAccessRule: (
    workspaceId: string,
    node: DriveNode,
    subject: AccessSubject,
    role: WorkspaceRole,
  ) => Promise<void>;
  clearAccessRule: (
    workspaceId: string,
    node: DriveNode,
    subject: AccessSubject,
  ) => Promise<void>;
  hydrateNode: (workspaceId: string, nodeId: string) => Promise<void>;
  setPreviewRole: (role: WorkspaceRole | null) => void;
  reset: () => void;
}

const initialState = (): PermissionState => ({
  rulesByWorkspace: {},
  previewRole: null,
  seed: 0,
});

export const usePermissionStore = create<PermissionState & PermissionActions>((set, get) => ({
  ...initialState(),

  setAccessRule: async (workspaceId, node, subject, role) => {
    await driveApi.setAccessRule(node.id, subject, role);

    set((state) => {
      const forWorkspace = state.rulesByWorkspace[workspaceId] ?? EMPTY_RULES;
      const existing = forWorkspace[node.id] ?? [];
      const seed = state.seed + 1;

      const rule: AccessRule = {
        id: `acl_${seed.toString(36)}`,
        nodeId: node.id,
        subject,
        role,
        grantedAt: nowIso(),
        grantedBy: currentUser().id,
      };

      return {
        seed,
        rulesByWorkspace: {
          ...state.rulesByWorkspace,
          [workspaceId]: {
            ...forWorkspace,
            [node.id]: [...existing.filter((candidate) => !sameSubject(candidate.subject, subject)), rule],
          },
        },
      };
    });
  },

  clearAccessRule: async (workspaceId, node, subject) => {
    const existingRules =
      (get().rulesByWorkspace[workspaceId] ?? EMPTY_RULES)[node.id] ?? [];

    if (
      !existingRules.some((candidate) => sameSubject(candidate.subject, subject))
    ) {
      return;
    }

    await driveApi.setAccessRule(node.id, subject, "none");

    set((state) => {
      const forWorkspace = state.rulesByWorkspace[workspaceId] ?? EMPTY_RULES;
      const existing = forWorkspace[node.id] ?? [];
      const remaining = existing.filter((candidate) => !sameSubject(candidate.subject, subject));
      if (remaining.length === existing.length) return state;

      const next = { ...forWorkspace };
      if (remaining.length === 0) delete next[node.id];
      else next[node.id] = remaining;

      return { rulesByWorkspace: { ...state.rulesByWorkspace, [workspaceId]: next } };
    });
  },

  hydrateNode: async (workspaceId, nodeId) => {
    try {
      const access = await driveApi.access(nodeId);

      set((state) => {
        const forWorkspace = state.rulesByWorkspace[workspaceId] ?? EMPTY_RULES;

        return {
          rulesByWorkspace: {
            ...state.rulesByWorkspace,
            [workspaceId]: {
              ...forWorkspace,
              [nodeId]: access.entries
                .filter((entry) => entry.origin?.nodeId === nodeId)
                .map((entry, index) => ({
                  id: `acl_${nodeId}_${index}`,
                  nodeId,
                  subject: entry.subject,
                  role: entry.role,
                  grantedAt: new Date().toISOString(),
                  grantedBy: entry.subject.kind === "user" ? entry.subject.userId : "",
                })),
            },
          },
        };
      });
    } catch {
    }
  },

  setPreviewRole: (previewRole) => set({ previewRole }),

  reset: () => set(initialState()),
}));

export const selectRulesFor =
  (workspaceId: string) =>
  (state: PermissionState): RulesByNode =>
    state.rulesByWorkspace[workspaceId] ?? EMPTY_RULES;

export const selectPreviewRole = (state: PermissionState): WorkspaceRole | null =>
  state.previewRole;
