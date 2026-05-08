import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "default" | "accent" | "success" | "warning" | "destructive" | "muted";

const toneClasses: Record<Tone, string> = {
  default: "bg-secondary text-foreground border-border",
  accent: "bg-accent/10 text-accent border-accent/20",
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-border",
};

export type StatusBadgeProps = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

export function StatusBadge({ children, tone = "default", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
