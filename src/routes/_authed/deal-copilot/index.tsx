import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, LineChart, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/platform";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCTS } from "@/core/platform";
import { useOpportunities } from "@/hooks/useOpportunities";

export const Route = createFileRoute("/_authed/deal-copilot/")({
  head: () => ({
    meta: [{ title: "Deal Copilot — Refurb Genius" }],
  }),
  component: DealCopilotIndex,
});

function DealCopilotIndex() {
  return <DealCopilotIndexContent />;
}

function DealCopilotIndexContent() {
  const { data: opportunities = [], isLoading, error } = useOpportunities();

  return (
    <AppLayout
      title="Deal Copilot"
      subtitle="AI acquisition intelligence for property investors. Start with manual deal analysis before adding background monitoring."
      actions={
        <Button asChild>
          <Link to="/deal-copilot/new">
            Analyse deal <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <BrainCircuit className="h-8 w-8 text-accent" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Manual deal intake first</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Add listing details, purchase assumptions, refurb level, GDV, and rent manually before
              building autonomous portal connectors.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <LineChart className="h-8 w-8 text-accent" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">Shared ROI engine</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Deal Copilot must reuse the existing pricing and ROI engines so investment numbers
              stay consistent with Refurb Genius.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <ShieldAlert className="h-8 w-8 text-accent" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">
              AI does not invent figures
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              AI can summarise listings, risks, and recommendations. Refurb costs, ROI, and scores
              come from deterministic engines.
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Saved opportunities</h2>
          <p className="mt-1 text-sm text-muted-foreground">Opportunities saved to your account.</p>
        </div>

        {isLoading ? (
          <div className="mt-6">
            <LoadingState label="Loading opportunities…" />
          </div>
        ) : error ? (
          <div className="mt-6 space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Could not load your opportunities. Please try again.
            </p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={BrainCircuit}
              title="No saved opportunities yet"
              description="Create one from the Deal Copilot intake flow to start tracking your deals."
              action={
                <Button asChild>
                  <Link to="/deal-copilot/new">
                    Analyse a deal <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              }
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {opportunities.map((opportunity) => (
              <Link
                key={opportunity.id}
                to="/deal-copilot/$opportunityId"
                params={{ opportunityId: opportunity.id }}
                className="block rounded-lg border border-border p-4 transition hover:border-accent/60 hover:bg-secondary/20"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-foreground">{opportunity.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {opportunity.postcode ?? "No postcode added"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      opportunity.status === "won"
                        ? "bg-emerald-100 text-emerald-800"
                        : opportunity.status === "offer"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {opportunity.status}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">Purchase price</dt>
                    <dd className="font-medium text-foreground">
                      {opportunity.purchasePrice
                        ? `£${opportunity.purchasePrice.toLocaleString("en-GB")}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Refurb budget</dt>
                    <dd className="font-medium text-foreground">
                      {opportunity.refurbBudget
                        ? `£${opportunity.refurbBudget.toLocaleString("en-GB")}`
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium text-foreground">
                      {new Date(opportunity.createdAt).toLocaleDateString("en-GB")}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <ProductCard
          product={PRODUCTS["refurb-genius"]}
          eyebrow="Connected module"
          ctaLabel="Estimate"
        />
        <ProductCard
          product={PRODUCTS["refurb-iq"]}
          eyebrow="Future downstream module"
          ctaLabel="BOQ"
        />
      </div>
    </AppLayout>
  );
}
