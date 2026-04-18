import type {
  NotificationChannel,
  NotificationRule,
  NotificationSettings,
  ReflectionTheme,
} from "../../domain.ts";
import { updateNotificationSettings } from "../../domain.ts";

export type NotificationRegistration = {
  theme: ReflectionTheme;
  settings: NotificationSettings;
};

export type DueNotification = {
  settingsId: string;
  themeId: string;
  channel: NotificationChannel;
  slotId: string;
  title: string;
  body: string;
};

type PickLatestDueNotificationInput = {
  theme: ReflectionTheme;
  settings: NotificationSettings;
  now: number;
};

function formatDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getMinutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getCurrentMinutes(timestamp: number) {
  const date = new Date(timestamp);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function daysBetween(anchorDate: string, currentDate: string) {
  const anchor = Date.parse(`${anchorDate}T00:00:00.000Z`);
  const current = Date.parse(`${currentDate}T00:00:00.000Z`);
  return Math.floor((current - anchor) / 86_400_000);
}

function matchesRule(rule: NotificationRule, timestamp: number) {
  const currentDate = formatDateKey(timestamp);

  if (rule.type === "every-n-days") {
    const diffDays = daysBetween(rule.anchorDate, currentDate);
    return diffDays >= 0 && diffDays % rule.intervalDays === 0;
  }

  return rule.weekdays.includes(new Date(timestamp).getUTCDay());
}

function buildSlotId(channel: NotificationChannel, dateKey: string, time: string) {
  return `${channel}-${dateKey}T${time}`;
}

function buildNotificationCopy(channel: NotificationChannel, theme: ReflectionTheme) {
  if (channel === "check-in") {
    return {
      title: "チェックインの時間です",
      body: theme.issue,
    };
  }

  return {
    title: "振り返りの時間です",
    body: theme.issue,
  };
}

export function pickLatestDueNotification({
  now,
  settings,
  theme,
}: PickLatestDueNotificationInput): DueNotification | null {
  if (!settings.enabled) {
    return null;
  }

  const dateKey = formatDateKey(now);
  const currentMinutes = getCurrentMinutes(now);
  const candidates: Array<DueNotification & { scheduledMinutes: number }> = [];

  const channels: Array<[NotificationChannel, NotificationSettings["channels"]["checkIn"]]> = [
    ["check-in", settings.channels.checkIn],
    ["review", settings.channels.review],
  ];

  for (const [channel, channelSettings] of channels) {
    if (!channelSettings.enabled) {
      continue;
    }

    for (const rule of channelSettings.rules) {
      if (!matchesRule(rule, now)) {
        continue;
      }

      for (const time of rule.times) {
        const scheduledMinutes = getMinutesFromTime(time);
        if (scheduledMinutes > currentMinutes) {
          continue;
        }

        const slotId = buildSlotId(channel, dateKey, time);
        if (slotId === settings.lastNotifiedSlotId) {
          continue;
        }

        const copy = buildNotificationCopy(channel, theme);
        candidates.push({
          ...copy,
          channel,
          settingsId: settings.id,
          slotId,
          themeId: theme.id,
          scheduledMinutes,
        });
      }
    }
  }

  candidates.sort((left, right) => right.scheduledMinutes - left.scheduledMinutes);
  const latest = candidates[0];
  if (!latest) {
    return null;
  }

  const { scheduledMinutes: _scheduledMinutes, ...dueNotification } = latest;
  return dueNotification;
}

export function runNotificationCheck({
  now,
  registrations,
}: {
  now: number;
  registrations: NotificationRegistration[];
}) {
  const notifications: DueNotification[] = [];
  const updatedSettings: NotificationSettings[] = [];

  for (const registration of registrations) {
    const due = pickLatestDueNotification({
      now,
      settings: registration.settings,
      theme: registration.theme,
    });

    if (due) {
      notifications.push(due);
    }

    updatedSettings.push(
      updateNotificationSettings(
        registration.settings,
        {
          enabled: registration.settings.enabled,
          channels: registration.settings.channels,
          lastCheckedAt: now,
          lastNotifiedSlotId: due?.slotId ?? registration.settings.lastNotifiedSlotId,
        },
        now,
      ),
    );
  }

  return {
    notifications,
    updatedSettings,
  };
}
