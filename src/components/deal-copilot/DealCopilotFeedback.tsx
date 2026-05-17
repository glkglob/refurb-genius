import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export interface DealCopilotFeedback {
  dealId: string;
  useful: "yes" | "no" | null;
  notes?: string;
  timestamp: string;
}

export interface DealCopilotFeedbackProps {
  onSubmit?: (feedback: DealCopilotFeedback) => Promise<void> | void;
  dealId: string;
}

/**
 * Lightweight feedback component for beta validation.
 *
 * Collects:
 * - Usefulness (thumbs up/down)
 * - Optional notes
 *
 * Does NOT:
 * - Send data to third-party analytics
 * - Collect behavior tracking
 * - Require user identification
 *
 * Purpose:
 * Capture deal score credibility and pricing confidence.
 */
export function DealCopilotFeedback({ onSubmit, dealId }: DealCopilotFeedbackProps) {
  const [useful, setUseful] = useState<"yes" | "no" | null>(null);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!useful) {
      return;
    }

    setSubmitting(true);
    try {
      const feedback: DealCopilotFeedback = {
        dealId,
        useful,
        notes: notes.trim() || undefined,
        timestamp: new Date().toISOString(),
      };

      if (onSubmit) {
        await onSubmit(feedback);
      }

      setSubmitted(true);
      console.debug("[deal-copilot] Feedback submitted", { dealId, useful });
    } catch (error) {
      console.error("[deal-copilot] Feedback submission failed", error);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-green-900">✓ Thank you for your feedback</p>
          <p className="mt-1 text-xs text-green-800">
            Your input helps us improve Deal Copilot accuracy and trust.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Was this analysis useful?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Help us understand deal score credibility and pricing confidence.
            </p>
          </div>

          {/* Feedback buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setUseful("yes")}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                useful === "yes"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-input bg-background text-foreground hover:border-green-300"
              }`}
              disabled={submitting}
            >
              <ThumbsUp className="h-4 w-4" />
              Yes
            </button>
            <button
              onClick={() => setUseful("no")}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                useful === "no"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-input bg-background text-foreground hover:border-red-300"
              }`}
              disabled={submitting}
            >
              <ThumbsDown className="h-4 w-4" />
              No
            </button>
          </div>

          {/* Optional notes */}
          {useful && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground">
                <MessageSquare className="h-3 w-3" />
                Optional notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Score seemed too optimistic, or pricing looked accurate..."
                maxLength={256}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                disabled={submitting}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">{notes.length}/256</p>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!useful || submitting}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send Feedback"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
