import PDFDocument from "pdfkit";
import type { GmbAudit } from "@/lib/gmbAudit";
import type { LeadIntelligenceAudit } from "@/lib/leadIntelligence";
import type { Lead } from "@/lib/types";

export type AuditAttachment = {
  filename: string;
  content: Buffer;
  contentType: "application/pdf";
};

const page = { width: 595.28, height: 841.89, margin: 42 };
const colors = {
  ink: "#0f172a",
  muted: "#64748b",
  line: "#dbeafe",
  panel: "#f8fafc",
  dark: "#071426",
  darker: "#020617",
  sky: "#38bdf8",
  skySoft: "#e0f2fe",
  emerald: "#34d399",
  emeraldSoft: "#d1fae5",
  amber: "#f59e0b",
  amberSoft: "#fef3c7",
  rose: "#fb7185",
  roseSoft: "#ffe4e6",
  white: "#ffffff"
};

function pdfBuffer(build: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: page.margin,
      bufferPages: true,
      info: { Creator: "Direct Optimize Lead Automation" }
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    build(doc);
    drawPageFooters(doc);
    doc.end();
  });
}

function cleanFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "lead";
}

function safeText(value?: string | number | null) {
  return value === undefined || value === null || value === "" ? "Not available" : String(value);
}

function scoreColor(score: number) {
  if (score >= 80) return colors.emerald;
  if (score >= 60) return colors.sky;
  if (score >= 40) return colors.amber;
  return colors.rose;
}

function scoreBg(score: number) {
  if (score >= 80) return colors.emeraldSoft;
  if (score >= 60) return colors.skySoft;
  if (score >= 40) return colors.amberSoft;
  return colors.roseSoft;
}

function addPageIfNeeded(doc: PDFKit.PDFDocument, neededHeight = 120) {
  if (doc.y + neededHeight <= page.height - 74) return;
  doc.addPage();
  drawMiniHeader(doc);
  doc.y = 92;
}

function drawPageFooters(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    doc.moveTo(page.margin, page.height - 52).lineTo(page.width - page.margin, page.height - 52).strokeColor("#e2e8f0").lineWidth(1).stroke();
    doc.fillColor(colors.muted).font("Helvetica").fontSize(8)
      .text("Prepared by Direct Optimize - Local visibility, website audits, and compliant lead outreach.", page.margin, page.height - 40, {
        width: page.width - page.margin * 2,
        align: "left"
      });
    doc.text(`Page ${i + 1}`, page.margin, page.height - 40, { width: page.width - page.margin * 2, align: "right" });
  }
}

function drawMiniHeader(doc: PDFKit.PDFDocument) {
  doc.rect(0, 0, page.width, 58).fill(colors.dark);
  doc.fillColor(colors.sky).font("Helvetica-Bold").fontSize(9).text("DIRECT OPTIMIZE", page.margin, 22, { characterSpacing: 1 });
  doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(10).text("Audit Report", page.width - 180, 22, { width: 138, align: "right" });
}

