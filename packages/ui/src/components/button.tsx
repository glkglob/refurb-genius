import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-[1px] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "btn-primary-cta",
        destructive:
          "bg-destructive text-destructive-foreground shadow-md shadow-destructive/25 hover:brightness-110",
        outline:
          "border border-border bg-card text-foreground shadow-sm hover:border-primary/50 hover:bg-primary/10 hover:text-foreground",
        secondary:
          "border border-border/80 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-secondary hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline font-semibold",
      },
      size: {
        default: "h-11 px-5 py-2 text-sm",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 rounded-xl px-8 text-base font-semibold",
        icon: "h-10 w-10 rounded-xl",
        touch: "h-11 px-6 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants };
