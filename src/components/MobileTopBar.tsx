import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  FolderKanban,
  Home,
  LineChart,
  LogOut,
  MoreHorizontal,
  Plus,
  Settings,
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
import {
  getMobileMoreNavItems,
  getMobilePrimaryNavItems,
  isGlobalNavItemActive,
  type GlobalNavItemId,
} from "@/features/navigation";
import { cn } from "@repo/ui";

/**
 * IA-8 — authenticated mobile chrome (final public-beta structure).
 *
 * Primary: Home | Projects | + New | Copilot | More
 * More: Trades, Settings, Sign out
 *
 * Destinations always come from the canonical GLOBAL_NAV_ITEMS authority
 * via getMobilePrimaryNavItems / getMobileMoreNavItems — no second route map.
 */
const MOBILE_ICONS: Record<GlobalNavItemId, LucideIcon> = {
  dashboard: Home,
  projects: FolderKanban,
  new_analysis: Plus,
  deal_copilot: LineChart,
  trades_marketplace: Briefcase,
  settings: Settings,
};

/** Short labels for the compact primary row (desktop keeps full GLOBAL labels). */
const PRIMARY_SHORT_LABEL: Partial<Record<GlobalNavItemId, string>> = {
  dashboard: "Home",
  projects: "Projects",
  new_analysis: "+ New",
  deal_copilot: "Copilot",
};

const itemButtonClass = (active: boolean, emphasizeNew = false) =>
  cn(
    "flex h-11 min-w-[2.75rem] flex-col items-center justify-center gap-0.5 px-1.5 py-1 text-[10px] leading-none active:scale-[0.97]",
    active && "text-foreground",
    !active && "text-muted-foreground",
    emphasizeNew && "text-primary",
  );

export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const primaryItems = getMobilePrimaryNavItems();
  const moreItems = getMobileMoreNavItems();
  const moreActive = moreItems.some((item) => isGlobalNavItemActive(pathname, item.id));

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-border bg-background/95 px-1.5 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] md:hidden"
      data-testid="mobile-top-bar"
    >
      <Link
        to="/dashboard"
        className="flex h-11 w-11 shrink-0 items-center justify-center"
        aria-label="Refurb Genius home"
        data-testid="mobile-nav-brand"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" aria-hidden />
        </div>
      </Link>

      <nav
        className="flex min-w-0 flex-1 items-center justify-evenly gap-0"
        aria-label="Mobile primary"
        data-testid="mobile-primary-nav"
      >
        {primaryItems.map((item) => {
          const Icon = MOBILE_ICONS[item.id];
          const shortLabel = PRIMARY_SHORT_LABEL[item.id] ?? item.label;
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
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      active ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
                    )}
                    aria-hidden
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
                <span className="mt-px max-w-[3.25rem] truncate font-medium">{shortLabel}</span>
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
              <MoreHorizontal className="h-4 w-4" aria-hidden />
              <span className="mt-px font-medium">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
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
              className="min-h-11 cursor-pointer gap-2"
              onSelect={(event) => {
                // Keep menu from fighting async sign-out navigation.
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
      </nav>
    </header>
  );
}
