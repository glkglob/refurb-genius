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
        Use Deal Copilot for acquisition questions. It does not replace project Photos, Analysis,
        Redesign, Estimate, or Export.
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-4 text-sm text-muted-foreground">
        <li>Review the current project stage before asking for deal guidance.</li>
        <li>Compare options on the Copilot surface, then return here to continue the workflow.</li>
      </ul>
      <Button asChild className="mt-4 min-h-11 w-full">
        <Link to="/deal-copilot" data-testid="deal-copilot-rail-open">
          Open Deal Copilot
        </Link>
      </Button>
    </aside>
  );
}
