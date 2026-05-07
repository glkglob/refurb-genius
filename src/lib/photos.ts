// Mock photo store. Holds object URLs in memory keyed by project id.
// Replace with Supabase Storage later: implement the same upload/list/remove
// surface against a `project-photos` bucket without changing consumers.

export type ProjectPhoto = {
  id: string;
  projectId: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
};

const photos = new Map<string, ProjectPhoto[]>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function delay(ms = 400) {
  return new Promise((r) => setTimeout(r, ms));
}

export const photoStore = {
  list(projectId: string): ProjectPhoto[] {
    return photos.get(projectId) ?? [];
  },
  async upload(projectId: string, files: File[]): Promise<ProjectPhoto[]> {
    await delay();
    const created: ProjectPhoto[] = files
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        projectId,
        url: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      }));
    const existing = photos.get(projectId) ?? [];
    photos.set(projectId, [...existing, ...created]);
    notify();
    return created;
  },
  async remove(projectId: string, photoId: string): Promise<void> {
    const list = photos.get(projectId) ?? [];
    const target = list.find((p) => p.id === photoId);
    if (target?.url.startsWith("blob:")) URL.revokeObjectURL(target.url);
    photos.set(projectId, list.filter((p) => p.id !== photoId));
    notify();
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
