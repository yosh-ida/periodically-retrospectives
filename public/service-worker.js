const DATABASE_NAME = "periodicallyRetrospectives";
const PERIODIC_SYNC_TAG = "reflection-notification-check";

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

function formatDateKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getMinutesFromTime(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function getCurrentMinutes(timestamp) {
  const date = new Date(timestamp);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function daysBetween(anchorDate, currentDate) {
  const anchor = Date.parse(`${anchorDate}T00:00:00.000Z`);
  const current = Date.parse(`${currentDate}T00:00:00.000Z`);
  return Math.floor((current - anchor) / 86400000);
}

function matchesRule(rule, timestamp) {
  const currentDate = formatDateKey(timestamp);

  if (rule.type === "every-n-days") {
    const diffDays = daysBetween(rule.anchorDate, currentDate);
    return diffDays >= 0 && diffDays % rule.intervalDays === 0;
  }

  return rule.weekdays.includes(new Date(timestamp).getUTCDay());
}

function buildSlotId(channel, dateKey, time) {
  return `${channel}-${dateKey}T${time}`;
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

  const dateKey = formatDateKey(now);
  const currentMinutes = getCurrentMinutes(now);
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

        candidates.push({
          ...buildNotificationCopy(channel, theme),
          channel,
          slotId,
          scheduledMinutes,
          themeId: theme.id,
        });
      }
    }
  }

  candidates.sort((left, right) => right.scheduledMinutes - left.scheduledMinutes);
  return candidates[0] ?? null;
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
            ? `/themes/${encodeURIComponent(due.themeId)}/review`
            : `/themes/${encodeURIComponent(due.themeId)}`,
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
  const url = event.notification?.data?.url || "/";
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
