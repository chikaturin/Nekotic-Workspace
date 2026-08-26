"use client";

import { create } from "zustand";
import { ROLE_LABELS, sameSubject } from "@/lib/permissions";
import { seedAccessRules } from "@/mock/access";
import { CURRENT_USER, DIRECTORY } from "@/mock/users";
import { auditService } from "@/services/audit-service";
import { nowIso } from "@/services/backend";
import type { AccessRule, AccessSubject, DriveNode, WorkspaceRole } from "@/types";

/**
 * Access rules and role preview (SY-INH-43, SY-RBC-42).
 *
 * Rules are keyed by workspace, then by the node they are written on — the
 * shape the resolver walks. Every write goes through one of the two actions
 * below, which is also why every write reaches the audit log.
 */

const EMPTY_RULES: Readonly<Record<string, readonly AccessRule[]>> = {};

type RulesByNode = Readonly<Record<string, readonly AccessRule[]>>;

interface PermissionState {
  readonly rulesByWorkspace: Readonly<Record<string, RulesByNode>>;
  /**
   * Role the UI is being previewed as. Null means the user's own role. It can
   * only ever narrow what is on screen — see `useEffectiveRole`.
   */
  readonly previewRole: WorkspaceRole | null;
  readonly seed: number;
}

interface PermissionActions {
  /** Write or replace the rule for one subject on one node. */
  setAccessRule: (workspaceId: string, node: DriveNode, subject: AccessSubject, role: WorkspaceRole) => void;
  /** Remove the rule written here, so the node inherits again. */
  clearAccessRule: (workspaceId: string, node: DriveNode, subject: AccessSubject) => void;
  setPreviewRole: (role: WorkspaceRole | null) => void;
  reset: () => void;
}

function subjectLabel(subject: AccessSubject): string {
  if (subject.kind === "role") return `everyone with the ${ROLE_LABELS[subject.role]} role`;
  return DIRECTORY.find((person) => person.id === subject.userId)?.name ?? "a member";
}

const initialState = (): PermissionState => ({
  rulesByWorkspace: seedAccessRules(),
  previewRole: null,
  seed: 0,
});

export const usePermissionStore = create<PermissionState & PermissionActions>((set) => ({
  ...initialState(),

  setAccessRule: (workspaceId, node, subject, role) =>
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
        grantedBy: CURRENT_USER.id,
      };

      auditService.record({
        module: "workspace",
        action: "workspace.permission.manage",
        actor: CURRENT_USER,
        severity: "warn",
        target: node.name,
        detail: `${subjectLabel(subject)} set to ${ROLE_LABELS[role]} on this item.`,
      });

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
    }),

  clearAccessRule: (workspaceId, node, subject) =>
    set((state) => {
      const forWorkspace = state.rulesByWorkspace[workspaceId] ?? EMPTY_RULES;
      const existing = forWorkspace[node.id] ?? [];
      const remaining = existing.filter((candidate) => !sameSubject(candidate.subject, subject));
      if (remaining.length === existing.length) return state;

      auditService.record({
        module: "workspace",
        action: "workspace.permission.manage",
        actor: CURRENT_USER,
        severity: "warn",
        target: node.name,
        detail: `${subjectLabel(subject)} now inherits access instead of holding it here.`,
      });

      const next = { ...forWorkspace };
      if (remaining.length === 0) delete next[node.id];
      else next[node.id] = remaining;

      return { rulesByWorkspace: { ...state.rulesByWorkspace, [workspaceId]: next } };
    }),

  setPreviewRole: (previewRole) => set({ previewRole }),

  reset: () => set(initialState()),
}));

/** Rules for one workspace. Returns the stored object, never a fresh one. */
export const selectRulesFor =
  (workspaceId: string) =>
  (state: PermissionState): RulesByNode =>
    state.rulesByWorkspace[workspaceId] ?? EMPTY_RULES;

export const selectPreviewRole = (state: PermissionState): WorkspaceRole | null =>
  state.previewRole;
