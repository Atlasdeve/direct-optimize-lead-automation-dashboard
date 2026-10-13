import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { createAppNotification } from "@/lib/appNotifications";
import { createGoogleCalendarEvent, getGoogleCalendarBusyTimes, googleCalendarConfiguration, deleteGoogleCalendarEvent } from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";

export type BookingWindow = { start: string; end: string };
export type BookingAvailability = Record<string, BookingWindow[]>;

const weekdayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const defaultBookingAvailability: BookingAvailability = {
  monday: [{ start: "09:00", end: "17:00" }],
  tuesday: [{ start: "09:00", end: "17:00" }],
  wednesday: [{ start: "09:00", end: "17:00" }],
  thursday: [{ start: "09:00", end: "17:00" }],
  friday: [{ start: "09:00", end: "17:00" }],
  saturday: [],
  sunday: []
};

type RawBookingSettings = {
  id?: string;
  timezone?: string;
  appointmentDurationMinutes?: number;
  bufferMinutes?: number;
  minimumNoticeMinutes?: number;
  maximumDaysAhead?: number;
  availability?: Prisma.JsonValue | null;
  eventTitle?: string;
  eventDescription?: string | null;
  isPublic?: boolean;
};

export type BookingSettingsData = {
  timezone: string;
  appointmentDurationMinutes: number;
  bufferMinutes: number;
  minimumNoticeMinutes: number;
  maximumDaysAhead: number;
  availability: BookingAvailability;
  eventTitle: string;
  eventDescription: string | null;
  isPublic: boolean;
};

export class BookingAvailabilityError extends Error {
  constructor(message: string, public code = "unavailable") {
    super(message);
  }
}

function appBaseUrl() {
  return (process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function safeTimeZone(value?: string | null) {
  const timezone = value?.trim() || process.env.BOOKING_DEFAULT_TIMEZONE || "America/Toronto";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return timezone;
  } catch {
    return "America/Toronto";
  }
}

function numberInRange(value: unknown, fallback: number, min: number, max: number, step = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const rounded = Math.round(number / step) * step;
  return Math.max(min, Math.min(max, rounded));
}

function timeToMinutes(value: unknown) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeWindow(value: unknown): BookingWindow | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const start = typeof item.start === "string" ? item.start : "";
  const end = typeof item.end === "string" ? item.end : "";
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;
  return { start, end };
}

export function normalizeBookingAvailability(value: unknown): BookingAvailability {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const normalized = {} as BookingAvailability;
  for (const day of weekdayKeys) {
    const supplied = source?.[day];
    if (Array.isArray(supplied)) {
      normalized[day] = supplied.map(normalizeWindow).filter((window): window is BookingWindow => Boolean(window)).slice(0, 1);
    } else {
      normalized[day] = defaultBookingAvailability[day].map((window) => ({ ...window }));
    }
  }
  return normalized;
}

export function normalizeBookingSettings(input: Record<string, unknown>, current?: RawBookingSettings | null): BookingSettingsData {
  const currentSettings = current || {};
  const duration = numberInRange(input.appointmentDurationMinutes, currentSettings.appointmentDurationMinutes ?? 30, 15, 120, 15);
  const eventTitleSource = typeof input.eventTitle === "string" ? input.eventTitle : currentSettings.eventTitle;
  const eventDescriptionSource = typeof input.eventDescription === "string" ? input.eventDescription : currentSettings.eventDescription;
  return {
    timezone: safeTimeZone(typeof input.timezone === "string" ? input.timezone : currentSettings.timezone),
    appointmentDurationMinutes: duration,
    bufferMinutes: numberInRange(input.bufferMinutes, currentSettings.bufferMinutes ?? 0, 0, 60, 5),
    minimumNoticeMinutes: numberInRange(input.minimumNoticeMinutes, currentSettings.minimumNoticeMinutes ?? 120, 0, 10_080, 15),
    maximumDaysAhead: numberInRange(input.maximumDaysAhead, currentSettings.maximumDaysAhead ?? 30, 1, 90),
    availability: normalizeBookingAvailability(input.availability === undefined ? currentSettings.availability : input.availability),
    eventTitle: (eventTitleSource?.trim() || "Discovery call").slice(0, 160),
    eventDescription: eventDescriptionSource?.trim() ? eventDescriptionSource.trim().slice(0, 2000) : null,
    isPublic: typeof input.isPublic === "boolean" ? input.isPublic : currentSettings.isPublic ?? true
  };
}

