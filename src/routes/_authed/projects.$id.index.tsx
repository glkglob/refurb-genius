// src/routes/_authed/projects.$id.index.tsx
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { LoadingState } from "@/components/LoadingState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { Suspense } from "react";

import { EstimateBuilder } from "@/components/EstimateBuilder";
import { BulkPhotoUpload } from "@/components/BulkPhotoUpload";
import { SensitivityAnalysis } from "@/components/SensitivityAnalysis";
import { FloorplanViewer } from "@/components/floorplan";
import { PhotoAnalysisViewer } from "@/components/photos/PhotoAnalysisViewer";
import { PitchDeckGenerator } from "@/components/pitch-deck";

import {
  Camera,
  Sparkles,
  Calculator,
  FileText,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Circle,
  Bed,
  Bath,
  Ruler,
  Home,
  BarChart3,
} from "lucide-react";

import { estimatedRefurbCost, estimatedProfit } from "@/core/projects";
import { useProjectProgress } from "@/hooks/useProjects";

import {
  projectQueryOptions,
  estimateQueryOptions,
  photosQueryOptions,
  financialsQueryOptions,
} from "@/lib/queries/projects";

import { floorplansByProjectQueryOptions } from "@/lib/queries/floorplans";
import { photoAnalysisByProjectQueryOptions } from "@/lib/queries/photo-analysis";
import { pitchDecksByProjectQueryOptions } from "@/lib/queries/pitch-decks";

import type { ProjectWithProgress } from "@/lib/mappers";

const TabSchema = z.enum([
  "overview",
  "photos",
  "estimate",
  "financials",
  "sensitivity",
  "floorplan",
]);

