export const emailTemplates = [
  { id: "seo", name: "SEO services", subject: "Quick local SEO wins for {{company_name}}", category: "SEO", active: true },
  { id: "web", name: "Website redesign", subject: "{{company_name}} website opportunity", category: "Website", active: true },
  { id: "gmb", name: "Google Business Profile optimization", subject: "GBP improvement ideas for {{company_name}}", category: "GBP", active: true },
  { id: "ads", name: "Local ads", subject: "More local enquiries for {{company_name}}", category: "Ads", active: true },
  { id: "marketing", name: "Digital marketing", subject: "Growth channels for {{company_name}}", category: "Marketing", active: true },
  { id: "software", name: "Software automation", subject: "Automation idea for {{company_name}}", category: "Software", active: true }
];

export const whatsappIdentificationRules = [
  { id: "phone_present", name: "Phone number present", active: true, description: "Show WhatsApp contact option when a lead has a usable phone number." },
  { id: "manual_review", name: "Manual verification", active: true, description: "Treat WhatsApp availability as a lead-review signal, not an automated send permission." }
];

export function providerSettings() {
  return {
    rateLimits: { dailyEmailCap: 150 },
    providers: {
      googlePlaces: Boolean(process.env.GOOGLE_PLACES_API_KEY),
      googleSearch: Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX),
      hunter: Boolean(process.env.HUNTER_API_KEY),
      builtWith: Boolean(process.env.BUILTWITH_API_KEY),
      email: Boolean(process.env.SMTP_HOST || process.env.GMAIL_CLIENT_ID),
      whatsappIdentification: true,
      openai: Boolean(process.env.OPENAI_API_KEY)
    },
    compliance: {
      unsubscribeRequired: true,
      consentFieldsEnabled: true,
      noLinkedinScraping: true,
      whatsappSendingDisabled: true
    }
  };
}
