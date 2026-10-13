import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const googleAuthorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
const googleUserInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";
const oauthStateCookieName = "direct_optimize_google_calendar_state";
const oauthStateLifetimeMs = 10 * 60 * 1000;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarConnection = {
  organizationId: string;
  calendarId: string;
  encryptedRefreshToken: string;
};

export type GoogleCalendarOAuthState = {
  organizationId: string;
  userId: string;
  expiresAt: number;
  nonce: string;
};

function appBaseUrl() {
  return (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function calendarClientId() {
  return process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim() || "";
}

function calendarClientSecret() {
  return process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim() || "";
}

function encryptionSecret() {
  return process.env.GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() || "";
}

function signingSecret() {
  return process.env.NEXTAUTH_SECRET?.trim() || "";
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function stateSignature(value: string) {
  const secret = signingSecret();
  if (secret.length < 32) throw new Error("NEXTAUTH_SECRET must be configured before connecting Google Calendar.");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function encryptionKey() {
  const secret = encryptionSecret();
  if (secret.length < 32) {
    throw new Error("GOOGLE_CALENDAR_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptRefreshToken(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptRefreshToken(value: string) {
  const [version, ivValue, tagValue, ciphertext] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertext) throw new Error("Stored Google Calendar credentials are invalid. Reconnect the calendar.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

async function googleJson<T>(url: string, init: RequestInit, message: string): Promise<T> {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof data?.error_description === "string"
      ? data.error_description
      : typeof data?.error?.message === "string"
        ? data.error.message
        : typeof data?.error === "string"
          ? data.error
          : "";
    throw new Error(detail ? `${message}: ${detail}` : message);
  }
  return data as T;
}

export function googleCalendarRedirectUri() {
  return `${appBaseUrl()}/api/booking/google/callback`;
}

export function googleCalendarConfiguration() {
  return {
    configured: Boolean(calendarClientId() && calendarClientSecret() && encryptionSecret().length >= 32),
    redirectUri: googleCalendarRedirectUri()
  };
}

export function googleCalendarStateCookieName() {
  return oauthStateCookieName;
}

export function createGoogleCalendarOAuthState(input: { organizationId: string; userId: string }) {
  const body = Buffer.from(JSON.stringify({
    organizationId: input.organizationId,
    userId: input.userId,
    expiresAt: Date.now() + oauthStateLifetimeMs,
    nonce: crypto.randomBytes(18).toString("base64url")
  })).toString("base64url");
  return `${body}.${stateSignature(body)}`;
}

export function verifyGoogleCalendarOAuthState(value?: string | null): GoogleCalendarOAuthState | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  try {
    if (!safeEqual(stateSignature(body), signature)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleCalendarOAuthState;
    if (!parsed.organizationId || !parsed.userId || !parsed.nonce || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildGoogleCalendarAuthorizationUrl(state: string) {
  const configuration = googleCalendarConfiguration();
  if (!configuration.configured) throw new Error("Google Calendar OAuth is not configured yet.");
  const url = new URL(googleAuthorizationEndpoint);
  url.searchParams.set("client_id", calendarClientId());
  url.searchParams.set("redirect_uri", configuration.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.events.owned",
    "https://www.googleapis.com/auth/calendar.events.freebusy"
  ].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeAuthorizationCode(code: string) {
  const configuration = googleCalendarConfiguration();
  if (!configuration.configured) throw new Error("Google Calendar OAuth is not configured yet.");
  return googleJson<GoogleTokenResponse>(googleTokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: calendarClientId(),
      client_secret: calendarClientSecret(),
      redirect_uri: configuration.redirectUri,
      grant_type: "authorization_code"
    })
  }, "Google could not authorize the calendar connection");
}

async function googleAccountEmail(accessToken?: string) {
  if (!accessToken) return null;
  try {
    const profile = await googleJson<{ email?: string }>(googleUserInfoEndpoint, {
      headers: { authorization: `Bearer ${accessToken}` }
    }, "Google account details could not be read");
    return typeof profile.email === "string" ? profile.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function completeGoogleCalendarConnection(input: { organizationId: string; code: string }) {
  const token = await exchangeAuthorizationCode(input.code);
  if (!token.access_token) throw new Error("Google did not return an access token. Please try connecting the calendar again.");

  const existing = await prisma.googleCalendarConnection.findUnique({ where: { organizationId: input.organizationId } });
  if (!token.refresh_token && !existing) {
    throw new Error("Google did not return a calendar refresh token. Remove Direct Optimize from your Google Account permissions, then connect it again.");
  }

  const accountEmail = await googleAccountEmail(token.access_token);
  const encryptedRefreshToken = token.refresh_token ? encryptRefreshToken(token.refresh_token) : existing!.encryptedRefreshToken;
  return prisma.googleCalendarConnection.upsert({
    where: { organizationId: input.organizationId },
    update: {
      encryptedRefreshToken,
      googleAccountEmail: accountEmail || existing?.googleAccountEmail || null,
      calendarId: "primary",
      scope: token.scope || existing?.scope || null
    },
    create: {
      organizationId: input.organizationId,
      encryptedRefreshToken,
      googleAccountEmail: accountEmail,
      calendarId: "primary",
      scope: token.scope || null
    },
    select: { calendarId: true, googleAccountEmail: true, updatedAt: true }
  });
}

export async function disconnectGoogleCalendar(organizationId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { organizationId } });
  if (!connection) return false;
  await prisma.googleCalendarConnection.delete({ where: { organizationId } });
  return true;
}

async function accessTokenForConnection(connection: GoogleCalendarConnection) {
  const refreshToken = decryptRefreshToken(connection.encryptedRefreshToken);
  const token = await googleJson<GoogleTokenResponse>(googleTokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: calendarClientId(),
      client_secret: calendarClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  }, "Google Calendar access could not be refreshed");
  if (!token.access_token) throw new Error("Google Calendar did not return an access token. Reconnect the calendar.");
  return token.access_token;
}

export async function getGoogleCalendarBusyTimes(connection: GoogleCalendarConnection, input: { timeMin: Date; timeMax: Date }) {
  if (!googleCalendarConfiguration().configured) throw new Error("Google Calendar credentials are not configured.");
  const accessToken = await accessTokenForConnection(connection);
  const data = await googleJson<{ calendars?: Record<string, { busy?: Array<{ start: string; end: string }>; errors?: Array<{ reason?: string }> }> }>(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeMin: input.timeMin.toISOString(),
        timeMax: input.timeMax.toISOString(),
        items: [{ id: connection.calendarId || "primary" }]
      })
    },
    "Google Calendar availability could not be read"
  );
  const calendar = data.calendars?.[connection.calendarId || "primary"] || Object.values(data.calendars || {})[0];
  if (calendar?.errors?.length) throw new Error("Google Calendar did not return availability for the selected calendar.");
  return calendar?.busy ?? [];
}

export async function createGoogleCalendarEvent(input: {
  connection: GoogleCalendarConnection;
  appointment: { id: string; name: string; email: string; companyName?: string | null; phone?: string | null; notes?: string | null; startsAt: Date; endsAt: Date; timezone: string };
  eventTitle: string;
  eventDescription?: string | null;
}) {
  if (!googleCalendarConfiguration().configured) throw new Error("Google Calendar credentials are not configured.");
  const accessToken = await accessTokenForConnection(input.connection);
  const calendarId = encodeURIComponent(input.connection.calendarId || "primary");
  const description = [
    input.eventDescription?.trim(),
    "",
    `Booked through Direct Optimize`,
    `Name: ${input.appointment.name}`,
    input.appointment.companyName ? `Company: ${input.appointment.companyName}` : null,
    input.appointment.phone ? `Phone: ${input.appointment.phone}` : null,
    input.appointment.notes ? `Notes: ${input.appointment.notes}` : null,
    `Booking reference: ${input.appointment.id}`
  ].filter((line): line is string => Boolean(line)).join("\n").slice(0, 7000);
  const event = await googleJson<{ id?: string }>(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        summary: input.eventTitle.slice(0, 240),
        description,
        start: { dateTime: input.appointment.startsAt.toISOString(), timeZone: input.appointment.timezone },
        end: { dateTime: input.appointment.endsAt.toISOString(), timeZone: input.appointment.timezone },
        attendees: [{ email: input.appointment.email, displayName: input.appointment.name }]
      })
    },
    "Google Calendar event could not be created"
  );
  if (!event.id) throw new Error("Google Calendar did not return an event id.");
  return event.id;
}

export async function deleteGoogleCalendarEvent(connection: GoogleCalendarConnection, googleEventId: string) {
  if (!googleCalendarConfiguration().configured) throw new Error("Google Calendar credentials are not configured.");
  const accessToken = await accessTokenForConnection(connection);
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(connection.calendarId || "primary")}/events/${encodeURIComponent(googleEventId)}?sendUpdates=all`,
    { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok && response.status !== 404) throw new Error("Google Calendar event could not be cancelled.");
}
