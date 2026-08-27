"use client";

import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends ComponentProps<"label"> {
  /**
   * Draws the marker after the caption. It is presentation only — pass
   * `required` (or `aria-required`) to the control as well, which `FormField`
   * does for you.
   */
  readonly isRequired?: boolean;
}

/**
 * The caption above a control.
 *
 * These exact classes were written out eight times across five files, always
 * on a <span> inside a wrapping <label>. That spelling gives you the click
 * target but nothing else: a <span> has no `htmlFor`, so the control has no id
 * anybody refers to, which is why `aria-describedby` appears nowhere in this
 * app. This is a real <label> and can point at a control anywhere in the tree.
 */
export function Label({ className, isRequired = false, children, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn("mb-1 block text-body font-medium text-muted-foreground", className)}
      {...props}
    >
      {children}
      {isRequired && (
        // Hidden from assistive technology on purpose: the control carries
        // `required`, and a reader that announced the asterisk as well would
        // say "required" twice for one field.
        <span aria-hidden="true" className="ml-0.5 text-danger">
          *
        </span>
      )}
    </label>
  );
}

/**
 * The sentence under a control that explains it.
 *
 * It sits outside the <label> so `aria-describedby` can point at it: a screen
 * reader announces the label first to say what the field is, then the
 * description to explain it. Inside the label both would be read as the name.
 */
export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("mt-1 text-micro text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * The sentence under a control that says why the value was refused.
 *
 * `role="alert"` because an error almost always appears while the field still
 * has focus. `aria-describedby` is only read when focus arrives, so without
 * the live region the one person guaranteed not to hear the message is the
 * one who just typed the value that caused it.
 */
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

/** The wiring `FormField` hands to the control it wraps. */
export interface FieldControlProps {
  readonly id: string;
  readonly required: true | undefined;
  readonly "aria-invalid": true | undefined;
  readonly "aria-describedby": string | undefined;
}

export interface FormFieldProps {
  readonly label: ReactNode;
  /** Replaced by `error` while there is one — they are never both on screen. */
  readonly description?: ReactNode;
  /** Anything truthy puts the field in its invalid state. */
  readonly error?: ReactNode;
  readonly isRequired?: boolean;
  readonly className?: string;
  readonly children: (control: FieldControlProps) => ReactNode;
}

/**
 * A label, a control, and the one message underneath it.
 *
 * Every form in this app writes those three pieces by hand and loses the
 * wiring between them: `htmlFor` appears exactly once in the whole repo and
 * `aria-describedby` not at all, so a caption is not a click target and the
 * sentence explaining what went wrong is invisible to a screen reader. The
 * ids are generated here and handed to the control, because then the only way
 * to forget them is to not use this component.
 *
 * The control is a render prop rather than a plain child. The ids have to land
 * on the <input> or <select> itself, and this component cannot see the shape
 * of an arbitrary child well enough to clone one and inject them — a render
 * prop makes the spread the caller's own visible line of code:
 *
 *   <FormField label="Workspace name" error={nameError} isRequired>
 *     {(field) => <Input {...field} value={name} onChange={rename} />}
 *   </FormField>
 */
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
  // One id for both messages, because only one of them is ever rendered:
  // `aria-describedby` then stays the same string whatever the field's state.
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

      {/* The error replaces the description rather than stacking under it.
          Two lines of small print, one of which the field has just proved did
          not work, is noise at the moment the reader needs one instruction. */}
      {hasError && <FieldError id={messageId}>{error}</FieldError>}
      {!hasError && hasMessage && (
        <FieldDescription id={messageId}>{description}</FieldDescription>
      )}
    </div>
  );
}
