export type RegionKey = "Canada" | "USA" | "UK" | "UAE" | "Qatar" | "Custom";

export type Lead = {
  id: string;
  company_name: string;
  region: RegionKey | string;
  country: string;
  city: string;
  category: string;
  business_type: string;
  website?: string | null;
  google_maps_url?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp_available: boolean;
  whatsapp_status: "unknown" | "available" | "unavailable" | "delivered" | "failed";
  owner_name?: string | null;
  ceo_name?: string | null;
  manager_name?: string | null;
  linkedin_url?: string | null;
  source_platform: string;
  lead_score: number;
  outreach_status: "New" | "Contacted" | "Replied" | "Follow-up" | "Meeting Booked" | "Closed" | "Failed";
  outreach_approved: boolean;
  outreach_approved_at?: string | null;
  email_sent: boolean;
  whatsapp_sent: boolean;
  replied: boolean;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  notes?: string | null;
  rating?: number;
  review_count?: number;
  missing_seo_metadata?: boolean;
  contact_forms?: string[];
  do_not_contact: boolean;
  archived?: boolean;
  consent_status: string;
  unsubscribed: boolean;
  created_at: string;
  updated_at: string;
};

export type RegionConfig = {
  name: RegionKey;
  country: string;
  timezone: string;
  morningCron: string;
};

export type AutomationResult = {
  region: string;
  status: "completed" | "queued" | "failed";
  leadsFetched: number;
  emailsSent: number;
  whatsappSent: number;
  failedCount: number;
  logs: string[];
};

export type PlaceLeadCandidate = {
  placeId: string;
  companyName: string;
  region: string;
  country: string;
  city: string;
  category: string;
  businessType: string;
  website?: string | null;
  googleMapsUrl?: string | null;
  phone?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  businessStatus?: string | null;
  missingSeoMetadata?: boolean;
  websiteAuditFlags?: string[];
  qualificationReasons?: string[];
  qualificationScore?: number;
  sourceQuery: string;
};
