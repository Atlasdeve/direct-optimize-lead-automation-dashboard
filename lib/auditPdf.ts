import PDFDocument from "pdfkit";
import type { GmbAudit } from "@/lib/gmbAudit";
import type { LeadIntelligenceAudit } from "@/lib/leadIntelligence";
import type { Lead } from "@/lib/types";

export type AuditAttachment = {
  filename: string;
  content: Buffer;
  contentType: "application/pdf";
};

function pdfBuffer(build: (doc: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Creator: "Direct Optimize Lead Automation" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    build(doc);
    doc.end();
  });
}

function cleanFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "lead";
}

function header(doc: PDFKit.PDFDocument, title: string, lead: Lead) {
  doc.rect(0, 0, doc.page.width, 112).fill("#071426");
  doc.fillColor("#7dd3fc").fontSize(10).font("Helvetica-Bold").text("DIRECT OPTIMIZE", 48, 34, { characterSpacing: 1.2 });
  doc.fillColor("#ffffff").fontSize(22).text(title, 48, 54);
  doc.fillColor("#cbd5e1").fontSize(10).font("Helvetica").text(`${lead.company_name} - ${lead.city || lead.region}, ${lead.country}`, 48, 84);
  doc.moveDown(4);
}

function section(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.8);
  doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(14).text(title);
  doc.moveTo(48, doc.y + 5).lineTo(doc.page.width - 48, doc.y + 5).strokeColor("#bae6fd").lineWidth(1).stroke();
  doc.moveDown(0.8);
}

function kv(doc: PDFKit.PDFDocument, label: string, value?: string | number | null) {
  doc.fillColor("#334155").font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), { continued: false });
  doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(value === undefined || value === null || value === "" ? "Not available" : String(value));
  doc.moveDown(0.5);
}

function bullets(doc: PDFKit.PDFDocument, items: string[], fallback: string) {
  const rows = items.length ? items : [fallback];
  rows.forEach((item) => {
    doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(`- ${item}`, { lineGap: 3 });
  });
}

function footer(doc: PDFKit.PDFDocument) {
  doc.fillColor("#64748b").fontSize(9).text("Prepared by Direct Optimize - Local visibility, website audits, and compliant lead outreach.", 48, doc.page.height - 44, {
    width: doc.page.width - 96,
    align: "center"
  });
}

export async function buildGmbAuditPdf(lead: Lead, audit: GmbAudit): Promise<AuditAttachment> {
  const content = await pdfBuffer((doc) => {
    header(doc, "Google Business Profile Audit", lead);
    section(doc, "Profile Snapshot");
    kv(doc, "Business status", audit.businessStatus ?? (audit.error ? "Audit unavailable" : "Not returned"));
    kv(doc, "Profile completeness", `${audit.profileCompleteness}/100`);
    kv(doc, "Rating", audit.rating ? `${audit.rating} stars` : "Not available");
    kv(doc, "Review count", audit.reviewCount ?? "Not available");
    kv(doc, "Open now", audit.openNow === null || audit.openNow === undefined ? "Not returned" : audit.openNow ? "Yes" : "No");
    kv(doc, "Photos returned", audit.photosCount);

    section(doc, "Opportunity Flags");
    bullets(doc, audit.gmbFlags, "No major Google Business Profile gaps were found in this quick audit.");

    section(doc, "Review Summary");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(audit.reviewSummary, { lineGap: 4 });

    section(doc, "Recommended Action");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(audit.recommendedAction, { lineGap: 4 });

    if (audit.weekdayText.length) {
      section(doc, "Business Hours");
      bullets(doc, audit.weekdayText, "Business hours were not returned.");
    }

    if (audit.error) {
      section(doc, "Audit Note");
      doc.fillColor("#991b1b").font("Helvetica").fontSize(10).text(audit.error);
    }
    footer(doc);
  });

  return {
    filename: `${cleanFilename(lead.company_name)}-gmb-audit.pdf`,
    content,
    contentType: "application/pdf"
  };
}

export async function buildWebsiteAuditPdf(lead: Lead, audit: LeadIntelligenceAudit): Promise<AuditAttachment> {
  const content = await pdfBuffer((doc) => {
    header(doc, lead.website ? "Website Audit" : "Website Creation Opportunity", lead);
    section(doc, "Website Snapshot");
    kv(doc, "Website", audit.website ?? "No website detected");
    kv(doc, "Title tag", audit.title);
    kv(doc, "Meta description", audit.metaDescription);
    kv(doc, "H1 headline", audit.h1);
    kv(doc, "Rough speed score", audit.roughSpeedScore ? `${audit.roughSpeedScore}/100` : "Not available");
    kv(doc, "Forms found", audit.formsCount);
    kv(doc, "Schema detected", audit.hasSchema ? "Yes" : "No");
    kv(doc, "Sitemap detected", audit.hasSitemapXml ? "Yes" : "No");

    section(doc, lead.website ? "Website Opportunity Flags" : "Website Creation Proposal");
    bullets(
      doc,
      lead.website ? audit.seoFlags : [
        "Create a fast service-focused website for local search visibility.",
        "Add clear call, email, and quote request actions above the fold.",
        "Build city and service pages around buyer-intent search terms.",
        "Connect the website to Google Business Profile for stronger trust signals."
      ],
      "No major homepage gaps were found in this quick audit."
    );

    section(doc, "Fit Summary");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(audit.fitSummary, { lineGap: 4 });

    section(doc, "Recommended Pitch");
    doc.fillColor("#0f172a").font("Helvetica").fontSize(11).text(audit.recommendedPitch, { lineGap: 4 });

    if (audit.techStack.length) {
      section(doc, "Detected Technology");
      bullets(doc, audit.techStack, "No technology stack signals detected.");
    }

    if (audit.error) {
      section(doc, "Audit Note");
      doc.fillColor("#991b1b").font("Helvetica").fontSize(10).text(audit.error);
    }
    footer(doc);
  });

  return {
    filename: `${cleanFilename(lead.company_name)}-${lead.website ? "website-audit" : "website-proposal"}.pdf`,
    content,
    contentType: "application/pdf"
  };
}
