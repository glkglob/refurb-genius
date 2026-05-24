import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderPlus,
  Settings,
  Building2,
  LogOut,
  LineChart,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects/new", label: "New Project", icon: FolderPlus },
  { to: "/deal-copilot", label: "Deal Copilot", icon: LineChart },
  { to: "/trades", label: "Trades", icon: Briefcase },
  { to: "/settings", label: "Settings", icon: Settings },
];

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

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
      {/* Brand colour strip */}
      <div className="h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500" />
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-5 w-5" />
        </div>
        <span className="text-base font-semibold text-foreground">
          Refurb<span className="text-accent">Genius</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active = isActivePath(pathname, item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent text-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        {user && (
          <div className="mb-2 flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
              {getInitials(user.fullName ?? user.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">Signed in as</p>
              <p className="truncate text-sm font-medium text-foreground">
                {user.fullName ?? user.email}
              </p>
            </div>
          </div>
        )}

        {/* Theme Toggle */}
        <div className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">
          <span>Theme</span>
          <ThemeToggle />
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
