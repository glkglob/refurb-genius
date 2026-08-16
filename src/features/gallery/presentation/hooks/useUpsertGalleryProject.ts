/**
 * Presentation-safe gallery upsert mutation (AO-1M3 / P1B4 / SEC-1B-GALLERY-C).
 *
 * Owns:
 * - auth.getUser gate
 * - useMutation lifecycle
 * - optimistic cache + rollback against galleryKeys.byProject
 * - cover revoke-before-unpublish and post-persist old-cover cleanup
 * - owner-session pending cover-cleanup collection (never one-slot overwrite)
 * - settled invalidation (owner + public list/detail keys)
 * - mutation logging
 *
 * Persistence: galleryRepository.upsertGalleryProject (infrastructure).
 * Cover revocation: revokeGalleryCover (infrastructure).
 * Optimistic objects use the stable PublicGalleryProjectRow application model.
 */
import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  isGalleryUnpublishPrivacyComplete,
  type GalleryCoverRevocationResult,
} from "@/features/gallery/domain";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { galleryKeys, type PublicGalleryProjectRow } from "@/lib/queries/gallery";
import { revokeGalleryCover } from "@/features/gallery/infrastructure";
import { galleryRepository } from "../../infrastructure/galleryRepository";

export interface UpsertGalleryProjectInput {
  is_public?: boolean;
  featured?: boolean;
  title?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
}

export type PendingCoverCleanup = {
  projectId: string;
  coverImageUrl: string;
  error: string;
  kind: "obsolete" | "compensation";
};

export type UpsertGalleryProjectResult = {
  gallery: PublicGalleryProjectRow;
  obsoleteCoverCleanup: GalleryCoverRevocationResult | null;
  pendingCoverCleanup: PendingCoverCleanup | null;
};

export class GalleryUnpublishPrivacyError extends Error {
  readonly code = "GALLERY_UNPUBLISH_PRIVACY" as const;

  constructor(message = "Could not remove the public cover image. The listing was left public.") {
    super(message);
    this.name = "GalleryUnpublishPrivacyError";
  }
}

export class GalleryCoverCleanupBusyError extends Error {
  readonly code = "GALLERY_COVER_CLEANUP_BUSY" as const;

  constructor(message = "Cover cleanup retry is in progress.") {
    super(message);
    this.name = "GalleryCoverCleanupBusyError";
  }
}

export function gallerySaveFeedback(
  result: UpsertGalleryProjectResult | null | undefined,
  error: unknown,
): { tone: "success" | "error"; message: string } {
  if (error instanceof GalleryUnpublishPrivacyError) {
    return { tone: "error", message: error.message };
  }
  if (error) {
    return {
      tone: "error",
      message: error instanceof Error ? error.message : "Failed to save gallery settings.",
    };
  }
  if (result?.obsoleteCoverCleanup?.status === "failed") {
    return {
      tone: "error",
      message:
        "Gallery settings saved, but the previous cover image could not be removed. Use Retry cleanup.",
    };
  }
  return { tone: "success", message: "Gallery settings saved" };
}

function isUnpublishRequest(
  input: UpsertGalleryProjectInput,
  previous: PublicGalleryProjectRow | null | undefined,
): boolean {
  return input.is_public === false && previous?.is_public !== false;
}

function invalidateGalleryCaches(queryClient: QueryClient, projectId: string) {
  queryClient.invalidateQueries({ queryKey: galleryKeys.byProject(projectId) });
  queryClient.invalidateQueries({ queryKey: galleryKeys.publicList() });
  queryClient.invalidateQueries({ queryKey: [...galleryKeys.all, "byId"] });
}

function sameCleanupIdentity(left: PendingCoverCleanup, projectId: string, coverImageUrl: string) {
  return left.projectId === projectId && left.coverImageUrl === coverImageUrl;
}

