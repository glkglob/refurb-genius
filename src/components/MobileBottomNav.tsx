/**
 * Mobile A — destination bar (bottom). Consumes GLOBAL_NAV helpers only.
 *
 * Visible primary: Home | Projects | New | Deal Copilot | More
 * More: Trades, Settings, theme, Sign out
 *
 * Hidden from `lg` so tablet 768 uses this chrome, not a persistent Sidebar.
 */
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  FolderKanban,
  Home,
  LineChart,
  LogOut,
  Moon,
  MoreHorizontal,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/features/auth";
import { useTheme } from "@/hooks/useTheme";
import {
  getMobileMoreNavItems,
  getMobilePrimaryNavItems,
  isGlobalNavItemActive,
  type GlobalNavItemId,
} from "@/features/navigation";
import { cn } from "@repo/ui";

const MOBILE_ICONS: Record<GlobalNavItemId, LucideIcon> = {
  dashboard: Home,
  projects: FolderKanban,
  new_analysis: Plus,
  deal_copilot: LineChart,
  trades_marketplace: Briefcase,
  settings: Settings,
};

const PRIMARY_VISIBLE_LABEL: Partial<Record<GlobalNavItemId, string>> = {
  dashboard: "Home",
  projects: "Projects",
  new_analysis: "New",
  deal_copilot: "Deal Copilot",
};

const itemButtonClass = (active: boolean, emphasizeNew = false) =>
  cn(
    "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-xs leading-tight active:scale-[0.97]",
    active && "text-foreground",
    !active && "text-muted-foreground",
    emphasizeNew && "text-primary",
  );

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const { resolvedTheme, toggleTheme } = useTheme();
  const primaryItems = getMobilePrimaryNavItems();
  const moreItems = getMobileMoreNavItems();
  const moreActive = moreItems.some((item) => isGlobalNavItemActive(pathname, item.id));

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobile primary"
      data-testid="mobile-bottom-nav"
    >
      <div className="flex min-h-14 items-stretch justify-evenly gap-0 px-1 py-1">
        {primaryItems.map((item) => {
          const Icon = MOBILE_ICONS[item.id];
          const visibleLabel = PRIMARY_VISIBLE_LABEL[item.id] ?? item.label;
          const active = isGlobalNavItemActive(pathname, item.id);
          const isNew = item.id === "new_analysis";
          const accessibleLabel =
            item.id === "dashboard"
              ? "Home"
              : item.id === "new_analysis"
                ? "New Analysis"
                : item.id === "deal_copilot"
                  ? "Deal Copilot"
                  : item.label;

          return (
            <Button
              key={item.id}
              asChild
              size="sm"
              variant="ghost"
              className={itemButtonClass(active, isNew)}
            >
              <Link
                to={item.to}
                aria-label={accessibleLabel}
                aria-current={active ? "page" : undefined}
                data-testid={`mobile-nav-${item.id}`}
                data-active={active ? "true" : "false"}
              >
                {isNew ? (
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
                    )}
                    aria-hidden
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="max-w-full whitespace-normal text-center font-medium">
                  {visibleLabel}
                </span>
              </Link>
            </Button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className={itemButtonClass(moreActive)}
              aria-label="More navigation"
              data-testid="mobile-nav-more"
              data-active={moreActive ? "true" : "false"}
            >
              <MoreHorizontal className="h-4 w-4 shrink-0" aria-hidden />
              <span className="font-medium">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="min-w-[12rem]"
            sideOffset={8}
            data-testid="mobile-more-menu"
          >
            {moreItems.map((item) => {
              const Icon = MOBILE_ICONS[item.id];
              const active = isGlobalNavItemActive(pathname, item.id);
              return (
                <DropdownMenuItem key={item.id} asChild className="min-h-11 cursor-pointer gap-2">
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    data-testid={`mobile-nav-${item.id}`}
                    data-active={active ? "true" : "false"}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              asChild
              className="min-h-11 cursor-pointer gap-2"
              onSelect={() => {
                toggleTheme();
              }}
            >
              <Button
                type="button"
                variant="ghost"
                className="h-11 w-full justify-start px-2"
                aria-label="Toggle theme"
                data-testid="mobile-nav-theme"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden />
                )}
                <span>Theme</span>
              </Button>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-11 cursor-pointer gap-2"
              onSelect={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
              data-testid="mobile-nav-sign-out"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
