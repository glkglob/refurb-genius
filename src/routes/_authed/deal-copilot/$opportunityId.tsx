import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatGBP } from "@/lib/utils";
import { useOpportunity } from "@/hooks/useOpportunities";

export const Route = createFileRoute("/_authed/deal-copilot/$opportunityId")({
  head: () => ({
    meta: [{ title: "Deal Opportunity — Deal Copilot" }],
  }),
  component: DealOpportunityDetail,
});

function getSafeListingUrl(listingUrl: string | undefined): string | null {
  if (!listingUrl) {
    return null;
  }

  try {
    const url = new URL(listingUrl);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

function DealOpportunityDetail() {
  return <DealOpportunityDetailContent />;
}

function DealOpportunityDetailContent() {
  const { opportunityId } = Route.useParams();
  const { data: opportunity, isLoading, error } = useOpportunity(opportunityId);

  if (isLoading) {
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

  if (error) {
    return (
      <AppLayout
        title="Unable to load opportunity"
        subtitle="There was a problem loading your saved opportunities."
      >
        <Card>
          <CardContent className="p-6">
            <p className="text-sm leading-6 text-destructive">
              Your opportunities could not be loaded. Please try again.
            </p>
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

  const safeListingUrl = getSafeListingUrl(opportunity.listingUrl);

  return (
    <AppLayout
      title={opportunity.title}
      subtitle="Deal Copilot opportunity detail. This is the underwriting bridge before project conversion."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/deal-copilot">
              <ArrowLeft className="h-4 w-4" />
              Back to Deal Copilot
            </Link>
          </Button>
          <Button asChild>
            <Link to="/deal-copilot/$opportunityId/edit" params={{ opportunityId }}>
              <Pencil className="h-4 w-4" />
              Edit opportunity
            </Link>
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Opportunity
                </p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">{opportunity.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {opportunity.postcode ?? "No postcode added"}
                </p>
              </div>

              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                {opportunity.status}
              </span>
            </div>

            <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
              <Metric label="Purchase price" value={formatGBP(opportunity.purchasePrice)} />
              <Metric label="Estimated GDV" value={formatGBP(opportunity.estimatedGdv)} />
              <Metric label="Refurb budget" value={formatGBP(opportunity.refurbBudget)} />
              <Metric
                label="Expected monthly rent"
                value={formatGBP(opportunity.expectedMonthlyRent)}
              />
              <Metric
                label="Created"
                value={new Date(opportunity.createdAt).toLocaleString("en-GB")}
              />
              <Metric
                label="Updated"
                value={new Date(opportunity.updatedAt).toLocaleString("en-GB")}
              />
            </dl>

            {safeListingUrl ? (
              <Button asChild className="mt-6">
                <a href={safeListingUrl} target="_blank" rel="noopener noreferrer">
                  Open listing <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground">Underwriting bridge</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This page intentionally reads from the Deal Copilot opportunity store only. The next
              step is to decide how an opportunity becomes a canonical Refurb Genius project row.
            </p>

            <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4 text-sm leading-6 text-muted-foreground">
              Keep this route lightweight until Supabase persistence and project conversion rules
              are agreed.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
