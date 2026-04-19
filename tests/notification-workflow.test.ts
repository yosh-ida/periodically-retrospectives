import assert from "node:assert/strict";

import {
  createNotificationSettings,
  createReflectionTheme,
  updateNotificationSettings,
} from "../src/domain.ts";
import {
  pickLatestDueNotification,
  runNotificationCheck,
} from "../src/features/notifications/engine.ts";
import {
  derivePwaAvailability,
  getPwaOnboardingMessage,
} from "../src/features/notifications/runtime.ts";
import { describeNotificationRule } from "../src/features/notifications/ui.ts";
import {
  buildPath,
  formatRouteTitle,
  parseRoute,
  type AppRoute,
} from "../src/routes.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function atUtc(year: number, month: number, day: number, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute);
}

run("parseRoute understands the notification settings page route", () => {
  const cases: Array<[string, AppRoute]> = [
    ["/themes/theme-1/notifications", { name: "theme-notifications", themeId: "theme-1" }],
    [
      "/themes/%E3%83%86%E3%83%BC%E3%83%9E/notifications",
      { name: "theme-notifications", themeId: "テーマ" },
    ],
  ];

  for (const [pathname, expected] of cases) {
    assert.deepEqual(parseRoute(pathname), expected);
  }
});

run("buildPath and formatRouteTitle include the notification settings page", () => {
  assert.equal(
    buildPath({ name: "theme-notifications", themeId: "theme-42" }),
    "/themes/theme-42/notifications",
  );
  assert.equal(
    formatRouteTitle({ name: "theme-notifications", themeId: "theme-42" }),
    "通知設定",
  );
});

run("updateNotificationSettings rewrites rules and runtime metadata while keeping the id", () => {
  const original = createNotificationSettings(undefined, atUtc(2026, 4, 18, 9, 0));

  const updated = updateNotificationSettings(
    original,
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: true,
          rules: [
            {
              id: "rule-checkin-1",
              type: "every-n-days",
              intervalDays: 2,
              anchorDate: "2026-04-18",
              times: ["09:00", "18:30"],
            },
          ],
        },
        review: {
          enabled: true,
          rules: [
            {
              id: "rule-review-1",
              type: "weekly-days",
              weekdays: [1, 4],
              times: ["20:00"],
            },
          ],
        },
      },
      lastCheckedAt: atUtc(2026, 4, 20, 10, 0),
      lastNotifiedSlotId: "check-in-2026-04-20T09:00",
    },
    atUtc(2026, 4, 20, 10, 1),
  );

  assert.deepEqual(updated, {
    ...original,
    enabled: true,
    channels: {
      checkIn: {
        enabled: true,
        rules: [
          {
            id: "rule-checkin-1",
            type: "every-n-days",
            intervalDays: 2,
            anchorDate: "2026-04-18",
            times: ["09:00", "18:30"],
          },
        ],
      },
      review: {
        enabled: true,
        rules: [
          {
            id: "rule-review-1",
            type: "weekly-days",
            weekdays: [1, 4],
            times: ["20:00"],
          },
        ],
      },
    },
    lastCheckedAt: atUtc(2026, 4, 20, 10, 0),
    lastNotifiedSlotId: "check-in-2026-04-20T09:00",
    updatedAt: atUtc(2026, 4, 20, 10, 1),
  });
});

run("pickLatestDueNotification chooses the latest due check-in slot for the current day", () => {
  const theme = createReflectionTheme(
    {
      issue: "朝会で結論より背景を先に話してしまう",
      cause: "前提を全部説明しないと不安になる",
      goal: "最初に結論を言ってから必要な補足に絞る",
    },
    atUtc(2026, 4, 18, 9, 0),
  );
  const settings = createNotificationSettings(
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: true,
          rules: [
            {
              id: "rule-checkin-1",
              type: "every-n-days",
              intervalDays: 2,
              anchorDate: "2026-04-18",
              times: ["09:00", "18:00"],
            },
          ],
        },
        review: {
          enabled: false,
          rules: [],
        },
      },
    },
    atUtc(2026, 4, 18, 9, 1),
  );

  const due = pickLatestDueNotification({
    now: Date.parse("2026-04-20T10:30:00+09:00"),
    settings,
    theme,
  });

  assert.deepEqual(due, {
    body: "朝会で結論より背景を先に話してしまう",
    channel: "check-in",
    settingsId: settings.id,
    slotId: "check-in-2026-04-20T09:00",
    themeId: theme.id,
    title: "チェックインの時間です",
  });
});

