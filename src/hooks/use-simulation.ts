"use client";

import { useSyncExternalStore } from "react";
import {
  getSimulation,
  setSimulation,
  subscribeSimulation,
  type SimulationConfig,
} from "@/services/simulation";

const SERVER_SNAPSHOT: SimulationConfig = {
  listFailure: "none",
  failUploads: false,
  failSaves: false,
  latency: "normal",
};

export function useSimulation(): {
  config: SimulationConfig;
  update: (patch: Partial<SimulationConfig>) => void;
} {
  const config = useSyncExternalStore(subscribeSimulation, getSimulation, () => SERVER_SNAPSHOT);
  return { config, update: setSimulation };
}
