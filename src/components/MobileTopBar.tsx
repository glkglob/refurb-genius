import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export function MobileTopBar() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
      <Link to="/dashboard" className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          Refurb<span className="text-accent">Genius</span>
        </span>
      </Link>
      <div className="flex items-center gap-1">
        <Button asChild size="icon" variant="ghost">
          <Link to="/projects/new" aria-label="New project">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
        <Button size="icon" variant="ghost" onClick={handleLogout} aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
