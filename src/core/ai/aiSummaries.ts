// AI summary / wording surface.
//
// Centralises the natural-language strings the report and analysis pages
// show alongside numbers. Keeping this here means swapping to a real LLM
// summary later only touches this file — UI keeps consuming `summarise*`
// helpers that always return strings.
//
// AI is responsible for: room narratives, project executive summary,
// recommended-works phrasing, and report headline copy. AI is NOT
// responsible for pricing, ROI, or any financial numbers — those are
// produced deterministically by the pricing/ROI engines and only
// referenced (not invented) by the wording layer.
import type { RoomAnalysis } from "@/lib/analysis";

export type ProjectSummaryInput = {
  projectName: string;
  address?: string;
  region?: string;
  rooms: RoomAnalysis[];
};

export type AiSummariesProvider = {
  /** Short headline for the report cover. */
  reportHeadline(input: ProjectSummaryInput): string;
  /** 1–2 sentence executive summary tying rooms together. */
  executiveSummary(input: ProjectSummaryInput): string;
  /** Per-room summary string. Falls back to room.ai_summary. */
  roomSummary(room: RoomAnalysis): string;
  /** Bullet list of recommended works for the report. */
  recommendedWorks(rooms: RoomAnalysis[]): string[];
};

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const HEAVY: ReadonlySet<string> = new Set(["Heavy", "Full"]);

export const mockAiSummariesProvider: AiSummariesProvider = {
  reportHeadline({ projectName, region }) {
    return region
      ? `${projectName} — refurbishment outlook for ${region}`
      : `${projectName} — refurbishment outlook`;
  },

  executiveSummary({ rooms }) {
    if (rooms.length === 0) {
      return "Upload property photos to generate a room-by-room refurbishment outlook.";
    }
    const heavy = rooms.filter((r) => HEAVY.has(r.refurbishment_level));
    const light = rooms.filter((r) => !HEAVY.has(r.refurbishment_level));
    const parts: string[] = [];
    if (heavy.length) {
      parts.push(
        `Significant works recommended in the ${joinList(
          heavy.map((r) => r.room_type.toLowerCase()),
        )}`,
      );
    }
    if (light.length) {
      parts.push(
        `cosmetic refresh across the ${joinList(light.map((r) => r.room_type.toLowerCase()))}`,
      );
    }
    return `${parts.join("; ")}. Pricing, ROI, and yield are calculated separately by the deterministic estimate engine.`;
  },

  roomSummary(room) {
    return room.ai_summary;
  },

  recommendedWorks(rooms) {
    const all = rooms.flatMap((r) => r.recommended_works.map((w) => `${r.room_type}: ${w}`));
    // Dedupe while preserving order.
    return Array.from(new Set(all));
  },
};

// Active provider — swap to an LLM-backed provider here without touching UI.
// TODO: introduce `lovableAiSummariesProvider` that calls the AI Gateway via
// an edge function and returns the same string outputs.
export const aiSummariesProvider: AiSummariesProvider = mockAiSummariesProvider;

// Convenience helpers.
export const reportHeadline = (input: ProjectSummaryInput) =>
  aiSummariesProvider.reportHeadline(input);
export const executiveSummary = (input: ProjectSummaryInput) =>
  aiSummariesProvider.executiveSummary(input);
export const roomSummary = (room: RoomAnalysis) => aiSummariesProvider.roomSummary(room);
export const recommendedWorks = (rooms: RoomAnalysis[]) =>
  aiSummariesProvider.recommendedWorks(rooms);