run("pickLatestDueNotification skips slots that were already notified", () => {
  const theme = createReflectionTheme(
    {
      issue: "レビューを書く前に別タスクへ逃げがち",
      cause: "評価を言語化するのに時間がかかる",
      goal: "一言でもいいのでその日のうちに残す",
    },
    atUtc(2026, 4, 18, 9, 0),
  );
  const settings = createNotificationSettings(
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: false,
          rules: [],
        },
        review: {
          enabled: true,
          rules: [
            {
              id: "rule-review-1",
              type: "weekly-days",
              weekdays: [1],
              times: ["20:00"],
            },
          ],
        },
      },
      lastNotifiedSlotId: "review-2026-04-20T20:00",
    },
    atUtc(2026, 4, 18, 9, 1),
  );

  const due = pickLatestDueNotification({
    now: Date.parse("2026-04-20T21:00:00+09:00"),
    settings,
    theme,
  });

  assert.equal(due, null);
});

run("pickLatestDueNotification uses the local day when building every-n-days slots", () => {
  const theme = createReflectionTheme(
    {
      issue: "日付またぎ直後のチェックインを取りこぼしたくない",
      cause: "UTC 日付で評価すると前日扱いになる",
      goal: "ローカル日付で当日のスロットを判定する",
    },
    atUtc(2026, 4, 18, 9, 0),
  );
  const settings = createNotificationSettings(
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: true,
          rules: [
            {
              id: "rule-checkin-local-day",
              type: "every-n-days",
              intervalDays: 2,
              anchorDate: "2026-04-18",
              times: ["00:15"],
            },
          ],
        },
        review: {
          enabled: false,
          rules: [],
        },
      },
    },
    atUtc(2026, 4, 18, 9, 1),
  );

  const due = pickLatestDueNotification({
    now: Date.parse("2026-04-20T00:30:00+09:00"),
    settings,
    theme,
  });

  assert.deepEqual(due, {
    body: "日付またぎ直後のチェックインを取りこぼしたくない",
    channel: "check-in",
    settingsId: settings.id,
    slotId: "check-in-2026-04-20T00:15",
    themeId: theme.id,
    title: "チェックインの時間です",
  });
});

run("pickLatestDueNotification evaluates weekly-days using the local weekday", () => {
  const theme = createReflectionTheme(
    {
      issue: "週の初めに振り返りを始めたい",
      cause: "ローカルでは月曜でも UTC では日曜になる時間帯がある",
      goal: "曜日判定もローカルタイムで揃える",
    },
    atUtc(2026, 4, 18, 9, 0),
  );
  const settings = createNotificationSettings(
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: false,
          rules: [],
        },
        review: {
          enabled: true,
          rules: [
            {
              id: "rule-review-local-weekday",
              type: "weekly-days",
              weekdays: [1],
              times: ["00:15"],
            },
          ],
        },
      },
    },
    atUtc(2026, 4, 18, 9, 1),
  );

  const due = pickLatestDueNotification({
    now: Date.parse("2026-04-20T00:30:00+09:00"),
    settings,
    theme,
  });

  assert.deepEqual(due, {
    body: "週の初めに振り返りを始めたい",
    channel: "review",
    settingsId: settings.id,
    slotId: "review-2026-04-20T00:15",
    themeId: theme.id,
    title: "振り返りの時間です",
  });
});

