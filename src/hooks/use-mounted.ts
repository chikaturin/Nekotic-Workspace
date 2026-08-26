"use client";

import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/** True after hydration — guards browser-only rendering without an effect. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
}
