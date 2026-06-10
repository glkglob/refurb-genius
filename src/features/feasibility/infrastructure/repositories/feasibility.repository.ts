import { auth } from "@/lib/auth";
import { supabase } from "@/platform/supabase/browser";
import type { Database } from "@repo/supabase";
import type { FeasibilityStatus } from "@repo/types";
import type { FeasibilityStudy, FeasibilityStudySnapshot } from "../../domain";
import type { FeasibilityRepository } from "../../application";

type FeasibilityStudyRow = Database["public"]["Tables"]["feasibility_studies"]["Row"];
type StudySnapshotRow = Database["public"]["Tables"]["study_snapshots"]["Row"];

type SerializableStudy = Omit<FeasibilityStudy, "createdAt" | "updatedAt" | "metadata"> & {
  createdAt: string;
  updatedAt: string;
  metadata: {
    version: number;
    lastComputedAt: string;
  };
};

export class SupabaseFeasibilityRepository implements FeasibilityRepository {
  async saveSnapshot(study: FeasibilityStudy): Promise<FeasibilityStudySnapshot> {
    const user = auth.getUser();
    if (!user) throw new Error("You must be signed in to save a feasibility study.");

    const serializable = serializeStudy(study);
    const snapshotPayload: Database["public"]["Tables"]["study_snapshots"]["Insert"]["snapshot"] =
      JSON.parse(JSON.stringify(serializable));

    const { error: studyError } = await supabase.from("feasibility_studies").upsert(
      {
        id: study.id,
        project_id: study.projectId,
        user_id: user.id,
        status: study.status,
        current_snapshot_version: study.metadata.version,
        title: study.property.name,
        last_computed_at: study.metadata.lastComputedAt.toISOString(),
      },
      { onConflict: "id" },
    );

    if (studyError) throw new Error(studyError.message);

    const { data: snapshot, error: snapshotError } = await supabase
      .from("study_snapshots")
      .insert({
        study_id: study.id,
        version: study.metadata.version,
        created_by: user.id,
        snapshot: snapshotPayload,
      })
      .select()
      .single();

    if (snapshotError) throw new Error(snapshotError.message);

    return toSnapshot(study, snapshot);
  }

  async loadLatest(projectId: string): Promise<FeasibilityStudy | null> {
    const user = auth.getUser();
    if (!user) return null;

    const { data: study, error: studyError } = await supabase
      .from("feasibility_studies")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (studyError) throw new Error(studyError.message);
    if (!study) return null;

    return this.loadSnapshotForStudy(study);
  }

  async loadByStudyId(studyId: string): Promise<FeasibilityStudy | null> {
    const user = auth.getUser();
    if (!user) return null;

    const { data: study, error: studyError } = await supabase
      .from("feasibility_studies")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", studyId)
      .maybeSingle();

    if (studyError) throw new Error(studyError.message);
    if (!study) return null;

    return this.loadSnapshotForStudy(study);
  }

  async listByProject(projectId: string): Promise<FeasibilityStudySnapshot[]> {
    const user = auth.getUser();
    if (!user) return [];

    const { data: studies, error: studiesError } = await supabase
      .from("feasibility_studies")
      .select("*")
      .eq("user_id", user.id)
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false });

    if (studiesError) throw new Error(studiesError.message);
    if (!studies || studies.length === 0) return [];

    const snapshots = await Promise.all(
      studies.map(async (study) => {
        const fullStudy = await this.loadSnapshotForStudy(study);
        return {
          studyId: fullStudy.id,
          projectId: fullStudy.projectId,
          version: fullStudy.metadata.version,
          capturedAt: fullStudy.updatedAt,
          study: fullStudy,
        } satisfies FeasibilityStudySnapshot;
      }),
    );

    return snapshots;
  }

  async createStatusSnapshot(
    studyId: string,
    status: FeasibilityStatus,
  ): Promise<FeasibilityStudySnapshot> {
    const existing = await this.loadByStudyId(studyId);
    if (!existing) throw new Error(`Feasibility study not found: ${studyId}`);

    const now = new Date();
    const updated: FeasibilityStudy = {
      ...existing,
      status,
      metadata: {
        version: existing.metadata.version + 1,
        lastComputedAt: now,
      },
      updatedAt: now,
    };

    return this.saveSnapshot(updated);
  }

  private async loadSnapshotForStudy(study: FeasibilityStudyRow): Promise<FeasibilityStudy> {
    const { data: snapshot, error: snapshotError } = await supabase
      .from("study_snapshots")
      .select("*")
      .eq("study_id", study.id)
      .eq("version", study.current_snapshot_version)
      .maybeSingle();

    if (snapshotError) throw new Error(snapshotError.message);
    if (!snapshot) {
      throw new Error(
        `Snapshot v${study.current_snapshot_version} not found for feasibility study ${study.id}.`,
      );
    }

    return decodeStudySnapshot(snapshot);
  }
}

export const supabaseFeasibilityRepository: FeasibilityRepository =
  new SupabaseFeasibilityRepository();

function serializeStudy(study: FeasibilityStudy): SerializableStudy {
  return {
    ...study,
    createdAt: study.createdAt.toISOString(),
    updatedAt: study.updatedAt.toISOString(),
    metadata: {
      ...study.metadata,
      lastComputedAt: study.metadata.lastComputedAt.toISOString(),
    },
  };
}

function decodeStudySnapshot(snapshot: StudySnapshotRow): FeasibilityStudy {
  const payload = snapshot.snapshot;
  const serialized = parseSerializableStudy(payload, snapshot.id);

  return {
    ...serialized,
    createdAt: new Date(serialized.createdAt),
    updatedAt: new Date(serialized.updatedAt),
    metadata: {
      ...serialized.metadata,
      lastComputedAt: new Date(serialized.metadata.lastComputedAt),
    },
  };
}

function parseSerializableStudy(payload: unknown, snapshotId: string): SerializableStudy {
  if (!payload || typeof payload !== "object") {
    throw new Error(`Snapshot payload is invalid for ${snapshotId}.`);
  }

  return payload as SerializableStudy;
}

function toSnapshot(study: FeasibilityStudy, snapshot: StudySnapshotRow): FeasibilityStudySnapshot {
  return {
    studyId: study.id,
    projectId: study.projectId,
    version: study.metadata.version,
    capturedAt: new Date(snapshot.created_at),
    study,
  };
}
