/**
 * Neutral project-photo type (C5-4B1).
 *
 * Side-effect free: no Supabase, no cache, no Auth listener, no store.
 * Read/write modules and UI import this type authority only.
 */
export type ProjectPhoto = {
  id: string;
  projectId: string;
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
  storagePath: string;
};
