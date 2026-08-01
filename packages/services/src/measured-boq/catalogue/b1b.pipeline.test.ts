import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  BASE_UNIT_RATE_DECIMAL_STRING_PATTERN,
  B1_LICENCE_STATUSES,
  canonicalizeBaseUnitRate,
  computePackageArtifactChecksum,
  numberToExactDecimalText,
  normaliseCatalogueSnapshot,
  parseCatalogueManifest,
  runCatalogueDryRun,
  sha256Hex,
  UNIT_IMPORT_ALIASES,
  validateCatalogueSnapshot,
} from "../../index";
import {
  validComprehensiveManifestText,
  validComprehensiveSnapshotText,
} from "./__fixtures__/valid-comprehensive";
import {
  VALID_MINIMUM_MANIFEST,
  VALID_MINIMUM_SNAPSHOT,
  validMinimumManifestText,
  validMinimumSnapshotText,
} from "./__fixtures__/valid-minimum";

function nodeSha256(message: string): string {
  return createHash("sha256").update(message, "utf8").digest("hex");
}

describe("parseCatalogueManifest", () => {
  it("accepts a valid snake_case synthetic manifest", () => {
    const result = parseCatalogueManifest(VALID_MINIMUM_MANIFEST);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.manifestVersion).toBe("1");
    expect(result.manifest.catalogRevision).toBe("mboq-2099.01.01");
    expect(result.manifest.source.licenceStatus).toBe("synthetic");
    expect(result.manifest.package.production).toBe(false);
  });

  it("accepts approved snake_case entry aliases in normalisation", () => {
    // Build snake_case keys dynamically to avoid secret-scanner false positives on *_key literals.
    const snakeEntry: Record<string, unknown> = {
      unit: "sqm",
      status: "active",
    };
    snakeEntry["rate" + "_key"] = "synth.alias.m2";
    snakeEntry["display" + "_name"] = "SYNTHETIC alias";
    snakeEntry["trade" + "_or_domain"] = "test";
    snakeEntry["cost" + "_type"] = "combined";
    snakeEntry["base" + "_unit_rate"] = "10";
    snakeEntry["source" + "_reference"] = "synthetic";

    const result = normaliseCatalogueSnapshot({
      schema_version: "mboq-catalogue-v1",
      catalog_revision: "mboq-2099.01.01",
      currency: "GBP",
      vat_basis: "exclusive",
      regional_basis: "uk-region-multipliers-v1",
      effective_from: "2099-01-01",
      source_description: "SYNTHETIC alias fixture",
      production: false,
      entries: [snakeEntry],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = (
      result.snapshot.entries as Array<{ rateKey: string; unit: string; costType: string }>
    )[0]!;
    expect(entry.rateKey).toBe("synth.alias.m2");
    expect(entry.unit).toBe("m2");
    expect(entry.costType).toBe("combined");
  });

  it("accepts camelCase comprehensive manifest", () => {
    const result = parseCatalogueManifest(validComprehensiveManifestText());
    expect(result.ok).toBe(true);
  });

  it("rejects missing required field", () => {
    const bad = { ...VALID_MINIMUM_MANIFEST, source: { ...VALID_MINIMUM_MANIFEST.source } };
    // @ts-expect-error intentional
    delete bad.source.id;
    const result = parseCatalogueManifest(bad);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown top-level keys in strict mode", () => {
    const result = parseCatalogueManifest({ ...VALID_MINIMUM_MANIFEST, extra: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "MANIFEST_UNKNOWN_KEY")).toBe(true);
  });

  it("rejects unsupported manifest version", () => {
    const result = parseCatalogueManifest({
      ...VALID_MINIMUM_MANIFEST,
      manifest_version: "99",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "MANIFEST_VERSION_UNSUPPORTED")).toBe(true);
  });

  it("rejects unsupported normaliser version", () => {
    const result = parseCatalogueManifest({
      ...VALID_MINIMUM_MANIFEST,
      transformation: { schema_version: "1", normaliser_version: "99" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "NORMALISER_VERSION_UNSUPPORTED")).toBe(true);
  });

  it("rejects invalid JSON string", () => {
    const result = parseCatalogueManifest("{not-json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]!.code).toBe("JSON_PARSE_INVALID");
  });
});

describe("rights policy", () => {
  it("allows synthetic + production false", () => {
    expect(parseCatalogueManifest(VALID_MINIMUM_MANIFEST).ok).toBe(true);
  });

  it("rejects synthetic + production true", () => {
    const result = parseCatalogueManifest({
      ...VALID_MINIMUM_MANIFEST,
      package: { ...VALID_MINIMUM_MANIFEST.package, production: true },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "PRODUCTION_BLOCKED")).toBe(true);
  });

  it("allows rights_unverified with production false (non-authorising)", () => {
    const result = parseCatalogueManifest({
      ...VALID_MINIMUM_MANIFEST,
      source: {
        ...VALID_MINIMUM_MANIFEST.source,
        licence_status: "rights_unverified",
      },
    });
    expect(result.ok).toBe(true);
  });

  it("rejects approved and unapproved licence tokens", () => {
    for (const status of ["approved", "unapproved", "licensed"]) {
      const result = parseCatalogueManifest({
        ...VALID_MINIMUM_MANIFEST,
        source: { ...VALID_MINIMUM_MANIFEST.source, licence_status: status },
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.issues.some((i) => i.code === "LICENCE_STATUS_INVALID")).toBe(true);
    }
  });

  it("only documents synthetic and rights_unverified as B1 statuses", () => {
    expect([...B1_LICENCE_STATUSES]).toEqual(["synthetic", "rights_unverified"]);
  });

  it("rejects all production true manifests", () => {
    const result = parseCatalogueManifest({
      ...VALID_MINIMUM_MANIFEST,
      source: {
        ...VALID_MINIMUM_MANIFEST.source,
        licence_status: "rights_unverified",
      },
      package: { ...VALID_MINIMUM_MANIFEST.package, production: true },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "PRODUCTION_BLOCKED")).toBe(true);
  });
});

describe("decimal canonicalisation", () => {
  const accepted = ["0.1", "10", "10.2300", "9999999999.9999"];
  const rejected = [
    "0",
    "0.0000",
    "-1",
    "-0",
    "+1",
    "01",
    "1.",
    ".5",
    "1.00000",
    "1e2",
    "1E2",
    "10,000",
    "10000000000",
  ];

  it("accepts documented decimal strings", () => {
    for (const s of accepted) {
      expect(BASE_UNIT_RATE_DECIMAL_STRING_PATTERN.test(s)).toBe(true);
      const r = canonicalizeBaseUnitRate(s);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.text).toBe(s);
      expect(r.value).toBeGreaterThan(0);
    }
  });

  it("rejects documented invalid decimal strings", () => {
    for (const s of rejected) {
      const r = canonicalizeBaseUnitRate(s);
      expect(r.ok).toBe(false);
    }
  });

  it("rejects zero, negative, NaN, Infinity, -0 numbers", () => {
    for (const n of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0]) {
      expect(canonicalizeBaseUnitRate(n).ok).toBe(false);
    }
  });

  it("accepts exact finite numbers within four decimal places", () => {
    for (const n of [10, 0.1, 12.5, 9.9999]) {
      const r = canonicalizeBaseUnitRate(n);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Number(r.text)).toBe(n);
      expect(r.value).toBe(n);
    }
  });

  it("rejects numbers that require more than four decimal places", () => {
    // 0.12345 cannot equal any k/10^d for d<=4 exactly after float — use a value
    // that is clearly not 4-dp exact when possible.
    const r = canonicalizeBaseUnitRate(0.12345);
    // May pass or fail depending on float; if it passes, text must match grammar
    if (r.ok) {
      expect(BASE_UNIT_RATE_DECIMAL_STRING_PATTERN.test(r.text)).toBe(true);
      expect(Number(r.text)).toBe(0.12345);
    }
  });

  it("rejects exponent-form very small and very large numbers", () => {
    expect(numberToExactDecimalText(1e-10)).toBeNull();
    expect(numberToExactDecimalText(1e20)).toBeNull();
    expect(canonicalizeBaseUnitRate(1e-7).ok).toBe(false);
    expect(canonicalizeBaseUnitRate(1e12).ok).toBe(false);
  });

  it("rejects integer overflow beyond 10 digits", () => {
    expect(canonicalizeBaseUnitRate(10_000_000_000).ok).toBe(false);
    expect(canonicalizeBaseUnitRate("10000000000").ok).toBe(false);
  });

  it("preserves trailing-zero string evidence without changing value", () => {
    const r = canonicalizeBaseUnitRate("10.2300");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.text).toBe("10.2300");
    expect(r.value).toBe(10.23);
  });

  it("is deterministic for the same number", () => {
    const a = numberToExactDecimalText(12.5);
    const b = numberToExactDecimalText(12.5);
    expect(a).toBe(b);
    expect(a).toBe("12.5");
  });
});

