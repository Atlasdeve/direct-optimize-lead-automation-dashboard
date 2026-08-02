export type LeadLastActivity = {
  at: string;
  label: string;
};

export type NotRespondedLeadRecord = {
  id: string;
  companyName: string;
  region: string;
  country: string;
  city: string;
  category: string;
  email: string | null;
  phone: string | null;
  outreachStatus: string;
  previousStatus: string;
  createdAt: string;
  lastActivityAt: string;
  lastActivityLabel: string;
  inactiveDays: number;
};
