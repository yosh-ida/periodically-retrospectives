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
    now: atUtc(2026, 4, 20, 10, 30),
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
    now: atUtc(2026, 4, 20, 21, 0),
    settings,
    theme,
  });

  assert.equal(due, null);
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
    now: atUtc(2026, 4, 20, 20, 30),
    registrations: [{ settings, theme }],
  });

  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0]?.slotId, "review-2026-04-20T20:00");
  assert.equal(result.updatedSettings.length, 1);
  assert.equal(
    result.updatedSettings[0]?.lastNotifiedSlotId,
    "review-2026-04-20T20:00",
  );
  assert.equal(result.updatedSettings[0]?.lastCheckedAt, atUtc(2026, 4, 20, 20, 30));
});
