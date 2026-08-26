/**
 * Mock-only failure switches. The real services would never ship this, but the
 * UI must prove it renders every state — so the states are triggerable.
 */
export type ListFailureMode = "none" | "network" | "permission" | "empty";

export type LatencyProfile = "fast" | "normal" | "slow";

export interface SimulationConfig {
  readonly listFailure: ListFailureMode;
  /** Force every upload to fail; individual files can also opt in by name. */
  readonly failUploads: boolean;
  /** Force every document save to fail. */
  readonly failSaves: boolean;
  readonly latency: LatencyProfile;
}

const DEFAULT_CONFIG: SimulationConfig = {
  listFailure: "none",
  failUploads: false,
  failSaves: false,
  latency: "normal",
};

export const LATENCY_MS: Readonly<Record<LatencyProfile, number>> = {
  fast: 120,
  normal: 380,
  slow: 1400,
};

let config: SimulationConfig = DEFAULT_CONFIG;
const listeners = new Set<() => void>();

export function getSimulation(): SimulationConfig {
  return config;
}

export function setSimulation(patch: Partial<SimulationConfig>): void {
  config = { ...config, ...patch };
  for (const listener of listeners) listener();
}

export function resetSimulation(): void {
  setSimulation(DEFAULT_CONFIG);
}

export function subscribeSimulation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Files whose name contains this marker always fail to upload. */
export const UPLOAD_FAILURE_MARKER = "fail";

export function shouldFailUpload(fileName: string): boolean {
  return config.failUploads || fileName.toLowerCase().includes(UPLOAD_FAILURE_MARKER);
}

/** Documents whose title contains the marker always fail to save. */
export function shouldFailSave(title: string): boolean {
  return config.failSaves || title.toLowerCase().includes(UPLOAD_FAILURE_MARKER);
}
