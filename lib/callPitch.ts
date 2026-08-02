import crypto from "crypto";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Lead } from "@/lib/types";
import type { LeadIntelligenceAudit } from "@/lib/leadIntelligence";
import type { GmbAudit } from "@/lib/gmbAudit";
import type { LeadCallPitch } from "@/lib/callPitchTypes";

const callPitchSchema = z.object({
  opening: z.string().trim().min(20).max(700),
  contextBridge: z.string().trim().min(20).max(900),
  valueStatement: z.string().trim().min(20).max(900),
  discoveryQuestions: z.array(z.string().trim().min(8).max(350)).min(2).max(5),
  talkingPoints: z.array(z.object({
    finding: z.string().trim().min(3).max(300),
    implication: z.string().trim().min(8).max(500),
    conversationalLine: z.string().trim().min(8).max(600)
  })).min(1).max(5),
  objectionResponses: z.array(z.object({
    objection: z.string().trim().min(3).max(200),
    response: z.string().trim().min(8).max(600)
  })).min(2).max(4),
  nextStep: z.string().trim().min(10).max(600)
}).strict();

function fingerprint(lead: Lead, websiteAudit: LeadIntelligenceAudit, gmbAudit: GmbAudit) {
  return crypto.createHash("sha256").update(JSON.stringify({
    schemaVersion: 2,
    lead: {
      company: lead.company_name,
      category: lead.category,
      city: lead.city,
      country: lead.country,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.review_count,
      contact: lead.decision_maker_name ?? lead.owner_name ?? lead.manager_name
    },
    websiteAudit,
    gmbAudit
  })).digest("hex");
}

function contactName(lead: Lead) {
  return lead.decision_maker_name ?? lead.owner_name ?? lead.manager_name ?? null;
}

function fallbackPitch(lead: Lead, websiteAudit: LeadIntelligenceAudit, gmbAudit: GmbAudit, auditFingerprint: string): LeadCallPitch {
  const name = contactName(lead);
  const websiteFinding = websiteAudit.seoFlags[0] ?? (lead.website ? "The website has a foundation we can build on" : "No active website was detected");
  const gmbFinding = gmbAudit.gmbFlags[0] ?? "The Google Business Profile can be reviewed for stronger local conversion";
  const greeting = name ? `Hi ${name},` : "Hi there,";
  return {
    generatedAt: new Date().toISOString(),
    auditFingerprint,
    generationMode: "audit_fallback",
    opening: `${greeting} this is [Your name] from Direct Optimize. Have I caught you at an okay time for a quick question about ${lead.company_name}'s online presence?`,
    contextBridge: `I took a brief look at how ${lead.company_name} appears online in ${lead.city || lead.country}. I noticed a couple of practical opportunities, including ${websiteFinding.toLowerCase()} and ${gmbFinding.toLowerCase()}. I wanted to understand whether these are already being worked on before making any assumptions.`,
    valueStatement: "We help local businesses turn their website and Google profile into clearer paths for enquiries. The aim is not to replace what is already working, but to identify a few measurable improvements worth prioritizing.",
    discoveryQuestions: [
      "How are most new customers finding you at the moment?",
      "Are you satisfied with the number and quality of enquiries coming from Google and your website?",
      "Is anyone currently responsible for keeping the website and Google Business Profile updated?"
    ],
    talkingPoints: [
      {
        finding: websiteFinding,
        implication: "This may make it harder for visitors or search engines to understand the business and take the next step.",
        conversationalLine: `One thing I noticed on the website side was ${websiteFinding.toLowerCase()}. Has that been on your radar?`
      },
      {
        finding: gmbFinding,
        implication: "A more complete and active profile can strengthen trust and improve how local searchers convert.",
        conversationalLine: `On the Google profile, I also noticed ${gmbFinding.toLowerCase()}. Is the profile managed regularly?`
      }
    ],
    objectionResponses: [
      {
        objection: "We already have someone handling this",
        response: "That makes sense. I am not looking to disrupt a good arrangement. I can share the audit as a second opinion, and your existing team can use anything they find helpful."
      },
      {
        objection: "Please send me some information",
        response: "Absolutely. I will send the short audit and keep it focused on the findings we discussed. Which email address is best for you?"
      },
      {
        objection: "We are not interested right now",
        response: "Understood, and I appreciate you being direct. Would it be all right if I send the audit for reference and leave the timing with you?"
      }
    ],
    nextStep: "Would you be open to a short review call where I walk you through the two or three highest-priority findings and what they could improve?"
  };
}

