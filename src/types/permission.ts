/** Actions the UI can gate on. Never inferred inline — always via `lib/permissions`. */
export type Capability = "view" | "edit" | "upload" | "delete" | "share" | "manage";

export type CapabilitySet = Readonly<Record<Capability, boolean>>;

export const NO_CAPABILITIES: CapabilitySet = {
  view: false,
  edit: false,
  upload: false,
  delete: false,
  share: false,
  manage: false,
};
