import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: "default" | "subtle";
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = "default",
}: Props) {
  const isSubtle = variant === "subtle";
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl text-center ${
        isSubtle
          ? "border border-border/60 bg-muted/30 p-8"
          : "border border-dashed border-border bg-card p-10 sm:p-12"
      }`}
    >
      <div
        className={`flex items-center justify-center rounded-full ${
          isSubtle
            ? "h-10 w-10 bg-background text-muted-foreground"
            : "h-12 w-12 bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className={isSubtle ? "h-5 w-5" : "h-6 w-6"} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
