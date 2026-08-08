import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Building2,
  Briefcase,
  FolderKanban,
  FolderPlus,
  LineChart,
  LogOut,
  MoreHorizontal,
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
  getGlobalNavItem,
  getMobileMoreNavItems,
  getMobilePrimaryNavItems,
  isGlobalNavItemActive,
  type GlobalNavItemId,
} from "@/features/navigation";

/**
 * IA-7 / IA-7-R2 — authenticated mobile chrome.
 *
 * Keeps the existing compact top bar. Adds a minimal "More" menu so Deal Copilot
 * and Settings are reachable without implementing IA-8's final mobile IA.
 * Destinations always come from the canonical GLOBAL_NAV_ITEMS authority.
 */
const MOBILE_ICONS: Partial<Record<GlobalNavItemId, LucideIcon>> = {
  projects: FolderKanban,
  trades_marketplace: Briefcase,
  new_analysis: FolderPlus,
  deal_copilot: LineChart,
  settings: Settings,
};

const PRIMARY_SHORT_LABEL: Partial<Record<GlobalNavItemId, string>> = {
  projects: "Projects",
  trades_marketplace: "Trades",
  new_analysis: "New",
};

export function MobileTopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const dashboard = getGlobalNavItem("dashboard");
  const primaryItems = getMobilePrimaryNavItems();
  const moreItems = getMobileMoreNavItems();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-1 border-b border-border bg-background/95 px-2 backdrop-blur md:hidden">
      <Link
        to={dashboard.to}
        className="flex min-w-0 shrink items-center gap-1.5"
        aria-label={dashboard.label}
        data-testid="mobile-nav-dashboard"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" aria-hidden />
        </div>
        {/* Wordmark hidden under ~360px to keep 320px chrome overflow-free. */}
        <span className="hidden min-[360px]:inline text-sm font-semibold text-foreground">
          Refurb<span className="text-accent">Genius</span>
        </span>
      </Link>

      <nav
        className="flex shrink-0 items-center gap-0"
        aria-label="Mobile primary"
        data-testid="mobile-primary-nav"
      >
        {primaryItems.map((item) => {
          const Icon = MOBILE_ICONS[item.id] ?? FolderKanban;
          const shortLabel = PRIMARY_SHORT_LABEL[item.id] ?? item.label;
          const active = isGlobalNavItemActive(pathname, item.id);
          return (
            <Button
              key={item.id}
              asChild
              size="sm"
              variant="ghost"
              className={
                active
                  ? "flex h-9 min-w-[40px] flex-col items-center justify-center gap-0 px-1 py-0.5 text-[9px] leading-none text-foreground active:scale-[0.97]"
                  : "flex h-9 min-w-[40px] flex-col items-center justify-center gap-0 px-1 py-0.5 text-[9px] leading-none active:scale-[0.97]"
              }
            >
              <Link
                to={item.to}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                data-testid={`mobile-nav-${item.id}`}
                data-active={active ? "true" : "false"}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="mt-px">{shortLabel}</span>
              </Link>
            </Button>
          );
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="flex h-9 min-w-[40px] flex-col items-center justify-center gap-0 px-1 py-0.5 text-[9px] leading-none active:scale-[0.97]"
              aria-label="More navigation"
              data-testid="mobile-nav-more"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
              <span className="mt-px">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[11rem]" sideOffset={8}>
            {moreItems.map((item) => {
              const Icon = MOBILE_ICONS[item.id] ?? Settings;
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