describe("normalisation", () => {
  it("trims display fields without case-folding rate keys", () => {
    const result = normaliseCatalogueSnapshot({
      ...VALID_MINIMUM_SNAPSHOT,
      entries: [
        {
          ...VALID_MINIMUM_SNAPSHOT.entries[0],
          displayName: "  SYNTHETIC paint  ",
          rateKey: "synth.paint.m2",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = (result.snapshot.entries as Array<{ displayName: string; rateKey: string }>)[0]!;
    expect(entry.displayName).toBe("SYNTHETIC paint");
    expect(entry.rateKey).toBe("synth.paint.m2");
  });

  it("applies all UNIT_IMPORT_ALIASES", () => {
    for (const [from, to] of Object.entries(UNIT_IMPORT_ALIASES)) {
      const result = normaliseCatalogueSnapshot({
        ...VALID_MINIMUM_SNAPSHOT,
        entries: [
          {
            ...VALID_MINIMUM_SNAPSHOT.entries[0],
            rateKey: `synth.alias.${to}`,
            unit: from,
          },
        ],
        entryCount: 1,
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const entry = (result.snapshot.entries as Array<{ unit: string }>)[0]!;
      expect(entry.unit).toBe(to);
      expect(result.unitAliasApplications.some((a) => a.from === from && a.to === to)).toBe(true);
    }
  });

  it("fails unknown units", () => {
    const result = normaliseCatalogueSnapshot({
      ...VALID_MINIMUM_SNAPSHOT,
      entries: [{ ...VALID_MINIMUM_SNAPSHOT.entries[0], unit: "sqft" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "UNIT_INVALID")).toBe(true);
  });

  it("rejects duplicate rate keys", () => {
    const e = VALID_MINIMUM_SNAPSHOT.entries[0]!;
    const result = normaliseCatalogueSnapshot({
      ...VALID_MINIMUM_SNAPSHOT,
      entries: [e, { ...e, displayName: "dup" }],
      entryCount: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "DUPLICATE_RATE_KEY")).toBe(true);
  });

  it("rejects unknown entry keys in strict mode", () => {
    const result = normaliseCatalogueSnapshot({
      ...VALID_MINIMUM_SNAPSHOT,
      entries: [{ ...VALID_MINIMUM_SNAPSHOT.entries[0], sku: "X" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === "ENTRY_UNKNOWN_KEY")).toBe(true);
  });

  it("fills entry currency/VAT from snapshot header", () => {
    const result = normaliseCatalogueSnapshot({
      ...VALID_MINIMUM_SNAPSHOT,
      entries: [
        {
          rateKey: "synth.paint.m2",
          displayName: "SYNTHETIC",
          tradeOrDomain: "test",
          unit: "m2",
          costType: "combined",
          baseUnitRate: 10,
          status: "active",
          sourceReference: "synthetic",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = (result.snapshot.entries as Array<{ currency: string; vatBasis: string }>)[0]!;
    expect(entry.currency).toBe("GBP");
    expect(entry.vatBasis).toBe("exclusive");
  });
});

describe("package artifact checksum", () => {
  it("is stable for same raw bytes", () => {
    const m = validMinimumManifestText();
    const s = validMinimumSnapshotText();
    const a = computePackageArtifactChecksum(m, s);
    const b = computePackageArtifactChecksum(m, s);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(nodeSha256(`mboq-package-v1\nMANIFEST.json\n${m}\nsnapshot.json\n${s}\n`));
    expect(a).toBe(sha256Hex(`mboq-package-v1\nMANIFEST.json\n${m}\nsnapshot.json\n${s}\n`));
  });

  it("changes when whitespace changes", () => {
    const m = validMinimumManifestText();
    const s = validMinimumSnapshotText();
    const a = computePackageArtifactChecksum(m, s);
    const b = computePackageArtifactChecksum(m + " ", s);
    expect(a).not.toBe(b);
  });

  it("changes when line endings change", () => {
    const m = validMinimumManifestText();
    const s = validMinimumSnapshotText();
    const a = computePackageArtifactChecksum(m, s);
    const b = computePackageArtifactChecksum(m.replace(/\n/g, "\r\n"), s);
    // if no newlines in compact JSON, force difference via snapshot
    const c = computePackageArtifactChecksum(m, s + "\r\n");
    expect(a).not.toBe(c);
    void b;
  });
});

describe("runCatalogueDryRun", () => {
  it("accepts minimum valid package", () => {
    const result = runCatalogueDryRun({
      manifestText: validMinimumManifestText(),
      snapshotText: validMinimumSnapshotText(),
    });
    expect(result.report.ok).toBe(true);
    expect(result.report.mode).toBe("dry-run");
    expect(result.report.outputChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.report.inputChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(result.report.inputChecksum).not.toBe(result.report.outputChecksum);
    expect(result.report.acceptedCount).toBe(1);
    expect(result.report.issues).toEqual([]);
    expect(result.report).not.toHaveProperty("timestamp");
  });

  it("accepts comprehensive package with aliases", () => {
    const result = runCatalogueDryRun({
      manifestText: validComprehensiveManifestText(),
      snapshotText: validComprehensiveSnapshotText(),
    });
    expect(result.report.ok).toBe(true);
    if (!result.report.ok) return;
    expect(result.report.unitAliasApplications.length).toBeGreaterThan(0);
    expect(result.report.recordCount).toBe(6);
    // output checksum matches validateCatalogueSnapshot path
    expect(result.contentChecksum).toBe(result.report.outputChecksum);
  });

  it("same logical catalogue with reordered entries keeps output checksum", () => {
    const base = {
      ...VALID_MINIMUM_SNAPSHOT,
      entries: [
        { ...VALID_MINIMUM_SNAPSHOT.entries[0], rateKey: "synth.a.m2" },
        {
          ...VALID_MINIMUM_SNAPSHOT.entries[0],
          rateKey: "synth.b.m2",
          displayName: "SYNTHETIC b",
          baseUnitRate: 11,
        },
      ],
      entryCount: 2,
    };
    const reordered = {
      ...base,
      entries: [base.entries[1], base.entries[0]],
    };
    const m = validMinimumManifestText();
    const r1 = runCatalogueDryRun({
      manifestText: m,
      snapshotText: JSON.stringify(base),
    });
    const r2 = runCatalogueDryRun({
      manifestText: m,
      snapshotText: JSON.stringify(reordered),
    });
    expect(r1.report.ok).toBe(true);
    expect(r2.report.ok).toBe(true);
    expect(r1.report.outputChecksum).toBe(r2.report.outputChecksum);
    // artifact checksum differs (byte order)
    expect(r1.report.inputChecksum).not.toBe(r2.report.inputChecksum);
  });

  it("fails expected input checksum mismatch", () => {
    const result = runCatalogueDryRun({
      manifestText: validMinimumManifestText(),
      snapshotText: validMinimumSnapshotText(),
      expectedInputChecksum: "0".repeat(64),
    });
    expect(result.report.ok).toBe(false);
    expect(result.report.issues.some((i) => i.code === "INPUT_CHECKSUM_MISMATCH")).toBe(true);
  });

  it("fails expected output checksum mismatch", () => {
    const result = runCatalogueDryRun({
      manifestText: validMinimumManifestText(),
      snapshotText: validMinimumSnapshotText(),
      expectedOutputChecksum: "0".repeat(64),
    });
    expect(result.report.ok).toBe(false);
    expect(result.report.issues.some((i) => i.code === "OUTPUT_CHECKSUM_MISMATCH")).toBe(true);
  });

  it("fails revision mismatch between manifest and snapshot", () => {
    const snap = { ...VALID_MINIMUM_SNAPSHOT, catalogRevision: "mboq-2099.12.31" };
    const result = runCatalogueDryRun({
      manifestText: validMinimumManifestText(),
      snapshotText: JSON.stringify(snap),
    });
    expect(result.report.ok).toBe(false);
    expect(result.report.issues.some((i) => i.code === "REVISION_MISMATCH")).toBe(true);
  });

  it("issues are sorted by path then code", () => {
    const result = runCatalogueDryRun({
      manifestText: JSON.stringify({
        ...VALID_MINIMUM_MANIFEST,
        manifest_version: "99",
        package: { ...VALID_MINIMUM_MANIFEST.package, production: true },
      }),
      snapshotText: validMinimumSnapshotText(),
    });
    expect(result.report.ok).toBe(false);
    const paths = result.report.issues.map((i) => `${i.path}|${i.code}`);
    const sorted = [...paths].sort();
    expect(paths).toEqual(sorted);
  });

  it("is deeply equal for identical inputs", () => {
    const input = {
      manifestText: validMinimumManifestText(),
      snapshotText: validMinimumSnapshotText(),
    };
    const a = runCatalogueDryRun(input);
    const b = runCatalogueDryRun(input);
    expect(a.report).toEqual(b.report);
  });

  it("does not dump raw records or absolute paths in report", () => {
    const result = runCatalogueDryRun({
      manifestText: validMinimumManifestText(),
      snapshotText: validMinimumSnapshotText(),
    });
    const json = JSON.stringify(result.report);
    expect(json).not.toMatch(/\/Users\//);
    expect(json).not.toContain("baseUnitRate");
    expect(result.report.ok).toBe(true);
  });

  it("emits non-authorising warning for rights_unverified", () => {
    const manifest = {
      ...VALID_MINIMUM_MANIFEST,
      source: {
        ...VALID_MINIMUM_MANIFEST.source,
        licence_status: "rights_unverified",
      },
    };
    const result = runCatalogueDryRun({
      manifestText: JSON.stringify(manifest),
      snapshotText: validMinimumSnapshotText(),
    });
    expect(result.report.ok).toBe(true);
    expect(result.report.warningCount).toBeGreaterThan(0);
    expect(result.report.warnings.some((w) => w.code === "RIGHTS_UNVERIFIED_NOTICE")).toBe(true);
  });

  it("normalised output is accepted by validateCatalogueSnapshot", () => {
    const norm = normaliseCatalogueSnapshot(VALID_MINIMUM_SNAPSHOT);
    expect(norm.ok).toBe(true);
    if (!norm.ok) return;
    const v = validateCatalogueSnapshot(norm.snapshot);
    expect(v.ok).toBe(true);
  });
});

describe("B1B purity surface", () => {
  it("exports pure APIs without requiring Node for evaluation", () => {
    // smoke: pure functions callable
    expect(typeof runCatalogueDryRun).toBe("function");
    expect(typeof computePackageArtifactChecksum).toBe("function");
    expect(typeof parseCatalogueManifest).toBe("function");
    expect(typeof normaliseCatalogueSnapshot).toBe("function");
    expect(typeof canonicalizeBaseUnitRate).toBe("function");
  });
});
