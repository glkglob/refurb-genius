"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Briefcase,
  Eye,
  HandshakeIcon,
  HardHat,
  Loader2,
  Pencil,
  SearchX,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { tradespeopleQueryOptions, tradeFavoritesQueryOptions } from "@/lib/queries/marketplace";
import {
  TradepersonCard,
  MarketplaceFilters,
  QuoteRequestDialog,
  MessagingInbox,
} from "@/components/marketplace";
import {
  listCurrentUserInterestsWithJobs,
  listCurrentUserTradesJobs,
  updateTradesJob,
  type TradesJobInterestWithJob,
} from "@/features/trades";
import { formatBudgetRange, formatCategoryLabel, formatShortDate, formatStatus } from "@repo/core";
import type { TradesJobStatus } from "@repo/types";

type OwnerTradesJob = Awaited<ReturnType<typeof listCurrentUserTradesJobs>>[number];

type JobsState =
  | { status: "loading" }
  | { status: "ready"; jobs: OwnerTradesJob[] }
  | { status: "error"; message: string };

type InterestsState =
  | { status: "loading" }
  | { status: "ready"; interests: TradesJobInterestWithJob[] }
  | { status: "error"; message: string };

function useMyTradesJobs(): [JobsState, (updatedJob: OwnerTradesJob) => void] {
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

  function applyUpdate(updatedJob: OwnerTradesJob) {
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", jobs: prev.jobs.map((j) => (j.id === updatedJob.id ? updatedJob : j)) }
        : prev,
    );
  }

  return [state, applyUpdate];
}

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

