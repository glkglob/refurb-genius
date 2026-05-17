import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { submitVisionFeedback, submitRedesignFeedback } from "@/lib/ai-quality-feedback";
import type { VisionAccuracy, RedesignUsability } from "@/lib/ai-quality-feedback";

interface AIFeedbackWidgetProps {
  projectId: string;
  photoId: string;
  type: "vision" | "redesign";
  onSubmit?: () => void;
}

export function AIFeedbackWidget({ projectId, photoId, type, onSubmit }: AIFeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleVisionFeedback = async (accuracy: VisionAccuracy) => {
    setIsSubmitting(true);
    const success = await submitVisionFeedback(projectId, photoId, accuracy, notes);
    if (success) {
      setSubmitted(true);
      setIsOpen(false);
      setNotes("");
      onSubmit?.();
      setTimeout(() => setSubmitted(false), 3000);
    }
    setIsSubmitting(false);
  };

  const handleRedesignFeedback = async (usability: RedesignUsability) => {
    setIsSubmitting(true);
    const success = await submitRedesignFeedback(projectId, photoId, usability, notes);
    if (success) {
      setSubmitted(true);
      setIsOpen(false);
      setNotes("");
      onSubmit?.();
      setTimeout(() => setSubmitted(false), 3000);
    }
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="text-xs text-green-600 flex items-center gap-1">
        <ThumbsUp className="w-3 h-3" />
        Feedback received
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <MessageSquare className="w-3 h-3" />
        Feedback
      </button>
    );
  }

  return (
    <Card className="absolute bottom-full right-0 mb-2 w-48 shadow-lg z-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {type === "vision" ? "Rate Analysis" : "Rate Concept"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {type === "vision" ? (
          <div className="space-y-2">
            <button
              onClick={() => handleVisionFeedback("accurate")}
              disabled={isSubmitting}
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-green-50 disabled:opacity-50"
            >
              ✓ Accurate
            </button>
            <button
              onClick={() => handleVisionFeedback("partial")}
              disabled={isSubmitting}
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-yellow-50 disabled:opacity-50"
            >
              ~ Partially accurate
            </button>
            <button
              onClick={() => handleVisionFeedback("inaccurate")}
              disabled={isSubmitting}
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-red-50 disabled:opacity-50"
            >
              ✗ Inaccurate
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => handleRedesignFeedback("useful")}
              disabled={isSubmitting}
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-green-50 disabled:opacity-50"
            >
              ✓ Useful
            </button>
            <button
              onClick={() => handleRedesignFeedback("generic")}
              disabled={isSubmitting}
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-50 disabled:opacity-50"
            >
              ~ Generic
            </button>
            <button
              onClick={() => handleRedesignFeedback("unrealistic")}
              disabled={isSubmitting}
              className="w-full text-left px-2 py-1 text-sm rounded hover:bg-red-50 disabled:opacity-50"
            >
              ✗ Unrealistic
            </button>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          className="w-full text-xs p-1 border rounded resize-none"
          rows={2}
          disabled={isSubmitting}
        />

        <div className="flex gap-2">
          <button
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="flex-1 text-xs px-2 py-1 rounded border hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
