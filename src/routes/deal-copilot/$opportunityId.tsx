import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDealOpportunityById } from "@/core/dealCopilot";
import { formatGBP } from "@/lib/utils";

export const Route = createFileRoute("/deal-copilot/$opportunityId")({
  head: () => ({
    meta: [{ title: "Deal Opportunity — Deal Copilot" }],
  }),
  component: DealOpportunityDetail,
});

function toSafeExternalUrl(value: string | undefined) {
  if (!value) return null;

  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      return parsedUrl.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function DealOpportunityDetail() {
  const { opportunityId } = Route.useParams();
  const opportunity = getDealOpportunityById(opportunityId);

  if (!opportunity) {
    return (
      <AppLayout
        title="Opportunity not found"
        subtitle="This in-memory opportunity is no longer available. Create or save it again from the Deal Copilot intake flow."
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
              In-memory opportunities only exist during the current app session. A page refresh,
              server restart, or new browser session can clear them.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const safeListingUrl = toSafeExternalUrl(opportunity.listingUrl);

  return (
    <AppLayout
      title={opportunity.title}
      subtitle="Deal Copilot opportunity detail. This is the underwriting bridge before project conversion."
      actions={
        <Button asChild variant="outline">
          <Link to="/deal-copilot">
            <ArrowLeft className="h-4 w-4" />
            Back to Deal Copilot
          </Link>
        </Button>
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
