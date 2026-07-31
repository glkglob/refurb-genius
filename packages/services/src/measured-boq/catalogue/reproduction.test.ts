import { describe, expect, it } from "vitest";

import {
  MEASURED_BOQ_POLICY_VERSION,
  runMeasuredBoqEngine,
  type MeasuredBoqLibraryCatalogEntry,
  type MeasuredBoqLibraryRateResolver,
} from "../../index";

function createResolver(
  catalogRevision: string,
  entries: MeasuredBoqLibraryCatalogEntry[],
): { resolveLibraryRate: MeasuredBoqLibraryRateResolver } {
  const map = new Map(entries.map((e) => [e.rateKey, e]));
  return {
    resolveLibraryRate: (ref) => {
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

const inputFor = (catalogRevision: string, rateKey = "synth.paint.m2") => ({
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
            rateKey,
            catalogRevision,
          },
        },
      ],
    },
  ],
});

describe("historical reproduction with synthetic revisions", () => {
  it("exact key and revision produce authority-priced through runMeasuredBoqEngine", () => {
    const deps = createResolver("mboq-2099.01.01", [entryA]);
    const a1 = runMeasuredBoqEngine(inputFor("mboq-2099.01.01"), deps);
    const a2 = runMeasuredBoqEngine(inputFor("mboq-2099.01.01"), deps);
    expect(a1).toEqual(a2);
    expect(a1.status).toBe("authority-priced");
    if (a1.status !== "authority-priced") return;
    expect(a1.pricing.policyVersion).toBe(MEASURED_BOQ_POLICY_VERSION);
    const line = a1.pricing.rooms[0]!.items[0]!;
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

  it("revision B remains independent of revision A", () => {
    const depsA = createResolver("mboq-2099.01.01", [entryA]);
    const depsB = createResolver("mboq-2099.01.02", [entryB]);
    const outA = runMeasuredBoqEngine(inputFor("mboq-2099.01.01"), depsA);
    const outB = runMeasuredBoqEngine(inputFor("mboq-2099.01.02"), depsB);
    expect(outA.status).toBe("authority-priced");
    expect(outB.status).toBe("authority-priced");
    if (outA.status !== "authority-priced" || outB.status !== "authority-priced") return;
    expect(outA.pricing.rooms[0]!.items[0]!.unitRate).toBe(13);
    expect(outB.pricing.rooms[0]!.items[0]!.unitRate).toBe(19.5);
    expect(outA.pricing.midTotal).not.toBe(outB.pricing.midTotal);
  });

  it("wrong-case key produces draft and MISSING_LIBRARY_REFERENCE via engine", () => {
    const deps = createResolver("mboq-2099.01.01", [entryA]);
    const outcome = runMeasuredBoqEngine(inputFor("mboq-2099.01.01", "SYNTH.PAINT.M2"), deps);
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "MISSING_LIBRARY_REFERENCE")).toBe(true);
  });

  it("wrong revision produces draft and MISSING_LIBRARY_REFERENCE via engine", () => {
    const deps = createResolver("mboq-2099.01.01", [entryA]);
    const outcome = runMeasuredBoqEngine(inputFor("mboq-2099.01.02"), deps);
    expect(outcome.status).toBe("draft");
    if (outcome.status !== "draft") return;
    expect(outcome.issues.some((i) => i.code === "MISSING_LIBRARY_REFERENCE")).toBe(true);
  });
});
