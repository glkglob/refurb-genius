import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  icon,
  action,
  children,
  className,
}: DashboardSectionProps) {
  return (
    <Card className={cn("mb-8 border-border/60 bg-card/80", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          {icon && <span className="text-accent">{icon}</span>}
          {title}
        </h2>
        {action}
      </div>
      <CardContent className="p-6 pt-5">{children}</CardContent>
    </Card>
  );
}
