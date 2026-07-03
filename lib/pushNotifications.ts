import webpush from "web-push";
import type { Notification } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@directoptimize.com", publicKey, privateKey);
  return true;
}

export function pushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || "";
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export async function sendPushForNotification(notification: Notification) {
  if (!configureWebPush()) return { sent: 0, failed: 0 };
  const users = notification.recipientUserId
    ? [{ id: notification.recipientUserId }]
    : await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
  if (users.length === 0) return { sent: 0, failed: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: users.map((user) => user.id) }, enabled: true }
  });
  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,
    url: notification.actionUrl || "/",
    tag: notification.id
  });
  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      }, payload, { TTL: 60 * 60 * 12, urgency: "high" });
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
      }
    }
  }));
  return { sent, failed };
}
