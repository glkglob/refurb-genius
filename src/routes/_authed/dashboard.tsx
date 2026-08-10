import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DashboardSection } from "@/components/DashboardSection";

import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { ProjectContinuationCard } from "@/features/projects";
import {
  consumeNewUserOnboarding,
  hasCompletedFirstStudy as readFirstStudyCelebration,
  ONBOARDING_GOAL_OPTIONS,
  useOnboardingGoalSelection,
} from "@/features/auth";
import { useEffect, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  FolderPlus,
  HardHat,
  Loader2,
  Eye,
  Pencil,
  XCircle,
  Calculator,
  TrendingUp,
  BookMarked,
  HandshakeIcon,
  DollarSign,
} from "lucide-react";
import type { TradesJob, TradesJobStatus } from "@/core/trades";
import {
  formatCategoryLabel,
  formatBudgetRange,
  formatShortDate,
} from "@/core/trades/tradesJob.selectors";
import { listCurrentUserTradesJobs, updateTradesJob } from "@/features/trades";

import { listCurrentUserInterestsWithJobs, type TradesJobInterestWithJob } from "@/features/trades";

export const Route = createFileRoute("/_authed/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Refurb Genius" }] }),
  component: Dashboard,
});

// ---------------------------------------------------------------------------
// Data hook
// ---------------------------------------------------------------------------

type JobsState =
  | { status: "loading" }
  | { status: "ready"; jobs: TradesJob[] }
  | { status: "error"; message: string };

