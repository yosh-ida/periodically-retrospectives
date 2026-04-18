import assert from "node:assert/strict";

import {
  createReflectionReview,
  updateReflectionReview,
} from "../src/domain.ts";
import {
  aggregateReviewsForChart,
  type ChartInterval,
} from "../src/reviewChart.ts";
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

run("parseRoute understands the review page route", () => {
  const cases: Array<[string, AppRoute]> = [
    ["/themes/theme-1/review", { name: "theme-review", themeId: "theme-1" }],
    ["/themes/%E3%83%86%E3%83%BC%E3%83%9E/review", { name: "theme-review", themeId: "テーマ" }],
  ];

  for (const [pathname, expected] of cases) {
    assert.deepEqual(parseRoute(pathname), expected);
  }
});

run("buildPath and formatRouteTitle include the review page", () => {
  assert.equal(buildPath({ name: "theme-review", themeId: "theme-42" }), "/themes/theme-42/review");
  assert.equal(formatRouteTitle({ name: "theme-review", themeId: "theme-42" }), "振り返りを記録");
});

run("updateReflectionReview updates score and note while keeping identity", () => {
  const original = createReflectionReview(
    {
      themeId: "theme-1",
      score: 3,
      note: "最初はまだ曖昧だった",
      reviewedAt: atUtc(2026, 4, 1, 9, 0),
    },
    atUtc(2026, 4, 1, 9, 5),
  );

  const updated = updateReflectionReview(
    original,
    {
      score: 6,
      note: "結論から話せる回数が増えた",
      reviewedAt: atUtc(2026, 4, 2, 20, 0),
    },
    atUtc(2026, 4, 2, 20, 1),
  );

  assert.deepEqual(updated, {
    ...original,
    score: 6,
    note: "結論から話せる回数が増えた",
    reviewedAt: atUtc(2026, 4, 2, 20, 0),
    updatedAt: atUtc(2026, 4, 2, 20, 1),
  });
});

run("aggregateReviewsForChart keeps raw reviews as single points", () => {
  const reviews = [
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 2,
        note: "",
        reviewedAt: atUtc(2026, 4, 1, 9, 0),
      },
      atUtc(2026, 4, 1, 9, 5),
    ),
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 7,
        note: "結論から始められた",
        reviewedAt: atUtc(2026, 4, 3, 9, 0),
      },
      atUtc(2026, 4, 3, 9, 5),
    ),
  ];

  const points = aggregateReviewsForChart(reviews, "raw");

  assert.equal(points.length, 2);
  assert.equal(points[0].score, 2);
  assert.equal(points[0].notes.length, 0);
  assert.equal(points[1].score, 7);
  assert.equal(points[1].notes.length, 1);
  assert.equal(points[1].notes[0]?.note, "結論から始められた");
});

run("aggregateReviewsForChart groups by week and rounds the average score", () => {
  const reviews = [
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 3,
        note: "火曜は説明が長かった",
        reviewedAt: atUtc(2026, 4, 6, 9, 0),
      },
      atUtc(2026, 4, 6, 9, 5),
    ),
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 4,
        note: "",
        reviewedAt: atUtc(2026, 4, 8, 9, 0),
      },
      atUtc(2026, 4, 8, 9, 5),
    ),
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 6,
        note: "金曜はうまく切り返せた",
        reviewedAt: atUtc(2026, 4, 10, 9, 0),
      },
      atUtc(2026, 4, 10, 9, 5),
    ),
  ];

  const points = aggregateReviewsForChart(reviews, "weekly");

  assert.equal(points.length, 1);
  assert.equal(points[0].score, 4);
  assert.equal(points[0].reviews.length, 3);
  assert.deepEqual(
    points[0].notes.map((item) => item.note),
    ["火曜は説明が長かった", "金曜はうまく切り返せた"],
  );
});

run("aggregateReviewsForChart groups by month and keeps month order", () => {
  const reviews = [
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 2,
        note: "",
        reviewedAt: atUtc(2026, 3, 28, 9, 0),
      },
      atUtc(2026, 3, 28, 9, 5),
    ),
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 5,
        note: "4月は改善の兆しがあった",
        reviewedAt: atUtc(2026, 4, 2, 9, 0),
      },
      atUtc(2026, 4, 2, 9, 5),
    ),
    createReflectionReview(
      {
        themeId: "theme-1",
        score: 6,
        note: "",
        reviewedAt: atUtc(2026, 4, 20, 9, 0),
      },
      atUtc(2026, 4, 20, 9, 5),
    ),
  ];

  const points = aggregateReviewsForChart(reviews, "monthly" satisfies ChartInterval);

  assert.equal(points.length, 2);
  assert.equal(points[0].periodKey, "2026-03");
  assert.equal(points[0].score, 2);
  assert.equal(points[1].periodKey, "2026-04");
  assert.equal(points[1].score, 6);
  assert.equal(points[1].notes[0]?.note, "4月は改善の兆しがあった");
});
