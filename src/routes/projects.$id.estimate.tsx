import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mockEstimate } from "@/lib/mockData";

export const Route = createFileRoute("/projects/$id/estimate")({
  head: () => ({ meta: [{ title: "Cost estimate — Refurb Genius" }] }),
  component: EstimatePage,
});

function EstimatePage() {
  const { id } = Route.useParams();
  return (
    <AppLayout
      title="Cost estimate"
      subtitle="Mock regional refurb estimate, broken down by category."
      actions={
        <Button asChild>
          <Link to="/projects/$id/report" params={{ id }}>View investor report</Link>
        </Button>
      }
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-end justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total estimate</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                £{mockEstimate.total.toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              Includes 10% contingency
            </span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {mockEstimate.breakdown.map((b) => (
              <div key={b.category} className="flex items-center justify-between py-3 text-sm">
                <span className="text-foreground">{b.category}</span>
                <span className="font-medium text-foreground">£{b.cost.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
