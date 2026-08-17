import { describe, expect, it } from "vitest";
import { analysisIdentityFromPhotoIds } from "./redesignAuthority";
import {
  currentSelectedRedesignConcept,
  currentSelectedRedesignId,
  isCurrentRedesignConcept,
  resolveCurrentAnalysisIdentity,
  selectCurrentRedesignConcepts,
} from "./redesignCurrentness";

const PHOTO_DELETED = "937a24a4-855e-4bb7-8627-fc8470dac3dd";
const PHOTO_1 = "d04cad1d-69fa-46bd-8431-136ee1f20f3c";
const PHOTO_2 = "d7b2c46a-379a-45a4-bd65-e21940ed7543";
const PHOTO_3 = "fdc70554-bbf9-432a-8887-5e14d125a5d4";

const IDENTITY_A = analysisIdentityFromPhotoIds([PHOTO_DELETED, PHOTO_1, PHOTO_2, PHOTO_3]);
const IDENTITY_B = analysisIdentityFromPhotoIds([PHOTO_1, PHOTO_2, PHOTO_3]);

function concept(
  id: string,
  analysisIdentity: string,
  isSelected = false,
): { id: string; analysisIdentity: string; isSelected: boolean } {
  return { id, analysisIdentity, isSelected };
}

const dumpA = [
  concept("c1", IDENTITY_A, true),
  concept("c2", IDENTITY_A, false),
  concept("c3", IDENTITY_A, false),
  concept("c4", IDENTITY_A, false),
  concept("c5", IDENTITY_A, false),
  concept("c6", IDENTITY_A, false),
];

