import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listDbNotifications } from "@/lib/dbStore";
import { NotificationsArchive, type ArchiveNotification } from "@/components/NotificationsArchive";

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/notifications");
  const notifications = await listDbNotifications(user, { take: 250 });
  const initialNotifications: ArchiveNotification[] = notifications.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    message: item.message,
    actionUrl: item.actionUrl,
    read: item.read,
    createdAt: item.createdAt.toISOString()
  }));
  return <NotificationsArchive initialNotifications={initialNotifications} />;
}
