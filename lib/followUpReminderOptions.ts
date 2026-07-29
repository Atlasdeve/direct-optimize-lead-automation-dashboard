export const followUpReminderOptions = [
  { value: "1_day", label: "1 day", days: 1 },
  { value: "2_days", label: "2 days", days: 2 },
  { value: "3_days", label: "3 days", days: 3 },
  { value: "4_days", label: "4 days", days: 4 },
  { value: "5_days", label: "5 days", days: 5 },
  { value: "6_days", label: "6 days", days: 6 },
  { value: "7_days", label: "7 days", days: 7 },
  { value: "2_weeks", label: "2 weeks", days: 14 },
  { value: "3_weeks", label: "3 weeks", days: 21 },
  { value: "1_month", label: "1 month", days: 30 },
  { value: "1_5_months", label: "1.5 months", days: 45 },
  { value: "2_months", label: "2 months", days: 60 },
  { value: "3_months", label: "3 months", days: 90 }
] as const;

export type FollowUpReminderPreset = (typeof followUpReminderOptions)[number]["value"];

export type FollowUpReminderRecord = {
  id: string;
  leadId: string | null;
  adultLeadId: string | null;
  leadType: "lead" | "adult_lead";
  leadName: string;
  country: string;
  preset: FollowUpReminderPreset;
  presetLabel: string;
  note: string | null;
  dueAt: string;
  status: string;
  notifiedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  actionUrl: string;
};
