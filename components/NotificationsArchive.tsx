"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import NotificationsIcon from "@mui/icons-material/Notifications";

export type ArchiveNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
};

function mergeNotifications(current: ArchiveNotification[], incoming: ArchiveNotification | ArchiveNotification[]) {
  const rows = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map(current.map((item) => [item.id, item]));
  rows.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function typeLabel(type: string) {
  return type.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function NotificationsArchive({ initialNotifications }: { initialNotifications: ArchiveNotification[] }) {
  const [items, setItems] = useState(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [connected, setConnected] = useState(false);
  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);
  const visibleItems = useMemo(() => items.filter((item) => {
    if (filter === "unread") return !item.read;
    if (filter === "read") return item.read;
    return true;
  }), [filter, items]);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    const onSnapshot = (event: MessageEvent) => {
      const notifications = JSON.parse(event.data) as ArchiveNotification[];
      setItems((current) => mergeNotifications(current, notifications));
      setConnected(true);
    };
    const onNotification = (event: MessageEvent) => {
      const notification = JSON.parse(event.data) as ArchiveNotification;
      setItems((current) => mergeNotifications(current, notification));
      window.dispatchEvent(new CustomEvent("portal-data-refresh", { detail: notification }));
    };
    source.addEventListener("snapshot", onSnapshot);
    source.addEventListener("notification", onNotification);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  async function markRead(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  }

  return (
    <div className="space-y-5">
      <section className="glass rounded-xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-sky-200">
              <NotificationsIcon fontSize="small" />
              {connected ? "Live notification history" : "Notification history"}
            </div>
            <h1 className="mt-2 text-3xl font-semibold text-white">All notifications</h1>
            <p className="mt-2 text-sm text-slate-400">Review new and previous notifications from your portal activity.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:min-w-80">
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-xs text-slate-400">Total</div>
              <div className="mt-1 text-2xl font-semibold text-white">{items.length}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-xs text-slate-400">Unread</div>
              <div className="mt-1 text-2xl font-semibold text-sky-200">{unread}</div>
            </div>
            <div className="rounded-lg bg-white/6 p-3 soft-border">
              <div className="text-xs text-slate-400">Status</div>
              <div className={connected ? "mt-2 text-sm font-semibold text-emerald-200" : "mt-2 text-sm font-semibold text-amber-200"}>{connected ? "Live" : "Offline"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="glass overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b border-line p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {(["all", "unread", "read"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={filter === item
                  ? "h-10 rounded-lg bg-sky-400 px-4 text-sm font-semibold capitalize text-slate-950"
                  : "h-10 rounded-lg bg-white/7 px-4 text-sm font-semibold capitalize text-slate-300 soft-border hover:bg-white/12"}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unread === 0}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white/8 px-4 text-sm font-semibold text-sky-100 soft-border hover:bg-white/12 disabled:opacity-40"
          >
            <DoneAllIcon fontSize="small" />
            Mark all read
          </button>
        </div>

        <div className="divide-y divide-line">
          {visibleItems.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-400">No notifications in this view.</div>
          )}
          {visibleItems.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 transition hover:bg-white/5 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!item.read && <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />}
                    <span className="rounded-md bg-white/7 px-2 py-1 text-xs font-semibold text-slate-300 soft-border">{typeLabel(item.type)}</span>
                    <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="mt-2 font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-400">{item.message}</div>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  {item.actionUrl?.startsWith("/") && (
                    <Link href={item.actionUrl} onClick={() => void markRead(item.id)} className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950 hover:bg-sky-300">
                      Open
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    disabled={item.read}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white/7 px-3 text-sm font-semibold text-slate-200 soft-border hover:bg-white/12 disabled:opacity-40"
                  >
                    <MarkEmailReadIcon fontSize="small" />
                    {item.read ? "Read" : "Mark read"}
                  </button>
                </div>
              </div>
          ))}
        </div>
      </section>
    </div>
  );
}
