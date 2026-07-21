"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/platform/supabase/browser";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { marketplaceKeys, quoteRequestsByProjectQueryOptions } from "@/lib/queries/marketplace";
import type { TablesInsert } from "@repo/supabase";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();
  const user = auth.getUser();

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("You must be signed in");
      if (!message.trim()) throw new Error("Message is required");

      // project_id is optional in the marketplace flow; empty string keeps legacy rows insertable.
      const payload: TablesInsert<"quote_requests"> & { proposed_price?: number } = {
        project_id: projectId ?? "",
        tradesperson_id: tradespersonId,
        user_id: user.id,
        status: "pending",
        title: `Quote request for ${tradespersonName}`,
        message: message.trim(),
      };

      const trimmedPrice = proposedPrice.trim();
      if (trimmedPrice) {
        const parsedPrice = Number(trimmedPrice);
        if (!Number.isFinite(parsedPrice)) {
          throw new Error("Proposed price must be a valid number");
        }
        payload.proposed_price = parsedPrice;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase.from("quote_requests").insert([payload] as any);

      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Quote request sent!", {
        description: `The tradesperson will be notified. ${projectId ? "Linked to your project." : ""}`,
      });
      setMessage("");
      setProposedPrice("");
      onOpenChange(false);

      if (projectId) {
        await queryClient.invalidateQueries({
          queryKey: marketplaceKeys.quoteRequestsByProject(projectId),
        });
      }
      // Also invalidate general if needed
    },
    onError: (err: Error) => {
      logger.error("[marketplace] quote request failed", { error: err.message });
      toast.error("Failed to send request", { description: err.message });
    },
    onSettled: () => setIsSubmitting(false),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    submitMutation.mutate();
  };

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
            <Button type="submit" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? "Sending..." : "Send Quote Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
