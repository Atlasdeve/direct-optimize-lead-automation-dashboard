import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { aiDrafts, leads, replies } from "../lib/mockData";
import { regions } from "../lib/regions";
import { emailTemplates, providerSettings } from "../lib/templates";

const prisma = new PrismaClient();

async function main() {
  const initialAdminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialAdminPassword || initialAdminPassword.length < 12) {
    throw new Error("Set ADMIN_INITIAL_PASSWORD to at least 12 characters before seeding.");
  }
  await prisma.user.upsert({
    where: { email: "admin@directoptimize.local" },
    update: { username: "admin" },
    create: {
      email: "admin@directoptimize.local",
      username: "admin",
      name: "Direct Optimize Admin",
      passwordHash: await bcrypt.hash(initialAdminPassword, 12),
      role: "admin"
    }
  });

  for (const region of regions) {
    await prisma.region.upsert({
      where: { name: region.name },
      update: {
        country: region.country,
        timezone: region.timezone,
        enabled: true
      },
      create: {
        name: region.name,
        country: region.country,
        timezone: region.timezone,
        enabled: true
      }
    });
  }

  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        category: template.category,
        subject: template.subject,
        active: template.active
      },
      create: {
        id: template.id,
        name: template.name,
        category: template.category,
        subject: template.subject,
        body: "Hi {{manager_name}},\n\nI noticed an opportunity for {{company_name}} around {{category}} in {{region}}.\n\nTo opt out of future messages, reply with Unsubscribe.",
        active: template.active
      }
    });
  }

  for (const lead of leads) {
    await prisma.lead.upsert({
      where: { id: lead.id },
      update: {},
      create: {
        id: lead.id,
        companyName: lead.company_name,
        region: lead.region,
        country: lead.country,
        city: lead.city,
        category: lead.category,
        businessType: lead.business_type,
        website: lead.website,
        googleMapsUrl: lead.google_maps_url,
        phone: lead.phone,
        email: lead.email,
        whatsappAvailable: lead.whatsapp_available,
        whatsappStatus: lead.whatsapp_status,
        ownerName: lead.owner_name,
        ceoName: lead.ceo_name,
        managerName: lead.manager_name,
        linkedinUrl: lead.linkedin_url,
        sourcePlatform: lead.source_platform,
        leadScore: lead.lead_score,
        outreachStatus: lead.outreach_status,
        emailSent: lead.email_sent,
        whatsappSent: lead.whatsapp_sent,
        replied: lead.replied,
        lastContactedAt: lead.last_contacted_at ? new Date(lead.last_contacted_at) : null,
        nextFollowUpAt: lead.next_follow_up_at ? new Date(lead.next_follow_up_at) : null,
        notes: lead.notes,
        rating: lead.rating,
        reviewCount: lead.review_count,
        missingSeoMetadata: lead.missing_seo_metadata ?? false,
        unsubscribed: lead.unsubscribed,
        consentStatus: lead.consent_status
      }
    });
  }

  for (const reply of replies) {
    await prisma.inboxReply.upsert({
      where: { id: reply.id },
      update: {},
      create: {
        id: reply.id,
        leadId: reply.lead_id,
        fromEmail: reply.from_email,
        subject: reply.subject,
        body: reply.body,
        receivedAt: new Date(reply.received_at)
      }
    });
  }

  for (const draft of aiDrafts) {
    await prisma.aiReplyDraft.upsert({
      where: { id: draft.id },
      update: {},
      create: {
        id: draft.id,
        leadId: draft.lead_id,
        draft: draft.draft,
        status: draft.status
      }
    });
  }

  await prisma.setting.upsert({
    where: { key: "provider_settings" },
    update: { value: providerSettings() },
    create: { key: "provider_settings", value: providerSettings() }
  });

  await prisma.notification.createMany({
    data: [
      {
        type: "automation",
        title: "Local infrastructure ready",
        message: "Postgres, Redis, Prisma migrations, and seed data are configured."
      },
      {
        type: "lead",
        title: "Seed leads imported",
        message: "Initial regional demo leads are stored in PostgreSQL."
      }
    ],
    skipDuplicates: true
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed complete.");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