function coverHeader(doc: PDFKit.PDFDocument, title: string, lead: Lead, kicker: string) {
  doc.rect(0, 0, page.width, 154).fill(colors.dark);
  doc.circle(page.width - 70, 46, 60).fill("#123a55");
  doc.circle(page.width - 122, 120, 46).fill("#0f3a3d");
  doc.fillColor(colors.sky).font("Helvetica-Bold").fontSize(10).text("DIRECT OPTIMIZE", page.margin, 32, { characterSpacing: 1.4 });
  doc.fillColor(colors.white).font("Helvetica-Bold").fontSize(title.length > 24 ? 24 : 28).text(title, page.margin, 54, { width: 380, lineGap: 2 });
  const leadY = Math.max(112, doc.y + 4);
  doc.fillColor("#cbd5e1").font("Helvetica").fontSize(11)
    .text(`${lead.company_name} - ${[lead.city || lead.region, lead.country].filter(Boolean).join(", ")}`, page.margin, leadY, { width: 360 });
  doc.roundedRect(page.margin, 170, page.width - page.margin * 2, 76, 12).fill(colors.panel).strokeColor("#dbeafe").stroke();
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(10).text(kicker, page.margin + 18, 188, { width: page.width - page.margin * 2 - 36, lineGap: 2 });
  doc.fillColor(colors.muted).font("Helvetica").fontSize(9).text(`Prepared ${new Date().toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}`, page.margin + 18, 222);
  doc.y = 250;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle?: string, nextContentHeight = 90) {
  addPageIfNeeded(doc, (subtitle ? 62 : 42) + nextContentHeight);
  const y = doc.y + 8;
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(15).text(title, page.margin, y, { width: page.width - page.margin * 2 });
  if (subtitle) doc.fillColor(colors.muted).font("Helvetica").fontSize(9).text(subtitle, page.margin, doc.y + 4, { width: page.width - page.margin * 2, lineGap: 2 });
  doc.moveTo(page.margin, doc.y + 8).lineTo(page.width - page.margin, doc.y + 8).strokeColor(colors.line).lineWidth(1).stroke();
  doc.moveDown(1);
}

function scoreCard(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, label: string, value: string, sub?: string, score?: number) {
  doc.roundedRect(x, y, w, h, 12).fill(score === undefined ? colors.panel : scoreBg(score)).strokeColor("#dbeafe").lineWidth(1).stroke();
  doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 12, y + 12, { width: w - 24 });
  doc.fillColor(score === undefined ? colors.ink : scoreColor(score)).font("Helvetica-Bold").fontSize(21).text(value, x + 12, y + 28, { width: w - 24 });
  if (sub) doc.fillColor(colors.muted).font("Helvetica").fontSize(8).text(sub, x + 12, y + h - 18, { width: w - 24 });
}

function metricCard(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, label: string, value?: string | number | null, sub?: string) {
  const text = safeText(value);
  doc.roundedRect(x, y, w, h, 12).fill(colors.panel).strokeColor("#dbeafe").lineWidth(1).stroke();
  doc.fillColor(colors.muted).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x + 12, y + 12, { width: w - 24 });
  doc.fillColor(colors.ink).font("Helvetica").fontSize(10).text(text, x + 12, y + 29, {
    width: w - 24,
    height: h - (sub ? 48 : 38),
    ellipsis: true,
    lineGap: 2
  });
  if (sub) doc.fillColor(colors.muted).font("Helvetica").fontSize(8).text(sub, x + 12, y + h - 16, { width: w - 24, ellipsis: true });
}

function metricGrid(doc: PDFKit.PDFDocument, items: Array<{ label: string; value?: string | number | null; sub?: string }>, columns = 2) {
  const gap = 12;
  const w = (page.width - page.margin * 2 - gap * (columns - 1)) / columns;
  const h = 76;
  let rowY = doc.y;
  items.forEach((item, index) => {
    const col = index % columns;
    if (col === 0) {
      addPageIfNeeded(doc, h + 16);
      rowY = doc.y;
    }
    const x = page.margin + col * (w + gap);
    metricCard(doc, x, rowY, w, h, item.label, item.value, item.sub);
    doc.y = rowY;
    if (col === columns - 1 || index === items.length - 1) doc.y = rowY + h + 10;
  });
}

function scoreBars(doc: PDFKit.PDFDocument, items: Array<{ label: string; score: number; detail: string }>) {
  const barW = page.width - page.margin * 2 - 150;
  items.forEach((item) => {
    addPageIfNeeded(doc, 58);
    const y = doc.y;
    doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(10).text(item.label, page.margin, y, { width: 132 });
    doc.fillColor(colors.muted).font("Helvetica").fontSize(8).text(item.detail, page.margin, y + 15, { width: 132, height: 22 });
    doc.roundedRect(page.margin + 150, y + 5, barW, 12, 6).fill("#e2e8f0");
    doc.roundedRect(page.margin + 150, y + 5, Math.max(8, barW * Math.min(100, Math.max(0, item.score)) / 100), 12, 6).fill(scoreColor(item.score));
    doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(10).text(`${item.score}/100`, page.width - page.margin - 48, y + 3, { width: 48, align: "right" });
    doc.y = y + 48;
  });
}

