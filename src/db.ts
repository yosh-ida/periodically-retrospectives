import Dexie, { type EntityTable } from "dexie";

import {
  createEntityId,
  createNotificationSettings,
  createReflectionReview,
  createReflectionTheme,
  type NotificationSettings,
  type ReflectionReview,
  type ReflectionTheme,
} from "./domain.ts";

export const DATABASE_NAME = "periodicallyRetrospectives";

export const STORE_SCHEMAS = {
  themes: "id, notificationSettingsId, isArchived, updatedAt",
  reviews: "id, themeId, reviewedAt, [themeId+reviewedAt], updatedAt",
  notificationSettings: "id, enabled, updatedAt",
} as const;

class PeriodicallyRetrospectivesDatabase extends Dexie {
  themes!: EntityTable<ReflectionTheme, "id">;
  reviews!: EntityTable<ReflectionReview, "id">;
  notificationSettings!: EntityTable<NotificationSettings, "id">;

  constructor() {
    super(DATABASE_NAME);
    this.version(1).stores(STORE_SCHEMAS);
  }
}

export const db = new PeriodicallyRetrospectivesDatabase();

export async function seedPhase1DemoData(now = Date.now()) {
  const notificationSettings = createNotificationSettings(
    {
      enabled: true,
      channels: {
        checkIn: {
          enabled: true,
          rules: [
            {
              id: createEntityId("rule", now),
              type: "every-n-days",
              intervalDays: 3,
              times: ["09:00"],
              anchorDate: "2026-04-18",
            },
          ],
        },
        review: {
          enabled: true,
          rules: [
            {
              id: createEntityId("rule", now + 1),
              type: "weekly-days",
              weekdays: [1, 4],
              times: ["21:00"],
            },
          ],
        },
      },
    },
    now,
  );

  const theme = createReflectionTheme(
    {
      issue: "Meetings drift into long background explanations",
      cause: "I try to front-load every detail before checking what is needed",
      goal: "Lead with the conclusion, then add context based on the response",
      notificationSettingsId: notificationSettings.id,
    },
    now + 1,
  );

  const review = createReflectionReview(
    {
      themeId: theme.id,
      score: 5,
      note: "I managed to start with the conclusion twice this week",
      reviewedAt: now + 2,
    },
    now + 2,
  );

  await db.transaction("rw", db.notificationSettings, db.themes, db.reviews, async () => {
    await db.notificationSettings.put(notificationSettings);
    await db.themes.put(theme);
    await db.reviews.put(review);
  });
}

export async function resetPhase1Data() {
  await db.transaction("rw", db.notificationSettings, db.themes, db.reviews, async () => {
    await db.reviews.clear();
    await db.themes.clear();
    await db.notificationSettings.clear();
  });
}
