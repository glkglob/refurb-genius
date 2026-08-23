import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  FolderPlus,
  Settings,
  Building2,
  LogOut,
  LineChart,
  Briefcase,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSignOut } from "@/features/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  GLOBAL_NAV_ITEMS,
  isGlobalNavItemActive,
  type GlobalNavItemId,
} from "@/features/navigation";

const NAV_ICONS: Record<GlobalNavItemId, LucideIcon> = {
  dashboard: LayoutDashboard,
  projects: FolderKanban,
  new_analysis: FolderPlus,
  deal_copilot: LineChart,
  trades_marketplace: Briefcase,
  settings: Settings,
};

function getInitials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "U";
  const trimmed = nameOrEmail.trim();
  // Email — use first letter before @
  if (trimmed.includes("@")) return trimmed[0].toUpperCase();
  // Full name — use first letters of first two words
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed[0].toUpperCase();
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { signOut } = useSignOut();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0B1F35] text-[#F5EFE5] lg:flex dark:border-border dark:bg-card dark:text-card-foreground"
      data-testid="app-sidebar"
    >
      {/* Brand colour strip */}
      <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500" />
      <div className="flex min-h-16 items-center gap-2 border-b border-white/10 px-5 py-2 dark:border-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <span className="min-w-0 break-words text-base font-semibold leading-tight">
          Refurb<span className="text-accent">Genius</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
        {GLOBAL_NAV_ITEMS.map((item) => {
          const active = isGlobalNavItemActive(pathname, item.id);
          const Icon = NAV_ICONS[item.id];
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={active ? "page" : undefined}
              data-testid={`global-nav-${item.id}`}
              data-active={active ? "true" : "false"}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/10 font-semibold text-white dark:bg-accent dark:text-accent-foreground"
                  : "text-white/75 hover:bg-white/10 hover:text-white dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 whitespace-normal break-words">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 dark:border-border">
        {user && (
          <div className="mb-2 flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white dark:bg-muted dark:text-muted-foreground">
              {getInitials(user.fullName ?? user.email)}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/70 dark:text-muted-foreground">Signed in as</p>
              <p className="break-words text-sm font-medium text-white dark:text-foreground">
                {user.fullName ?? user.email}
              </p>
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <div className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-white/75 dark:text-muted-foreground">
          <span>Theme</span>
          <ThemeToggle className="text-white hover:bg-white/10 hover:text-white dark:text-foreground dark:hover:bg-secondary" />
        </div>

        <button
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
