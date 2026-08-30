"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { routableHref } from "@/lib/exported-routes";

export function useOpenNode(): (href: string) => void {
  const router = useRouter();

  return useCallback((href: string) => router.push(routableHref(href)), [router]);
}
