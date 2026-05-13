import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BrainCircuit, LineChart, ShieldAlert } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_DEFINITIONS } from "@/core/platform";

export const Route = createFileRoute("/deal-copilot/")({
  head: () => ({
    meta: [{ title: "Deal Copilot — Refurb Genius" }],
  }),
  component: DealCopilotIndex,
});

function DealCopilotIndex() {
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
