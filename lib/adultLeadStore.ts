import { load } from "cheerio";
import { prisma } from "@/lib/prisma";
import { adultLeadCategory, type AdultLeadCategoryId } from "@/lib/adultLeadCategories";
import { prohibitedLeadTerm } from "@/lib/restrictedLeadPolicy";
import { fetchPlacesLeads } from "@/lib/providers";

const defaultAdultLeadCountries = ["Nigeria", "Thailand", "Vietnam", "Indonesia"];

type GoogleSearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
};

export type AdultLeadRecord = {
  id: string;
  businessName: string;
  country: string;
  city: string | null;
  category: string;
  website: string;
  email: string | null;
  phone: string | null;
  sourceTitle: string | null;
  sourceSnippet: string | null;
  sourceQuery: string | null;
  reviewStatus: string;
  outreachStatus: string;
  outreachApproved: boolean;
  outreachApprovedAt: string | null;
  emailSent: boolean;
  emailOpened: boolean;
  emailClicked: boolean;
  lastContactedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function toRecord(lead: {
  id: string;
  businessName: string;
  country: string;
  city: string | null;
  category: string;
  website: string;
  email: string | null;
  phone: string | null;
  sourceTitle: string | null;
  sourceSnippet: string | null;
  sourceQuery: string | null;
  reviewStatus: string;
  outreachStatus: string;
  outreachApproved: boolean;
  outreachApprovedAt: Date | null;
  emailSent: boolean;
  emailOpened: boolean;
  emailClicked: boolean;
  lastContactedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AdultLeadRecord {
  return {
    ...lead,
    outreachApprovedAt: lead.outreachApprovedAt?.toISOString() ?? null,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString()
  };
}

function websiteOrigin(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const socialHosts = ["instagram.com", "facebook.com", "tiktok.com", "linktr.ee"];
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if (socialHosts.includes(hostname)) {
      const pathname = url.pathname.replace(/\/+$/, "");
      return `https://${hostname}${pathname || "/"}`;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function businessName(title: string, hostname: string) {
  const firstSegment = title.split(/\s+[|–—-]\s+/)[0]?.trim();
  return (firstSegment || hostname.replace(/^www\./, "").split(".")[0] || "Website lead").slice(0, 200);
}

function firstEmail(value: string) {
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return matches.find((email) => !/\.(png|jpg|jpeg|gif|webp)$/i.test(email))?.toLowerCase().slice(0, 320) ?? null;
}

function firstPhone(value: string) {
  const matches = value.match(/(?:\+\d{1,3}[\s().-]*)?(?:\d[\s().-]*){7,14}\d/g) ?? [];
  return matches.map((phone) => phone.trim()).find((phone) => phone.replace(/\D/g, "").length >= 8)?.slice(0, 50) ?? null;
}

async function inspectPublicWebsite(website: string) {
  try {
    const response = await fetch(website, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DirectOptimizeLeadResearch/1.0)",
        Accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
      return { email: null, phone: null, text: "" };
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const html = new TextDecoder().decode(bytes.slice(0, 750_000));
    const $ = load(html);
    $("script, style, noscript, svg").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 40_000);
    const mailto = $('a[href^="mailto:"]').first().attr("href")?.replace(/^mailto:/i, "").split("?")[0] ?? "";
    const tel = $('a[href^="tel:"]').first().attr("href")?.replace(/^tel:/i, "") ?? "";
    return {
      email: firstEmail(mailto) || firstEmail(text),
      phone: firstPhone(tel) || firstPhone(text),
      text
    };
  } catch {
    return { email: null, phone: null, text: "" };
  }
}

export async function listAdultLeads(filters: { country?: string; category?: string; status?: string } = {}) {
  const leads = await prisma.adultLead.findMany({
    where: {
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.status ? { reviewStatus: filters.status } : {})
    },
    orderBy: [{ createdAt: "desc" }]
  });
  return leads.map(toRecord);
}

export async function listAdultLeadCountries() {
  await Promise.all(defaultAdultLeadCountries.map((name) => prisma.adultLeadCountry.upsert({
    where: { name },
    update: {},
    create: { name }
  })));
  const countries = await prisma.adultLeadCountry.findMany({
    orderBy: { createdAt: "asc" },
    select: { name: true }
  });
  const defaultOrder = new Map(defaultAdultLeadCountries.map((name, index) => [name, index]));
  return countries
    .sort((left, right) => {
      const leftIndex = defaultOrder.get(left.name) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = defaultOrder.get(right.name) ?? Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex;
    })
    .map((country) => country.name);
}

export async function createAdultLeadCountry(value: string) {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) throw new Error("Country name should be 2-80 characters.");
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(name)) throw new Error("Enter a valid country name.");

  const existing = await prisma.adultLeadCountry.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { name: true }
  });
  if (existing) return existing.name;

  const country = await prisma.adultLeadCountry.create({
    data: { name },
    select: { name: true }
  });
  return country.name;
}

