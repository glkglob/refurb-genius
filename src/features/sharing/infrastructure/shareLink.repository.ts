import { auth } from "@/lib/auth";
import { supabase } from "@/platform/supabase/browser";
import type { Database } from "@repo/supabase";
import type { ShareLinkRepository } from "../application";
import type { CreateShareLinkInput, ShareLink } from "../domain";

type ShareLinkRow = Database["public"]["Tables"]["share_links"]["Row"];

export class SupabaseShareLinkRepository implements ShareLinkRepository {
  async create(input: CreateShareLinkInput): Promise<ShareLink> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in to create share links.");

    const token = crypto.randomUUID().replaceAll("-", "");
    const { data, error } = await supabase
      .from("share_links")
      .insert({
        study_id: input.studyId,
        owner_user_id: user.id,
        token,
        visibility: input.visibility,
        access_role: input.accessRole,
        expires_at: input.expiresAt ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapShareLink(data);
  }

  async listByStudy(studyId: string): Promise<ShareLink[]> {
    const user = auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from("share_links")
      .select("*")
      .eq("study_id", studyId)
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapShareLink);
  }

  async revoke(linkId: string): Promise<void> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in to revoke share links.");

    const { error } = await supabase
      .from("share_links")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("owner_user_id", user.id);

    if (error) throw new Error(error.message);
  }
}

export const supabaseShareLinkRepository: ShareLinkRepository = new SupabaseShareLinkRepository();

function mapShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    studyId: row.study_id,
    token: row.token,
    visibility: row.visibility as ShareLink["visibility"],
    accessRole: row.access_role as ShareLink["accessRole"],
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}
