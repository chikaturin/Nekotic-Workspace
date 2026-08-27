"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const switchVariants = cva("relative inline-flex shrink-0 items-center rounded-full", {
  variants: {
    size: {
      sm: "h-3.5 w-6.5",
      md: "h-4.5 w-8",
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * The thumb is a flex child rather than an absolutely centred one so the only
 * transform on it is the horizontal travel — mixing a centring `-translate-y`
 * into the same property is what makes a sliding thumb drift vertically
 * mid-transition. Travel is (track − thumb − 2× the 2px inset), which is why
 * each size needs its own value instead of a shared one.
 */
const switchThumbVariants = cva(
  "pointer-events-none relative ml-0.5 rounded-full shadow-raise transition-transform duration-150",
  {
    variants: {
      size: {
        sm: "size-2.5",
        md: "size-3.5",
      },
      /* `accent-foreground` is the token guaranteed to be legible on `accent`,
         so the thumb stays visible in both themes. A hard-coded white one
         disappears into the dark theme's pale blue accent. */
      isOn: {
        true: "bg-accent-foreground",
        false: "bg-surface",
      },
    },
    compoundVariants: [
      { size: "sm", isOn: true, class: "translate-x-3" },
      { size: "md", isOn: true, class: "translate-x-3.5" },
    ],
    defaultVariants: { size: "md", isOn: false },
  },
);

export interface SwitchProps
  extends Omit<ComponentProps<"input">, "type" | "role" | "checked" | "onChange" | "size">,
    VariantProps<typeof switchVariants> {
  readonly checked: boolean;
  readonly onCheckedChange?: (checked: boolean) => void;
}

/**
 * A persisted on/off setting.
 *
 * Native `<input type="checkbox">` underneath, for the same reasons as
 * Checkbox: Space toggles it, it participates in a form, and the checked state
 * is reported by the platform rather than by us remembering to mirror it.
 * `role="switch"` is the whole point of the component — a button carrying
 * `aria-pressed` announces "pressed", which describes a momentary action, not
 * a setting that stays where you left it after the dialog closes.
 *
 * It has no built-in label, so give it one: wrap it in a `<label>` or pass
 * `aria-label`. An unlabelled switch announces only "on".
 */
export function Switch({
  checked,
  onCheckedChange,
  size,
  disabled,
  className,
  ...props
}: SwitchProps) {
  return (
    <span
      data-slot="switch"
      className={cn(
        switchVariants({ size }),
        // Dimming the wrapper rather than the input keeps the thumb and the
        // track fading together; dimming the input alone leaves a bright thumb
        // floating over a washed-out track.
        disabled && "opacity-[var(--disabled-opacity)]",
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          "absolute inset-0 size-full cursor-pointer appearance-none rounded-full outline-none transition-colors duration-150",
          "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
          checked
            ? "bg-accent enabled:hover:bg-accent-hover"
            : "bg-border-strong enabled:hover:bg-faint-foreground",
        )}
        {...props}
      />

      <span className={switchThumbVariants({ size, isOn: checked })} />
    </span>
  );
}
