/**
 * Web A — contextual Deal Copilot rail.
 *
 * Presentation only: explains the product and links into the existing
 * `/deal-copilot` surface. Does not embed chat, duplicate Copilot state,
 * or invent project-to-Copilot persistence.
 */
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DealCopilotRail() {
  return (
    <aside
      className="hidden w-72 shrink-0 flex-col border-l border-border bg-card/60 p-4 xl:flex"
      aria-label="Deal Copilot"
      data-testid="deal-copilot-rail"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <h2 className="text-base font-semibold text-foreground">Deal Copilot</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Which project needs attention? Open Deal Copilot for acquisition analysis without leaving
        the project workspace.
      </p>
      <Button asChild className="mt-4 min-h-11 w-full">
        <Link to="/deal-copilot" data-testid="deal-copilot-rail-open">
          Ask Deal Copilot
        </Link>
      </Button>
    </aside>
  );
}
