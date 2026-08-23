import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import wordmarkDarkUrl from "@/assets/brand/refurb-genius-wordmark-dark.svg?url";
import wordmarkLightUrl from "@/assets/brand/refurb-genius-wordmark-light.svg?url";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { initialThemeState } from "@/components/ThemeProviderContext";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/deal-copilot", label: "Deal Copilot" },
  { to: "/trades", label: "Trades" },
  { to: "/trades/new", label: "Post Job" },
] as const;

/** App theme surface, not prefers-color-scheme. Pre-provider: html class / dark-first SSR. */
function useAppBrandSurface(): "light" | "dark" {
  const { resolvedTheme, setTheme } = useTheme();
  if (setTheme === initialThemeState.setTheme) {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  return resolvedTheme;
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const brandSurface = useAppBrandSurface();
  const wordmarkSrc = brandSurface === "dark" ? wordmarkDarkUrl : wordmarkLightUrl;

  return (
    <header
      // Padding on the header (no fixed height) so inset sits above the h-16 row
      // instead of compressing it. Header background still covers the status area.
      className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]"
      data-testid="marketing-navbar"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 items-center" aria-label="Refurb Genius home">
          <img
            src={wordmarkSrc}
            alt=""
            className="h-8 w-auto max-w-[11.5rem] object-contain object-left"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm">
              <Link to={link.to} className="text-muted-foreground hover:text-foreground">
                {link.label}
              </Link>
            </Button>
          ))}
          <div className="mx-2 h-4 w-px bg-border" />
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "signin" }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started free
                </Link>
              </Button>
            </>
          )}
        </nav>

        {/* Mobile: auth buttons + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          {isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/dashboard" data-testid="marketing-nav-dashboard">
                Dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Toggle menu"
            data-testid="marketing-nav-menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border bg-background/95 px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1 border-t border-border" />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Get started free
              </Link>
            )}

            {/* Mobile Theme Toggle */}
            <div className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">
              <span>Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
