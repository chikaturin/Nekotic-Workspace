"use client";

import { cva } from "class-variance-authority";
import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RadioGroupContextValue {
  readonly name: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly isGroupDisabled: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

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
  readonly label?: ReactNode;
  readonly name?: string;
  readonly listClassName?: string;
  readonly disabled?: boolean;
}

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
  const generatedName = useId();

  return (
    <fieldset data-slot="radio-group" className={cn("min-w-0", className)} {...props}>
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
  readonly description?: ReactNode;
}

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
  readonly icon?: ReactNode;
  readonly meta?: ReactNode;
  readonly layout?: "row" | "stack";
}

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
