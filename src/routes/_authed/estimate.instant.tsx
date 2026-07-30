/**
 * Thin route: L1/L2 instant estimate.
 *
 * All product logic lives in features/estimate.
 * This file only wires the layout and the public feature API.
 */
import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { L1EstimateForm } from "@/features/estimate";

export const Route = createFileRoute("/_authed/estimate/instant")({
  head: () => ({
    meta: [
      {
        title: "Instant refurbishment estimate — Refurb Genius",
      },
    ],
  }),
  component: InstantEstimatePage,
});

function InstantEstimatePage() {
  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Instant refurbishment estimate</h1>
          <p className="text-muted-foreground">
            Start with three quick inputs, then add finish and floor area for a tighter range.
          </p>
        </header>

        <L1EstimateForm />
      </main>
    </AppLayout>
  );
}
