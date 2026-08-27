"use client";

import { cva } from "class-variance-authority";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RadioGroupContextValue {
  /** Shared `name`, which is what makes the platform treat these as one group. */
  readonly name: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly isGroupDisabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

/**
 * Items read their name, checked state and handler from the group rather than
 * repeating them at every option — that repetition is exactly what drifts, and
 * a single mistyped `name` silently splits one group into two that can both be
 * selected at once.
 */
function useRadioGroup(componentName: string): RadioGroupContextValue {
  const context = useContext(RadioGroupContext);
  if (context === null) {
    throw new Error(`<${componentName}> must be rendered inside a <RadioGroup>.`);
  }
  return context;
}

export interface RadioGroupProps
  extends Omit<ComponentProps<"fieldset">, "onChange" | "defaultValue" | "value" | "name"> {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Rendered as the `<legend>`. Omit it only when a heading above already names the group. */
  readonly label?: ReactNode;
  /** Only needed to keep two groups apart across a remount; otherwise generated. */
  readonly name?: string;
  /**
   * Layout for the options themselves. `className` styles the fieldset, which
   * is the wrong box to make a grid out of — the legend would become a grid
   * item. Pass `grid grid-cols-3 gap-2` here for a row of cards.
   */
  readonly listClassName?: string;
  /** Disables every option at once, for a group the viewer may read but not change. */
  readonly disabled?: boolean;
}

/**
 * A set of mutually exclusive options.
 *
 * Real `<input type="radio">` elements underneath, so roving focus, the arrow
 * keys and the "only one at a time" rule all come from the platform. Re-built
 * out of divs, every one of those has to be written by hand and one of them is
 * always missing.
 */
export function RadioGroup({
  value,
  onValueChange,
  label,
  name,
  listClassName,
  disabled = false,
  className,
  children,
  ...props
}: RadioGroupProps) {
  // A group with no explicit name still needs one the browser can group by,
  // and two of these on the same screen must not collide.
  const generatedName = useId();

  return (
    <fieldset data-slot="radio-group" className={cn("min-w-0", className)} {...props}>
      {/* The caption speaks in the same voice as `Label` in field.tsx. A radio
          group and a form field stacked in one dialog were captioning
          themselves in two registers — uppercase micro-caps against sentence
          case — which reads as two products, not two controls. */}
      {label !== undefined && (
        <legend className="mb-1.5 text-body font-medium text-muted-foreground">
          {label}
        </legend>
      )}

      <div className={cn("flex flex-col gap-1", listClassName)}>
        <RadioGroupContext.Provider
          value={{
            name: name ?? generatedName,
            value,
            onValueChange,
            isGroupDisabled: disabled,
          }}
        >
          {children}
        </RadioGroupContext.Provider>
      </div>
    </fieldset>
  );
}

interface RadioMarkProps extends Omit<ComponentProps<"input">, "type" | "checked"> {
  readonly isChecked: boolean;
}

/**
 * The input itself, styled — same native-first shape as Checkbox, so a radio
 * and a checkbox sitting in one form are the same size and weight. The dot is
 * drawn over the input instead of by the platform because `accent-color`
 * cannot be given the border, hover and disabled treatment the rest of the
 * controls share.
 */
function RadioMark({ isChecked, className, ...props }: RadioMarkProps) {
  return (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        type="radio"
        checked={isChecked}
        className={cn(
          "size-4 cursor-pointer appearance-none rounded-full border transition-colors outline-none",
          "disabled:cursor-not-allowed",
          isChecked
            ? "border-accent bg-accent"
            : "border-border-strong bg-surface enabled:hover:border-accent",
          className,
        )}
        {...props}
      />

      {isChecked && (
        <span className="pointer-events-none absolute size-1.5 rounded-full bg-accent-foreground" />
      )}
    </span>
  );
}

export interface RadioGroupItemProps
  extends Omit<
    ComponentProps<"input">,
    "type" | "name" | "value" | "checked" | "onChange" | "size" | "children"
  > {
  readonly value: string;
  readonly label: ReactNode;
  /** The consequence of picking this one, when the label alone does not say it. */
  readonly description?: ReactNode;
}

/** One option in a list: the control, its label, and optionally what it does. */
export function RadioGroupItem({
  value,
  label,
  description,
  disabled,
  className,
  ...props
}: RadioGroupItemProps) {
  const group = useRadioGroup("RadioGroupItem");
  const isChecked = group.value === value;
  const isDisabled = disabled === true || group.isGroupDisabled;

  return (
    <label
      className={cn(
        "flex items-start gap-2 text-ui",
        isDisabled
          ? "cursor-not-allowed opacity-[var(--disabled-opacity)]"
          : "cursor-pointer",
        className,
      )}
    >
      {/* A 16px control against an 18px line box: one pixel down puts it on the
          label's optical centre and keeps it there when a description wraps. */}
      <RadioMark
        isChecked={isChecked}
        name={group.name}
        value={value}
        disabled={isDisabled}
        onChange={() => group.onValueChange(value)}
        className="mt-px focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      />

      <span className="min-w-0 flex-1">
        <span className="block text-foreground">{label}</span>
        {description !== undefined && (
          <span className="mt-0.5 block text-body text-faint-foreground">{description}</span>
        )}
      </span>
    </label>
  );
}

const radioCardVariants = cva(
  // The ring lands on the card rather than on the control inside it, because in
  // the stacked layout the control is visually hidden and the card is the only
  // thing a keyboard user can see they have landed on.
  "relative rounded-lg border transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
  {
    variants: {
      layout: {
        row: "flex items-start gap-2.5 px-3 py-2",
        stack: "flex flex-col items-start gap-1 p-2.5 text-left",
      },
      isSelected: {
        true: "border-accent bg-accent-soft",
        false: "border-border bg-surface",
      },
      isDisabled: {
        true: "cursor-not-allowed opacity-[var(--disabled-opacity)]",
        false: "cursor-pointer",
      },
    },
    compoundVariants: [
      // Only an option that can still be picked reacts to the pointer; a hover
      // on a dead card promises something the click will not deliver.
      {
        isSelected: false,
        isDisabled: false,
        class: "hover:border-border-strong hover:bg-hover",
      },
    ],
    defaultVariants: { layout: "row", isSelected: false, isDisabled: false },
  },
);

export interface RadioCardProps
  extends Omit<
    ComponentProps<"input">,
    "type" | "name" | "value" | "checked" | "onChange" | "size" | "children"
  > {
  readonly value: string;
  readonly label: ReactNode;
  readonly description?: ReactNode;
  /** An icon element — it inherits the card's selected/unselected colour. */
  readonly icon?: ReactNode;
  /** Trailing detail, such as the row count a format would write. */
  readonly meta?: ReactNode;
  /** `row` for a list of choices, `stack` for a grid of icon-led cards. */
  readonly layout?: "row" | "stack";
}

/**
 * An option as a bordered, clickable card.
 *
 * `stack` hides the control and lets the card's own border carry the selection,
 * which is how the export-format cards already read. Hidden, not removed: it is
 * still the real radio, so it still takes focus and still moves with the arrow
 * keys — a card that only responds to a click strands anyone not using a mouse.
 */
export function RadioCard({
  value,
  label,
  description,
  icon,
  meta,
  layout = "row",
  disabled,
  className,
  ...props
}: RadioCardProps) {
  const group = useRadioGroup("RadioCard");
  const isSelected = group.value === value;
  const isDisabled = disabled === true || group.isGroupDisabled;

  const inputProps = {
    name: group.name,
    value,
    disabled: isDisabled,
    onChange: () => group.onValueChange(value),
    ...props,
  };

  return (
    <label className={cn(radioCardVariants({ layout, isSelected, isDisabled }), className)}>
      {layout === "row" ? (
        <RadioMark isChecked={isSelected} className="mt-px" {...inputProps} />
      ) : (
        <input type="radio" checked={isSelected} className="sr-only" {...inputProps} />
      )}

      {icon !== undefined && (
        <span
          className={cn(
            "[&_svg]:size-4 [&_svg]:shrink-0",
            isSelected ? "text-accent" : "text-faint-foreground",
          )}
        >
          {icon}
        </span>
      )}

      <span className={cn("min-w-0", layout === "row" && "flex-1")}>
        <span className="block text-ui font-medium text-foreground">{label}</span>
        {description !== undefined && (
          <span className="mt-0.5 block text-body leading-snug text-faint-foreground">
            {description}
          </span>
        )}
      </span>

      {meta !== undefined && (
        <span className="mt-0.5 shrink-0 text-body text-faint-foreground">{meta}</span>
      )}
    </label>
  );
}
