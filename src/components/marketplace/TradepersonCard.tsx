"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { Button } from "@repo/ui";
import { Badge } from "@repo/ui";
import { Heart, Star, MapPin, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/services/supabase";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  tradeSpecialtiesQueryOptions,
  tradeFavoritesQueryOptions,
  marketplaceKeys,
} from "@/lib/queries/marketplace";
import { optimisticSetList, rollbackList } from "@/lib/queries/projects";

interface TradepersonCardProps {
  tradesperson: {
    id: string;
    business_name: string;
    contact_name: string;
    postcode: string | null;
    bio: string | null;
    rating: number | null;
    review_count: number | null;
    phone: string | null;
    email: string | null;
  };
  onRequestQuote: (tradespersonId: string) => void;
  projectId?: string;
}

export function TradepersonCard({ tradesperson, onRequestQuote, projectId }: TradepersonCardProps) {
  const queryClient = useQueryClient();
  const user = auth.getUser();
  const userId = user?.id;

  const { data: specialties = [] } = useQuery(tradeSpecialtiesQueryOptions(tradesperson.id));

  const { data: favorites = [] } = useQuery({
    ...tradeFavoritesQueryOptions(userId || ""),
    enabled: !!userId,
  });

  const isFavorited = favorites.some((f) => f.tradesperson_id === tradesperson.id);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Sign in to favorite");

      if (isFavorited) {
        const fav = favorites.find((f) => f.tradesperson_id === tradesperson.id);
        if (fav) {
          const { error } = await supabase.from("trade_favorites").delete().eq("id", fav.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("trade_favorites").insert({
          user_id: userId,
          tradesperson_id: tradesperson.id,
        });
        if (error) throw error;
      }
    },
    onMutate: async () => {
      if (!userId) return;
      await queryClient.cancelQueries({
        queryKey: marketplaceKeys.favoritesByUser(userId),
      });
      const previous = optimisticSetList(
        queryClient,
        marketplaceKeys.favoritesByUser(userId),
        (old = []) => {
          if (isFavorited) {
            return (old as Array<{ tradesperson_id?: string }>).filter(
              (f: { tradesperson_id?: string }) => f.tradesperson_id !== tradesperson.id,
            );
          }
          return [
            ...old,
            {
              id: "temp-" + Date.now(),
              user_id: userId,
              tradesperson_id: tradesperson.id,
              created_at: new Date().toISOString(),
            },
          ];
        },
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous && userId) {
        rollbackList(queryClient, marketplaceKeys.favoritesByUser(userId), ctx.previous);
      }
      logger.error("[marketplace] favorite toggle failed", { error: (err as Error).message });
      toast.error("Failed to update favorites");
    },
    onSettled: () => {
      if (userId) {
        queryClient.invalidateQueries({
          queryKey: marketplaceKeys.favoritesByUser(userId),
        });
      }
    },
  });

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userId) {
      toast.error("Please sign in to save favorites");
      return;
    }
    toggleFavoriteMutation.mutate();
  };

  const displayRating = tradesperson.rating ?? 0;
  const displayReviews = tradesperson.review_count ?? 0;

  return (
    <Card className="group flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg group-hover:text-accent transition-colors">
              {tradesperson.business_name}
            </CardTitle>
            <CardDescription>{tradesperson.contact_name}</CardDescription>
          </div>
          <button
            onClick={handleFavorite}
            className="p-1 rounded hover:bg-muted"
            aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
            disabled={toggleFavoriteMutation.isPending}
          >
            <Heart
              className={`h-5 w-5 transition-colors ${
                isFavorited
                  ? "fill-red-500 text-red-500"
                  : "text-muted-foreground group-hover:text-red-400"
              }`}
            />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3 text-sm">
        {tradesperson.postcode && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> {tradesperson.postcode}
          </div>
        )}

        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${
                  i < Math.round(displayRating)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <span className="font-medium">{displayRating.toFixed(1)}</span>
          <span className="text-muted-foreground">({displayReviews})</span>
        </div>

        {tradesperson.bio && (
          <p className="text-muted-foreground line-clamp-2">{tradesperson.bio}</p>
        )}

        <div className="flex flex-wrap gap-1 pt-1">
          {specialties.length > 0 ? (
            specialties.slice(0, 4).map((spec) => (
              <Badge key={spec.id} variant="secondary" className="text-[10px]">
                {spec.specialty}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Specialties loading...</span>
          )}
        </div>

        <div className="flex gap-2 pt-2 text-xs text-muted-foreground">
          {tradesperson.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {tradesperson.phone}
            </span>
          )}
          {tradesperson.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="h-3 w-3" /> {tradesperson.email}
            </span>
          )}
        </div>
      </CardContent>

      <div className="p-4 pt-0 mt-auto">
        <Button
          onClick={() => onRequestQuote(tradesperson.id)}
          className="w-full"
          variant="default"
          size="sm"
        >
          Request Quote{projectId ? " for Project" : ""}
        </Button>
      </div>
    </Card>
  );
}
