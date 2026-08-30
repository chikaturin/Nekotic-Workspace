"use client";

import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends ComponentProps<"label"> {
  readonly isRequired?: boolean;
}

export function Label({ className, isRequired = false, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn("mb-1 block text-body font-medium text-muted-foreground", className)}
      {...props}
    >
      {children}
      {isRequired && (
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      )}
    </label>
  );
}

export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("mt-1 text-micro text-muted-foreground", className)}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("mt-1 text-micro text-danger", className)}
      {...props}
    />
  );
}

export interface FieldControlProps {
  readonly id: string;
  readonly required: true | undefined;
  readonly "aria-invalid": true | undefined;
  readonly "aria-describedby": string | undefined;
}

export interface FormFieldProps {
  readonly label: ReactNode;
  readonly description?: ReactNode;
  readonly error?: ReactNode;
  readonly isRequired?: boolean;
  readonly className?: string;
  readonly children: (control: FieldControlProps) => ReactNode;
}

export function FormField({
  label,
  description,
  error,
  isRequired = false,
  className,
  children,
}: FormFieldProps) {
  const fieldId = useId();
  const controlId = `${fieldId}-control`;
  const messageId = `${fieldId}-message`;

  const hasError = Boolean(error);
  const hasMessage = hasError || Boolean(description);

  return (
    <div data-slot="form-field" className={cn("min-w-0", className)}>
      <Label htmlFor={controlId} isRequired={isRequired}>
        {label}
      </Label>

      {children({
        id: controlId,
        required: isRequired || undefined,
        "aria-invalid": hasError || undefined,
        "aria-describedby": hasMessage ? messageId : undefined,
      })}

      {hasError && <FieldError id={messageId}>{error}</FieldError>}
      {!hasError && hasMessage && (
        <FieldDescription id={messageId}>{description}</FieldDescription>
      )}
    </div>
  );
}
