"use client";

import { useEffect, useState } from "react";
import { apiPost } from "@/lib/api-client";

type Status = "idle" | "unsupported" | "subscribed" | "working" | "error";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Back the array with a concrete ArrayBuffer so it satisfies BufferSource.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export default function PushSubscribe() {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let cancelled = false;
    // Browser-only feature detection + existing-subscription check. Kept inside
    // an async helper so state updates land in callbacks, not the effect body.
    async function detect() {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
      if (!supported) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub && !cancelled) setStatus("subscribed");
      } catch {
        // ignore — leave status as idle
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    setStatus("working");
    try {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) throw new Error("Missing VAPID public key");

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("error");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });

      await apiPost("/api/push/subscribe", sub.toJSON());
      setStatus("subscribed");
    } catch (err) {
      console.error("push subscribe failed", err);
      setStatus("error");
    }
  }

  if (status === "unsupported") return null;

  const label =
    status === "subscribed"
      ? "Reminders on"
      : status === "working"
        ? "Enabling…"
        : status === "error"
          ? "Retry reminders"
          : "Enable reminders";

  return (
    <button
      type="button"
      onClick={subscribe}
      disabled={status === "working" || status === "subscribed"}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
        status === "subscribed"
          ? "border-ok/40 text-ok"
          : "border-border text-muted active:scale-95"
      }`}
    >
      <BellIcon />
      {label}
    </button>
  );
}

function BellIcon() {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
