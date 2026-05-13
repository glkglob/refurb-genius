import { useSyncExternalStore } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, LineChart, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { opportunityStore } from "@/core/dealCopilot";
import { PRODUCT_DEFINITIONS } from "@/core/platform";

export const Route = createFileRoute("/deal-copilot/")({
  head: () => ({
    meta: [{ title: "Deal Copilot — Refurb Genius" }],
  }),
  component: DealCopilotIndex,
});

function DealCopilotIndex() {
  const { opportunities, loading, loaded, error } = useSyncExternalStore(
    opportunityStore.subscribe,
    opportunityStore.getSnapshot,
    opportunityStore.getSnapshot,
  );

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

        {!loaded || loading ? (
          <p className="mt-6 rounded-lg border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            Loading opportunities…
          </p>
        ) : error ? (
          <div className="mt-6 space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Could not load your opportunities. Please try again.</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void opportunityStore.refresh();
              }}
            >
              Retry
            </Button>
          </div>
        ) : opportunities.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
            No opportunities saved yet. Create one from the Deal Copilot intake flow.
          </p>
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
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
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
          product={PRODUCT_DEFINITIONS["refurb-genius"]}
          eyebrow="Connected module"
          ctaLabel="Estimate"
        />
        <ProductCard
          product={PRODUCT_DEFINITIONS["refurb-iq"]}
          eyebrow="Future downstream module"
          ctaLabel="BOQ"
        />
      </div>
    </AppLayout>
  );
}
