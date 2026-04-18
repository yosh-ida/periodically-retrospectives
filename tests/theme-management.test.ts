import assert from "node:assert/strict";

import {
  archiveReflectionTheme,
  createNotificationSettings,
  createReflectionReview,
  createReflectionTheme,
  isReviewScore,
  updateReflectionTheme,
} from "../src/domain.ts";
import {
  STORE_SCHEMAS,
  createNotificationSettingsPlaceholder,
} from "../src/db.ts";
import {
  buildPath,
  formatRouteTitle,
  getRouteSnapshot,
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

run("createReflectionTheme creates an active theme with trimmed required fields", () => {
  const now = 1_700_000_000_000;

  const theme = createReflectionTheme(
    {
      issue: "  会議で前提説明が長くなる  ",
      cause: "  相手の知りたい範囲を確かめる前に全部話してしまう  ",
      goal: "  先に結論を言ってから必要な背景を足す  ",
    },
    now,
  );

  assert.deepEqual(theme, {
    id: "theme-1700000000000-0",
    issue: "会議で前提説明が長くなる",
    cause: "相手の知りたい範囲を確かめる前に全部話してしまう",
    goal: "先に結論を言ってから必要な背景を足す",
    notificationSettingsId: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  });
});

run("updateReflectionTheme rewrites editable fields and keeps immutable ids", () => {
  const original = createReflectionTheme(
    {
      issue: "話が長い",
      cause: "前提説明から入る",
      goal: "先に結論を言う",
    },
    10,
  );

  const updated = updateReflectionTheme(
    original,
    {
      issue: "  話の入りが長い  ",
      cause: "  結論より背景を先に話す  ",
      goal: "  最初の一文で論点を出す  ",
      notificationSettingsId: "notification-settings-1",
    },
    20,
  );

  assert.deepEqual(updated, {
    ...original,
    issue: "話の入りが長い",
    cause: "結論より背景を先に話す",
    goal: "最初の一文で論点を出す",
    notificationSettingsId: "notification-settings-1",
    updatedAt: 20,
  });
});

run("archiveReflectionTheme marks the theme archived without touching history references", () => {
  const original = createReflectionTheme(
    {
      issue: "考える前に説明する",
      cause: "焦って埋めようとする",
      goal: "沈黙を怖がらず確認する",
      notificationSettingsId: "notification-settings-1",
    },
    100,
  );

  const archived = archiveReflectionTheme(original, 200);

  assert.equal(archived.isArchived, true);
  assert.equal(archived.notificationSettingsId, "notification-settings-1");
  assert.equal(archived.updatedAt, 200);
  assert.equal(archived.createdAt, 100);
});

run("createReflectionTheme rejects missing required fields", () => {
  assert.throws(
    () =>
      createReflectionTheme({
        issue: " ",
        cause: "原因",
        goal: "ゴール",
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
      note: "  今週は最初に結論を言えた  ",
      reviewedAt,
    },
    now,
  );

  assert.deepEqual(review, {
    id: "review-1700000100000-0",
    themeId: "theme-1",
    score: 6,
    note: "今週は最初に結論を言えた",
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

run("createNotificationSettingsPlaceholder creates a disabled reference target", () => {
  const placeholder = createNotificationSettingsPlaceholder(500);

  assert.equal(placeholder.enabled, false);
  assert.equal(placeholder.channels.checkIn.rules.length, 0);
  assert.equal(placeholder.channels.review.rules.length, 0);
  assert.equal(placeholder.updatedAt, 500);
});

run("parseRoute understands dashboard, create, detail, and edit pages", () => {
  const cases: Array<[string, AppRoute]> = [
    ["/", { name: "dashboard" }],
    ["/themes/new", { name: "theme-new" }],
    ["/themes/theme-1", { name: "theme-detail", themeId: "theme-1" }],
    ["/themes/theme-1/edit", { name: "theme-edit", themeId: "theme-1" }],
    ["/missing", { name: "not-found" }],
  ];

  for (const [pathname, expected] of cases) {
    assert.deepEqual(parseRoute(pathname), expected);
  }
});

run("buildPath and formatRouteTitle keep navigation labels consistent", () => {
  assert.equal(buildPath({ name: "dashboard" }), "/");
  assert.equal(buildPath({ name: "theme-new" }), "/themes/new");
  assert.equal(buildPath({ name: "theme-detail", themeId: "theme-42" }), "/themes/theme-42");
  assert.equal(buildPath({ name: "theme-edit", themeId: "theme-42" }), "/themes/theme-42/edit");
  assert.equal(formatRouteTitle({ name: "theme-new" }), "新しい反省点");
  assert.equal(formatRouteTitle({ name: "theme-edit", themeId: "theme-42" }), "反省点を編集");
});

run("getRouteSnapshot returns a stable object for the same pathname", () => {
  const first = getRouteSnapshot("/themes/theme-42");
  const second = getRouteSnapshot("/themes/theme-42");
  const third = getRouteSnapshot("/themes/theme-42/edit");

  assert.equal(first, second);
  assert.notEqual(first, third);
});

run("STORE_SCHEMAS keeps the Phase 1 IndexedDB indexes from the data model", () => {
  assert.deepEqual(STORE_SCHEMAS, {
    themes: "id, notificationSettingsId, isArchived, updatedAt",
    reviews: "id, themeId, reviewedAt, [themeId+reviewedAt], updatedAt",
    notificationSettings: "id, enabled, updatedAt",
  });
});
