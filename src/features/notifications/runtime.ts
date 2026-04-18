import { checkAndNotify } from "../../db.ts";
import type { DueNotification } from "./engine.ts";

export const PERIODIC_SYNC_TAG = "reflection-notification-check";

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register: (tag: string, options: { minInterval: number }) => Promise<void>;
  };
};

export type BrowserCapabilities = {
  serviceWorkerSupported: boolean;
  notificationSupported: boolean;
  periodicSyncSupported: boolean;
  notificationPermission: NotificationPermission | "unsupported";
};

export function getBrowserCapabilities(): BrowserCapabilities {
  const serviceWorkerSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const notificationSupported = typeof window !== "undefined" && "Notification" in window;

  return {
    serviceWorkerSupported,
    notificationSupported,
    periodicSyncSupported: false,
    notificationPermission: notificationSupported ? Notification.permission : "unsupported",
  };
}

export async function getDetailedBrowserCapabilities(): Promise<BrowserCapabilities> {
  const base = getBrowserCapabilities();
  if (!base.serviceWorkerSupported) {
    return base;
  }

  const registration = await navigator.serviceWorker.ready;
  return {
    ...base,
    periodicSyncSupported: "periodicSync" in registration,
  };
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported" as const;
  }

  return Notification.requestPermission();
}

export async function registerPeriodicNotificationSync() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("service worker is not supported");
  }

  const registration = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
  if (!registration.periodicSync) {
    throw new Error("periodic sync is not supported");
  }

  await registration.periodicSync.register(PERIODIC_SYNC_TAG, {
    minInterval: 12 * 60 * 60 * 1000,
  });
}

async function showNotificationsWithServiceWorker(notifications: DueNotification[]) {
  const registration = await navigator.serviceWorker.ready;

  for (const notification of notifications) {
    await registration.showNotification(notification.title, {
      body: notification.body,
      tag: notification.slotId,
      data: {
        url:
          notification.channel === "review"
            ? `/themes/${encodeURIComponent(notification.themeId)}/review`
            : `/themes/${encodeURIComponent(notification.themeId)}`,
      },
    });
  }
}

export async function runNotificationCheckNow(now = Date.now()) {
  const result = await checkAndNotify(now);

  if (result.notifications.length > 0 && "Notification" in window && Notification.permission === "granted") {
    await showNotificationsWithServiceWorker(result.notifications);
  }

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "notification-check",
      now,
    });
  }

  return result;
}