export const Route = createFileRoute("/_authed/projects/$id/")({
  head: () => ({ meta: [{ title: "Project — Refurb Genius" }] }),

  validateSearch: (search: Record<string, unknown>) => {
    const parsed = TabSchema.safeParse(search.tab);
    return { tab: parsed.success ? parsed.data : "overview" };
  },

  loader: async ({ context, params: { id } }) => {
    const { queryClient } = context;

    await Promise.all([
      queryClient.ensureQueryData(projectQueryOptions(id)),
      queryClient.prefetchQuery(estimateQueryOptions(id)),
      queryClient.prefetchQuery(photosQueryOptions(id)),
      queryClient.prefetchQuery(financialsQueryOptions(id)),
      queryClient.prefetchQuery(floorplansByProjectQueryOptions(id)),
      queryClient.prefetchQuery(photoAnalysisByProjectQueryOptions(id)),
      queryClient.prefetchQuery(pitchDecksByProjectQueryOptions(id)),
    ]);
  },

  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: project } = useSuspenseQuery(projectQueryOptions(id));
  const { data: financials } = useSuspenseQuery(financialsQueryOptions(id));
  const { data: photos = [] } = useSuspenseQuery(photosQueryOptions(id));
  const { data: analyses = [] } = useQuery(photoAnalysisByProjectQueryOptions(id));

  const progress = useProjectProgress(id);

  if (!project) return <Navigate to="/dashboard" />;

  const setTab = (newTab: z.infer<typeof TabSchema>) => {
    navigate({
      to: "/projects/$id",
      params: { id },
      search: { tab: newTab },
    });
  };

  const prefetchTab = (t: z.infer<typeof TabSchema>) => {
    if (t === "photos") queryClient.prefetchQuery(photosQueryOptions(id));
    if (t === "estimate") queryClient.prefetchQuery(estimateQueryOptions(id));
    if (t === "financials" || t === "sensitivity")
      queryClient.prefetchQuery(financialsQueryOptions(id));
    if (t === "floorplan") queryClient.prefetchQuery(floorplansByProjectQueryOptions(id));
  };

  const workflow = [
    {
      stage: "photos" as const,
      to: "/projects/$id/upload",
      label: "Photos",
      desc: "Upload & AI analysis",
      icon: Camera,
    },
    {
      stage: "analysis" as const,
      to: "/projects/$id/analysis",
      label: "AI Analysis",
      desc: "Room condition & scope",
      icon: Sparkles,
    },
    {
      stage: "estimate" as const,
      to: "/projects/$id/estimate",
      label: "Estimate",
      desc: "Detailed refurb costs",
      icon: Calculator,
    },
    {
      stage: "report" as const,
      to: "/projects/$id/report",
      label: "Report",
      desc: "Investor ready",
      icon: FileText,
    },
  ] as const;

  const nextStage = workflow.find((w) => !progress[w.stage]) ?? workflow[workflow.length - 1];

  return (
    <AppLayout
      title={project.name || project.address}
      subtitle={`${project.address} · ${project.postcode}`}
      actions={<PitchDeckGenerator projectId={id} project={project} trigger="header" />}
    >
      {/* Property Summary */}
      <Card className="mb-6">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Address" value={project.address} icon={MapPin} />
          <Detail label="Postcode" value={project.postcode} />
          <Detail label="Region" value={project.region} />
          <Detail label="Property type" value={project.property_type} icon={Home} />
          <Detail label="Bedrooms" value={String(project.bedrooms)} icon={Bed} />
          <Detail label="Bathrooms" value={String(project.bathrooms)} icon={Bath} />
          <Detail label="Size" value={`${project.size_sqm} m²`} icon={Ruler} />
          <Detail label="Status" value={project.status} />
          <Detail
            label="Created"
            value={new Date(project.created_at).toLocaleDateString("en-GB")}
          />
        </CardContent>
      </Card>

      {/* Money Summary */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Money label="Purchase price" value={project.purchase_price} />
        <Money label="Estimated refurb" value={estimatedRefurbCost(project)} />
        <Money label="Estimated GDV" value={project.estimated_gdv} accent />
        <Money label="Estimated profit" value={estimatedProfit(project)} />
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as z.infer<typeof TabSchema>)}
        className="mb-8"
      >
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
          <TabsTrigger value="overview" onMouseEnter={() => prefetchTab("overview")}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="photos" onMouseEnter={() => prefetchTab("photos")}>
            Photos &amp; AI
          </TabsTrigger>
          <TabsTrigger value="estimate" onMouseEnter={() => prefetchTab("estimate")}>
            Estimate Builder
          </TabsTrigger>
          <TabsTrigger value="financials" onMouseEnter={() => prefetchTab("financials")}>
            Financials
          </TabsTrigger>
          <TabsTrigger value="sensitivity" onMouseEnter={() => prefetchTab("sensitivity")}>
            Sensitivity
          </TabsTrigger>
          <TabsTrigger value="floorplan" onMouseEnter={() => prefetchTab("floorplan")}>
            3D Floorplan
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Workflow Cards - preserved from current file */}
          <h2 className="text-lg font-semibold">Workflow</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((w) => {
              const done = progress[w.stage];
              const isNext = w === nextStage && !done;
              return (
                <Link key={w.stage} to={w.to} params={{ id }}>
                  <Card
                    className={`h-full transition-shadow hover:shadow-md ${isNext ? "border-accent ring-1 ring-accent/40" : ""}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                          <w.icon className="h-5 w-5" />
                        </div>
                        {done ? (
                          <CheckCircle2 className="h-5 w-5 text-accent" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40" />
                        )}
                      </div>
                      <h3 className="mt-4 font-semibold">{w.label}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{w.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Find Trades CTA */}
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Get the work done</h2>
            <Card className="hover:shadow-md transition border-accent/30">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    Find local tradespeople{" "}
                    <span className="text-xs bg-accent/10 px-1.5 py-0.5 rounded">Marketplace</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Browse verified trades, save favorites, request quotes for this refurb
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/marketplace" search={{ projectId: id }}>
                    Browse Trades →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Photos & AI - Enhanced with rich AI Analysis Results Viewer */}
        <TabsContent value="photos" className="mt-6 space-y-8">
          <Suspense fallback={<LoadingState />}>
            <BulkPhotoUpload projectId={id} />
          </Suspense>

          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              AI Photo Analysis Results
              <span className="text-xs font-normal text-muted-foreground">
                ({analyses.length} analyses)
              </span>
            </h3>
            <PhotoAnalysisViewer projectId={id} photos={photos} analyses={analyses} />
          </div>
        </TabsContent>

        {/* Estimate Builder */}
        <TabsContent value="estimate" className="mt-6">
          <Suspense fallback={<LoadingState />}>
            <EstimateBuilder projectId={id} project={project} />
          </Suspense>
        </TabsContent>

        {/* Financials */}
        <TabsContent value="financials" className="mt-6">
          <Suspense fallback={<LoadingState />}>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Financial Summary</h3>
                  <p className="text-sm text-muted-foreground">
                    Key metrics, ROI and investment case
                  </p>
                </div>
                <PitchDeckGenerator projectId={id} project={project} trigger="financials" />
              </div>

              {/* Simple metrics cards (full details in Sensitivity tab) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Purchase Price
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      £{project.purchase_price.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Est. Refurb
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      £{(financials?.refurbBudget ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Est. Profit
                    </p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      £{(financials?.estimatedProfit ?? 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">ROI</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                      {financials?.roiPercent ?? 0}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-sm text-muted-foreground">
                Full sensitivity analysis, charts and scenario modeling available in the Sensitivity
                tab. Use the Pitch Deck button above to generate a complete investor document.
              </p>
            </div>
          </Suspense>
        </TabsContent>

        {/* Sensitivity */}
        <TabsContent value="sensitivity" className="mt-6">
          <Suspense fallback={<LoadingState />}>
            <SensitivityAnalysis projectId={id} project={project} financials={financials} />
          </Suspense>
        </TabsContent>

        {/* 3D Floorplan Tab - production implementation */}
        <TabsContent value="floorplan" className="mt-6">
          <Suspense fallback={<LoadingState />}>
            <FloorplanViewer projectId={id} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

// Helper components (preserved from your version)
function Detail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ElementType<{ className?: string }>;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {value}
      </p>
    </div>
  );
}

function Money({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-2 text-2xl font-semibold tracking-tight ${accent ? "text-accent" : ""}`}>
          £{value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
