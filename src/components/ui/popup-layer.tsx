"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  closePopupLayer,
  openPopupLayer,
  type PopupLayerId,
} from "@/lib/popup-registry";

/**
 * Phần React của luật "mỗi lúc chỉ một popup" — xem `@/lib/popup-registry`.
 *
 * Context mang theo chuỗi tổ tiên, nên popup lồng trong popup vẫn nhận ra nhau
 * dù nội dung đã bị portal đưa ra khỏi cây DOM.
 */
const AncestryContext = createContext<readonly PopupLayerId[]>([]);

interface PopupLayerInput {
  readonly open?: boolean | undefined;
  readonly defaultOpen?: boolean | undefined;
  readonly onOpenChange?: ((open: boolean) => void) | undefined;
}

export interface PopupLayer {
  readonly isOpen: boolean;
  readonly setOpen: (next: boolean) => void;
  readonly ancestry: readonly PopupLayerId[];
}

export function usePopupLayer({
  open,
  defaultOpen = false,
  onOpenChange,
}: PopupLayerInput): PopupLayer {
  const id = useId();
  const parents = useContext(AncestryContext);
  const ancestry = useMemo(() => [...parents, id], [parents, id]);

  const isControlled = open !== undefined;
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isOpen = isControlled ? open : uncontrolled;

  // Ghi trong effect chứ không phải lúc render: ref là ô nhớ ngoài luồng render.
  const latestChange = useRef(onOpenChange);
  useEffect(() => {
    latestChange.current = onOpenChange;
  });

  const setOpen = useCallback((next: boolean) => {
    setUncontrolled(next);
    latestChange.current?.(next);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      closePopupLayer(id);
      return;
    }

    openPopupLayer(id, ancestry, () => setOpen(false));

    return () => closePopupLayer(id);
  }, [isOpen, id, ancestry, setOpen]);

  return { isOpen, setOpen, ancestry };
}

export function PopupAncestry({
  ancestry,
  children,
}: {
  readonly ancestry: readonly PopupLayerId[];
  readonly children: ReactNode;
}) {
  return <AncestryContext.Provider value={ancestry}>{children}</AncestryContext.Provider>;
}