function promptData(lead: Lead, websiteAudit: LeadIntelligenceAudit, gmbAudit: GmbAudit) {
  return {
    lead: {
      company: lead.company_name,
      contactName: contactName(lead),
      contactTitle: lead.decision_maker_title,
      category: lead.category,
      businessType: lead.business_type,
      city: lead.city,
      country: lead.country,
      website: lead.website,
      rating: lead.rating,
      reviewCount: lead.review_count,
      notes: lead.research_note ?? lead.notes
    },
    websiteAudit: {
      website: websiteAudit.website,
      title: websiteAudit.title,
      metaDescription: websiteAudit.metaDescription,
      h1: websiteAudit.h1,
      roughSpeedScore: websiteAudit.roughSpeedScore,
      formsCount: websiteAudit.formsCount,
      techStack: websiteAudit.techStack,
      seoFlags: websiteAudit.seoFlags,
      fitSummary: websiteAudit.fitSummary,
      recommendedPitch: websiteAudit.recommendedPitch,
      error: websiteAudit.error
    },
    gmbAudit: {
      rating: gmbAudit.rating,
      reviewCount: gmbAudit.reviewCount,
      profileCompleteness: gmbAudit.profileCompleteness,
      photosCount: gmbAudit.photosCount,
      categories: gmbAudit.categories,
      gmbFlags: gmbAudit.gmbFlags,
      reviewSummary: gmbAudit.reviewSummary,
      recommendedAction: gmbAudit.recommendedAction,
      error: gmbAudit.error
    }
  };
}

async function createPitch(lead: Lead, websiteAudit: LeadIntelligenceAudit, gmbAudit: GmbAudit, auditFingerprint: string) {
  if (!process.env.OPENAI_API_KEY) return fallbackPitch(lead, websiteAudit, gmbAudit, auditFingerprint);

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.65,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You create natural B2B phone conversation briefs for Direct Optimize, a website, SEO, and Google Business Profile agency.",
            "Write like a thoughtful consultant, not a telemarketer. Use plain spoken English, short sentences, and a calm professional tone.",
            "Use only facts supplied in the lead and audit data. Never invent traffic, rankings, revenue, competitors, penalties, or guaranteed results.",
            "Treat automated audit findings as observations to verify in conversation, not accusations or absolute facts.",
            "The opening must ask permission to continue. The discovery questions should invite the prospect to explain their situation.",
            "The next step must be low pressure. Return JSON only with keys: opening, contextBridge, valueStatement, discoveryQuestions, talkingPoints, objectionResponses, nextStep.",
            "talkingPoints entries require finding, implication, conversationalLine. objectionResponses entries require objection and response."
          ].join(" ")
        },
        {
          role: "user",
          content: `Create a tailored call brief from this verified data:\n${JSON.stringify(promptData(lead, websiteAudit, gmbAudit))}`
        }
      ]
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("AI returned an empty call pitch.");
    const parsed = callPitchSchema.parse(JSON.parse(content));
    return { ...parsed, generatedAt: new Date().toISOString(), auditFingerprint, generationMode: "ai" } satisfies LeadCallPitch;
  } catch (error) {
    console.warn("AI call pitch generation unavailable; using the audit-based fallback:", error);
    return fallbackPitch(lead, websiteAudit, gmbAudit, auditFingerprint);
  }
}

export async function getLatestLeadCallPitch(leadId: string) {
  const log = await prisma.outreachLog.findFirst({
    where: { leadId, action: "lead_call_pitch", status: "completed" },
    orderBy: { createdAt: "desc" }
  });
  return (log?.metadata as LeadCallPitch | null) ?? null;
}

export async function generateLeadCallPitch(
  lead: Lead,
  websiteAudit: LeadIntelligenceAudit,
  gmbAudit: GmbAudit,
  options?: { force?: boolean }
) {
  const auditFingerprint = fingerprint(lead, websiteAudit, gmbAudit);
  if (!options?.force) {
    const existing = await getLatestLeadCallPitch(lead.id);
    if (existing?.auditFingerprint === auditFingerprint) return existing;
  }

  const pitch = await createPitch(lead, websiteAudit, gmbAudit, auditFingerprint);
  await prisma.outreachLog.create({
    data: {
      leadId: lead.id,
      channel: "voice",
      action: "lead_call_pitch",
      status: "completed",
      message: "Audit-aware call pitch generated.",
      metadata: pitch
    }
  });
  return pitch;
}
