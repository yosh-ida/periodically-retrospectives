import type { ReflectionReview } from "./domain.ts";

export type ChartInterval = "raw" | "weekly" | "monthly";

export type ChartPointNote = {
  id: string;
  note: string;
  reviewedAt: number;
};

export type ChartPoint = {
  periodKey: string;
  label: string;
  score: number;
  reviewedAt: number;
  reviews: ReflectionReview[];
  notes: ChartPointNote[];
};

function toSortedReviews(reviews: ReflectionReview[]) {
  return [...reviews].sort((left, right) => left.reviewedAt - right.reviewedAt);
}

function startOfUtcWeek(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime();
}

function formatUtcDate(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(timestamp);
}

function formatUtcMonth(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
  }).format(timestamp);
}

function getPeriodKey(reviewedAt: number, interval: Exclude<ChartInterval, "raw">) {
  const date = new Date(reviewedAt);

  if (interval === "weekly") {
    const start = startOfUtcWeek(reviewedAt);
    return `week:${start}`;
  }

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getPointLabel(periodKey: string, reviewedAt: number, interval: ChartInterval) {
  if (interval === "raw") {
    return formatUtcDate(reviewedAt);
  }

  if (interval === "weekly") {
    const weekStart = Number(periodKey.replace("week:", ""));
    return `${formatUtcDate(weekStart)}週`;
  }

  return formatUtcMonth(reviewedAt);
}

function toPointNotes(reviews: ReflectionReview[]) {
  return reviews
    .filter((review) => review.note.length > 0)
    .map((review) => ({
      id: review.id,
      note: review.note,
      reviewedAt: review.reviewedAt,
    }));
}

export function aggregateReviewsForChart(
  reviews: ReflectionReview[],
  interval: ChartInterval,
): ChartPoint[] {
  const sortedReviews = toSortedReviews(reviews);

  if (interval === "raw") {
    return sortedReviews.map((review) => ({
      periodKey: review.id,
      label: getPointLabel(review.id, review.reviewedAt, interval),
      score: review.score,
      reviewedAt: review.reviewedAt,
      reviews: [review],
      notes: toPointNotes([review]),
    }));
  }

  const grouped = new Map<string, ReflectionReview[]>();

  for (const review of sortedReviews) {
    const periodKey = getPeriodKey(review.reviewedAt, interval);
    const current = grouped.get(periodKey) ?? [];
    current.push(review);
    grouped.set(periodKey, current);
  }

  return [...grouped.entries()].map(([periodKey, periodReviews]) => {
    const roundedScore = Math.round(
      periodReviews.reduce((sum, review) => sum + review.score, 0) / periodReviews.length,
    );
    const representative = periodReviews[periodReviews.length - 1] ?? periodReviews[0];

    return {
      periodKey,
      label: getPointLabel(periodKey, representative.reviewedAt, interval),
      score: roundedScore,
      reviewedAt: representative.reviewedAt,
      reviews: periodReviews,
      notes: toPointNotes(periodReviews),
    };
  });
}
