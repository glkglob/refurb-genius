import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { NewProjectEntry } from "@/features/projects";

/**
 * IA-7-R1 — Canonical New Analysis entry flow.
 *
 * Global nav: New Analysis → /analyze
 * Behaviour: create durable Project → /projects/$id/upload (Photos).
 *
 * Legacy feasibility workspace relocated to /studies/workspace (demoted).
 * /projects/new remains a compatibility alias of the same entry form.
 */
export const Route = createFileRoute("/_authed/analyze")({
  head: () => ({ meta: [{ title: "New Analysis — Refurb Genius" }] }),
  component: AnalyzeRoute,
});

function AnalyzeRoute() {
  return (
    <AppLayout
      title="New Analysis"
      subtitle="Create a project to start the Photos → Analysis → Redesign → Estimate → Export workflow. Only a name is required."
    >
      <NewProjectEntry />
    </AppLayout>
  );
}