export function bookingSettingsFromRecord(settings?: RawBookingSettings | null) {
  return normalizeBookingSettings({}, settings);
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: part("weekday").toLowerCase(),
    minutes: Number(part("hour")) * 60 + Number(part("minute"))
  };
}

function parseDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const test = new Date(Date.UTC(year, month - 1, day));
  return test.getUTCFullYear() === year && test.getUTCMonth() === month - 1 && test.getUTCDate() === day ? { year, month, day } : null;
}

function daysBetween(first: string, second: string) {
  return Math.round((Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
}

function dateRangeForBookingDay(date: string) {
  const parsed = parseDateString(date);
  if (!parsed) throw new BookingAvailabilityError("Choose a valid booking date.", "invalid_date");
  const start = Date.UTC(parsed.year, parsed.month - 1, parsed.day) - 18 * 60 * 60 * 1000;
  const end = Date.UTC(parsed.year, parsed.month - 1, parsed.day + 2) + 18 * 60 * 60 * 1000;
  return { start: new Date(start), end: new Date(end) };
}

function intervalOverlaps(start: Date, end: Date, interval: { start: Date; end: Date }) {
  return start < interval.end && end > interval.start;
}

function displayTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
}

function serializeAppointment(appointment: {
  id: string;
  name: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  notes: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  status: string;
  source: string;
  calendarSyncStatus: string;
  googleEventId: string | null;
  createdAt: Date;
}) {
  return {
    id: appointment.id,
    name: appointment.name,
    email: appointment.email,
    companyName: appointment.companyName,
    phone: appointment.phone,
    notes: appointment.notes,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    timezone: appointment.timezone,
    status: appointment.status,
    source: appointment.source,
    calendarSyncStatus: appointment.calendarSyncStatus,
    googleEventId: appointment.googleEventId,
    createdAt: appointment.createdAt.toISOString()
  };
}

export async function getPublicBookingProfile(slug: string) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      companyName: true,
      brandColor: true,
      bookingSettings: {
        select: {
          id: true,
          timezone: true,
          appointmentDurationMinutes: true,
          bufferMinutes: true,
          minimumNoticeMinutes: true,
          maximumDaysAhead: true,
          availability: true,
          eventTitle: true,
          eventDescription: true,
          isPublic: true
        }
      }
    }
  });
  if (!organization) return null;
  const settings = bookingSettingsFromRecord(organization.bookingSettings);
  if (!settings.isPublic) return null;
  return {
    organizationId: organization.id,
    slug: organization.slug,
    organizationName: organization.companyName || organization.name,
    brandColor: organization.brandColor,
    settings
  };
}

