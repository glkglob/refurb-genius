// Supabase Storage + photos table backed photo store.
// Files live in the public `project-photos` bucket under
// `{user_id}/{project_id}/{uuid}.{ext}` so storage RLS scopes ownership by
// the leading folder. Metadata is mirrored into the `photos` table.
import { supabase } from "@/integrations/supabase/client";
import { auth } from "./auth";

export type ProjectPhoto = {
  id: string;
  projectId: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
  storagePath: string;
};

const BUCKET = "project-photos";

const cacheByProject = new Map<string, ProjectPhoto[]>();
const loadedProjects = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function rowToPhoto(r: Record<string, unknown>): ProjectPhoto {
  return {
    id: r.id,
    projectId: r.project_id,
    url: r.url,
    name: r.name,
    size: Number(r.size ?? 0),
    uploadedAt: r.uploaded_at,
    storagePath: r.storage_path,
  };
}

async function fetchProjectPhotos(projectId: string) {
  if (!auth.getUser()) {
    cacheByProject.set(projectId, []);
    loadedProjects.add(projectId);
    notify();
    return;
  }
  const { data, error } = await supabase
    .from("photos")
    .select("*")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: true });
  if (error) {
    console.error("[photos] fetch failed", error);
    cacheByProject.set(projectId, []);
  } else {
    cacheByProject.set(projectId, (data ?? []).map(rowToPhoto));
  }
  loadedProjects.add(projectId);
  notify();
}

function ensureLoaded(projectId: string) {
  if (loadedProjects.has(projectId) || inFlight.has(projectId)) return;
  const p = fetchProjectPhotos(projectId).finally(() => inFlight.delete(projectId));
  inFlight.set(projectId, p);
}

if (typeof window !== "undefined") {
  auth.onChange(() => {
    cacheByProject.clear();
    loadedProjects.clear();
    notify();
  });
}

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "jpg";
}

export const photoStore = {
  list(projectId: string): ProjectPhoto[] {
    ensureLoaded(projectId);
    return cacheByProject.get(projectId) ?? [];
  },
  async refresh(projectId: string): Promise<void> {
    await fetchProjectPhotos(projectId);
  },
  async upload(projectId: string, files: File[]): Promise<ProjectPhoto[]> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in to upload photos.");
    const created: ProjectPhoto[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const id = crypto.randomUUID();
      const path = `${user.id}/${projectId}/${id}.${fileExt(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        console.error("[photos] upload failed", upErr);
        throw new Error(upErr.message);
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub.publicUrl;
      const { data: row, error: insErr } = await supabase
        .from("photos")
        .insert({
          id,
          project_id: projectId,
          user_id: user.id,
          storage_path: path,
          url,
          name: file.name,
          size: file.size,
        })
        .select()
        .single();
      if (insErr) {
        console.error("[photos] metadata insert failed", insErr);
        // Roll back the storage upload to keep things consistent.
        await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
        throw new Error(insErr.message);
      }
      created.push(rowToPhoto(row));
    }
    const existing = cacheByProject.get(projectId) ?? [];
    cacheByProject.set(projectId, [...existing, ...created]);
    loadedProjects.add(projectId);
    notify();
    return created;
  },
  async remove(projectId: string, photoId: string): Promise<void> {
    const list = cacheByProject.get(projectId) ?? [];
    const target = list.find((p) => p.id === photoId);
    cacheByProject.set(projectId, list.filter((p) => p.id !== photoId));
    notify();
    if (target?.storagePath) {
      await supabase.storage.from("project-photos").remove([target.storagePath]).catch(() => {});
    }
    const { error } = await supabase.from("photos").delete().eq("id", photoId);
    if (error) console.error("[photos] delete failed", error);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