run("runNotificationCheck updates runtime state when a notification is emitted", () => {
  const theme = createReflectionTheme(
    {
      issue: "振り返りを翌日に持ち越しやすい",
      cause: "メモをまとめて書こうとして重くなる",
      goal: "その日のうちに短く残す",
      notificationSettingsId: "notification-settings-1",
    },
    atUtc(2026, 4, 18, 9, 0),
  );
  const settings = createNotificationSettings(
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: false,
          rules: [],
        },
        review: {
          enabled: true,
          rules: [
            {
              id: "rule-review-1",
              type: "weekly-days",
              weekdays: [1],
              times: ["20:00"],
            },
          ],
        },
      },
    },
    atUtc(2026, 4, 18, 9, 1),
  );

  const result = runNotificationCheck({
    now: Date.parse("2026-04-20T20:30:00+09:00"),
    registrations: [{ settings, theme }],
  });

  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0]?.slotId, "review-2026-04-20T20:00");
  assert.equal(result.updatedSettings.length, 1);
  assert.equal(
    result.updatedSettings[0]?.lastNotifiedSlotId,
    "review-2026-04-20T20:00",
  );
  assert.equal(
    result.updatedSettings[0]?.lastCheckedAt,
    Date.parse("2026-04-20T20:30:00+09:00"),
  );
});

run("derivePwaAvailability enables install only when the prompt is available outside standalone mode", () => {
  assert.deepEqual(
    derivePwaAvailability({
      hasInstallPrompt: true,
      isStandalone: false,
      periodicSyncRegistered: true,
      serviceWorkerControlled: true,
    }),
    {
      canInstall: true,
      installStateLabel: "available",
      periodicSyncStateLabel: "registered",
      serviceWorkerStateLabel: "controlled",
    },
  );

  assert.deepEqual(
    derivePwaAvailability({
      hasInstallPrompt: false,
      isStandalone: true,
      periodicSyncRegistered: false,
      serviceWorkerControlled: false,
    }),
    {
      canInstall: false,
      installStateLabel: "installed",
      periodicSyncStateLabel: "not-registered",
      serviceWorkerStateLabel: "waiting",
    },
  );
});

run("getPwaOnboardingMessage prioritizes unsupported environments", () => {
  assert.deepEqual(
    getPwaOnboardingMessage({
      serviceWorkerSupported: false,
      notificationSupported: true,
      periodicSyncSupported: false,
      notificationPermission: "default",
      hasInstallPrompt: false,
      isStandalone: false,
      periodicSyncRegistered: false,
      serviceWorkerControlled: false,
      canInstall: false,
      installStateLabel: "unavailable",
      periodicSyncStateLabel: "not-registered",
      serviceWorkerStateLabel: "waiting",
    }),
    {
      severity: "warning",
      title: "この環境ではバックグラウンド通知を利用できません",
      body:
        "Service Worker・Notification・Periodic Sync に対応した Chromium 系ブラウザで開いてください。",
    },
  );
});

run("getPwaOnboardingMessage guides users toward install and standalone launch", () => {
  assert.deepEqual(
    getPwaOnboardingMessage({
      serviceWorkerSupported: true,
      notificationSupported: true,
      periodicSyncSupported: true,
      notificationPermission: "default",
      hasInstallPrompt: true,
      isStandalone: false,
      periodicSyncRegistered: false,
      serviceWorkerControlled: true,
      canInstall: true,
      installStateLabel: "available",
      periodicSyncStateLabel: "not-registered",
      serviceWorkerStateLabel: "controlled",
    }),
    {
      severity: "info",
      title: "最初にアプリとしてインストールしてください",
      body:
        "通知導線はインストール済み PWA をアプリ表示で起動している前提です。インストール後に権限許可と periodic sync 登録へ進んでください。",
    },
  );
});

run("describeNotificationRule renders every-n-days rules for UI summaries", () => {
  assert.equal(
    describeNotificationRule({
      id: "rule-1",
      type: "every-n-days",
      intervalDays: 2,
      anchorDate: "2026-04-18",
      times: ["09:00", "18:30"],
    }),
    "2日ごと / 基準日 2026-04-18 / 09:00, 18:30",
  );
});

run("describeNotificationRule renders weekly-days rules for UI summaries", () => {
  assert.equal(
    describeNotificationRule({
      id: "rule-2",
      type: "weekly-days",
      weekdays: [1, 4],
      times: ["20:00"],
    }),
    "毎週 Mon, Thu / 20:00",
  );
});
