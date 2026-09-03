import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { BrandLogo } from "@/components/BrandLogo";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/deal-copilot", label: "Deal Copilot" },
  { to: "/trades", label: "Trades" },
  { to: "/trades/new", label: "Post Job" },
] as const;

/** Raised semantic card control: White/#162A41 against canvas, not a primary fill. */
const NAV_CONTROL_CLASS =
  "border border-border bg-card font-semibold text-foreground shadow-sm hover:bg-section hover:text-foreground";

/** Restrained active route: keep the raised surface; Teal indicator only. */
const NAV_CONTROL_ACTIVE_CLASS =
  "relative text-foreground after:absolute after:inset-x-2 after:bottom-1 after:h-0.5 after:rounded-full after:bg-accent";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  return (
    <header
      // Padding on the header (no fixed height) so inset sits above the h-16 row
      // instead of compressing it. Header background still covers the status area.
      className="sticky top-0 z-40 w-full border-b border-border bg-background supports-[padding:max(0px)]:pt-[env(safe-area-inset-top)]"
      data-testid="marketing-navbar"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2" aria-label="Refurb Genius home">
          <BrandLogo
            variant="primary"
            surface="adaptive"
            decorative
            className="h-8 w-auto min-w-[7.5rem] max-w-full"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Button key={link.to} asChild variant="ghost" size="sm" className={NAV_CONTROL_CLASS}>
              <Link
                to={link.to}
                activeProps={{
                  className: NAV_CONTROL_ACTIVE_CLASS,
                  "aria-current": "page",
                }}
              >
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
              <Button asChild variant="ghost" size="sm" className={NAV_CONTROL_CLASS}>
                <Link to="/auth" search={{ mode: "signin" }} data-testid="marketing-nav-sign-in">
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  data-testid="marketing-nav-get-started"
                >
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
            <Button asChild variant="ghost" size="sm" className={NAV_CONTROL_CLASS}>
              <Link to="/auth" search={{ mode: "signin" }}>
                Sign in
              </Link>
            </Button>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={`rounded-md p-1.5 ${NAV_CONTROL_CLASS}`}
            aria-label="Toggle menu"
            data-testid="marketing-nav-menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-3 py-2 text-sm ${NAV_CONTROL_CLASS}`}
                activeProps={{
                  className: NAV_CONTROL_ACTIVE_CLASS,
                  "aria-current": "page",
                }}
              >
                {link.label}
              </Link>
            ))}
            <div className="my-1 border-t border-border" />
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                onClick={() => setMenuOpen(false)}
                className="rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Get started free
              </Link>
            )}

            {/* Mobile Theme Toggle */}
            <div
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${NAV_CONTROL_CLASS}`}
            >
              <span>Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
