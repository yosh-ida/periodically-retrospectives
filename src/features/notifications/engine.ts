import type {
  NotificationChannel,
  NotificationRule,
  NotificationSettings,
  ReflectionTheme,
} from "../../domain.ts";
import { updateNotificationSettings } from "../../domain.ts";

const DAY_IN_MS = 86_400_000;
const LAST_MINUTE_OF_DAY = 24 * 60 - 1;

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

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
};

type DueRuleSlot = {
  dateKey: string;
  scheduledMinutes: number;
};

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalDateParts(timestamp: number): LocalDateParts {
  const date = new Date(timestamp);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function formatDateKeyFromParts(parts: LocalDateParts) {
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function parseDateKey(dateKey: string): LocalDateParts {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function getDayIndexFromParts(parts: LocalDateParts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_IN_MS);
}

function getDayIndexFromTimestamp(timestamp: number) {
  return getDayIndexFromParts(getLocalDateParts(timestamp));
}

function getDayIndexFromDateKey(dateKey: string) {
  return getDayIndexFromParts(parseDateKey(dateKey));
}

function formatDateKeyFromDayIndex(dayIndex: number) {
  const date = new Date(dayIndex * DAY_IN_MS);
  return formatDateKeyFromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function getLocalWeekdayFromDayIndex(dayIndex: number) {
  return new Date(dayIndex * DAY_IN_MS).getUTCDay();
}

function getMinutesFromTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTimeFromMinutes(totalMinutes: number) {
  return `${padDatePart(Math.floor(totalMinutes / 60))}:${padDatePart(totalMinutes % 60)}`;
}

function getCurrentMinutes(timestamp: number) {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

function findLatestDueTime(times: string[], maxScheduledMinutes: number) {
  let latest: number | null = null;

  for (const time of times) {
    const scheduledMinutes = getMinutesFromTime(time);
    if (scheduledMinutes > maxScheduledMinutes) {
      continue;
    }

    if (latest === null || scheduledMinutes > latest) {
      latest = scheduledMinutes;
    }
  }

  return latest;
}

function findLatestDueRuleSlot(rule: NotificationRule, now: number): DueRuleSlot | null {
  const currentDayIndex = getDayIndexFromTimestamp(now);
  const currentMinutes = getCurrentMinutes(now);

  if (rule.type === "every-n-days") {
    const anchorDayIndex = getDayIndexFromDateKey(rule.anchorDate);
    if (anchorDayIndex > currentDayIndex) {
      return null;
    }

    let candidateDayIndex =
      currentDayIndex - ((currentDayIndex - anchorDayIndex) % rule.intervalDays);

    while (candidateDayIndex >= anchorDayIndex) {
      const latestDueTime = findLatestDueTime(
        rule.times,
        candidateDayIndex === currentDayIndex ? currentMinutes : LAST_MINUTE_OF_DAY,
      );
      if (latestDueTime !== null) {
        return {
          dateKey: formatDateKeyFromDayIndex(candidateDayIndex),
          scheduledMinutes: latestDueTime,
        };
      }

      candidateDayIndex -= rule.intervalDays;
    }

    return null;
  }

  if (rule.weekdays.length === 0) {
    return null;
  }

  for (let offset = 0; offset < 14; offset += 1) {
    const candidateDayIndex = currentDayIndex - offset;
    if (!rule.weekdays.includes(getLocalWeekdayFromDayIndex(candidateDayIndex))) {
      continue;
    }

    const latestDueTime = findLatestDueTime(
      rule.times,
      candidateDayIndex === currentDayIndex ? currentMinutes : LAST_MINUTE_OF_DAY,
    );
    if (latestDueTime !== null) {
      return {
        dateKey: formatDateKeyFromDayIndex(candidateDayIndex),
        scheduledMinutes: latestDueTime,
      };
    }
  }

  return null;
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

  const candidates: Array<DueNotification & { scheduledAtSortKey: number }> = [];

  const channels: Array<[NotificationChannel, NotificationSettings["channels"]["checkIn"]]> = [
    ["check-in", settings.channels.checkIn],
    ["review", settings.channels.review],
  ];

  for (const [channel, channelSettings] of channels) {
    if (!channelSettings.enabled) {
      continue;
    }

    for (const rule of channelSettings.rules) {
      const dueSlot = findLatestDueRuleSlot(rule, now);
      if (!dueSlot) {
        continue;
      }

      const time = formatTimeFromMinutes(dueSlot.scheduledMinutes);
      const slotId = buildSlotId(channel, dueSlot.dateKey, time);
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
        scheduledAtSortKey:
          getDayIndexFromDateKey(dueSlot.dateKey) * 24 * 60 + dueSlot.scheduledMinutes,
      });
    }
  }

  candidates.sort((left, right) => right.scheduledAtSortKey - left.scheduledAtSortKey);
  const latest = candidates[0];
  if (!latest) {
    return null;
  }

  const { scheduledAtSortKey: _scheduledAtSortKey, ...dueNotification } = latest;
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
