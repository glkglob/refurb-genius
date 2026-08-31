import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Building2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/features/auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GLOBAL_NAV_ITEMS, getGlobalNavItem, isGlobalNavItemActive } from "@/features/navigation";

function navItemClass(active: boolean, subordinate = false) {
  return cn(
    "flex min-h-11 items-center rounded-md px-3 py-2 text-sm transition-colors",
    active
      ? "relative bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary dark:bg-accent dark:text-accent-foreground"
      : subordinate
        ? "text-white/55 hover:bg-white/10 hover:text-white dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
        : "text-white/75 hover:bg-white/10 hover:text-white dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground",
  );
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const settingsItem = getGlobalNavItem("settings");
  const settingsActive = isGlobalNavItemActive(pathname, settingsItem.id);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-[#0B1F35] text-[#F5EFE5] lg:flex dark:border-border dark:bg-card dark:text-card-foreground"
      data-testid="app-sidebar"
    >
      <div className="flex min-h-16 items-center gap-2 border-b border-white/10 px-5 py-2 dark:border-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <span className="min-w-0 break-words text-base font-semibold leading-tight">
          Refurb<span className="text-accent">Genius</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Primary">
        {GLOBAL_NAV_ITEMS.filter((item) => item.id !== "settings").map((item) => {
          const active = isGlobalNavItemActive(pathname, item.id);
          return (
            <Link
              key={item.id}
              to={item.to}
              aria-current={active ? "page" : undefined}
              data-testid={`global-nav-${item.id}`}
              data-active={active ? "true" : "false"}
              className={navItemClass(active)}
            >
              <span className="min-w-0 whitespace-normal break-words">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3 dark:border-border">
        <nav aria-label="Settings" className="mb-1">
          <Link
            to={settingsItem.to}
            aria-current={settingsActive ? "page" : undefined}
            data-testid={`global-nav-${settingsItem.id}`}
            data-active={settingsActive ? "true" : "false"}
            className={navItemClass(settingsActive, true)}
          >
            <span className="min-w-0 whitespace-normal break-words">{settingsItem.label}</span>
          </Link>
        </nav>

        {/* Theme Toggle — extra functional chrome, visually subordinate */}
        <div className="mb-1 flex min-h-11 w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium text-white/55 dark:text-muted-foreground">
          <span>Theme</span>
          <ThemeToggle className="text-white/70 hover:bg-white/10 hover:text-white dark:text-foreground dark:hover:bg-secondary" />
        </div>

        <button
          onClick={handleLogout}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-xs font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white dark:text-muted-foreground dark:hover:bg-secondary dark:hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
