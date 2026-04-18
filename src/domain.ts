export type ReviewScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReflectionTheme = {
  id: string;
  issue: string;
  cause: string;
  goal: string;
  notificationSettingsId: string | null;
  isArchived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ReflectionReview = {
  id: string;
  themeId: string;
  score: ReviewScore;
  note: string;
  reviewedAt: number;
  createdAt: number;
  updatedAt: number;
};

export type NotificationChannel = "check-in" | "review";

export type NotificationRule =
  | {
      id: string;
      type: "every-n-days";
      intervalDays: number;
      times: string[];
      anchorDate: string;
    }
  | {
      id: string;
      type: "weekly-days";
      weekdays: number[];
      times: string[];
    };

export type NotificationChannelSettings = {
  enabled: boolean;
  rules: NotificationRule[];
};

export type NotificationSettings = {
  id: string;
  enabled: boolean;
  channels: {
    checkIn: NotificationChannelSettings;
    review: NotificationChannelSettings;
  };
  lastNotifiedSlotId: string | null;
  lastCheckedAt: number | null;
  updatedAt: number;
};

type CreateReflectionThemeInput = {
  issue: string;
  cause: string;
  goal: string;
  notificationSettingsId?: string | null;
  isArchived?: boolean;
};

type CreateReflectionReviewInput = {
  themeId: string;
  score: number;
  note?: string;
  reviewedAt: number;
};

type CreateNotificationSettingsInput = Partial<Omit<NotificationSettings, "id" | "updatedAt">>;

const idSequenceByKey = new Map<string, number>();

function nextSequence(prefix: string, now: number) {
  const key = `${prefix}:${now}`;
  const currentSequence = idSequenceByKey.get(key) ?? 0;
  idSequenceByKey.set(key, currentSequence + 1);
  return currentSequence;
}

function normalizeText(value: string) {
  return value.trim();
}

function requireTextFields(values: Record<string, string>) {
  const hasMissingField = Object.values(values).some((value) => value.length === 0);
  if (hasMissingField) {
    throw new Error("issue, cause, goal are required");
  }
}

export function createEntityId(prefix: string, now = Date.now()) {
  return `${prefix}-${now}-${nextSequence(prefix, now)}`;
}

export function isReviewScore(value: number): value is ReviewScore {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

export function createReflectionTheme(
  input: CreateReflectionThemeInput,
  now = Date.now(),
): ReflectionTheme {
  const issue = normalizeText(input.issue);
  const cause = normalizeText(input.cause);
  const goal = normalizeText(input.goal);

  requireTextFields({ issue, cause, goal });

  return {
    id: createEntityId("theme", now),
    issue,
    cause,
    goal,
    notificationSettingsId: input.notificationSettingsId ?? null,
    isArchived: input.isArchived ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createReflectionReview(
  input: CreateReflectionReviewInput,
  now = Date.now(),
): ReflectionReview {
  if (normalizeText(input.themeId).length === 0) {
    throw new Error("themeId is required");
  }

  if (!isReviewScore(input.score)) {
    throw new Error("score must be between 1 and 7");
  }

  return {
    id: createEntityId("review", now),
    themeId: input.themeId,
    score: input.score,
    note: normalizeText(input.note ?? ""),
    reviewedAt: input.reviewedAt,
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyChannelSettings(): NotificationChannelSettings {
  return {
    enabled: false,
    rules: [],
  };
}

export function createNotificationSettings(
  input?: CreateNotificationSettingsInput,
  now = Date.now(),
): NotificationSettings {
  return {
    id: createEntityId("notification-settings", now),
    enabled: input?.enabled ?? false,
    channels: {
      checkIn: input?.channels?.checkIn ?? createEmptyChannelSettings(),
      review: input?.channels?.review ?? createEmptyChannelSettings(),
    },
    lastNotifiedSlotId: input?.lastNotifiedSlotId ?? null,
    lastCheckedAt: input?.lastCheckedAt ?? null,
    updatedAt: now,
  };
}