async function discoverWithGooglePlaces(input: {
  country: string;
  city?: string | null;
  categoryId: AdultLeadCategoryId;
  limit: number;
}, searchError: string) {
  const category = adultLeadCategory(input.categoryId);
  if (!category) throw new Error("Select a supported category.");
  const result = await fetchPlacesLeads(input.country, {
    city: input.city?.trim() || undefined,
    categories: [category.placesQuery],
    maxResults: input.limit
  });
  const candidates = result.records
    .filter((record) => record.website)
    .slice(0, input.limit);
  const existing = new Set((await prisma.adultLead.findMany({
    where: { website: { in: candidates.map((candidate) => websiteOrigin(candidate.website ?? "")).filter((website): website is string => Boolean(website)) } },
    select: { website: true }
  })).map((lead) => lead.website));

  let created = 0;
  let processed = 0;
  let blocked = 0;
  const inspectedCandidates = await Promise.all(candidates.map(async (candidate) => {
    const website = websiteOrigin(candidate.website ?? "");
    return {
      candidate,
      website,
      contact: website ? await inspectPublicWebsite(website) : { email: null, phone: null, text: "" }
    };
  }));
  for (const { candidate, website, contact } of inspectedCandidates) {
    if (!website || prohibitedLeadTerm(candidate.companyName, candidate.category, website)) {
      blocked += 1;
      continue;
    }
    if (prohibitedLeadTerm(candidate.companyName, candidate.category, contact.text, website)) {
      blocked += 1;
      continue;
    }
    processed += 1;
    await prisma.adultLead.upsert({
      where: { website },
      update: {
        businessName: candidate.companyName,
        city: candidate.city || input.city?.trim() || null,
        sourceTitle: candidate.companyName,
        sourceSnippet: "Google Places fallback result.",
        sourceQuery: candidate.sourceQuery,
        email: contact.email,
        phone: contact.phone || candidate.phone || null
      },
      create: {
        businessName: candidate.companyName,
        country: input.country.trim(),
        city: candidate.city || input.city?.trim() || null,
        category: category.id,
        website,
        email: contact.email,
        phone: contact.phone || candidate.phone || null,
        sourceTitle: candidate.companyName,
        sourceSnippet: "Google Places fallback result.",
        sourceQuery: candidate.sourceQuery
      }
    });
    if (!existing.has(website)) created += 1;
  }

  return {
    created,
    updated: processed - created,
    blocked,
    provider: result.provider,
    warning: `Custom Search was unavailable (${searchError}). Google Places was used instead.`,
    leads: await listAdultLeads({ country: input.country.trim() })
  };
}

export async function discoverAdultLeads(input: {
  country: string;
  city?: string | null;
  categoryId: AdultLeadCategoryId;
  limit: number;
}) {
  const category = adultLeadCategory(input.categoryId);
  if (!category) throw new Error("Select a supported category.");
  if (!process.env.GOOGLE_SEARCH_API_KEY || !process.env.GOOGLE_SEARCH_CX) {
    throw new Error("Google Custom Search is not configured.");
  }

  const place = [input.city?.trim(), input.country.trim()].filter(Boolean).join(", ");
  const query = `${category.query} "${place}" -escort -escorts -brothel -prostitute -"call girl"`;
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", process.env.GOOGLE_SEARCH_API_KEY);
  url.searchParams.set("cx", process.env.GOOGLE_SEARCH_CX);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(Math.max(input.limit, 1), 10)));

  const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  const payload = await response.json().catch(() => ({})) as { items?: GoogleSearchItem[]; error?: { message?: string } };
  if (!response.ok) {
    const searchError = payload.error?.message || "Google Search request failed.";
    if (process.env.GOOGLE_PLACES_API_KEY) return discoverWithGooglePlaces(input, searchError);
    throw new Error(searchError);
  }

  const candidates = (payload.items ?? [])
    .map((item) => {
      const website = item.link ? websiteOrigin(item.link) : null;
      if (!website) return null;
      const hostname = new URL(website).hostname;
      const title = item.title?.trim() || hostname;
      if (prohibitedLeadTerm(title, item.snippet, website)) return null;
      return { website, hostname, title, snippet: item.snippet?.trim().slice(0, 1000) || null };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.website, candidate])).values()];
  const existing = new Set((await prisma.adultLead.findMany({
    where: { website: { in: uniqueCandidates.map((candidate) => candidate.website) } },
    select: { website: true }
  })).map((lead) => lead.website));

  let created = 0;
  let processed = 0;
  let blocked = (payload.items?.length ?? 0) - uniqueCandidates.length;
  const inspectedCandidates = await Promise.all(uniqueCandidates.map(async (candidate) => ({
    candidate,
    contact: await inspectPublicWebsite(candidate.website)
  })));
  for (const { candidate, contact } of inspectedCandidates) {
    if (prohibitedLeadTerm(candidate.title, candidate.snippet, contact.text, candidate.website)) {
      blocked += 1;
      continue;
    }
    processed += 1;
    await prisma.adultLead.upsert({
      where: { website: candidate.website },
      update: {
        sourceTitle: candidate.title,
        sourceSnippet: candidate.snippet,
        sourceQuery: query,
        email: contact.email,
        phone: contact.phone,
        city: input.city?.trim() || null
      },
      create: {
        businessName: businessName(candidate.title, candidate.hostname),
        country: input.country.trim(),
        city: input.city?.trim() || null,
        category: category.id,
        website: candidate.website,
        email: contact.email,
        phone: contact.phone,
        sourceTitle: candidate.title,
        sourceSnippet: candidate.snippet,
        sourceQuery: query
      }
    });
    if (!existing.has(candidate.website)) created += 1;
  }

  return {
    created,
    updated: processed - created,
    blocked,
    provider: "google_custom_search",
    warning: null,
    leads: await listAdultLeads({ country: input.country.trim() })
  };
}