export const Route = createFileRoute("/_authed/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace — Refurb Genius" }] }),
  validateSearch: z.object({
    projectId: z.string().optional(),
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const { projectId } = Route.useSearch();
  const { user } = useAuth();
  const [jobsState, applyJobUpdate] = useMyTradesJobs();
  const interestsState = useMyInterests();

  useEffect(() => {
    trackEvent("marketplace_listing_viewed");
  }, []);

  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [postcodeFilter, setPostcodeFilter] = useState("");
  const [minRating, setMinRating] = useState(0);

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [selectedTradeperson, setSelectedTradeperson] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: tradespeople = [], isLoading, error } = useQuery(tradespeopleQueryOptions());

  const { data: favorites = [] } = useQuery({
    ...tradeFavoritesQueryOptions(user?.id || ""),
    enabled: !!user?.id,
  });

  // Client-side filtering (matches query layer style + keeps server fetch simple)
  const filteredTrades = tradespeople
    .filter((t) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        t.business_name.toLowerCase().includes(term) ||
        (t.bio && t.bio.toLowerCase().includes(term)) ||
        (t.postcode && t.postcode.toLowerCase().includes(term));

      const matchesPostcode =
        !postcodeFilter ||
        (t.postcode && t.postcode.toLowerCase().includes(postcodeFilter.toLowerCase()));

      const matchesRating = (t.rating ?? 0) >= minRating;

      // Specialties are loaded per-card so we approximate by matching the
      // filter value against business name and bio rather than the search term.
      const specialtyLower = specialtyFilter.toLowerCase();
      const matchesSpecialty =
        specialtyFilter === "All" ||
        t.business_name.toLowerCase().includes(specialtyLower) ||
        (t.bio && t.bio.toLowerCase().includes(specialtyLower));

      return matchesSearch && matchesPostcode && matchesRating && matchesSpecialty;
    })
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const handleRequestQuote = (tradespersonId: string) => {
    const tp = tradespeople.find((t) => t.id === tradespersonId);
    if (tp) {
      setSelectedTradeperson({ id: tradespersonId, name: tp.business_name });
      setQuoteDialogOpen(true);
    }
  };

  const closeQuoteDialog = () => {
    setQuoteDialogOpen(false);
    setSelectedTradeperson(null);
  };

  return (
    <AppLayout
      title="Marketplace"
      subtitle="Provider directory, quotes, messages, jobs, and interests. A verified provider marketplace is not live yet."
      actions={
        <>
          <Button asChild size="sm">
            <Link to="/trades/new" data-testid="marketplace-post-job">
              Post a Job
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/trades" data-testid="marketplace-trades-board">
              Trades job board
            </Link>
          </Button>
        </>
      }
    >
      <div className="mb-6">
        <p className="text-muted-foreground">
          This directory is still being developed and is not a mature supply of vetted tradespeople.
          Use the job board to post or browse refurbishment jobs today.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/trades">Browse Trades job board</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/trades/new">Post a Job</Link>
          </Button>
        </div>
        {projectId && (
          <div className="mt-2 inline-flex items-center rounded-md bg-accent/10 px-3 py-1 text-xs font-medium text-accent-text">
            Context: Project {projectId.slice(0, 8)}…
            <Link
              to="/projects/$id"
              params={{ id: projectId }}
              search={{ tab: "overview" }}
              className="ml-2 underline"
            >
              View project
            </Link>
          </div>
        )}
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="browse">Browse directory</TabsTrigger>
          <TabsTrigger value="inbox">My Quotes &amp; Messages</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="my-jobs" data-testid="marketplace-tab-my-jobs">
            My Jobs
          </TabsTrigger>
          <TabsTrigger value="my-interests" data-testid="marketplace-tab-my-interests">
            My Interests
          </TabsTrigger>
        </TabsList>

        {/* Browse */}
        <TabsContent value="browse">
          <MarketplaceFilters
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            specialtyFilter={specialtyFilter}
            setSpecialtyFilter={setSpecialtyFilter}
            postcodeFilter={postcodeFilter}
            setPostcodeFilter={setPostcodeFilter}
            minRating={minRating}
            setMinRating={setMinRating}
          />

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-6 text-destructive">
                Failed to load tradespeople. Please try again.
              </CardContent>
            </Card>
          ) : tradespeople.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">Provider directory still being developed</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                There is no live provider supply here yet. Post or browse jobs on the Trades job
                board instead.
              </p>
              <Button asChild className="mt-4" size="sm">
                <Link to="/trades">Go to Trades job board</Link>
              </Button>
            </div>
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">No profiles match these filters</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters or search term. The directory is still early and supply
                is limited.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTrades.map((tp) => (
                <TradepersonCard
                  key={tp.id}
                  tradesperson={tp}
                  onRequestQuote={handleRequestQuote}
                  projectId={projectId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Inbox / Messages */}
        <TabsContent value="inbox">
          <MessagingInbox projectId={projectId} />
        </TabsContent>

        <TabsContent value="my-jobs" data-testid="marketplace-my-jobs">
          <MyJobsPanel state={jobsState} onUpdate={applyJobUpdate} />
        </TabsContent>

        <TabsContent value="my-interests" data-testid="marketplace-my-interests">
          <MyInterestsPanel state={interestsState} />
        </TabsContent>

        {/* Favorites */}
        <TabsContent value="favorites">
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to see your saved favorites.</p>
          ) : favorites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You haven't favorited any tradespeople yet. Heart icons on cards will save them here.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favorites.map((fav) => {
                const tp = tradespeople.find((t) => t.id === fav.tradesperson_id);
                if (!tp) return null;
                return (
                  <TradepersonCard
                    key={fav.id}
                    tradesperson={tp}
                    onRequestQuote={handleRequestQuote}
                    projectId={projectId}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Quote dialog */}
      {selectedTradeperson && (
        <QuoteRequestDialog
          open={quoteDialogOpen}
          onOpenChange={closeQuoteDialog}
          tradespersonId={selectedTradeperson.id}
          tradespersonName={selectedTradeperson.name}
          projectId={projectId}
        />
      )}
    </AppLayout>
  );
}

function JobStatusBadge({ status }: { status: TradesJobStatus }) {
  const tone = status === "posted" ? "accent" : status === "closed" ? "muted" : "destructive";
  return <StatusBadge tone={tone}>{formatStatus(status)}</StatusBadge>;
}

function MyJobsPanel({
  state,
  onUpdate,
}: {
  state: JobsState;
  onUpdate: (job: OwnerTradesJob) => void;
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
              <Briefcase className="h-4 w-4" /> Post a Job
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="divide-y divide-border sm:hidden">
        {state.jobs.map((job) => (
          <TradesJobCard key={job.id} job={job} onUpdate={onUpdate} />
        ))}
      </div>
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

function TradesJobRow({
  job,
  onUpdate,
}: {
  job: OwnerTradesJob;
  onUpdate: (job: OwnerTradesJob) => void;
}) {
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

function TradesJobCard({
  job,
  onUpdate,
}: {
  job: OwnerTradesJob;
  onUpdate: (job: OwnerTradesJob) => void;
}) {
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

function MyInterestsPanel({ state }: { state: InterestsState }) {
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
