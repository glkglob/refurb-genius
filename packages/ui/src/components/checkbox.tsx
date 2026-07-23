"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "../lib/utils";

/**
 * Accessible checkbox without Radix bubble-input.
 * Radix injects `<input aria-hidden tabIndex={-1}>` which fails axe
 * "aria-hidden-focus". This native control keeps the onCheckedChange API
 * used across the app while remaining keyboard- and form-friendly.
 */
export type CheckboxProps = Omit<React.ComponentPropsWithoutRef<"button">, "onChange" | "type"> & {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Optional name for native form submission via a non-hidden sibling input. */
  name?: string;
  value?: string;
  required?: boolean;
};

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      className,
      checked,
      defaultChecked,
      onCheckedChange,
      disabled,
      name,
      value = "on",
      required,
      id,
      ...props
    },
    ref,
  ) => {
    const [uncontrolled, setUncontrolled] = React.useState(Boolean(defaultChecked));
    const isControlled = checked !== undefined;
    const isChecked = isControlled ? checked === true || checked === "indeterminate" : uncontrolled;
    const isIndeterminate = checked === "indeterminate";

    function toggle() {
      if (disabled) return;
      const next = !isChecked;
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next);
    }

    return (
      <span className="relative inline-flex shrink-0">
        <button
          type="button"
          role="checkbox"
          id={id}
          ref={ref}
          aria-checked={isIndeterminate ? "mixed" : isChecked}
          aria-required={required || undefined}
          disabled={disabled}
          data-state={isIndeterminate ? "indeterminate" : isChecked ? "checked" : "unchecked"}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              toggle();
            }
          }}
          className={cn(
            "peer grid h-5 w-5 place-content-center rounded-md border-2 shadow-sm transition-colors",
            "border-primary/55 bg-field text-primary-foreground",
            "hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
            className,
          )}
          {...props}
        >
          {(isChecked || isIndeterminate) && (
            <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden focusable={false} />
          )}
        </button>
        {/* Real form control — not aria-hidden, not tabbable; mirrors button state */}
        {name ? (
          <input
            type="checkbox"
            name={name}
            value={value}
            checked={isChecked}
            required={required}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden={false}
            readOnly
            className="pointer-events-none absolute h-px w-px opacity-0"
            // Keep in a11y tree as decorative form bridge only; button is the exposed control
            style={{ position: "absolute", clip: "rect(0,0,0,0)" }}
          />
        ) : null}
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
