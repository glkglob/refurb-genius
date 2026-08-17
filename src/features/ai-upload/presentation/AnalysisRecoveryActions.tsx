/**
 * In-page Analysis recovery/retry actions.
 *
 * Must stay visible on iPhone viewports. Do not add hidden / md:hidden here:
 * ProjectWorkflowShell already hides header actions under the mobile sticky bar.
 */
import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AnalysisRecoveryActionsProps = {
  mode: "retry-weak" | "recover";
  disabled?: boolean;
  busy?: boolean;
  onRetryWeak: () => void;
  onRecover: () => void;
};

export function AnalysisRecoveryActions({
  mode,
  disabled = false,
  busy = false,
  onRetryWeak,
  onRecover,
}: AnalysisRecoveryActionsProps) {
  if (mode === "retry-weak") {
    return (
      <Button
        type="button"
        variant="outline"
        className="mt-3 min-h-11"
        data-testid="analysis-retry-weak-cta"
        disabled={disabled || busy}
        onClick={onRetryWeak}
      >
        <RefreshCw className={`mr-1 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        Re-analyse weak photos
      </Button>
    );
  }

  return (
    <Button
      type="button"
      className="mt-3 min-h-11"
      data-testid="analysis-recovery-cta"
      disabled={disabled || busy}
      onClick={onRecover}
    >
      <Sparkles className="mr-1 h-4 w-4" />
      Analyse uploaded photos
    </Button>
  );
}
