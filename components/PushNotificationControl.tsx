"use client";

import { useEffect, useState } from "react";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";

function decodePublicKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function platformName() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "web";
}

export function PushNotificationControl({ compact = false }: { compact?: boolean }) {
  const [supported, setSupported] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const available = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(available);
    if (!available) return;
    void (async () => {
      const response = await fetch("/api/push/config", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      setConfigured(Boolean(data.configured));
      setPublicKey(data.publicKey || "");
      const registration = await navigator.serviceWorker.ready;
      setSubscribed(Boolean(await registration.pushManager.getSubscription()));
    })().catch(() => setMessage("Push status is temporarily unavailable."));
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted.");
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodePublicKey(publicKey)
      });
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...subscription.toJSON(), platform: platformName() })
      });
      if (!response.ok) throw new Error("This device could not be registered.");
      setSubscribed(true);
      setMessage("Mobile notifications enabled.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifications could not be enabled.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage("Mobile notifications disabled.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported || !configured) return compact ? null : (
    <div className="rounded-lg bg-white/5 p-3 text-xs text-slate-400 soft-border">
      {!supported ? "Push notifications are not supported in this browser." : "Mobile push is awaiting server configuration."}
    </div>
  );

  return (
    <div className={compact ? "" : "rounded-lg bg-sky-400/8 p-3 soft-border"}>
      <button
        type="button"
        onClick={subscribed ? disable : enable}
        disabled={busy}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-400/12 px-3 text-sm font-semibold text-sky-100 transition soft-border hover:bg-sky-400/20 disabled:opacity-60"
      >
        {subscribed ? <NotificationsOffIcon fontSize="small" /> : <NotificationsActiveIcon fontSize="small" />}
        {busy ? "Please wait..." : subscribed ? "Disable mobile alerts" : "Enable mobile alerts"}
      </button>
      {!compact && message && <div aria-live="polite" className="mt-2 text-xs text-slate-300">{message}</div>}
    </div>
  );
}
