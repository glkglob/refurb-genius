// Pitch Deck Exports domain types

export type PitchDeckExport = {
  id: string;
  projectId: string;
  userId: string;
  title: string | null;
  exportUrl: string | null;
  format: string; // "pdf" | ...
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
};