describe("redesignCurrentness", () => {
  it("T01: matching current identity is a current-candidate", () => {
    const input = { analysisIsCurrent: true, currentAnalysisIdentity: IDENTITY_A };
    expect(isCurrentRedesignConcept(dumpA[0]!, input)).toBe(true);
  });

  it("T02: multiple matching current-identity concepts remain current-candidates", () => {
    const current = selectCurrentRedesignConcepts(dumpA, {
      analysisIsCurrent: true,
      currentAnalysisIdentity: IDENTITY_A,
    });
    expect(current).toHaveLength(6);
    expect(current.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
  });

  it("T03: matching isSelected is current-selected", () => {
    const selected = currentSelectedRedesignConcept(dumpA, {
      analysisIsCurrent: true,
      currentAnalysisIdentity: IDENTITY_A,
    });
    expect(selected?.id).toBe("c1");
    expect(
      currentSelectedRedesignId(dumpA, {
        analysisIsCurrent: true,
        currentAnalysisIdentity: IDENTITY_A,
      }),
    ).toBe("c1");
  });

  it("T04: IDENTITY_A is not current against IDENTITY_B", () => {
    const input = { analysisIsCurrent: true, currentAnalysisIdentity: IDENTITY_B };
    expect(isCurrentRedesignConcept(dumpA[0]!, input)).toBe(false);
  });

  it("T05: selector hides IDENTITY_A when current identity is B", () => {
    expect(
      selectCurrentRedesignConcepts(dumpA, {
        analysisIsCurrent: true,
        currentAnalysisIdentity: IDENTITY_B,
      }),
    ).toEqual([]);
  });

  it("T06: stale isSelected is not current-selected", () => {
    const input = { analysisIsCurrent: true, currentAnalysisIdentity: IDENTITY_B };
    expect(currentSelectedRedesignConcept(dumpA, input)).toBeNull();
    expect(currentSelectedRedesignId(dumpA, input)).toBeNull();
  });

  it("T07: unresolved identity is empty when Analysis is not current", () => {
    expect(
      resolveCurrentAnalysisIdentity({
        analysisIsCurrent: false,
        photoIds: [PHOTO_1, PHOTO_2, PHOTO_3, null],
      }),
    ).toBe("");
  });

  it("T08: four-photo A becomes non-current after one photo is removed", () => {
    const before = {
      analysisIsCurrent: true,
      currentAnalysisIdentity: resolveCurrentAnalysisIdentity({
        analysisIsCurrent: true,
        photoIds: [PHOTO_DELETED, PHOTO_1, PHOTO_2, PHOTO_3],
      }),
    };
    expect(selectCurrentRedesignConcepts(dumpA, before)).toHaveLength(6);

    const afterDelete = {
      analysisIsCurrent: false,
      currentAnalysisIdentity: resolveCurrentAnalysisIdentity({
        analysisIsCurrent: false,
        photoIds: [PHOTO_1, PHOTO_2, PHOTO_3, null],
      }),
    };
    expect(afterDelete.currentAnalysisIdentity).toBe("");
    expect(selectCurrentRedesignConcepts(dumpA, afterDelete)).toEqual([]);
  });

  it("T09: deleted photo id inside analysisIdentity keeps A stale", () => {
    expect(IDENTITY_A).toContain(PHOTO_DELETED);
    expect(IDENTITY_B).not.toContain(PHOTO_DELETED);
    expect(IDENTITY_A).not.toBe(IDENTITY_B);
    expect(
      isCurrentRedesignConcept(dumpA[0]!, {
        analysisIsCurrent: true,
        currentAnalysisIdentity: IDENTITY_B,
      }),
    ).toBe(false);
  });

  it("T10: selector does not mutate historical rows", () => {
    const original = dumpA.map((c) => ({ ...c }));
    const snapshot = structuredClone(original);
    selectCurrentRedesignConcepts(original, {
      analysisIsCurrent: true,
      currentAnalysisIdentity: IDENTITY_B,
    });
    currentSelectedRedesignId(original, {
      analysisIsCurrent: false,
      currentAnalysisIdentity: "",
    });
    expect(original).toEqual(snapshot);
    expect(original[0]?.isSelected).toBe(true);
    expect(original[0]?.analysisIdentity).toBe(IDENTITY_A);
  });

  it("T11: Analysis B does not resurrect A concepts", () => {
    expect(
      selectCurrentRedesignConcepts(dumpA, {
        analysisIsCurrent: true,
        currentAnalysisIdentity: IDENTITY_B,
      }),
    ).toEqual([]);
  });

  it("T12: matching B concepts become current", () => {
    const dumpB = [concept("b1", IDENTITY_B, false), concept("b2", IDENTITY_B, false)];
    const mixed = [...dumpA, ...dumpB];
    const current = selectCurrentRedesignConcepts(mixed, {
      analysisIsCurrent: true,
      currentAnalysisIdentity: IDENTITY_B,
    });
    expect(current.map((c) => c.id)).toEqual(["b1", "b2"]);
  });

  it("T13: selected B is current-selected", () => {
    const mixed = [...dumpA, concept("b1", IDENTITY_B, true), concept("b2", IDENTITY_B, false)];
    expect(
      currentSelectedRedesignId(mixed, {
        analysisIsCurrent: true,
        currentAnalysisIdentity: IDENTITY_B,
      }),
    ).toBe("b1");
  });

  it("T14: re-invoking the selector after reload still rejects A", () => {
    const input = { analysisIsCurrent: true, currentAnalysisIdentity: IDENTITY_B };
    expect(selectCurrentRedesignConcepts(dumpA, input)).toEqual([]);
    expect(selectCurrentRedesignConcepts(dumpA, input)).toEqual([]);
  });

  it("T15: identity change A→B drops the current set without touching rows", () => {
    const rows = dumpA.map((c) => ({ ...c }));
    const asA = selectCurrentRedesignConcepts(rows, {
      analysisIsCurrent: true,
      currentAnalysisIdentity: IDENTITY_A,
    });
    expect(asA).toHaveLength(6);
    const asB = selectCurrentRedesignConcepts(rows, {
      analysisIsCurrent: true,
      currentAnalysisIdentity: IDENTITY_B,
    });
    expect(asB).toEqual([]);
    expect(rows[0]?.analysisIdentity).toBe(IDENTITY_A);
    expect(rows[0]?.isSelected).toBe(true);
  });
});