function flagList(doc: PDFKit.PDFDocument, items: string[], fallback: string) {
  const rows = items.length ? items : [fallback];
  rows.forEach((item) => {
    addPageIfNeeded(doc, 34);
    const y = doc.y;
    doc.roundedRect(page.margin, y, page.width - page.margin * 2, 28, 8).fill(items.length ? colors.amberSoft : colors.emeraldSoft);
    doc.fillColor(items.length ? "#92400e" : "#065f46").font("Helvetica-Bold").fontSize(9).text(items.length ? "Opportunity" : "Strength", page.margin + 12, y + 9, { width: 74 });
    doc.fillColor(colors.ink).font("Helvetica").fontSize(9).text(item, page.margin + 94, y + 8, { width: page.width - page.margin * 2 - 108 });
    doc.y = y + 38;
  });
}

function narrativeCard(doc: PDFKit.PDFDocument, title: string, body: string, accent = colors.skySoft) {
  addPageIfNeeded(doc, 96);
  const y = doc.y;
  const textHeight = doc.heightOfString(body, { width: page.width - page.margin * 2 - 28, lineGap: 3 });
  const h = Math.max(76, textHeight + 42);
  doc.roundedRect(page.margin, y, page.width - page.margin * 2, h, 12).fill(accent).strokeColor("#dbeafe").stroke();
  doc.fillColor(colors.ink).font("Helvetica-Bold").fontSize(11).text(title, page.margin + 14, y + 13);
  doc.fillColor(colors.ink).font("Helvetica").fontSize(10).text(body, page.margin + 14, y + 34, {
    width: page.width - page.margin * 2 - 28,
    lineGap: 3
  });
  doc.y = y + h + 10;
}

function smallBullets(doc: PDFKit.PDFDocument, title: string, items: string[], fallback: string) {
  if (!items.length) items = [fallback];
  sectionTitle(doc, title);
  items.forEach((item) => {
    addPageIfNeeded(doc, 28);
    doc.fillColor(colors.sky).font("Helvetica-Bold").fontSize(10).text(">", page.margin, doc.y, { continued: true });
    doc.fillColor(colors.ink).font("Helvetica").fontSize(10).text(` ${item}`, { width: page.width - page.margin * 2 - 16, lineGap: 2 });
    doc.moveDown(0.35);
  });
}

