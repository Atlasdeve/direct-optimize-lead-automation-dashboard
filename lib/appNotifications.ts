import { prisma } from "@/lib/prisma";
import { sendPushForNotification } from "@/lib/pushNotifications";

export async function createAppNotification(input: {
  type: string;
  title: string;
  message: string;
  actionUrl?: string;
  leadId?: string;
  recipientUserId?: string;
}) {
  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      title: input.title.slice(0, 180),
      message: input.message.slice(0, 500),
      actionUrl: input.actionUrl,
      leadId: input.leadId,
      recipientUserId: input.recipientUserId
    }
  });
  await sendPushForNotification(notification).catch(() => undefined);
  return notification;
}
