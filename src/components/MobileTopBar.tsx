import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut, Plus, Briefcase, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/features/auth";

/**
 * IA-7 — mobile chrome preserves existing compact pattern (IA-8 owns redesign).
 * Labels/routes align with canonical product destinations without a new IA.
 */
export function MobileTopBar() {
  const navigate = useNavigate();
  const { signOut } = useSignOut();
  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur md:hidden">
      <Link to="/dashboard" className="flex items-center gap-2" aria-label="Dashboard">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building2 className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          Refurb<span className="text-accent">Genius</span>
        </span>
      </Link>
      <div className="flex items-center gap-0.5">
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="flex h-9 min-w-[48px] flex-col items-center justify-center gap-0 px-1.5 py-0.5 text-[9px] leading-none active:scale-[0.97]"
        >
          <Link to="/projects" aria-label="Projects">
            <FolderKanban className="h-3.5 w-3.5" />
            <span className="mt-px">Projects</span>
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="flex h-9 min-w-[48px] flex-col items-center justify-center gap-0 px-1.5 py-0.5 text-[9px] leading-none active:scale-[0.97]"
        >
          <Link to="/trades" aria-label="Trades marketplace">
            <Briefcase className="h-3.5 w-3.5" />
            <span className="mt-px">Trades</span>
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="flex h-9 min-w-[48px] flex-col items-center justify-center gap-0 px-1.5 py-0.5 text-[9px] leading-none active:scale-[0.97]"
        >
          <Link to="/projects/new" aria-label="New analysis">
            <Plus className="h-3.5 w-3.5" />
            <span className="mt-px">New</span>
          </Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleLogout}
          aria-label="Sign out"
          className="flex h-9 min-w-[48px] flex-col items-center justify-center gap-0 px-1.5 py-0.5 text-[9px] leading-none active:scale-[0.97]"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="mt-px">Out</span>
        </Button>
      </div>
    </header>
  );
}
