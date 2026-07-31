import { describe, expect, it } from "vitest";

import {
  MEASURED_BOQ_POLICY_VERSION,
  runMeasuredBoqEngine,
  type MeasuredBoqLibraryCatalogEntry,
} from "../../index";

function createResolver(catalogRevision: string, entries: MeasuredBoqLibraryCatalogEntry[]) {
  const map = new Map(entries.map((e) => [e.rateKey, e]));
  return {
    resolveLibraryRate: (ref: { rateKey: string; catalogRevision: string }) => {
      if (ref.catalogRevision !== catalogRevision) return null;
      return map.get(ref.rateKey) ?? null;
    },
  };
}

const entryA: MeasuredBoqLibraryCatalogEntry = {
  rateKey: "synth.paint.m2",
  catalogRevision: "mboq-2099.01.01",
  baseUnitRate: 10,
  currency: "GBP",
  vatBasis: "exclusive",
  unit: "m2",
  costType: "combined",
};

const entryB: MeasuredBoqLibraryCatalogEntry = {
  ...entryA,
  catalogRevision: "mboq-2099.01.02",
  baseUnitRate: 15,
};

describe("historical reproduction with synthetic revisions", () => {
  it("revision A pricing and provenance are deterministic", () => {
    const deps = createResolver("mboq-2099.01.01", [entryA]);
    const input = {
      region: "London" as const,
      rooms: [
        {
          id: "r1",
          name: "Room",
          items: [
            {
              id: "i1",
              name: "Paint",
              quantity: 2,
              unit: "m2",
              rate: {
                source: "library" as const,
                rateKey: "synth.paint.m2",
                catalogRevision: "mboq-2099.01.01",
              },
            },
          ],
        },
      ],
    };
    const a1 = runMeasuredBoqEngine(input, deps);
    const a2 = runMeasuredBoqEngine(input, deps);
    expect(a1).toEqual(a2);
    expect(a1.status).toBe("authority-priced");
    if (a1.status !== "authority-priced") return;
    expect(a1.pricing.policyVersion).toBe(MEASURED_BOQ_POLICY_VERSION);
    const line = a1.pricing.rooms[0]!.items[0]!;
    // London mult 1.3 → 10 * 1.3 = 13
    expect(line.unitRate).toBe(13);
    expect(line.totalCost).toBe(26);
    expect(line.libraryProvenance).toEqual({
      rateKey: "synth.paint.m2",
      catalogRevision: "mboq-2099.01.01",
      unit: "m2",
      costType: "combined",
      baseUnitRate: 10,
      regionalMultiplier: 1.3,
      resolvedUnitRate: 13,
    });
  });

  it("revision B produces its own result and cannot replace A", () => {
    const depsA = createResolver("mboq-2099.01.01", [entryA]);
    const depsB = createResolver("mboq-2099.01.02", [entryB]);
    const inputA = {
      region: "London" as const,
      rooms: [
        {
          id: "r1",
          name: "Room",
          items: [
            {
              id: "i1",
              name: "Paint",
              quantity: 2,
              unit: "m2",
              rate: {
                source: "library" as const,
                rateKey: "synth.paint.m2",
                catalogRevision: "mboq-2099.01.01",
              },
            },
          ],
        },
      ],
    };
    const inputB = {
      ...inputA,
      rooms: [
        {
          ...inputA.rooms[0]!,
          items: [
            {
              ...inputA.rooms[0]!.items[0]!,
              rate: {
                source: "library" as const,
                rateKey: "synth.paint.m2",
                catalogRevision: "mboq-2099.01.02",
              },
            },
          ],
        },
      ],
    };

    const outA = runMeasuredBoqEngine(inputA, depsA);
    const outB = runMeasuredBoqEngine(inputB, depsB);
    expect(outA.status).toBe("authority-priced");
    expect(outB.status).toBe("authority-priced");
    if (outA.status !== "authority-priced" || outB.status !== "authority-priced") return;
    expect(outA.pricing.rooms[0]!.items[0]!.unitRate).toBe(13);
    expect(outB.pricing.rooms[0]!.items[0]!.unitRate).toBe(19.5); // 15 * 1.3
    expect(outA.pricing.midTotal).not.toBe(outB.pricing.midTotal);

    // Pin A identity against B resolver → missing library reference
    const cross = runMeasuredBoqEngine(inputA, depsB);
    expect(cross.status).toBe("draft");
  });

  it("exact key only — case and wrong revision miss", () => {
    const deps = createResolver("mboq-2099.01.01", [entryA]);
    expect(
      deps.resolveLibraryRate({
        rateKey: "SYNTH.PAINT.M2",
        catalogRevision: "mboq-2099.01.01",
      }),
    ).toBeNull();
    expect(
      deps.resolveLibraryRate({
        rateKey: "synth.paint.m2",
        catalogRevision: "mboq-2099.01.02",
      }),
    ).toBeNull();
    expect(
      deps.resolveLibraryRate({
        rateKey: "synth.paint.m2",
        catalogRevision: "mboq-2099.01.01",
      }),
    ).toEqual(entryA);
  });
});
