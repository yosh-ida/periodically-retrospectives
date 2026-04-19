const DATABASE_NAME = "periodicallyRetrospectives";
const PERIODIC_SYNC_TAG = "reflection-notification-check";
const DAY_IN_MS = 86400000;
const LAST_MINUTE_OF_DAY = 24 * 60 - 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getAllRecords(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function putRecords(storeName, records) {
  if (!records.length) {
    return;
  }

  const db = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    for (const record of records) {
      store.put(record);
    }

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getLocalDateParts(timestamp) {
  const date = new Date(timestamp);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function formatDateKeyFromParts(parts) {
  return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(parts.day)}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

function getDayIndexFromParts(parts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_IN_MS);
}

function getDayIndexFromTimestamp(timestamp) {
  return getDayIndexFromParts(getLocalDateParts(timestamp));
}

function getDayIndexFromDateKey(dateKey) {
  return getDayIndexFromParts(parseDateKey(dateKey));
}

function formatDateKeyFromDayIndex(dayIndex) {
  const date = new Date(dayIndex * DAY_IN_MS);
  return formatDateKeyFromParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

function getLocalWeekdayFromDayIndex(dayIndex) {
  return new Date(dayIndex * DAY_IN_MS).getUTCDay();
}

function getMinutesFromTime(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatTimeFromMinutes(totalMinutes) {
  return `${padDatePart(Math.floor(totalMinutes / 60))}:${padDatePart(totalMinutes % 60)}`;
}

function getCurrentMinutes(timestamp) {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

function findLatestDueTime(times, maxScheduledMinutes) {
  let latest = null;

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

function findLatestDueRuleSlot(rule, now) {
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

function buildSlotId(channel, dateKey, time) {
  return `${channel}-${dateKey}T${time}`;
}

function buildAppUrl(pathname = "") {
  const normalizedPathname = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return new URL(normalizedPathname, self.registration.scope).toString();
}

function buildNotificationCopy(channel, theme) {
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

function pickLatestDueNotification(theme, settings, now) {
  if (!settings || !settings.enabled) {
    return null;
  }

  const channels = [
    ["check-in", settings.channels.checkIn],
    ["review", settings.channels.review],
  ];
  const candidates = [];

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

      candidates.push({
        ...buildNotificationCopy(channel, theme),
        channel,
        slotId,
        scheduledAtSortKey:
          getDayIndexFromDateKey(dueSlot.dateKey) * 24 * 60 + dueSlot.scheduledMinutes,
        themeId: theme.id,
      });
    }
  }

  candidates.sort((left, right) => right.scheduledAtSortKey - left.scheduledAtSortKey);
  const latest = candidates[0];
  if (!latest) {
    return null;
  }

  const { scheduledAtSortKey, ...due } = latest;
  return due;
}

async function runNotificationCheck(now = Date.now()) {
  const [themes, settingsList] = await Promise.all([
    getAllRecords("themes"),
    getAllRecords("notificationSettings"),
  ]);
  const settingsById = new Map(settingsList.map((settings) => [settings.id, settings]));
  const updatedSettings = [];
  const notifications = [];

  for (const theme of themes) {
    if (theme.isArchived || !theme.notificationSettingsId) {
      continue;
    }

    const settings = settingsById.get(theme.notificationSettingsId);
    if (!settings) {
      continue;
    }

    const due = pickLatestDueNotification(theme, settings, now);

    updatedSettings.push({
      ...settings,
      lastCheckedAt: now,
      lastNotifiedSlotId: due ? due.slotId : settings.lastNotifiedSlotId,
      updatedAt: now,
    });

    if (!due) {
      continue;
    }

    notifications.push(due);
    await self.registration.showNotification(due.title, {
      body: due.body,
      tag: due.slotId,
      renotify: false,
      data: {
        url:
          due.channel === "review"
            ? buildAppUrl(`themes/${encodeURIComponent(due.themeId)}/review`)
            : buildAppUrl(`themes/${encodeURIComponent(due.themeId)}`),
      },
    });
  }

  await putRecords("notificationSettings", updatedSettings);
  return notifications;
}

async function broadcastMessage(message) {
  const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clientList) {
    client.postMessage(message);
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const notifications = await runNotificationCheck();
      await broadcastMessage({
        type: "notification-check-complete",
        notifications: notifications.map((item) => item.slotId),
        source: "activate",
      });
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "notification-check") {
    return;
  }

  event.waitUntil(
    (async () => {
      const notifications = await runNotificationCheck(event.data.now || Date.now());
      await broadcastMessage({
        type: "notification-check-complete",
        notifications: notifications.map((item) => item.slotId),
        source: "message",
      });
    })(),
  );
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== PERIODIC_SYNC_TAG) {
    return;
  }

  event.waitUntil(
    (async () => {
      const notifications = await runNotificationCheck();
      await broadcastMessage({
        type: "notification-check-complete",
        notifications: notifications.map((item) => item.slotId),
        source: "periodicsync",
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const url = event.notification?.data?.url || buildAppUrl();
  event.notification.close();

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clientList.find((client) => "focus" in client);

      if (existing) {
        await existing.navigate(url);
        await existing.focus();
        return;
      }

      await self.clients.openWindow(url);
    })(),
  );
});
