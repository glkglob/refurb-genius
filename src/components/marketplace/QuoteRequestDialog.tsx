"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { Textarea } from "@repo/ui";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useAuth } from "@/hooks/useAuth";
import { useCreateQuoteRequest } from "@/features/marketplace";
import { LabourRateGuide } from "@/components/marketplace/LabourRateGuide";

interface QuoteRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradespersonId: string;
  tradespersonName: string;
  projectId?: string;
  /** Optional specialty / job category for labour rate guide. */
  jobCategory?: string;
  postcode?: string;
}

export function QuoteRequestDialog({
  open,
  onOpenChange,
  tradespersonId,
  tradespersonName,
  projectId,
  jobCategory,
  postcode,
}: QuoteRequestDialogProps) {
  const [message, setMessage] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const { user, isLoading: authLoading, hydrated } = useAuth();
  const userId = user?.id;
  const authReady = hydrated && !authLoading;

  const createQuoteMutation = useCreateQuoteRequest(userId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authReady) {
      return;
    }
    if (!userId) {
      toast.error("Failed to send request", { description: "You must be signed in" });
      return;
    }
    if (!message.trim()) {
      toast.error("Failed to send request", { description: "Message is required" });
      return;
    }

    let price: number | undefined;
    const trimmedPrice = proposedPrice.trim();
    if (trimmedPrice) {
      const parsedPrice = Number(trimmedPrice);
      if (!Number.isFinite(parsedPrice)) {
        toast.error("Failed to send request", {
          description: "Proposed price must be a valid number",
        });
        return;
      }
      price = parsedPrice;
    }

    createQuoteMutation.mutate(
      {
        tradespersonId,
        projectId,
        title: `Quote request for ${tradespersonName}`,
        message: message.trim(),
        proposedPrice: price,
      },
      {
        onSuccess: () => {
          toast.success("Quote request sent!", {
            description: `The tradesperson will be notified. ${projectId ? "Linked to your project." : ""}`,
          });
          setMessage("");
          setProposedPrice("");
          onOpenChange(false);
        },
        onError: (err) => {
          logger.error("[marketplace] quote request failed", {
            error: err instanceof Error ? err.message : String(err),
          });
          toast.error("Failed to send request", {
            description: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  };

  const pending = createQuoteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Request Quote from {tradespersonName}</DialogTitle>
          <DialogDescription>
            Describe the work needed. {projectId && "This will be linked to your selected project."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="message">Message / Scope of work</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="E.g. Full kitchen refit including plumbing and electrical. 3 weeks timeline preferred."
              required
              rows={4}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="price">Your budget / target price (optional)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
              placeholder="e.g. 4500"
              className="mt-1"
            />
          </div>

          {projectId && (
            <p className="text-xs text-muted-foreground">
              Quote will be associated with project ID: {projectId.slice(0, 8)}...
            </p>
          )}

          <LabourRateGuide
            jobCategory={jobCategory ?? "general_building"}
            postcode={postcode}
            days={5}
            compact
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !authReady || !message.trim()}>
              {pending ? "Sending..." : "Send Quote Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
