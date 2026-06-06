"use client";

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@repo/ui";
import { Card, CardContent } from "@repo/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui";
import { Loader2, SearchX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { tradespeopleQueryOptions, tradeFavoritesQueryOptions } from "@/lib/queries/marketplace";
import {
  TradepersonCard,
  MarketplaceFilters,
  QuoteRequestDialog,
  MessagingInbox,
} from "@/components/marketplace";

export const Route = createFileRoute("/_authed/marketplace")({
  head: () => ({ meta: [{ title: "Trades Marketplace — Refurb Genius" }] }),
  validateSearch: (search: Record<string, unknown>) => {
    const pid = typeof search.projectId === "string" ? search.projectId : undefined;
    return { projectId: pid } as { projectId?: string };
  },
  component: MarketplacePage,
});

function MarketplacePage() {
  const search = Route.useSearch() as { projectId?: string };
  const { projectId } = search;
  const { user } = useAuth();

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

      const matchesSpecialty =
        specialtyFilter === "All" ||
        // Note: specialties loaded per-card; we approximate here with name/bio match for the filter term
        (specialtyFilter !== "All" && term.includes(specialtyFilter.toLowerCase())) ||
        t.business_name.toLowerCase().includes(specialtyFilter.toLowerCase());

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
      title="Trades Marketplace"
      subtitle="Find verified local tradespeople for your refurb projects"
    >
      <div className="mb-6">
        <p className="text-muted-foreground">
          Browse, favorite, and request quotes. When coming from a project, your requests will be
          linked automatically.
        </p>
        {projectId && (
          <div className="mt-2 inline-flex items-center rounded-md bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
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
        <TabsList>
          <TabsTrigger value="browse">Browse Tradespeople</TabsTrigger>
          <TabsTrigger value="inbox">My Quotes &amp; Messages</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
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
          ) : filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <SearchX className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="font-medium">No matching tradespeople found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your filters or search term.
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
