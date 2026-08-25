/**
 * IA-8 — Mobile sticky next-action chrome.
 *
 * Presentation only. Label/route/kind MUST come from the canonical resolver
 * (or stage-owned mutation handlers that already use that output).
 * Does not invent a second next-action algorithm.
 */
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@repo/ui";

export type MobileStickyNextActionProps = {
  label: string;
  /** Navigation-only continuation (preferred when resolver returns a route). */
  href?: string;
  /** Mutation / in-page action owned by the stage surface. */
  onClick?: () => void;
  actionKind?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "default" | "outline";
  className?: string;
  testId?: string;
};

export function MobileStickyNextAction({
  label,
  href,
  onClick,
  actionKind,
  disabled = false,
  loading = false,
  variant = "default",
  className,
  testId = "mobile-sticky-next-action",
}: MobileStickyNextActionProps) {
  if (!href && !onClick) return null;

  const busy = loading || disabled;

  return (
    <div
      className={cn(
        // Sit ABOVE MobileBottomNav. Nav owns safe-area-inset-bottom.
        // Hidden from `lg` together with the bottom destination bar.
        "fixed inset-x-0 z-40 border-t border-border bg-background/95 px-3 py-2 backdrop-blur lg:hidden",
        "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
        className,
      )}
      data-testid="mobile-sticky-next-action-bar"
      role="region"
      aria-label="Next workflow action"
    >
      {href && !onClick ? (
        <Button
          asChild
          variant={variant}
          size="lg"
          className="h-12 w-full text-base"
          disabled={busy}
          data-testid={testId}
          data-action-kind={actionKind}
        >
          <a href={href} aria-disabled={busy || undefined}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {label}
          </a>
        </Button>
      ) : (
        <Button
          type="button"
          variant={variant}
          size="lg"
          className="h-12 w-full text-base"
          disabled={busy}
          onClick={onClick}
          data-testid={testId}
          data-action-kind={actionKind}
          aria-busy={loading || undefined}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {label}
        </Button>
      )}
    </div>
  );
}
