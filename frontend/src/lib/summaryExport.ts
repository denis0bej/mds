export type SummaryStat = {
  label: string;
  value: number;
};

export type SummaryExportPayload = {
  title: string;
  subtitle: string;
  narrative: string;
  stats: SummaryStat[];
  heroName?: string;
  avatar?: string;
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "adventure"
  );
}

export function buildSummaryFilename(heroName: string | undefined, extension: "txt" | "pdf"): string {
  return `${slugify(heroName ?? "adventure")}-summary.${extension}`;
}

export function buildSummaryText(payload: SummaryExportPayload): string {
  const lines = [
    payload.title,
    payload.subtitle,
    "",
    payload.narrative,
    "",
    "══════════════════════════════════════",
    "FINAL STATISTICS",
    "══════════════════════════════════════",
    ...payload.stats.map((stat) => `  • ${stat.label}: ${stat.value}`),
    "",
    `Generated on ${new Date().toLocaleString()}`,
  ];

  return lines.join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadSummaryTxt(payload: SummaryExportPayload): string {
  const filename = buildSummaryFilename(payload.heroName, "txt");
  const content = buildSummaryText(payload);
  triggerDownload(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
  return filename;
}

export async function downloadSummaryPdf(payload: SummaryExportPayload): Promise<string> {
  const { jsPDF } = await import("jspdf");

  const filename = buildSummaryFilename(payload.heroName, "pdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - margin) return;
    doc.addPage();
    y = margin;
  };

  if (payload.avatar) {
    const avatarSize = 72;
    const avatarX = (pageWidth - avatarSize) / 2;
    const format = payload.avatar.startsWith("data:image/png") ? "PNG" : "JPEG";

    ensureSpace(avatarSize + 20);
    doc.addImage(payload.avatar, format, avatarX, y, avatarSize, avatarSize);
    y += avatarSize + 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(40, 30, 10);
  const titleLines = doc.splitTextToSize(payload.title, maxWidth) as string[];
  ensureSpace(titleLines.length * 24);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 24 + 10;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(90, 80, 60);
  const subtitleLines = doc.splitTextToSize(payload.subtitle, maxWidth) as string[];
  ensureSpace(subtitleLines.length * 16);
  doc.text(subtitleLines, margin, y);
  y += subtitleLines.length * 16 + 20;

  doc.setDrawColor(180, 150, 80);
  doc.setLineWidth(0.75);
  ensureSpace(12);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 25, 15);
  const narrativeParagraphs = payload.narrative.split(/\n+/).filter(Boolean);
  for (const paragraph of narrativeParagraphs) {
    const lines = doc.splitTextToSize(paragraph, maxWidth) as string[];
    ensureSpace(lines.length * 15 + 8);
    doc.text(lines, margin, y);
    y += lines.length * 15 + 10;
  }

  y += 8;
  ensureSpace(80);
  doc.setDrawColor(180, 150, 80);
  doc.line(margin, y, pageWidth - margin, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(40, 30, 10);
  doc.text("Final Statistics", margin, y);
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const stat of payload.stats) {
    ensureSpace(18);
    doc.text(`${stat.label}: ${stat.value}`, margin + 8, y);
    y += 18;
  }

  y += 12;
  ensureSpace(16);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(120, 110, 90);
  doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y);

  doc.save(filename);
  return filename;
}
