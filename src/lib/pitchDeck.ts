import { logger } from "./logger";
import { addDiagnosticBreadcrumb } from "./sentry";
import type { ProjectWithProgress } from "./mappers";
import type { Financials } from "./queries/projects";
import type { PersistedRoomEstimate } from "@/features/estimate/infrastructure";
import type { ProjectPhoto } from "./photos";
import type { PhotoAnalysisResultRow } from "./queries/photo-analysis";
import type { PitchDeckExportRow } from "./queries/pitch-decks"; // for type

export type PitchDeckData = {
  project: ProjectWithProgress;
  financials: Financials | null;
  estimate: PersistedRoomEstimate | null;
  photos: ProjectPhoto[];
  analyses: PhotoAnalysisResultRow[];
  floorplanModels?: Array<{ id: string; name: string }>; // metadata only for now
};

export type GeneratePitchDeckOptions = {
  onProgress?: (stage: string, percent?: number) => void;
  includePhotos?: boolean;
  include3D?: boolean;
  includeSensitivity?: boolean;
};

const A4_WIDTH = 210;
const A4_HEIGHT = 297;

export async function generatePitchDeckPDF(
  data: PitchDeckData,
  options: GeneratePitchDeckOptions = {},
): Promise<{ blob: Blob; filename: string; pageCount: number }> {
  const { onProgress, includePhotos = true } = options;
  const { project, financials, estimate, photos, analyses, floorplanModels = [] } = data;

  const start = Date.now();
  addDiagnosticBreadcrumb("pitch-deck:generate:start", { projectId: project.id });

  onProgress?.("loading-libs", 10);

  // Dynamic imports
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { jsPDF: JsPDF } = jsPDF as any; // dynamic import — types unavailable at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const autoTable = (autoTableMod as any).default || autoTableMod;

  onProgress?.("preparing-data", 20);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = new (jsPDF as any)({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;
  let page = 1;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > A4_HEIGHT - 20) {
      doc.addPage();
      page++;
      y = 20;
      // footer on new page
      doc.setFontSize(8);
      doc.text("Refurb Genius • Confidential Investor Material", margin, A4_HEIGHT - 10);
    }
  };

  // === HEADER ===
  doc.setFillColor(20, 20, 20);
  doc.rect(0, 0, pageWidth, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("REFURB GENIUS", margin, 12);
  doc.setFontSize(10);
  doc.text("Investor Pitch Deck", pageWidth - margin - 50, 12);

  doc.setTextColor(0, 0, 0);
  y = 28;

  // Title
  doc.setFontSize(18);
  doc.text("Investment Opportunity", margin, y);
  y += 8;
  doc.setFontSize(12);
  doc.text(`${project.name || project.address} • ${project.postcode}`, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}  |  Confidential`, margin, y);
  y += 12;

  // === PROJECT SUMMARY ===
  addPageIfNeeded(40);
  doc.setFontSize(13);
  doc.text("1. Project Summary", margin, y);
  y += 8;

  doc.setFontSize(10);
  const summaryLines = [
    `Address: ${project.address}`,
    `Postcode: ${project.postcode}  |  Region: ${project.region}`,
    `Property: ${project.property_type}  |  ${project.bedrooms} bed  |  ${project.bathrooms} bath  |  ${project.size_sqm} m²`,
    `Purchase Price: £${project.purchase_price.toLocaleString()}`,
    `Estimated GDV: £${project.estimated_gdv.toLocaleString()}`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 5;
  });
  y += 6;

  // Key metrics box
  const profit =
    financials?.estimatedProfit ??
    project.estimated_gdv - project.purchase_price - (financials?.refurbBudget ?? 0);
  const roi = financials?.roiPercent ?? 0;
  doc.setDrawColor(200, 200, 200);
  doc.rect(margin, y, pageWidth - 2 * margin, 18, "S");
  doc.setFontSize(9);
  doc.text(
    `Est. Profit: £${Math.round(profit).toLocaleString()}    |    ROI: ${roi}%    |    Refurb: £${(financials?.refurbBudget ?? 0).toLocaleString()}`,
    margin + 3,
    y + 7,
  );
  y += 24;

  // Photos summary
  if (includePhotos && photos.length) {
    addPageIfNeeded(15);
    doc.setFontSize(10);
    doc.text(`Photos: ${photos.length} uploaded`, margin, y);
    y += 5;
    photos.slice(0, 3).forEach((ph, i) => {
      doc.text(`  - ${ph.name || `Photo ${i + 1}`}`, margin + 5, y);
      y += 4;
    });
    if (photos.length > 3) doc.text(`  ... and ${photos.length - 3} more`, margin + 5, y);
    y += 6;
  }

  // === FINANCIALS + ROI ===
  addPageIfNeeded(50);
  doc.setFontSize(13);
  doc.text("2. Financial Overview & ROI", margin, y);
  y += 8;

  if (financials) {
    const finLines = [
      `Purchase Price: £${financials.purchasePrice.toLocaleString()}`,
      `Refurb Budget: £${financials.refurbBudget.toLocaleString()}`,
      `Total Project Cost: £${financials.totalProjectCost.toLocaleString()}`,
      `Estimated GDV: £${financials.estimatedGdv.toLocaleString()}`,
      `Estimated Profit: £${financials.estimatedProfit.toLocaleString()}`,
      `ROI: ${financials.roiPercent}%    |    Gross Yield: ${financials.grossYield}%`,
      `Investment Score: ${financials.investmentScore}    |    Risk: ${financials.riskLevel}`,
    ];
    doc.setFontSize(9);
    finLines.forEach((l) => {
      doc.text(l, margin, y);
      y += 4.5;
    });
  } else {
    doc.text("Detailed financials available in the Financials tab.", margin, y);
    y += 6;
  }
  y += 6;

  // Simple sensitivity note
  doc.setFontSize(9);
  doc.text(
    "Sensitivity: See interactive charts in Sensitivity Analysis tab. Key levers: GDV, Refurb cost, Finance rate, Timeline.",
    margin,
    y,
  );
  y += 10;

  // === ESTIMATE SUMMARY ===
  addPageIfNeeded(60);
  doc.setFontSize(13);
  doc.text("3. Scope of Work (Estimate Summary)", margin, y);
  y += 8;

  if (estimate?.rooms?.length) {
    estimate.rooms.forEach((room) => {
      addPageIfNeeded(25);
      doc.setFontSize(10);
      doc.text(`${room.name}${room.area_sqm ? ` (${room.area_sqm} m²)` : ""}`, margin, y);
      y += 5;

      const items = (room.items || []).slice(0, 6); // limit for space
      const tableData = items.map((item) => [
        item.name || "",
        item.category || "",
        `${item.quantity || 1} ${item.unit || "item"}`,
        `£${Math.round(item.unit_cost || 0)}`,
        `£${Math.round((item.quantity || 1) * (item.unit_cost || 0))}`,
      ]);

      if (tableData.length) {
        autoTable(doc, {
          startY: y,
          head: [["Item", "Category", "Qty", "Unit Cost", "Total"]],
          body: tableData,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [230, 230, 230] },
          margin: { left: margin, right: margin },
          theme: "grid",
        });
        // jspdf-autotable augments at runtime
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 4;
      }

      const roomTotal =
        room.items?.reduce((s: number, i) => s + (i.quantity ?? 1) * (i.unit_cost ?? 0), 0) || 0;
      doc.setFontSize(9);
      doc.text(`Room subtotal: £${Math.round(roomTotal).toLocaleString()}`, margin, y);
      y += 8;
    });

    const total = estimate.rooms.reduce((s: number, r) => {
      return (
        s +
        (r.items || []).reduce((is: number, i) => is + (i.quantity ?? 1) * (i.unit_cost ?? 0), 0)
      );
    }, 0);
    doc.setFontSize(10);
    doc.text(
      `Estimated Total (excl. VAT/contingency): £${Math.round(total).toLocaleString()}`,
      margin,
      y,
    );
    y += 10;
  } else {
    doc.setFontSize(9);
    doc.text("No detailed estimate yet. Use the Estimate Builder tab to generate one.", margin, y);
    y += 8;
  }

  // AI Photo insights summary (from analyses)
  if (analyses && analyses.length) {
    addPageIfNeeded(20);
    doc.setFontSize(11);
    doc.text("AI Photo Insights (top findings):", margin, y);
    y += 5;
    doc.setFontSize(9);
    analyses.slice(0, 3).forEach((a, i) => {
      const room = a.category || "General";
      // confidence_score may be stored as a 0-1 fraction or a 0-100 percent.
      const rawConf = a.confidence_score ?? 0.8;
      const conf = Math.round(rawConf > 1 ? rawConf : rawConf * 100);
      doc.text(
        `  ${i + 1}. ${room} (${conf}% conf) - ${((a.detected_defects as unknown[]) || []).length} issues noted`,
        margin + 3,
        y,
      );
      y += 4;
    });
    y += 4;
  }

  // === 3D FLOORPLAN ===
  addPageIfNeeded(15);
  doc.setFontSize(13);
  doc.text("4. 3D Floorplan & Measurements", margin, y);
  y += 6;
  doc.setFontSize(9);
  const fpCount = floorplanModels.length;
  doc.text(`3D Models: ${fpCount} uploaded for this project.`, margin, y);
  y += 5;
  if (fpCount > 0) {
    floorplanModels.slice(0, 2).forEach((m) => {
      doc.text(`  - ${m.name || m.id}`, margin + 5, y);
      y += 4;
    });
  }
  doc.text(
    "View interactive model, room tags, and measurements in the 3D Floorplan tab.",
    margin,
    y,
  );
  y += 10;

  // === INVESTMENT HIGHLIGHTS ===
  addPageIfNeeded(30);
  doc.setFontSize(13);
  doc.text("5. Investment Highlights & Next Steps", margin, y);
  y += 8;

  doc.setFontSize(9);
  const highlights = [
    "• Strong ROI potential with conservative assumptions.",
    "• Detailed room-by-room scope ready for contractor quotes.",
    "• Local trades marketplace integrated for competitive bidding.",
    "• AI photo analysis for condition and material take-offs.",
    "• Full sensitivity modeling for risk assessment.",
  ];
  highlights.forEach((h) => {
    doc.text(h, margin, y);
    y += 5;
  });
  y += 6;

  doc.text(
    "Next Steps: Review full data in app → Request quotes via Marketplace → Finalise scope → Execute.",
    margin,
    y,
  );
  y += 10;

  // Footer on last page
  doc.setFontSize(8);
  doc.text(
    "Refurb Genius • Confidential • Generated for investor review only",
    margin,
    A4_HEIGHT - 10,
  );
  doc.text(`Page ${page}`, pageWidth - margin - 15, A4_HEIGHT - 10);

  onProgress?.("generating-pdf", 70);

  const blob = doc.output("blob");
  const filename = `refurb-genius-pitch-${project.id.slice(0, 8)}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.pdf`;

  const duration = Date.now() - start;
  addDiagnosticBreadcrumb("pitch-deck:generate:complete", {
    projectId: project.id,
    durationMs: duration,
    pages: page,
  });

  return { blob, filename, pageCount: page };
}

export async function savePitchDeckToSupabase(
  projectId: string,
  userId: string,
  blob: Blob,
  filename: string,
  pageCount: number,
): Promise<{ record: Record<string, unknown> | null; storagePath: string }> {
  const { supabase } = await import("@/platform/supabase/browser"); // avoid circular if any
  const path = `${userId}/${projectId}/${filename}`;

  const { error: uploadErr } = await supabase.storage.from("pitch-decks").upload(path, blob, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (uploadErr) {
    logger.error("[pitchDeck] storage upload failed", { error: uploadErr.message });
    throw uploadErr;
  }

  const { data: record, error: dbErr } = await supabase
    .from("pitch_deck_exports")
    // Live prod schema: created_by/storage_path/metadata (the committed migration's
    // user_id/export_url/title columns were replaced out-of-band — see memory note).
    .insert({
      project_id: projectId,
      created_by: userId,
      storage_path: path,
      metadata: {
        title: filename.replace(".pdf", ""),
        format: "pdf",
        file_size_bytes: blob.size,
      },
    })
    .select()
    .single();

  if (dbErr) {
    logger.error("[pitchDeck] db insert failed", { error: dbErr.message });
    // best effort cleanup
    await supabase.storage
      .from("pitch-decks")
      .remove([path])
      .catch(() => {});
    throw dbErr;
  }

  return { record, storagePath: path };
}