export async function updateAdultLead(id: string, input: {
  businessName?: string;
  country?: string;
  city?: string | null;
  category?: AdultLeadCategoryId;
  website?: string;
  email?: string | null;
  phone?: string | null;
  reviewStatus?: string;
  notes?: string | null;
}) {
  const reviewStatus = input.reviewStatus && ["Unverified", "Reviewed", "Rejected"].includes(input.reviewStatus)
    ? input.reviewStatus
    : undefined;
  if (input.category && !adultLeadCategory(input.category)) throw new Error("Select a supported category.");
  if (prohibitedLeadTerm(input.businessName, input.website, input.notes)) {
    throw new Error("This lead cannot be stored in the Adult Leads workspace.");
  }
  if (input.country) {
    await createAdultLeadCountry(input.country);
  }

  try {
    return toRecord(await prisma.adultLead.update({
      where: { id },
      data: {
        ...(input.businessName !== undefined ? { businessName: input.businessName.trim().slice(0, 200) } : {}),
        ...(input.country !== undefined ? { country: input.country.trim().slice(0, 80) } : {}),
        ...(input.city !== undefined ? { city: input.city?.trim().slice(0, 120) || null } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.email !== undefined ? { email: input.email?.trim().toLowerCase().slice(0, 320) || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim().slice(0, 50) || null } : {}),
        ...(reviewStatus ? { reviewStatus } : {}),
        ...(reviewStatus && reviewStatus !== "Reviewed" ? {
          outreachApproved: false,
          outreachApprovedAt: null,
          outreachStatus: "New"
        } : {}),
        ...(input.email === null ? {
          outreachApproved: false,
          outreachApprovedAt: null,
          outreachStatus: "New"
        } : {}),
        ...(input.notes !== undefined ? { notes: input.notes?.trim().slice(0, 2000) || null } : {})
      }
    }));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new Error("Another Adult Lead already uses this website.");
    }
    throw error;
  }
}

export async function approveAdultLeadForOutreach(id: string) {
  const lead = await prisma.adultLead.findUnique({ where: { id } });
  if (!lead) throw new Error("Adult Lead was not found.");
  if (!lead.email) throw new Error("Add a valid email address before approving outreach.");
  if (lead.emailSent) throw new Error("Email outreach has already been sent.");
  return toRecord(await prisma.adultLead.update({
    where: { id },
    data: {
      reviewStatus: "Reviewed",
      outreachApproved: true,
      outreachApprovedAt: new Date(),
      outreachStatus: "Approved"
    }
  }));
}

export async function cancelAdultLeadOutreachApproval(id: string) {
  const lead = await prisma.adultLead.findUnique({ where: { id } });
  if (!lead) throw new Error("Adult Lead was not found.");
  if (lead.emailSent) throw new Error("A sent email cannot be returned to the approval queue.");
  return toRecord(await prisma.adultLead.update({
    where: { id },
    data: {
      outreachApproved: false,
      outreachApprovedAt: null,
      outreachStatus: "New"
    }
  }));
}

export async function deleteAdultLead(id: string) {
  await prisma.adultLead.delete({ where: { id } });
}
