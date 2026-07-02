import type { Lead } from "@/lib/types";
import { leadQualityLabel } from "@/lib/scoring";

export type LeadTemperature = "Hot" | "Warm" | "Cold";

export function leadTemperature(lead: Pick<Lead, "lead_score" | "replied" | "outreach_status" | "email" | "phone" | "contact_forms">): LeadTemperature {
  if (lead.replied || lead.outreach_status === "Meeting Booked" || lead.lead_score >= 75) return "Hot";
  if (lead.lead_score >= 45 || Boolean(lead.email) || Boolean(lead.phone) || (lead.contact_forms?.length ?? 0) > 0) return "Warm";
  return "Cold";
}

export function nextBestAction(lead: Lead) {
  if (lead.unsubscribed || lead.do_not_contact) return "Do not contact. Keep for reporting only.";
  if (lead.replied) return "Review reply, draft a personal response, and move to opportunity if there is buying intent.";
  if (lead.outreach_status === "Meeting Booked") return "Prepare proposal notes and confirm the meeting.";
  if (!lead.email && (lead.contact_forms?.length ?? 0) === 0) return "Run email discovery and contact-form scan before outreach.";
  if (!lead.outreach_approved && lead.email) return "Review and approve the email before sending.";
  if (lead.outreach_approved && !lead.email_sent && lead.email) return "Send approved email outreach.";
  if (lead.email_sent && !lead.replied) return "Schedule follow-up email with a lighter audit angle.";
  if (!lead.website) return "Pitch a quick website and Google visibility audit.";
  if (lead.missing_seo_metadata) return "Pitch local SEO metadata and conversion fixes.";
  return "Review lead details and choose the strongest outreach angle.";
}

export function leadSequencePlan(lead: Lead) {
  const angle = !lead.website
    ? "website visibility gap"
    : lead.missing_seo_metadata
      ? "local SEO metadata gap"
      : typeof lead.rating === "number" && lead.rating < 3.8
        ? "review trust gap"
        : "Google visibility and conversion audit";

  return [
    {
      day: "Day 1",
      channel: lead.email ? "Email" : (lead.contact_forms?.length ?? 0) > 0 ? "Contact form" : "Research",
      action: lead.email ? `Send personalized ${angle} email.` : (lead.contact_forms?.length ?? 0) > 0 ? `Submit short ${angle} message via contact form.` : "Find a verified email or form first."
    },
    {
      day: "Day 3",
      channel: lead.email ? "Email follow-up" : "Phone/WhatsApp signal",
      action: lead.email ? "Follow up with one specific observation and a low-friction audit offer." : "Use phone/WhatsApp shortcut only if appropriate and consent-safe."
    },
    {
      day: "Day 7",
      channel: "Final follow-up",
      action: "Send a polite close-the-loop message and stop if there is no response."
    }
  ];
}

export function leadOpportunitySummary(lead: Lead) {
  return {
    temperature: leadTemperature(lead),
    quality: leadQualityLabel(lead.lead_score),
    action: nextBestAction(lead),
    sequence: leadSequencePlan(lead)
  };
}
