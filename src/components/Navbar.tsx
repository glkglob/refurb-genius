import { Link } from "@tanstack/react-router";
import { Building2, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/deal-copilot", label: "Deal Copilot" },
  { to: "/trades", label: "Trades" },
  { to: "/trades/new", label: "Post Job" },
] as const;

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Refurb<span className="text-accent">Genius</span>
          </span>
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
        </nav>

        {/* Mobile: auth buttons + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth" search={{ mode: "signin" }}>
              Sign in
            </Link>
          </Button>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Toggle menu"
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
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              onClick={() => setMenuOpen(false)}
              className="rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get started free
            </Link>

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