function useMyTradesJobs(): [JobsState, (updatedJob: TradesJob) => void] {
  const [state, setState] = useState<JobsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listCurrentUserTradesJobs()
      .then((jobs) => {
        if (!cancelled) setState({ status: "ready", jobs });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load jobs.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function applyUpdate(updatedJob: TradesJob) {
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", jobs: prev.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)) }
        : prev,
    );
  }

  return [state, applyUpdate];
}

// ---------------------------------------------------------------------------
// Interests hook
// ---------------------------------------------------------------------------

type InterestsState =
  | { status: "loading" }
  | { status: "ready"; interests: TradesJobInterestWithJob[] }
  | { status: "error"; message: string };

function useMyInterests(): InterestsState {
  const [state, setState] = useState<InterestsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    listCurrentUserInterestsWithJobs()
      .then((interests) => {
        if (!cancelled) setState({ status: "ready", interests });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load interests.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusLabel(status: TradesJobStatus): string {
  if (status === "posted") return "Posted";
  if (status === "closed") return "Closed";
  return "Draft";
}

function formatBudgetTotal(total: number | null, loading: boolean): string {
  if (loading) return "…";
  if (total === null || total === 0) return "—";
  if (total >= 1_000_000) return `£${(total / 1_000_000).toFixed(1)}m`;
  if (total >= 1_000) return `£${Math.round(total / 1_000)}k`;
  return `£${total.toLocaleString()}`;
}

function JobStatusBadge({ status }: { status: TradesJobStatus }) {
  const toneMap: Record<TradesJobStatus, "accent" | "muted" | "destructive"> = {
    posted: "accent",
    closed: "muted",
    draft: "destructive", // or we can add a "warning" tone later
  };

  return <StatusBadge tone={toneMap[status] ?? "muted"}>{statusLabel(status)}</StatusBadge>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function Dashboard() {
  return <DashboardContent />;
}

function DashboardContent() {
  const { user } = useAuth();
  const [jobsState, applyUpdate] = useMyTradesJobs();
  const interestsState = useMyInterests();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const [showOnboardingCard, setShowOnboardingCard] = useState(false);
  const [hasCompletedFirstStudy, setHasCompletedFirstStudy] = useState(false);
  const {
    onboardingGoal,
    isSaving: goalSaving,
    hydrateOnboardingGoal,
    applyOnboardingGoal,
  } = useOnboardingGoalSelection();

  useEffect(() => {
    // Consume once so the welcome card does not reappear after dismiss/reload.
    if (consumeNewUserOnboarding()) {
      setShowOnboardingCard(true);
    }
    hydrateOnboardingGoal();
    setHasCompletedFirstStudy(readFirstStudyCelebration());
  }, [hydrateOnboardingGoal]);

  const jobCount =
    jobsState.status === "ready" ? jobsState.jobs.filter((j) => j.status !== "closed").length : 0;
  const interestCount = interestsState.status === "ready" ? interestsState.interests.length : 0;
  const totalBudgetPosted =
    jobsState.status === "ready"
      ? jobsState.jobs.reduce((sum, j) => sum + (j.budgetMax ?? j.budgetMin ?? 0), 0)
      : null;
  const projectCount = projects.length;
  // Empty commercial metrics must not dominate the first mobile viewport (IA-8-VR-R1).
  const commercialEmpty =
    jobsState.status !== "loading" &&
    interestsState.status !== "loading" &&
    jobCount === 0 &&
    interestCount === 0 &&
    (totalBudgetPosted === null || totalBudgetPosted === 0);

  const projectsSection = (
    <DashboardSection
      title="My projects"
      icon={<FolderPlus className="h-5 w-5" />}
      action={
        <Link to="/analyze" className="text-sm font-medium text-accent hover:underline">
          + New Analysis
        </Link>
      }
      className="mb-0"
    >
      {projectsLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">Loading your projects…</div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          description="Create your first refurbishment project to start AI photo analysis and estimates."
          action={
            <Button asChild>
              <Link to="/analyze">
                <FolderPlus className="h-4 w-4" /> New Analysis
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((p) => (
            <ProjectContinuationCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </DashboardSection>
  );

  const commercialStats = (
    <div
      className={cn(
        commercialEmpty
          ? // Compact strip when empty — do not fill first mobile viewport with zeros.
            "grid grid-cols-3 gap-2 sm:grid-cols-3 lg:grid-cols-3"
          : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
      )}
      data-testid="dashboard-commercial-metrics"
      data-empty={commercialEmpty ? "true" : "false"}
    >
      <StatCard
        label="Active trades jobs"
        value={jobsState.status === "loading" ? "…" : String(jobCount)}
        icon={Briefcase}
        subLabel="open listings"
        compact={commercialEmpty}
      />
      <StatCard
        label="Saved opportunities"
        value={interestsState.status === "loading" ? "…" : String(interestCount)}
        icon={HandshakeIcon}
        subLabel="interests expressed"
        compact={commercialEmpty}
      />
      <StatCard
        label="Total budget posted"
        value={formatBudgetTotal(totalBudgetPosted, jobsState.status === "loading")}
        icon={DollarSign}
        subLabel="across all jobs"
        compact={commercialEmpty}
      />
    </div>
  );

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Continue your refurbishment projects — Photos, Analysis, Redesign, Estimate, Export."
    >
      {showOnboardingCard && (
        <Card className="mb-6 border-accent/40 bg-accent/10">
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Welcome{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""} 👋
                </p>
                <p className="text-xs text-muted-foreground">
                  Complete this checklist to get value from Refurb Genius in under 10 minutes.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowOnboardingCard(false)}>
                Dismiss
              </Button>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border/50 bg-background/50 p-3">
              <Label htmlFor="dashboard-onboarding-goal" className="text-sm font-medium">
                What do you want to do first?{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <p id="dashboard-onboarding-goal-hint" className="text-xs text-muted-foreground">
                Helps us highlight the right next step. You can change this anytime by dismissing
                and continuing from Quick actions.
              </p>
              <select
                id="dashboard-onboarding-goal"
                value={onboardingGoal}
                onChange={(event) => {
                  void applyOnboardingGoal(event.target.value);
                }}
                disabled={goalSaving}
                aria-describedby="dashboard-onboarding-goal-hint"
                className={cn(
                  "field-surface flex h-10 w-full max-w-md rounded-xl px-3 text-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <option value="">Choose a starting focus…</option>
                {ONBOARDING_GOAL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <OnboardingCheckItem done={projectCount > 0} label="Create your first project" />
              <OnboardingCheckItem
                done={jobsState.status === "ready" && jobsState.jobs.length > 0}
                label="Add a trades job or shortlist"
              />
              {/*
                PH-TRUTH-R1: done-state is first-Study celebration localStorage only.
                Do not label it as project Estimate/Export progress — legacy
                estimate_done/report_done flags are non-authoritative for currentness
                and must not invent workflow authority here.
              */}
              <OnboardingCheckItem
                done={hasCompletedFirstStudy}
                label="Optional: create a feasibility snapshot"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/analyze">New Analysis</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/projects">View projects</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/*
        IA-8-VR-R1 mobile hierarchy:
        1) Projects / continuation (core Photos→Export journey)
        2) Quick actions for that journey
        3) Commercial metrics (compact when empty)
        4) Trades / interests detail
      */}
      <div className="mb-6" data-testid="dashboard-projects-section">
        {projectsSection}
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard icon={Calculator} label="New Analysis" to="/analyze" />
          <QuickActionCard icon={FolderPlus} label="Create Project" to="/projects/new" />
          <QuickActionCard icon={Briefcase} label="Post a Trades Job" to="/trades/new" />
          <QuickActionCard icon={HardHat} label="Browse Trades Jobs" to="/trades" />
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Trades activity
        </h2>
        {commercialStats}
      </div>

      <DashboardSection
        title="My trades jobs"
        icon={<Briefcase className="h-5 w-5" />}
        action={
          <Link to="/trades/new" className="text-sm font-medium text-accent hover:underline">
            + Post new job
          </Link>
        }
      >
        <TradesJobsTable state={jobsState} onUpdate={applyUpdate} />
      </DashboardSection>

      <DashboardSection title="My interests" icon={<HandshakeIcon className="h-5 w-5" />}>
        <MyInterestsTable state={interestsState} />
      </DashboardSection>

      {/* PH-TRUTH CIR-TRUTH-06: Studies remain available but secondary to Projects workflow */}
      <section data-testid="dashboard-studies-secondary" className="mt-2">
        <Card className="border-dashed border-border/50 bg-muted/20 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Optional · Feasibility snapshots
            </h2>
            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Secondary
            </span>
          </div>
          <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
            Lightweight feasibility snapshots sit outside the primary Photos → Analysis → Redesign →
            Estimate → Export project workflow. Use them when you need a quick standalone study.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <LiveFeatureCard
              icon={Calculator}
              title="Refurb estimates (snapshot)"
              description="Standalone regional cost snapshots — separate from project Estimate authority."
              to="/studies/workspace"
              cta="Open feasibility workspace"
              detail="Optional · not the main project path"
            />
            <LiveFeatureCard
              icon={TrendingUp}
              title="ROI snapshot tools"
              description="Quick deal-style ROI helpers in the feasibility workspace."
              to="/studies/workspace"
              cta="Open ROI tools"
              detail="Optional · project Export remains primary for PDFs"
            />
            <LiveFeatureCard
              icon={BookMarked}
              title="Saved studies"
              description="Revisit saved feasibility snapshots. Share with lenders or JV partners when useful."
              to="/studies"
              cta="View studies"
              detail="Deep-link still available · not primary navigation"
            />
          </div>
        </Card>
      </section>
    </AppLayout>
  );
}

function OnboardingCheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-success" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TradesJobsTable({
  state,
  onUpdate,
}: {
  state: JobsState;
  onUpdate: (job: TradesJob) => void;
}) {
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (state.status === "error") {
    return <EmptyState icon={Briefcase} title="Could not load jobs" description={state.message} />;
  }

  if (state.jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No trades jobs yet"
        description="Post your first refurbishment job to the Trades job board."
        action={
          <Button asChild>
            <Link to="/trades/new">
              <Briefcase className="h-4 w-4" /> Post a job
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="divide-y divide-border sm:hidden">
        {state.jobs.map((job) => (
          <TradesJobCard key={job.id} job={job} onUpdate={onUpdate} />
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Budget</th>
              <th className="px-4 py-3 text-left">Posted</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {state.jobs.map((job) => (
              <TradesJobRow key={job.id} job={job} onUpdate={onUpdate} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TradesJobRow({ job, onUpdate }: { job: TradesJob; onUpdate: (job: TradesJob) => void }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      const updated = await updateTradesJob(job.id, { status: "closed" });
      onUpdate(updated);
    } finally {
      setClosing(false);
    }
  }

  return (
    <tr className="transition-colors hover:bg-secondary/50">
      <td className="max-w-[220px] truncate px-4 py-3 font-medium text-foreground">{job.title}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatCategoryLabel(job.jobCategory)}</td>
      <td className="px-4 py-3">
        <JobStatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatBudgetRange(job)}</td>
      <td className="px-4 py-3 text-muted-foreground">{formatShortDate(job.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm" title="View">
            <Link to="/trades/$jobId" params={{ jobId: job.id }}>
              <Eye className="h-4 w-4" />
              <span className="sr-only">View</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" title="Edit" disabled={job.status === "closed"}>
            <Link to="/trades/$jobId/edit" params={{ jobId: job.id }}>
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Close job"
            disabled={job.status === "closed" || closing}
            onClick={handleClose}
            className="text-destructive hover:text-destructive"
          >
            {closing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TradesJobCard({ job, onUpdate }: { job: TradesJob; onUpdate: (job: TradesJob) => void }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      const updated = await updateTradesJob(job.id, { status: "closed" });
      onUpdate(updated);
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-medium text-foreground">{job.title}</p>
        <p className="text-xs text-muted-foreground">
          {formatCategoryLabel(job.jobCategory)} · {formatShortDate(job.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          <span className="text-xs text-muted-foreground">{formatBudgetRange(job)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link to="/trades/$jobId" params={{ jobId: job.id }}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" disabled={job.status === "closed"}>
          <Link to="/trades/$jobId/edit" params={{ jobId: job.id }}>
            <Pencil className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={job.status === "closed" || closing}
          onClick={handleClose}
          className="text-destructive hover:text-destructive"
        >
          {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function MyInterestsTable({ state }: { state: InterestsState }) {
  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border bg-card py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <EmptyState
        icon={HandshakeIcon}
        title="Could not load interests"
        description={state.message}
      />
    );
  }

  if (state.interests.length === 0) {
    return (
      <EmptyState
        icon={HandshakeIcon}
        title="No interests yet"
        description="You have not registered interest in any jobs yet."
        action={
          <Button asChild>
            <Link to="/trades">
              <HardHat className="h-4 w-4" /> Start exploring jobs near you
            </Link>
          </Button>
        }
      />
    );
  }

  const interestStatusBadge: Record<string, "accent" | "muted" | "destructive"> = {
    pending: "muted",
    accepted: "accent",
    rejected: "destructive",
  };

  return (
    <>
      {/* Mobile card list */}
      <div className="divide-y divide-border sm:hidden">
        {state.interests.map((interest) => (
          <div key={interest.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate font-medium text-foreground">{interest.jobTitle}</p>
              <p className="text-xs text-muted-foreground">
                {formatCategoryLabel(interest.jobCategory)}
                {interest.jobPostcode ? ` · ${interest.jobPostcode}` : ""} ·{" "}
                {formatShortDate(interest.createdAt)}
              </p>
              <div className="flex items-center gap-2">
                <StatusBadge tone={interestStatusBadge[interest.status] ?? "muted"}>
                  {interest.status}
                </StatusBadge>
                {interest.message && (
                  <span className="max-w-[160px] truncate text-xs text-muted-foreground">
                    {interest.message}
                  </span>
                )}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/trades/$jobId" params={{ jobId: interest.jobId }}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 text-left">Job title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Area</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Message</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {state.interests.map((interest) => (
              <tr key={interest.id} className="transition-colors hover:bg-secondary/30">
                <td className="max-w-[200px] truncate px-4 py-3 font-medium text-foreground">
                  {interest.jobTitle}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatCategoryLabel(interest.jobCategory)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{interest.jobPostcode ?? "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={interestStatusBadge[interest.status] ?? "muted"}>
                    {interest.status}
                  </StatusBadge>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                  {interest.message ?? <span className="italic">No message</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatShortDate(interest.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="ghost" size="sm" title="View job">
                    <Link to="/trades/$jobId" params={{ jobId: interest.jobId }}>
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View job</span>
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  compact = false,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon?: typeof Calculator;
  /** When true, reduce visual weight for empty commercial metrics (IA-8-VR-R1). */
  compact?: boolean;
}) {
  return (
    <Card className={cn("border border-border/60 bg-card/75", compact ? "p-3 sm:p-4" : "p-5")}>
      <div className="flex items-center justify-between gap-1">
        <p
          className={cn(
            "font-medium uppercase tracking-[0.5px] text-muted-foreground",
            compact ? "text-[10px] leading-tight" : "text-xs",
          )}
        >
          {label}
        </p>
        {Icon && !compact ? <Icon className="h-4 w-4 shrink-0 text-accent" /> : null}
      </div>
      <p
        className={cn(
          "font-semibold tracking-tighter text-foreground tabular-nums",
          compact ? "mt-1.5 text-xl sm:text-2xl" : "mt-3 text-3xl",
        )}
      >
        {value}
      </p>
      {subLabel && !compact ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{subLabel}</p>
      ) : null}
    </Card>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  to,
}: {
  icon: typeof Calculator;
  label: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[100px] flex-col justify-between rounded-xl border border-border/60 bg-card/75 p-5 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg active:translate-y-0"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent transition group-hover:bg-accent/15">
        <Icon className="h-4 w-4" />
      </div>
      <span className="mt-2 leading-tight text-foreground/90 group-hover:text-foreground">
        {label}
      </span>
    </Link>
  );
}

function LiveFeatureCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
  detail,
}: {
  icon: typeof Calculator;
  title: string;
  description: string;
  to: string;
  cta: string;
  detail: string;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60 bg-card/75">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-5 w-5" />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to={to}>{cta}</Link>
          </Button>
        </div>
        <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