function upsertPendingCleanup(
  current: PendingCoverCleanup[],
  entry: PendingCoverCleanup,
): PendingCoverCleanup[] {
  const index = current.findIndex((item) =>
    sameCleanupIdentity(item, entry.projectId, entry.coverImageUrl),
  );
  if (index === -1) return [...current, entry];
  const next = current.slice();
  next[index] = { ...current[index]!, error: entry.error, kind: entry.kind };
  return next;
}

function removePendingCleanup(
  current: PendingCoverCleanup[],
  projectId: string,
  coverImageUrl: string,
): PendingCoverCleanup[] {
  return current.filter((item) => !sameCleanupIdentity(item, projectId, coverImageUrl));
}

function resolveRetryTargetUrl(
  target: string | Pick<PendingCoverCleanup, "coverImageUrl"> | undefined,
): string | undefined {
  if (target === undefined) return undefined;
  return typeof target === "string" ? target : target.coverImageUrl;
}

/**
 * Owner-management mutation for the "Publish to Gallery" feature.
 *
 * Upserts a row into `public_gallery_projects` keyed on `project_id`
 * (unique). RLS (`public_gallery_projects_owner_manage`) permits this for
 * the project owner only.
 */
export function useUpsertGalleryProject(projectId: string) {
  const queryClient = useQueryClient();
  const queryKey = galleryKeys.byProject(projectId);
  const previousByInput = new WeakMap<
    UpsertGalleryProjectInput,
    PublicGalleryProjectRow | null | undefined
  >();
  const [pendingCoverCleanups, setPendingCoverCleanups] = useState<PendingCoverCleanup[]>([]);
  const [retryingCoverImageUrl, setRetryingCoverImageUrl] = useState<string | null>(null);
  const retryingRef = useRef(false);

  const recordFailedCleanup = (entry: PendingCoverCleanup) => {
    setPendingCoverCleanups((current) => upsertPendingCleanup(current, entry));
    logger.error(
      entry.kind === "compensation"
        ? "[gallery] new cover compensation revoke failed"
        : "[gallery] obsolete cover cleanup failed",
      {
        projectId: entry.projectId,
        coverImageUrl: entry.coverImageUrl,
        error: entry.error,
      },
    );
    return entry;
  };

  const clearRevokedCleanup = (coverImageUrl: string | null | undefined) => {
    if (!coverImageUrl) return;
    setPendingCoverCleanups((current) => {
      const next = removePendingCleanup(current, projectId, coverImageUrl);
      return next.length === current.length ? current : next;
    });
  };

  const mutation = useMutation({
    mutationFn: async (input: UpsertGalleryProjectInput): Promise<UpsertGalleryProjectResult> => {
      if (retryingRef.current) {
        throw new GalleryCoverCleanupBusyError();
      }

      const user = auth.getUser();
      if (!user) throw new Error("You must be signed in");

      const previous = previousByInput.get(input);
      const oldCover = previous?.cover_image_url ?? null;

      if (isUnpublishRequest(input, previous)) {
        const coverRevocation = await revokeGalleryCover({ coverImageUrl: oldCover });
        if (
          !isGalleryUnpublishPrivacyComplete({
            isPublic: false,
            coverRevocation,
          })
        ) {
          const detail =
            coverRevocation.status === "failed"
              ? coverRevocation.error
              : "privacy revocation incomplete";
          throw new GalleryUnpublishPrivacyError(
            `Could not remove the public cover image. The listing was left public. ${detail}`,
          );
        }

        const gallery = await galleryRepository.upsertGalleryProject({
          projectId,
          userId: user.id,
          ...input,
          is_public: false,
          cover_image_url: null,
        });
        clearRevokedCleanup(oldCover);
        return { gallery, obsoleteCoverCleanup: null, pendingCoverCleanup: null };
      }

      try {
        const gallery = await galleryRepository.upsertGalleryProject({
          projectId,
          userId: user.id,
          ...input,
        });

        const nextCover = input.cover_image_url !== undefined ? input.cover_image_url : oldCover;
        let obsoleteCoverCleanup: GalleryCoverRevocationResult | null = null;
        let nextPending: PendingCoverCleanup | null = null;
        if (oldCover && nextCover !== oldCover) {
          obsoleteCoverCleanup = await revokeGalleryCover({ coverImageUrl: oldCover });
          if (obsoleteCoverCleanup.status === "failed") {
            nextPending = recordFailedCleanup({
              projectId,
              coverImageUrl: oldCover,
              error: obsoleteCoverCleanup.error,
              kind: "obsolete",
            });
          } else {
            clearRevokedCleanup(oldCover);
          }
        }

        return { gallery, obsoleteCoverCleanup, pendingCoverCleanup: nextPending };
      } catch (err) {
        const uploaded = input.cover_image_url;
        if (uploaded && uploaded !== oldCover) {
          const compensation = await revokeGalleryCover({ coverImageUrl: uploaded });
          if (compensation.status === "failed") {
            recordFailedCleanup({
              projectId,
              coverImageUrl: uploaded,
              error: compensation.error,
              kind: "compensation",
            });
          } else {
            clearRevokedCleanup(uploaded);
          }
        }
        throw err;
      }
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PublicGalleryProjectRow | null>(queryKey);
      previousByInput.set(input, previous);

      const now = new Date().toISOString();
      const fallback: PublicGalleryProjectRow = {
        id: previous?.id ?? "",
        project_id: projectId,
        is_public: false,
        featured: false,
        title: previous?.title ?? "Untitled Project",
        description: null,
        cover_image_url: null,
        view_count: 0,
        created_at: previous?.created_at ?? now,
        updated_at: now,
      };

      const optimisticInput =
        input.is_public === false ? { ...input, cover_image_url: null } : input;

      const merged: PublicGalleryProjectRow = {
        ...(previous ?? fallback),
        ...optimisticInput,
        title: input.title ?? previous?.title ?? fallback.title,
        project_id: projectId,
        updated_at: now,
      };
      queryClient.setQueryData<PublicGalleryProjectRow | null>(queryKey, merged);

      return { previous };
    },
    onError: (err, _input, context) => {
      if (context && "previous" in context) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      logger.error("[gallery] upsert mutation error", {
        projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    },
    onSettled: () => {
      invalidateGalleryCaches(queryClient, projectId);
    },
  });

  const activePendingCoverCleanups = pendingCoverCleanups.filter(
    (entry) => entry.projectId === projectId,
  );
  const pendingCoverCleanup = activePendingCoverCleanups[0] ?? null;

  const retryPendingCoverCleanup = useCallback(
    async (
      target?: string | Pick<PendingCoverCleanup, "coverImageUrl">,
    ): Promise<GalleryCoverRevocationResult> => {
      if (mutation.isPending || retryingRef.current) {
        return { status: "failed", error: "Cover cleanup retry is already in progress" };
      }

      const requestedUrl = resolveRetryTargetUrl(target);
      const entry =
        requestedUrl === undefined
          ? activePendingCoverCleanups[0]
          : activePendingCoverCleanups.find((item) => item.coverImageUrl === requestedUrl);

      if (!entry) {
        if (requestedUrl === undefined) return { status: "already_absent" };
        return { status: "failed", error: "Cover cleanup is not available for this project" };
      }

      retryingRef.current = true;
      setRetryingCoverImageUrl(entry.coverImageUrl);
      try {
        const result = await revokeGalleryCover({ coverImageUrl: entry.coverImageUrl });
        if (result.status === "deleted" || result.status === "already_absent") {
          setPendingCoverCleanups((current) =>
            removePendingCleanup(current, entry.projectId, entry.coverImageUrl),
          );
          return result;
        }

        setPendingCoverCleanups((current) =>
          upsertPendingCleanup(current, { ...entry, error: result.error }),
        );
        return result;
      } finally {
        retryingRef.current = false;
        setRetryingCoverImageUrl(null);
      }
    },
    [activePendingCoverCleanups, mutation.isPending],
  );

  return {
    ...mutation,
    pendingCoverCleanup,
    pendingCoverCleanups: activePendingCoverCleanups,
    retryPendingCoverCleanup,
    isRetryingCoverCleanup: retryingCoverImageUrl !== null,
  };
}
