export const integratedCallingRegions = ["USA", "Canada", "UK"] as const;

export function telnyxCallingConfigured() {
  return Boolean(
    process.env.TELNYX_API_KEY &&
    process.env.TELNYX_TELEPHONY_CREDENTIAL_ID &&
    process.env.TELNYX_PHONE_NUMBER
  );
}

export function integratedCallingAllowed(region: string) {
  return integratedCallingRegions.includes(region as (typeof integratedCallingRegions)[number]);
}

export function validE164(phone: string) {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

export function normalizeE164(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed.startsWith("+")) return trimmed;
  return `+${trimmed.slice(1).replace(/\D/g, "")}`;
}

export async function createTelnyxAccessToken() {
  if (!telnyxCallingConfigured()) throw new Error("Telnyx browser calling is not configured.");
  const credentialId = encodeURIComponent(process.env.TELNYX_TELEPHONY_CREDENTIAL_ID!);
  const response = await fetch(`https://api.telnyx.com/v2/telephony_credentials/${credentialId}/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      Accept: "application/json"
    },
    cache: "no-store"
  });
  const responseBody = await response.text();
  let payload: unknown = responseBody.trim();
  try {
    payload = JSON.parse(responseBody);
  } catch {
    // Telnyx currently returns the JWT as raw text without a Content-Type header.
  }
  if (!response.ok) {
    const errorPayload = typeof payload === "object" && payload !== null
      ? payload as { errors?: Array<{ detail?: string }>; message?: string }
      : null;
    const message = errorPayload?.errors?.[0]?.detail || errorPayload?.message || `Telnyx token request failed with HTTP ${response.status}`;
    throw new Error(message);
  }
  const objectPayload = typeof payload === "object" && payload !== null
    ? payload as { token?: string; data?: string | { token?: string } }
    : null;
  const token = typeof payload === "string"
    ? payload
    : typeof objectPayload?.data === "string"
      ? objectPayload.data
      : objectPayload?.data?.token || objectPayload?.token;
  if (!token) throw new Error("Telnyx did not return a WebRTC access token.");
  return token as string;
}