export async function buildGmbAuditPdf(lead: Lead, audit: GmbAudit): Promise<AuditAttachment> {
  const content = await pdfBuffer((doc) => {
    coverHeader(doc, "Google Business Profile Audit", lead, "A presentable snapshot of profile quality, reputation strength, conversion readiness, and local visibility gaps.");

    const overall = audit.overallScore ?? audit.profileCompleteness;
    const rating = audit.rating ? `${audit.rating}/5` : "N/A";
    const reviewCount = audit.reviewCount ?? 0;
    const reviewSub = reviewCount < 25 ? "Needs review depth" : "Review base exists";
    const cardW = (page.width - page.margin * 2 - 36) / 4;
    const cardY = doc.y;
    scoreCard(doc, page.margin, cardY, cardW, 76, "Overall score", `${overall}/100`, "GMB opportunity", overall);
    scoreCard(doc, page.margin + cardW + 12, cardY, cardW, 76, "Completeness", `${audit.profileCompleteness}/100`, "Profile fields", audit.profileCompleteness);
    scoreCard(doc, page.margin + (cardW + 12) * 2, cardY, cardW, 76, "Rating", rating, reviewSub, audit.rating ? Math.min(100, audit.rating * 20) : 0);
    scoreCard(doc, page.margin + (cardW + 12) * 3, cardY, cardW, 76, "Photos", String(audit.photosCount), "Returned by Google", audit.photosCount >= 5 ? 85 : audit.photosCount > 0 ? 55 : 10);
    doc.y = cardY + 96;

    if (audit.scoreBreakdown?.length) {
      sectionTitle(doc, "GMB Score Graph", "Higher scores mean stronger public trust and fewer obvious profile gaps.");
      scoreBars(doc, audit.scoreBreakdown);
    }

    sectionTitle(doc, "Profile Snapshot");
    metricGrid(doc, [
      { label: "Business status", value: audit.businessStatus ?? (audit.error ? "Audit unavailable" : "Not returned") },
      { label: "Open now", value: audit.openNow === null || audit.openNow === undefined ? "Not returned" : audit.openNow ? "Yes" : "No" },
      { label: "Review count", value: audit.reviewCount ?? "Not available" },
      { label: "Categories", value: audit.categories.length ? audit.categories.slice(0, 4).join(", ") : "Not returned" },
      { label: "Phone", value: audit.phone },
      { label: "Website", value: audit.website },
      { label: "Address", value: audit.address },
      { label: "Maps URL", value: audit.mapsUrl }
    ]);

    sectionTitle(doc, "Opportunity Flags");
    flagList(doc, audit.gmbFlags, "No major Google Business Profile gaps were found in this audit.");

    narrativeCard(doc, "Review Summary", audit.reviewSummary, colors.emeraldSoft);
    narrativeCard(doc, "Recommended Action", audit.recommendedAction, colors.skySoft);

    if (audit.weekdayText.length) {
      smallBullets(doc, "Business Hours", audit.weekdayText, "Business hours were not returned.");
    }

    if (audit.error) narrativeCard(doc, "Audit Note", audit.error, colors.roseSoft);
  });

  return {
    filename: `${cleanFilename(lead.company_name)}-gmb-audit.pdf`,
    content,
    contentType: "application/pdf"
  };
}

