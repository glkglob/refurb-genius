/**
 * Mobile A — top identity chrome only.
 *
 * Primary destinations and More (`mobile-nav-more`) live in MobileBottomNav.
 * This header keeps brand/home and signed-in identity so the destination row
 * is not competing at the top. Profile overflow is identity (sign-out), not a
 * second route map.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";
import { useSignOut } from "@/features/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(nameOrEmail: string | null | undefined): string {
  if (!nameOrEmail) return "U";
  const trimmed = nameOrEmail.trim();
  if (trimmed.includes("@")) return trimmed[0]!.toUpperCase();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed[0]!.toUpperCase();
}

export function MobileTopBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { signOut } = useSignOut();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-border bg-card supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)] lg:hidden"
      data-testid="mobile-top-bar"
    >
      <div
        className="flex min-h-14 items-center justify-between gap-3 px-3 py-1.5"
        data-testid="mobile-top-bar-row"
      >
        <Link
          to="/dashboard"
          className="flex min-h-11 min-w-0 items-center gap-2"
          aria-label="Refurb Genius home"
          data-testid="mobile-nav-brand"
        >
          <BrandLogo variant="compact" surface="adaptive" decorative className="h-8 w-8 shrink-0" />
          <span className="min-w-0 break-words text-sm font-semibold leading-tight text-foreground">
            Refurb Genius
          </span>
        </Link>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted p-0 text-sm font-semibold text-muted-foreground"
                aria-label={`Signed in as ${user.fullName ?? user.email ?? "user"}`}
                data-testid="mobile-top-bar-profile"
              >
                {getInitials(user.fullName ?? user.email)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]" sideOffset={8}>
              <DropdownMenuItem
                className="min-h-11 cursor-pointer gap-2"
                onSelect={(event) => {
                  event.preventDefault();
                  void handleLogout();
                }}
                data-testid="mobile-top-bar-sign-out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  );
}
