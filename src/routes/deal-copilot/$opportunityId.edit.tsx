import { useEffect, useState, useSyncExternalStore } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  opportunityStore,
  updateDealOpportunity,
  type DealOpportunityStatus,
} from "@/core/dealCopilot";

export const Route = createFileRoute("/deal-copilot/$opportunityId/edit")({
  head: () => ({
    meta: [{ title: "Edit Deal Opportunity - Deal Copilot" }],
  }),
  component: EditDealOpportunity,
});

const editableStatuses: DealOpportunityStatus[] = [
  "sourced",
  "underwriting",
  "watchlist",
  "rejected",
];

function EditDealOpportunity() {
  const navigate = useNavigate();
  const { opportunityId } = Route.useParams();
  const { opportunities, loaded } = useSyncExternalStore(
    opportunityStore.subscribe,
    opportunityStore.getSnapshot,
    opportunityStore.getSnapshot,
  );
  const opportunity = opportunities.find((o) => o.id === opportunityId) ?? null;
  const [status, setStatus] = useState<DealOpportunityStatus>("sourced");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opportunity) setStatus(opportunity.status);
  }, [opportunity?.id, opportunity?.status]);

  if (!loaded) {
    return (
      <AppLayout title="Loading…" subtitle="Fetching opportunity from your account.">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Loading opportunity…</p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!opportunity) {
    return (
      <AppLayout
        title="Opportunity not found"
        subtitle="This opportunity could not be found. It may have been deleted."
        actions={
          <Button asChild variant="outline">
            <Link to="/deal-copilot">
              <ArrowLeft className="h-4 w-4" />
              Back to Deal Copilot
            </Link>
          </Button>
        }
      >
        <Card>
          <CardContent className="p-6">
            <p className="text-sm leading-6 text-muted-foreground">
              This opportunity could not be found in your account. It may have been deleted or the
              link may be incorrect.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const updated = await updateDealOpportunity(opportunityId, { status });
      if (!updated) {
        setError("Unable to update this opportunity.");
        return;
      }
      await navigate({
        to: "/deal-copilot/$opportunityId",
        params: { opportunityId: updated.id },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this opportunity.");
    }
  }

  return (
    <AppLayout
      title={`Edit ${opportunity.title}`}
      subtitle="Update Deal Copilot opportunity metadata."
      actions={
        <Button asChild variant="outline">
          <Link to="/deal-copilot/$opportunityId" params={{ opportunityId }}>
            <ArrowLeft className="h-4 w-4" />
            Back to opportunity
          </Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as DealOpportunityStatus)}
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                {editableStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit">
              <Save className="h-4 w-4" />
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
