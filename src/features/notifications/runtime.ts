import { checkAndNotify } from "../../db.ts";
import type { DueNotification } from "./engine.ts";

export const PERIODIC_SYNC_TAG = "reflection-notification-check";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PeriodicSyncRegistration = ServiceWorkerRegistration & {
  periodicSync?: {
    register: (tag: string, options: { minInterval: number }) => Promise<void>;
    getTags?: () => Promise<string[]>;
  };
};

export type BrowserCapabilities = {
  serviceWorkerSupported: boolean;
  notificationSupported: boolean;
  periodicSyncSupported: boolean;
  notificationPermission: NotificationPermission | "unsupported";
};

export type PwaAvailabilityState = {
  hasInstallPrompt: boolean;
  isStandalone: boolean;
  periodicSyncRegistered: boolean;
  serviceWorkerControlled: boolean;
};

export type PwaAvailability = {
  canInstall: boolean;
  installStateLabel: "available" | "installed" | "unavailable";
  periodicSyncStateLabel: "registered" | "not-registered";
  serviceWorkerStateLabel: "controlled" | "waiting";
};

export type PwaRuntimeState = BrowserCapabilities &
  PwaAvailabilityState &
  PwaAvailability;

export type PwaOnboardingMessage = {
  severity: "info" | "warning";
  title: string;
  body: string;
};

let cachedInstallPromptEvent: BeforeInstallPromptEvent | null = null;
let hasRegisteredPwaListeners = false;
const pwaListeners = new Set<() => void>();

function emitPwaStateChange() {
  for (const listener of pwaListeners) {
    listener();
  }
}

function getStandaloneFlag() {
  if (typeof window === "undefined") {
    return false;
  }

  const standaloneViaMedia =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const standaloneViaNavigator =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return standaloneViaMedia || standaloneViaNavigator;
}

export function derivePwaAvailability(input: PwaAvailabilityState): PwaAvailability {
  const installStateLabel = input.isStandalone
    ? "installed"
    : input.hasInstallPrompt
      ? "available"
      : "unavailable";

  return {
    canInstall: !input.isStandalone && input.hasInstallPrompt,
    installStateLabel,
    periodicSyncStateLabel: input.periodicSyncRegistered ? "registered" : "not-registered",
    serviceWorkerStateLabel: input.serviceWorkerControlled ? "controlled" : "waiting",
  };
}

export function getPwaOnboardingMessage(state: PwaRuntimeState): PwaOnboardingMessage {
  if (
    !state.serviceWorkerSupported ||
    !state.notificationSupported ||
    !state.periodicSyncSupported
  ) {
    return {
      severity: "warning",
      title: "この環境ではバックグラウンド通知を利用できません",
      body:
        "Service Worker・Notification・Periodic Sync に対応した Chromium 系ブラウザで開いてください。",
    };
  }

  if (!state.isStandalone) {
    return {
      severity: "info",
      title: "最初にアプリとしてインストールしてください",
      body:
        "通知導線はインストール済み PWA をアプリ表示で起動している前提です。インストール後に権限許可と periodic sync 登録へ進んでください。",
    };
  }

  if (state.notificationPermission !== "granted") {
    return {
      severity: "info",
      title: "次に通知権限を許可してください",
      body:
        "アプリ表示で起動できたら、Notification 権限を許可してから periodic sync を登録してください。",
    };
  }

  if (!state.periodicSyncRegistered) {
    return {
      severity: "info",
      title: "periodic sync を登録して通知判定を有効化してください",
      body:
        "`reflection-notification-check` を登録すると、保存済みルールに基づく check-in / review 通知判定を再利用できます。",
    };
  }

  return {
    severity: "info",
    title: "通知の前提設定は完了しています",
    body:
      "このまま check-in / review ルールを調整し、必要なら手動チェックで表示内容を確認してください。",
  };
}

export function registerPwaLifecycleListeners() {
  if (hasRegisteredPwaListeners || typeof window === "undefined") {
    return;
  }

  hasRegisteredPwaListeners = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    cachedInstallPromptEvent = event as BeforeInstallPromptEvent;
    emitPwaStateChange();
  });

  window.addEventListener("appinstalled", () => {
    cachedInstallPromptEvent = null;
    emitPwaStateChange();
  });
}

export function subscribeToPwaRuntimeState(listener: () => void) {
  pwaListeners.add(listener);
  return () => {
    pwaListeners.delete(listener);
  };
}

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

export async function getPwaRuntimeState(): Promise<PwaRuntimeState> {
  registerPwaLifecycleListeners();

  const base = getBrowserCapabilities();
  const pwaState: PwaAvailabilityState = {
    hasInstallPrompt: cachedInstallPromptEvent !== null,
    isStandalone: getStandaloneFlag(),
    periodicSyncRegistered: false,
    serviceWorkerControlled:
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      Boolean(navigator.serviceWorker.controller),
  };

  if (!base.serviceWorkerSupported) {
    return {
      ...base,
      ...pwaState,
      ...derivePwaAvailability(pwaState),
    };
  }

  const registration = (await navigator.serviceWorker.ready) as PeriodicSyncRegistration;
  const periodicSyncSupported = "periodicSync" in registration;

  if (registration.periodicSync?.getTags) {
    const tags = await registration.periodicSync.getTags();
    pwaState.periodicSyncRegistered = tags.includes(PERIODIC_SYNC_TAG);
  }

  return {
    ...base,
    periodicSyncSupported,
    ...pwaState,
    ...derivePwaAvailability(pwaState),
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

export async function promptPwaInstall() {
  registerPwaLifecycleListeners();

  if (!cachedInstallPromptEvent || getStandaloneFlag()) {
    return "unavailable" as const;
  }

  const promptEvent = cachedInstallPromptEvent;
  cachedInstallPromptEvent = null;
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  emitPwaStateChange();
  return choice.outcome;
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
