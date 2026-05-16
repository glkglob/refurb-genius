import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LineChart, HardHat, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavEntry {
  to: string;
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  iconColorClass: string;
}

const NAV_ENTRIES: NavEntry[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    description: "Projects, jobs, and saved work",
    icon: LayoutDashboard,
    colorClass: "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10",
    iconColorClass: "text-blue-500",
  },
  {
    to: "/deal-copilot",
    label: "Deal Copilot",
    description: "Analyse property opportunities",
    icon: LineChart,
    colorClass: "border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10",
    iconColorClass: "text-purple-500",
  },
  {
    to: "/trades",
    label: "Trades Marketplace",
    description: "Browse refurbishment jobs",
    icon: HardHat,
    colorClass: "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
    iconColorClass: "text-emerald-500",
  },
  {
    to: "/trades/new",
    label: "Post a Trades Job",
    description: "Create a job for tradespeople",
    icon: Briefcase,
    colorClass: "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
    iconColorClass: "text-amber-500",
  },
];

interface PlatformNavButtonsProps {
  /** Routes to exclude from the grid (e.g. hide current page) */
  exclude?: string[];
  className?: string;
}

export function PlatformNavButtons({ exclude = [], className }: PlatformNavButtonsProps) {
  const entries = NAV_ENTRIES.filter((e) => !exclude.includes(e.to));
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-3",
        entries.length === 4
          ? "sm:grid-cols-4"
          : entries.length === 3
            ? "sm:grid-cols-3"
            : "sm:grid-cols-2",
        className,
      )}
    >
      {entries.map((entry) => (
        <Link
          key={entry.to}
          to={entry.to}
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4 transition-colors",
            entry.colorClass,
          )}
        >
          <entry.icon className={cn("mt-0.5 h-4 w-4 shrink-0", entry.iconColorClass)} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{entry.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
