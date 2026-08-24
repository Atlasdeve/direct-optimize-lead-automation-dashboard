import crypto from "crypto";
import type { Lead } from "@/lib/types";

const defaultMaxDurationSeconds = 90;

function publicBaseUrl(fallbackOrigin?: string | null) {
  const configured = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN;
  if (configured) return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  if (fallbackOrigin?.startsWith("https://")) return fallbackOrigin.replace(/\/$/, "");
  return "";
}

function streamSecret() {
  return process.env.AI_CALL_STREAM_SECRET || process.env.NEXTAUTH_SECRET || process.env.LEAD_CAPTURE_API_KEY || "";
}

export function aiAppointmentCallingConfigured(fallbackOrigin?: string | null) {
  return Boolean(
    process.env.OPENAI_API_KEY &&
    process.env.TELNYX_API_KEY &&
    process.env.TELNYX_PHONE_NUMBER &&
    (process.env.TELNYX_CALL_CONTROL_CONNECTION_ID || process.env.TELNYX_CONNECTION_ID) &&
    publicBaseUrl(fallbackOrigin) &&
    streamSecret()
  );
}

export function signAiCallStream(callLogId: string) {
  const secret = streamSecret();
  if (!secret) throw new Error("AI_CALL_STREAM_SECRET or NEXTAUTH_SECRET is required for AI calls.");
  return crypto.createHmac("sha256", secret).update(callLogId).digest("base64url");
}

export function aiCallStreamUrl(callLogId: string, fallbackOrigin?: string | null) {
  const base = publicBaseUrl(fallbackOrigin);
  if (!base) throw new Error("Set APP_PUBLIC_URL or NEXT_PUBLIC_APP_URL to your HTTPS app URL before using AI calls.");
  const url = new URL("/api/calls/ai/stream", base);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.searchParams.set("callLogId", callLogId);
  url.searchParams.set("token", signAiCallStream(callLogId));
  return url.toString();
}

export function verifyAiCallStream(callLogId: string, token?: string | null) {
  if (!token) return false;
  const expected = Buffer.from(signAiCallStream(callLogId));
  const received = Buffer.from(token);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function aiCallMaxDurationSeconds() {
  const configured = Number(process.env.AI_CALL_MAX_SECONDS);
  if (!Number.isFinite(configured)) return defaultMaxDurationSeconds;
  return Math.max(30, Math.min(180, Math.round(configured)));
}

export function aiAppointmentInstructions(lead: Lead, auditPoints: string[]) {
  const contactName = lead.decision_maker_name || lead.manager_name || lead.owner_name || "the owner or manager";
  const finding = auditPoints[0] || "a few quick improvement points around Google visibility and website conversion";
  return [
    "You are an AI appointment setter for Direct Optimize.",
    "Your job is only to run a short, polite appointment-setting call. Do not sell deeply.",
    "Keep the call natural, calm, human, and brief. Speak in short sentences.",
    "If interrupted, stop talking and listen.",
    "If the person sounds busy, offer to send the audit and end politely.",
    "If they ask technical questions, say a developer can explain the audit properly on a short call.",
    "Never promise rankings, revenue, or guaranteed results.",
    "If they say no, apologize once, say you will not bother them further, and end the call.",
    "Goal one: ask whether they prefer the short audit by email or WhatsApp.",
    "Goal two: if they show interest, ask whether a developer should call them to explain the main points.",
    `Business name: ${lead.company_name}.`,
    `Location: ${[lead.city, lead.country].filter(Boolean).join(", ") || lead.region}.`,
    `Contact target: ${contactName}.`,
    `Known email: ${lead.email || "not available"}.`,
    `Known WhatsApp/phone: ${lead.phone || "not available"}.`,
    `Specific observation to mention: ${finding}.`,
    "Opening line: Hi, is this the owner or manager of the business? I will be very quick."
  ].join("\n");
}

