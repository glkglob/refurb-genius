import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { makeCreateShareLink, makeListShareLinks, makeRevokeShareLink } from "../../application";
import type { CreateShareLinkInput, ShareLink } from "../../domain";
import { supabaseShareLinkRepository } from "../../infrastructure";
import { trackEvent } from "@/lib/analytics";

const createShareLink = makeCreateShareLink({ repository: supabaseShareLinkRepository });
const listShareLinks = makeListShareLinks({ repository: supabaseShareLinkRepository });
const revokeShareLink = makeRevokeShareLink({ repository: supabaseShareLinkRepository });

export function useShareLinks(studyId: string) {
  return useQuery({
    queryKey: ["share-links", studyId],
    queryFn: () => listShareLinks(studyId),
    enabled: !!studyId,
  });
}

export function useCreateShareLink(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation<ShareLink, Error, Omit<CreateShareLinkInput, "studyId">>({
    mutationFn: (input) => createShareLink({ ...input, studyId }),
    onSuccess: () => {
      trackEvent("study_shared", { study_id: studyId });
      void queryClient.invalidateQueries({ queryKey: ["share-links", studyId] });
    },
  });
}

export function useRevokeShareLink(studyId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { linkId: string }>({
    mutationFn: ({ linkId }) => revokeShareLink(linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["share-links", studyId] });
    },
  });
}