export async function getBookingWorkspace(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      slug: true,
      companyName: true,
      bookingSettings: {
        select: {
          id: true,
          timezone: true,
          appointmentDurationMinutes: true,
          bufferMinutes: true,
          minimumNoticeMinutes: true,
          maximumDaysAhead: true,
          availability: true,
          eventTitle: true,
          eventDescription: true,
          isPublic: true
        }
      },
      googleCalendarConnection: {
        select: { calendarId: true, googleAccountEmail: true, updatedAt: true }
      },
      bookingAppointments: {
        orderBy: { startsAt: "asc" },
        take: 50,
        where: { startsAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        select: {
          id: true,
          name: true,
          email: true,
          companyName: true,
          phone: true,
          notes: true,
          startsAt: true,
          endsAt: true,
          timezone: true,
          status: true,
          source: true,
          calendarSyncStatus: true,
          googleEventId: true,
          createdAt: true
        }
      }
    }
  });
  if (!organization) throw new Error("Workspace was not found.");
  const configuration = googleCalendarConfiguration();
  return {
    settings: bookingSettingsFromRecord(organization.bookingSettings),
    publicBookingUrl: `${appBaseUrl()}/book/${organization.slug}`,
    googleCalendar: {
      configured: configuration.configured,
      redirectUri: configuration.redirectUri,
      connected: Boolean(organization.googleCalendarConnection),
      accountEmail: organization.googleCalendarConnection?.googleAccountEmail ?? null,
      calendarId: organization.googleCalendarConnection?.calendarId ?? null,
      connectedAt: organization.googleCalendarConnection?.updatedAt?.toISOString() ?? null
    },
    appointments: organization.bookingAppointments.map(serializeAppointment)
  };
}

export async function saveBookingSettings(organizationId: string, input: Record<string, unknown>) {
  const current = await prisma.bookingSettings.findUnique({ where: { organizationId } });
  const settings = normalizeBookingSettings(input, current);
  const record = await prisma.bookingSettings.upsert({
    where: { organizationId },
    update: {
      timezone: settings.timezone,
      appointmentDurationMinutes: settings.appointmentDurationMinutes,
      bufferMinutes: settings.bufferMinutes,
      minimumNoticeMinutes: settings.minimumNoticeMinutes,
      maximumDaysAhead: settings.maximumDaysAhead,
      availability: settings.availability as Prisma.InputJsonValue,
      eventTitle: settings.eventTitle,
      eventDescription: settings.eventDescription,
      isPublic: settings.isPublic
    },
    create: {
      organizationId,
      timezone: settings.timezone,
      appointmentDurationMinutes: settings.appointmentDurationMinutes,
      bufferMinutes: settings.bufferMinutes,
      minimumNoticeMinutes: settings.minimumNoticeMinutes,
      maximumDaysAhead: settings.maximumDaysAhead,
      availability: settings.availability as Prisma.InputJsonValue,
      eventTitle: settings.eventTitle,
      eventDescription: settings.eventDescription,
      isPublic: settings.isPublic
    }
  });
  return bookingSettingsFromRecord(record);
}