export async function buildWebsiteAuditPdf(lead: Lead, audit: LeadIntelligenceAudit): Promise<AuditAttachment> {
  const content = await pdfBuffer((doc) => {
    coverHeader(doc, lead.website ? "Website Audit" : "Website Creation Opportunity", lead, "A deep website audit covering search metadata, technical health, local signals, conversion paths, trust, and performance.");

    const overall = audit.overallScore ?? audit.roughSpeedScore;
    const cardW = (page.width - page.margin * 2 - 36) / 4;
    const cardY = doc.y;
    scoreCard(doc, page.margin, cardY, cardW, 76, "Overall score", `${overall}/100`, "Website health", overall);
    scoreCard(doc, page.margin + cardW + 12, cardY, cardW, 76, "Performance", `${audit.roughSpeedScore}/100`, audit.responseTimeMs ? `${audit.responseTimeMs}ms` : "Approximation", audit.roughSpeedScore);
    scoreCard(doc, page.margin + (cardW + 12) * 2, cardY, cardW, 76, "Pages scanned", String(audit.pagesScanned?.length ?? 1), "Deep audit scope");
    scoreCard(doc, page.margin + (cardW + 12) * 3, cardY, cardW, 76, "Flags", String(audit.seoFlags.length), "Opportunity count", audit.seoFlags.length === 0 ? 90 : Math.max(10, 100 - audit.seoFlags.length * 10));
    doc.y = cardY + 96;

    sectionTitle(doc, "Website Score Graph", "Each bar shows a practical sales and audit category, not just raw technical data.");
    scoreBars(doc, audit.scoreBreakdown ?? [
      { label: "Performance", score: audit.roughSpeedScore, detail: "Server response, page weight, scripts, and images." }
    ]);

    sectionTitle(doc, "Website Snapshot");
    metricGrid(doc, [
      { label: "Website", value: audit.website ?? "No website detected" },
      { label: "Final URL", value: audit.finalUrl },
      { label: "HTTP status", value: audit.httpStatus },
      { label: "Homepage size", value: audit.pageSizeKb ? `${audit.pageSizeKb}KB` : undefined },
      { label: "Title tag", value: audit.title },
      { label: "Meta description", value: audit.metaDescription },
      { label: "H1 headline", value: audit.h1 },
      { label: "Schema types", value: audit.schemaTypes?.length ? audit.schemaTypes.join(", ") : audit.hasSchema ? "Detected" : "Not detected" }
    ]);

    sectionTitle(doc, "Technical and Conversion Signals");
    metricGrid(doc, [
      { label: "Viewport meta", value: audit.hasViewportMeta ? "Yes" : "No" },
      { label: "Canonical tag", value: audit.hasCanonical ? "Yes" : "No" },
      { label: "Indexable robots meta", value: audit.hasIndexableRobotsMeta ? "Yes" : "No" },
      { label: "Open Graph metadata", value: audit.hasOpenGraph ? "Yes" : "No" },
      { label: "Robots.txt", value: audit.hasRobotsTxt ? "Yes" : "No" },
      { label: "Sitemap", value: audit.hasSitemapXml ? "Yes" : "No" },
      { label: "Phone visible", value: audit.hasPhoneOnPage ? "Yes" : "No" },
      { label: "Email/form path", value: audit.hasEmailOnPage || audit.formsCount > 0 ? "Yes" : "No" },
      { label: "Booking/quote CTA", value: audit.bookingSignalFound ? "Yes" : "No" },
      { label: "Contact page", value: audit.contactPageFound ? "Yes" : "No" }
    ]);

    sectionTitle(doc, "Content, Links, and Trust");
    metricGrid(doc, [
      { label: "Content word count", value: audit.contentWordCount },
      { label: "Headings found", value: audit.headingsCount },
      { label: "Internal links", value: audit.internalLinksCount },
      { label: "External links", value: audit.externalLinksCount },
      { label: "Images missing alt", value: audit.imagesMissingAlt !== undefined ? `${audit.imagesMissingAlt}/${audit.imagesCount}` : undefined },
      { label: "Local signals", value: audit.localSignalsCount },
      { label: "Trust signals", value: audit.trustSignalsCount },
      { label: "Security headers", value: audit.securityHeaders?.length ? audit.securityHeaders.map((header) => `${header.label}: ${header.present ? "Yes" : "No"}`).join("; ") : "Not checked" }
    ]);

    sectionTitle(doc, lead.website ? "Website Opportunity Flags" : "Website Creation Proposal");
    flagList(
      doc,
      lead.website ? audit.seoFlags : [
        "Create a fast service-focused website for local search visibility.",
        "Add clear call, email, and quote request actions above the fold.",
        "Build city and service pages around buyer-intent search terms.",
        "Connect the website to Google Business Profile for stronger trust signals."
      ],
      "No major homepage gaps were found in this audit."
    );

    narrativeCard(doc, "Fit Summary", audit.fitSummary, colors.emeraldSoft);
    narrativeCard(doc, "Recommended Pitch", audit.recommendedPitch, colors.skySoft);

    if (audit.techStack.length) smallBullets(doc, "Detected Technology", audit.techStack, "No technology stack signals detected.");
    if (audit.pagesScanned?.length) {
      smallBullets(doc, "Pages Scanned", audit.pagesScanned.map((scannedPage) => `${scannedPage.status || "Unknown"} - ${scannedPage.title || "Untitled"} - ${scannedPage.url}`), "Only the homepage was scanned.");
    }
    if (audit.error) narrativeCard(doc, "Audit Note", audit.error, colors.roseSoft);
  });

  return {
    filename: `${cleanFilename(lead.company_name)}-${lead.website ? "website-audit" : "website-proposal"}.pdf`,
    content,
    contentType: "application/pdf"
  };
}
