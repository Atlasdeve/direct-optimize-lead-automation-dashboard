"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import NotificationsIcon from "@mui/icons-material/Notifications";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CloseIcon from "@mui/icons-material/Close";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";

type LiveNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
};

function mergeNotifications(current: LiveNotification[], incoming: LiveNotification | LiveNotification[]) {
  const rows = Array.isArray(incoming) ? incoming : [incoming];
  const byId = new Map(current.map((item) => [item.id, item]));
  rows.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
}

export function AdminNotificationCenter({ userRole }: { userRole: string }) {
  const centerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(true);
  const [items, setItems] = useState<LiveNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<LiveNotification | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);

  function playNotificationSound() {
    const context = audioContextRef.current;
    if (!soundEnabledRef.current || !context || context.state !== "running") return;
    const startAt = context.currentTime;
    for (let index = 0; index < 3; index += 1) {
      const ringAt = startAt + index * 0.58;
      [880, 1320].forEach((frequency, toneIndex) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = toneIndex === 0 ? "triangle" : "sine";
        oscillator.frequency.setValueAtTime(frequency, ringAt);
        gain.gain.setValueAtTime(0.0001, ringAt);
        gain.gain.exponentialRampToValueAtTime(toneIndex === 0 ? 0.34 : 0.2, ringAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, ringAt + 0.3);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(ringAt);
        oscillator.stop(ringAt + 0.32);
      });
    }
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("admin-notification-sound");
    const enabled = stored !== "off";
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    async function unlockAudio() {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      audioContextRef.current ??= new AudioContextClass();
      if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    }
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
      void audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/notifications/stream");
    const onSnapshot = (event: MessageEvent) => {
      const notifications = JSON.parse(event.data) as LiveNotification[];
      setItems(notifications);
      setConnected(true);
    };
    const onNotification = (event: MessageEvent) => {
      const notification = JSON.parse(event.data) as LiveNotification;
      setItems((current) => mergeNotifications(current, notification));
      setToast(notification);
      playNotificationSound();
      window.dispatchEvent(new CustomEvent("admin-notification", { detail: notification }));
      window.dispatchEvent(new CustomEvent("portal-data-refresh", { detail: notification }));
    };
    source.addEventListener("snapshot", onSnapshot);
    source.addEventListener("notification", onNotification);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: PointerEvent) {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function markRead(id: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }

  async function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  }

  function toggleSound() {
    const enabled = !soundEnabledRef.current;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    window.localStorage.setItem("admin-notification-sound", enabled ? "on" : "off");
    if (enabled) playNotificationSound();
  }

  return <>
    <div ref={centerRef} className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <button type="button" onClick={() => setOpen((value) => !value)} title="Admin notifications" aria-expanded={open} className="relative ml-auto grid h-11 w-11 place-items-center rounded-lg border border-line bg-[#091629]/95 text-slate-100 shadow-xl backdrop-blur-xl hover:bg-[#10213a]">
        <NotificationsIcon fontSize="small" />
        {unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-400 px-1 text-[11px] font-bold text-slate-950">{unread > 99 ? "99+" : unread}</span>}
        <span className={`absolute bottom-1 right-1 h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />
      </button>
      {open && <div className="mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-[#071426]/98 shadow-2xl backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <div>
            <div className="font-semibold text-white">Live notifications</div>
            <div className="text-xs text-slate-500">{connected ? "Connected" : "Reconnecting..."}</div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={toggleSound} title={soundEnabled ? "Mute notification sounds" : "Enable notification sounds"} className="grid h-9 w-9 place-items-center rounded-lg text-sky-200 hover:bg-white/7">{soundEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}</button>
            <button type="button" onClick={markAllRead} disabled={unread === 0} title="Mark all as read" className="grid h-9 w-9 place-items-center rounded-lg text-sky-200 hover:bg-white/7 disabled:opacity-35"><DoneAllIcon fontSize="small" /></button>
          </div>
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {items.length === 0 && <div className="p-5 text-sm text-slate-400">No notifications yet.</div>}
          {items.map((item) => {
            const content = <div className="relative px-4 py-3">
              {!item.read && <span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-sky-400" />}
              <div className="text-sm font-medium text-white">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{item.message}</div>
              <div className="mt-1 text-[11px] text-slate-600">{new Date(item.createdAt).toLocaleString()}</div>
            </div>;
            return item.actionUrl?.startsWith("/") ? <Link key={item.id} href={item.actionUrl} onClick={() => { void markRead(item.id); setOpen(false); }} className="block border-b border-line/70 hover:bg-white/5">{content}</Link> : <button key={item.id} type="button" onClick={() => void markRead(item.id)} className="block w-full border-b border-line/70 text-left hover:bg-white/5">{content}</button>;
          })}
        </div>
      </div>}
    </div>
    {toast && <div className="fixed bottom-5 right-5 z-50 w-[min(23rem,calc(100vw-2.5rem))] rounded-lg border border-sky-300/30 bg-[#0b1d32] p-4 shadow-2xl">
      <button type="button" onClick={() => setToast(null)} title="Dismiss notification" className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/7"><CloseIcon fontSize="small" /></button>
      <div className="pr-8 text-sm font-semibold text-white">{toast.title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-300">{toast.message}</div>
    </div>}
  </>;
}