async function availabilityForProfile(profile: NonNullable<Awaited<ReturnType<typeof getPublicBookingProfile>>>, date: string) {
  const { settings } = profile;
  const today = localParts(new Date(), settings.timezone).date;
  const dayOffset = daysBetween(today, date);
  if (dayOffset < 0 || dayOffset > settings.maximumDaysAhead) {
    throw new BookingAvailabilityError("Choose a date within the booking window.", "outside_window");
  }

  const { start: rangeStart, end: rangeEnd } = dateRangeForBookingDay(date);
  const parsedDate = parseDateString(date);
  if (!parsedDate) throw new BookingAvailabilityError("Choose a valid booking date.", "invalid_date");
  const weekday = weekdayKeys[(new Date(Date.UTC(parsedDate.year, parsedDate.month - 1, parsedDate.day)).getUTCDay() + 6) % 7];
  const windows = settings.availability[weekday] ?? [];
  if (!windows.length) return [];

  const [appointments, connection] = await Promise.all([
    prisma.bookingAppointment.findMany({
      where: {
        organizationId: profile.organizationId,
        status: "confirmed",
        startsAt: { lt: rangeEnd },
        endsAt: { gt: rangeStart }
      },
      select: { startsAt: true, endsAt: true }
    }),
    prisma.googleCalendarConnection.findUnique({
      where: { organizationId: profile.organizationId },
      select: { organizationId: true, calendarId: true, encryptedRefreshToken: true }
    })
  ]);

  let googleBusy: Array<{ start: Date; end: Date }> = [];
  if (connection) {
    try {
      googleBusy = (await getGoogleCalendarBusyTimes(connection, { timeMin: rangeStart, timeMax: rangeEnd }))
        .map((busy) => ({ start: new Date(busy.start), end: new Date(busy.end) }))
        .filter((busy) => !Number.isNaN(busy.start.getTime()) && !Number.isNaN(busy.end.getTime()));
    } catch {
      throw new BookingAvailabilityError("Google Calendar is temporarily unavailable. Please try again shortly.", "calendar_unavailable");
    }
  }

  const occupied = [
    ...appointments.map((appointment) => ({ start: appointment.startsAt, end: appointment.endsAt })),
    ...googleBusy
  ];
  const durationMs = settings.appointmentDurationMinutes * 60 * 1000;
  const noticeCutoff = Date.now() + settings.minimumNoticeMinutes * 60 * 1000;
  const slots: Array<{ startsAt: string; endsAt: string; label: string }> = [];
  const seenLocalTimes = new Set<number>();

  for (let cursor = rangeStart.getTime(); cursor < rangeEnd.getTime(); cursor += 5 * 60 * 1000) {
    const startsAt = new Date(cursor);
    const parts = localParts(startsAt, settings.timezone);
    if (parts.date !== date || seenLocalTimes.has(parts.minutes)) continue;
    const matchingWindow = windows.find((window) => {
      const start = timeToMinutes(window.start) ?? 0;
      const end = timeToMinutes(window.end) ?? 0;
      const increment = settings.appointmentDurationMinutes + settings.bufferMinutes;
      return parts.minutes >= start
        && parts.minutes + settings.appointmentDurationMinutes <= end
        && (parts.minutes - start) % increment === 0;
    });
    if (!matchingWindow || startsAt.getTime() < noticeCutoff) continue;
    const endsAt = new Date(cursor + durationMs);
    if (occupied.some((interval) => intervalOverlaps(startsAt, endsAt, interval))) continue;
    seenLocalTimes.add(parts.minutes);
    slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), label: displayTime(startsAt, settings.timezone) });
  }
  return slots;
}

export async function getPublicBookingAvailability(slug: string, date: string) {
  const profile = await getPublicBookingProfile(slug);
  if (!profile) throw new BookingAvailabilityError("This booking page is not available.", "not_found");
  return { profile, slots: await availabilityForProfile(profile, date) };
}

