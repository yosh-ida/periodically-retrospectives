import Dexie, { type EntityTable } from "dexie";

import {
  archiveReflectionTheme,
  createEntityId,
  createNotificationSettings,
  findDuplicateReview,
  updateReflectionReview,
  updateNotificationSettings,
  createReflectionReview,
  createReflectionTheme,
  updateReflectionTheme,
  type NotificationSettingsInput,
  type NotificationSettings,
  type ReflectionReview,
  type ReflectionTheme,
  type ThemeInput,
} from "./domain.ts";
import { runNotificationCheck } from "./features/notifications/engine.ts";

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

export function createNotificationSettingsPlaceholder(now = Date.now()) {
  return createNotificationSettings(undefined, now);
}

const DUPLICATE_REVIEW_ERROR =
  "同じ記録日時の振り返りがすでにあります。既存の記録を編集してください。";

async function assertNotificationSettingsExists(notificationSettingsId: string | null) {
  if (notificationSettingsId === null) {
    return;
  }

  const settings = await db.notificationSettings.get(notificationSettingsId);
  if (!settings) {
    throw new Error("notification settings reference is invalid");
  }
}

export async function createNotificationSettingsReference(now = Date.now()) {
  const settings = createNotificationSettingsPlaceholder(now);
  await db.notificationSettings.put(settings);
  return settings;
}

export async function ensureThemeNotificationSettings(themeId: string, now = Date.now()) {
  const theme = await db.themes.get(themeId);
  if (!theme) {
    throw new Error("theme not found");
  }

  if (theme.notificationSettingsId) {
    const settings = await db.notificationSettings.get(theme.notificationSettingsId);
    if (!settings) {
      throw new Error("notification settings reference is invalid");
    }

    return { settings, theme };
  }

  const settings = createNotificationSettingsPlaceholder(now);
  const updatedTheme = {
    ...theme,
    notificationSettingsId: settings.id,
    updatedAt: now,
  };

  await db.transaction("rw", db.notificationSettings, db.themes, async () => {
    await db.notificationSettings.put(settings);
    await db.themes.put(updatedTheme);
  });

  return { settings, theme: updatedTheme };
}

export async function createTheme(input: ThemeInput, now = Date.now()) {
  await assertNotificationSettingsExists(input.notificationSettingsId ?? null);

  const theme = createReflectionTheme(input, now);
  await db.themes.put(theme);
  return theme;
}

export async function updateTheme(themeId: string, input: ThemeInput, now = Date.now()) {
  const existingTheme = await db.themes.get(themeId);
  if (!existingTheme) {
    throw new Error("theme not found");
  }

  await assertNotificationSettingsExists(input.notificationSettingsId ?? null);

  const updatedTheme = updateReflectionTheme(existingTheme, input, now);
  await db.themes.put(updatedTheme);
  return updatedTheme;
}

export async function archiveTheme(themeId: string, now = Date.now()) {
  const existingTheme = await db.themes.get(themeId);
  if (!existingTheme) {
    throw new Error("theme not found");
  }

  const archivedTheme = archiveReflectionTheme(existingTheme, now);
  await db.themes.put(archivedTheme);
  return archivedTheme;
}

export async function createReview(
  input: {
    themeId: string;
    score: number;
    note?: string;
    reviewedAt: number;
  },
  now = Date.now(),
) {
  const theme = await db.themes.get(input.themeId);
  if (!theme) {
    throw new Error("theme not found");
  }

  const existingAtSameTime = await db.reviews
    .where("[themeId+reviewedAt]")
    .equals([input.themeId, input.reviewedAt])
    .toArray();
  if (findDuplicateReview(existingAtSameTime, input)) {
    throw new Error(DUPLICATE_REVIEW_ERROR);
  }

  const review = createReflectionReview(input, now);
  await db.reviews.put(review);
  return review;
}

export async function updateReview(
  reviewId: string,
  input: {
    score: number;
    note?: string;
    reviewedAt: number;
  },
  now = Date.now(),
) {
  const review = await db.reviews.get(reviewId);
  if (!review) {
    throw new Error("review not found");
  }

  const existingAtSameTime = await db.reviews
    .where("[themeId+reviewedAt]")
    .equals([review.themeId, input.reviewedAt])
    .toArray();
  if (
    findDuplicateReview(existingAtSameTime, {
      themeId: review.themeId,
      reviewedAt: input.reviewedAt,
      excludeReviewId: review.id,
    })
  ) {
    throw new Error(DUPLICATE_REVIEW_ERROR);
  }

  const updatedReview = updateReflectionReview(review, input, now);
  await db.reviews.put(updatedReview);
  return updatedReview;
}

export async function updateNotificationSettingsRecord(
  settingsId: string,
  input: NotificationSettingsInput,
  now = Date.now(),
) {
  const settings = await db.notificationSettings.get(settingsId);
  if (!settings) {
    throw new Error("notification settings not found");
  }

  const updatedSettings = updateNotificationSettings(settings, input, now);
  await db.notificationSettings.put(updatedSettings);
  return updatedSettings;
}

export async function checkAndNotify(now = Date.now()) {
  const themes = await db.themes.toArray();
  const activeThemes = themes.filter((theme) => !theme.isArchived && theme.notificationSettingsId);
  const settingsIds = [
    ...new Set(
      activeThemes
        .map((theme) => theme.notificationSettingsId)
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  const settingsList = settingsIds.length
    ? await db.notificationSettings.bulkGet(settingsIds)
    : [];
  const settingsById = new Map(
    settingsList
      .filter((settings): settings is NotificationSettings => Boolean(settings))
      .map((settings) => [settings.id, settings]),
  );

  const registrations = activeThemes.flatMap((theme) => {
    const settings = theme.notificationSettingsId
      ? settingsById.get(theme.notificationSettingsId)
      : undefined;

    return settings ? [{ settings, theme }] : [];
  });

  const result = runNotificationCheck({
    now,
    registrations,
  });

  if (result.updatedSettings.length > 0) {
    await db.notificationSettings.bulkPut(result.updatedSettings);
  }

  return result;
}

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
