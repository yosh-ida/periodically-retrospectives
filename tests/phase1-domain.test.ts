import assert from "node:assert/strict";

import {
  createNotificationSettings,
  createReflectionReview,
  createReflectionTheme,
  isReviewScore,
} from "../src/domain.ts";
import { STORE_SCHEMAS } from "../src/db.ts";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

run("createReflectionTheme creates an active theme with trimmed required fields", () => {
  const now = 1_700_000_000_000;

  const theme = createReflectionTheme(
    {
      issue: "  会議で話しすぎる  ",
      cause: "  不安で間を埋めてしまう  ",
      goal: "  相手の発言を最後まで聞く  ",
    },
    now,
  );

  assert.deepEqual(theme, {
    id: "theme-1700000000000-0",
    issue: "会議で話しすぎる",
    cause: "不安で間を埋めてしまう",
    goal: "相手の発言を最後まで聞く",
    notificationSettingsId: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
});

run("createReflectionTheme rejects missing required fields", () => {
  assert.throws(
    () =>
      createReflectionTheme({
        issue: " ",
        cause: "原因",
        goal: "目標",
      }),
    /issue, cause, goal are required/,
  );
});

run("createReflectionReview creates a point-in-time review with an optional note", () => {
  const now = 1_700_000_100_000;
  const reviewedAt = 1_700_000_090_000;

  const review = createReflectionReview(
    {
      themeId: "theme-1",
      score: 6,
      note: "  次回は結論を先に言う  ",
      reviewedAt,
    },
    now,
  );

  assert.deepEqual(review, {
    id: "review-1700000100000-0",
    themeId: "theme-1",
    score: 6,
    note: "次回は結論を先に言う",
    reviewedAt,
    createdAt: now,
    updatedAt: now,
  });
});

run("createReflectionReview rejects scores outside the 1 to 7 range", () => {
  assert.equal(isReviewScore(0), false);
  assert.equal(isReviewScore(8), false);
  assert.equal(isReviewScore(7), true);

  assert.throws(
    () =>
      createReflectionReview({
        themeId: "theme-1",
        score: 8,
        reviewedAt: Date.now(),
      }),
    /score must be between 1 and 7/,
  );
});

run("createNotificationSettings builds disabled channels and runtime state defaults", () => {
  const now = 1_700_000_200_000;

  const settings = createNotificationSettings(undefined, now);

  assert.deepEqual(settings, {
    id: "notification-settings-1700000200000-0",
    enabled: false,
    channels: {
      checkIn: {
        enabled: false,
        rules: [],
      },
      review: {
        enabled: false,
        rules: [],
      },
    },
    lastNotifiedSlotId: null,
    lastCheckedAt: null,
    updatedAt: now,
  });
});

run("STORE_SCHEMAS keeps the Phase 1 IndexedDB indexes from the data model", () => {
  assert.deepEqual(STORE_SCHEMAS, {
    themes: "id, notificationSettingsId, isArchived, updatedAt",
    reviews: "id, themeId, reviewedAt, [themeId+reviewedAt], updatedAt",
    notificationSettings: "id, enabled, updatedAt",
  });
});