function bookingText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function createPublicBooking(slug: string, input: Record<string, unknown>) {
  const profile = await getPublicBookingProfile(slug);
  if (!profile) throw new BookingAvailabilityError("This booking page is not available.", "not_found");
  const name = bookingText(input.name, 120);
  const email = bookingText(input.email, 254).toLowerCase();
  const companyName = bookingText(input.companyName, 160) || null;
  const phone = bookingText(input.phone, 60) || null;
  const notes = bookingText(input.notes, 1500) || null;
  const startsAtValue = bookingText(input.startsAt, 64);
  if (name.length < 2) throw new BookingAvailabilityError("Enter your name to continue.", "invalid_booking");
  if (!emailPattern.test(email)) throw new BookingAvailabilityError("Enter a valid email address.", "invalid_booking");
  const startsAt = new Date(startsAtValue);
  if (Number.isNaN(startsAt.getTime())) throw new BookingAvailabilityError("Choose an available time slot.", "invalid_booking");
  const localDate = localParts(startsAt, profile.settings.timezone).date;
  const slots = await availabilityForProfile(profile, localDate);
  const selectedSlot = slots.find((slot) => slot.startsAt === startsAt.toISOString());
  if (!selectedSlot) throw new BookingAvailabilityError("That time is no longer available. Please choose another slot.", "slot_unavailable");
  const endsAt = new Date(selectedSlot.endsAt);

  let appointment;
  try {
    appointment = await prisma.$transaction(async (transaction) => {
      const conflict = await transaction.bookingAppointment.findFirst({
        where: {
          organizationId: profile.organizationId,
          status: "confirmed",
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt }
        },
        select: { id: true }
      });
      if (conflict) throw new BookingAvailabilityError("That time was just booked. Please choose another slot.", "slot_unavailable");
      const settings = await transaction.bookingSettings.findUnique({ where: { organizationId: profile.organizationId }, select: { id: true } });
      return transaction.bookingAppointment.create({
        data: {
          organizationId: profile.organizationId,
          bookingSettingsId: settings?.id,
          name,
          email,
          companyName,
          phone,
          notes,
          startsAt,
          endsAt,
          timezone: profile.settings.timezone,
          status: "confirmed",
          source: "public_booking",
          calendarSyncStatus: "not_connected",
          bookingToken: crypto.randomBytes(24).toString("base64url")
        }
      });
    });
  } catch (error) {
    if (error instanceof BookingAvailabilityError) throw error;
    if ((error as { code?: string }).code === "P2002") throw new BookingAvailabilityError("That time was just booked. Please choose another slot.", "slot_unavailable");
    throw error;
  }

  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { organizationId: profile.organizationId },
    select: { organizationId: true, calendarId: true, encryptedRefreshToken: true }
  });
  let syncStatus = "not_connected";
  if (connection) {
    try {
      const googleEventId = await createGoogleCalendarEvent({
        connection,
        appointment,
        eventTitle: profile.settings.eventTitle,
        eventDescription: profile.settings.eventDescription
      });
      syncStatus = "synced";
      appointment = await prisma.bookingAppointment.update({
        where: { id: appointment.id },
        data: { googleEventId, calendarSyncStatus: syncStatus }
      });
    } catch {
      syncStatus = "needs_attention";
      appointment = await prisma.bookingAppointment.update({
        where: { id: appointment.id },
        data: { calendarSyncStatus: syncStatus }
      });
    }
  }

  await createAppNotification({
    organizationId: profile.organizationId,
    type: "booking_created",
    title: `New booking: ${name}`,
    message: `${companyName || email} booked ${displayTime(startsAt, profile.settings.timezone)} on ${localDate}.`,
    actionUrl: "/booking"
  }).catch(() => undefined);

  return {
    appointment: serializeAppointment(appointment),
    organizationName: profile.organizationName,
    calendarSynced: syncStatus === "synced"
  };
}

export async function cancelBookingAppointment(organizationId: string, appointmentId: string) {
  const appointment = await prisma.bookingAppointment.findFirst({
    where: { id: appointmentId, organizationId },
    select: { id: true, name: true, companyName: true, startsAt: true, timezone: true, status: true, googleEventId: true }
  });
  if (!appointment) throw new Error("Booking was not found.");
  if (appointment.status === "cancelled") return { alreadyCancelled: true };
  const connection = appointment.googleEventId
    ? await prisma.googleCalendarConnection.findUnique({ where: { organizationId }, select: { organizationId: true, calendarId: true, encryptedRefreshToken: true } })
    : null;
  if (appointment.googleEventId && connection) {
    await deleteGoogleCalendarEvent(connection, appointment.googleEventId);
  }
  const calendarSyncStatus = appointment.googleEventId && !connection ? "needs_attention" : appointment.googleEventId ? "cancelled" : "not_connected";
  await prisma.bookingAppointment.update({
    where: { id: appointment.id },
    data: { status: "cancelled", calendarSyncStatus }
  });
  await createAppNotification({
    organizationId,
    type: "booking_cancelled",
    title: `Booking cancelled: ${appointment.name}`,
    message: `${appointment.companyName || "Visitor"} booking at ${displayTime(appointment.startsAt, appointment.timezone)} was cancelled.`,
    actionUrl: "/booking"
  }).catch(() => undefined);
  return { alreadyCancelled: false, calendarSyncStatus };
}
