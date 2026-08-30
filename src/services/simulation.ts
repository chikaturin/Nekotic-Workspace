export type ListFailureMode = "none" | "network" | "permission" | "empty";

export type LatencyProfile = "fast" | "normal" | "slow";

export interface SimulationConfig {
  readonly listFailure: ListFailureMode;
  readonly failUploads: boolean;
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

export const UPLOAD_FAILURE_MARKER = "fail";

export function shouldFailUpload(fileName: string): boolean {
  return config.failUploads || fileName.toLowerCase().includes(UPLOAD_FAILURE_MARKER);
}

export function shouldFailSave(title: string): boolean {
  return config.failSaves || title.toLowerCase().includes(UPLOAD_FAILURE_MARKER);
}

export function shouldFailWrite(): boolean {
  return config.failSaves;
}
