import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { inputVariants } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The box the native <select> sits inside.
 *
 * A chevron has to hang off something, and a <select> cannot have children
 * that are not <option>s, so the control gains a wrapper. That wrapper is what
 * `className` reaches: thirty-five call sites already pass `min-w-0 flex-1`,
 * `w-36 shrink-0` or `h-7`, and those words only mean anything on the box that
 * is actually the flex item. The select then fills it, so a caller writing
 * `h-7` still gets a 28px control rather than a 32px one overflowing a 28px
 * shell.
 *
 * The two custom properties exist so the padding that keeps the text off the
 * chevron and the chevron's own inset cannot drift apart: both are stated once
 * per size, and the two children below read them.
 *
 * The text colour is stated here rather than on the select for two reasons.
 * `text-ui` is a font size, but tailwind-merge has no way to know that and
 * files it under colours, so a colour sitting next to it on the same element
 * is dropped as a duplicate. And on the shell it is inherited, which means a
 * caller tinting the control — the select-column colour picker passes the
 * option's colour straight through — actually reaches the text.
 */
const selectShellVariants = cva("relative inline-flex min-w-0 items-center text-foreground", {
  variants: {
    size: {
      xs: "h-[var(--control-xs)] [--select-pad:var(--control-pad-xs)] [--select-chevron:var(--icon-xs)]",
      sm: "h-[var(--control-sm)] [--select-pad:var(--control-pad-sm)] [--select-chevron:var(--icon-sm)]",
      md: "h-[var(--control-md)] [--select-pad:var(--control-pad-md)] [--select-chevron:var(--icon-md)]",
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * What the select adds on top of the shared input shell.
 *
 * `appearance-none` is the whole point of the rewrite: the OS chrome it
 * replaces is drawn by the platform in the platform's colours, so a select was
 * the one control in the app that ignored the theme and stayed light grey on a
 * navy dialog.
 *
 * `block` overrides the `flex` the shell brings along. Display on a <select>
 * is largely the UA's business, but `display: flex` makes its <option>
 * children flex items, which some browsers render by dropping the label text
 * entirely.
 *
 * The type step is restated rather than inherited: globals deliberately does
 * not redefine `--text-ui`, so `text-ui` is still Tailwind's 16px and the
 * 12px step of this app's ramp is spelled `text-ui`.
 */
const selectControlVariants = cva(
  [
    "block h-full cursor-pointer appearance-none",
    // Clear the chevron, or a long option label runs underneath it. `pr` is
    // emitted after `px`, so this wins over the shell's symmetric padding.
    "pr-[calc(var(--select-pad)+var(--select-chevron)+0.25rem)]",
  ].join(" "),
  {
    variants: {
      size: { xs: "text-body", sm: "text-ui", md: "text-ui" },
    },
    defaultVariants: { size: "md" },
  },
);

/**
 * `size` is dropped from the DOM props because `<select size>` is the native
 * "how many rows to show at once" attribute, which would collide with the
 * variant union. Nothing in this app uses it, and a select showing several
 * rows at once is a listbox, not this component.
 */
export type SelectFieldProps = Omit<ComponentProps<"select">, "size"> &
  VariantProps<typeof inputVariants>;

/**
 * A native <select>, wearing the same shell as Input.
 *
 * It stays native on purpose. The keyboard behaviour — typeahead, Home/End,
 * Alt+Down, the mobile wheel — is the platform's and is better than anything
 * worth re-implementing, it is one DOM node, and every call site sits inside a
 * Dialog or a Popover where a second portal holding a listbox is a liability
 * rather than a feature. An option that needs to carry an icon, a colour, an
 * avatar or a description cannot be an <option> and belongs in <Select>.
 *
 * It defaults to `md`, so a Select and an Input standing next to each other
 * are the same height. It used to be 28px against the input's 32px while its
 * own doc comment claimed the two matched.
 */
export function SelectField({
  className,
  variant,
  size,
  disabled = false,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <span
      data-slot="select-field"
      className={cn(selectShellVariants({ size }), className)}
    >
      <select
        data-slot="select"
        disabled={disabled}
        className={cn(inputVariants({ variant, size }), selectControlVariants({ size }))}
        {...props}
      >
        {children}
      </select>

      {/* Drawn over the select, so it must not eat the click that opens it.
          The dimming is driven by the select's `disabled` rather than by a
          `disabled:` variant, because this element has no disabled state of
          its own to hang one on. */}
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 right-[var(--select-pad)] -translate-y-1/2",
          "size-[var(--select-chevron)] text-faint-foreground",
          disabled && "is-disabled",
        )}
      />
    </span>
  );
}

export { selectShellVariants };
