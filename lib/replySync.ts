import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { createAppNotification } from "@/lib/appNotifications";
import { toLead } from "@/lib/dbStore";
import { draftAiReply } from "@/lib/providers";
import { classifyReply } from "@/lib/replyClassifier";

const DEFAULT_LOOKBACK_DAYS = 14;

function imapConfigured() {
  return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS);
}

function createImapClient() {
  const port = Number(process.env.IMAP_PORT || 993);
  return new ImapFlow({
    host: process.env.IMAP_HOST ?? "",
    port,
    secure: port === 993,
    auth: {
      user: process.env.IMAP_USER ?? "",
      pass: process.env.IMAP_PASS ?? ""
    },
    logger: false
  });
}

function normalizeEmail(email?: string | false) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

async function closeClient(client: ImapFlow) {
  try {
    client.close();
  } catch {
    // Ignore cleanup failures after a connection error.
  }
}

export async function verifyImapConnection() {
  if (!imapConfigured()) {
    return { ok: false, reason: "IMAP_HOST, IMAP_USER, or IMAP_PASS is missing" };
  }
  const client = createImapClient();
  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });
    await client.logout();
    return { ok: true, reason: "IMAP connection verified" };
  } catch (error) {
    await closeClient(client);
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "IMAP verification failed"
    };
  }
}

export async function syncInboxReplies() {
  if (!imapConfigured()) {
    return {
      ok: false,
      scanned: 0,
      matched: 0,
      stored: 0,
      drafted: 0,
      reason: "IMAP is not configured"
    };
  }

  const client = createImapClient();
  let scanned = 0;
  let matched = 0;
  let stored = 0;
  let drafted = 0;

  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });

    const since = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const uids = await client.search({ since });
    if (!uids || uids.length === 0) {
      await client.logout();
      return { ok: true, scanned, matched, stored, drafted, reason: "Inbox sync complete" };
    }

    for await (const message of client.fetch(uids, {
      uid: true,
      envelope: true,
      internalDate: true,
      source: true
    })) {
      scanned += 1;
      const fromAddress = normalizeEmail(message.envelope?.from?.[0]?.address);
      if (!fromAddress) continue;

      const lead = await prisma.lead.findFirst({
        where: {
          email: {
            equals: fromAddress,
            mode: "insensitive"
          }
        }
      });
      if (!lead) continue;
      matched += 1;

      const providerId = `imap:${message.uid}`;
      const existing = await prisma.inboxReply.findFirst({ where: { providerId } });
      if (existing) continue;

      const parsed = message.source ? await simpleParser(message.source) : null;
      const body = (parsed?.text || parsed?.html || "").toString().trim();
      const reply = await prisma.inboxReply.create({
        data: {
          leadId: lead.id,
          fromEmail: fromAddress,
          subject: parsed?.subject ?? message.envelope?.subject ?? null,
          body: body.slice(0, 20000),
          providerId,
          receivedAt: message.internalDate ?? new Date()
        }
      });
      stored += 1;
      const classification = classifyReply(reply.subject ?? "", body);

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          replied: true,
          outreachStatus: classification === "bounce" ? "Failed" : "Replied",
          unsubscribed: classification === "unsubscribe" ? true : undefined,
          doNotContact: classification === "unsubscribe" || classification === "bounce" ? true : undefined,
          nextFollowUpAt: null
        }
      });

      await createAppNotification({
        leadId: lead.id,
        type: "reply",
        title: "Email reply received",
        message: `${lead.companyName} replied from ${fromAddress}. Classification: ${classification.replaceAll("_", " ")}.`,
        actionUrl: `/leads/${lead.id}`
      });

      await prisma.outreachLog.create({
        data: {
          leadId: lead.id,
          channel: "email",
          action: "reply_classified",
          status: classification,
          message: `Reply classified as ${classification.replaceAll("_", " ")}.`
        }
      });

      try {
        const draft = await draftAiReply(toLead(lead), body);
        if (draft) {
          await prisma.aiReplyDraft.create({
            data: {
              leadId: lead.id,
              replyId: reply.id,
              draft,
              status: "needs_review"
            }
          });
          drafted += 1;
        }
      } catch (error) {
        await prisma.outreachLog.create({
          data: {
            leadId: lead.id,
            channel: "system",
            action: "ai_reply_draft",
            status: "failed",
            message: error instanceof Error ? `Reply stored, but AI drafting failed: ${error.message}` : "Reply stored, but AI drafting failed."
          }
        });
      }
    }

    await client.logout();
    return { ok: true, scanned, matched, stored, drafted, reason: "Inbox sync complete" };
  } catch (error) {
    await closeClient(client);
    return {
      ok: false,
      scanned,
      matched,
      stored,
      drafted,
      reason: error instanceof Error ? error.message : "Inbox sync failed"
    };
  }
}
