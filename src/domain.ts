export type ReviewScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ThemeInput = {
  issue: string;
  cause: string;
  goal: string;
  notificationSettingsId?: string | null;
};

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

export type ReviewDuplicateCandidate = {
  themeId: string;
  reviewedAt: number;
  excludeReviewId?: string;
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

export type NotificationChannelSettingsInput = {
  enabled: boolean;
  rules: NotificationRule[];
};

export type NotificationSettingsInput = {
  enabled: boolean;
  channels: {
    checkIn: NotificationChannelSettingsInput;
    review: NotificationChannelSettingsInput;
  };
  lastNotifiedSlotId?: string | null;
  lastCheckedAt?: number | null;
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

type CreateReflectionThemeInput = ThemeInput & {
  isArchived?: boolean;
};

type CreateReflectionReviewInput = {
  themeId: string;
  score: number;
  note?: string;
  reviewedAt: number;
};

type UpdateReflectionReviewInput = {
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

function normalizeThemeInput(input: ThemeInput) {
  return {
    issue: normalizeText(input.issue),
    cause: normalizeText(input.cause),
    goal: normalizeText(input.goal),
    notificationSettingsId: input.notificationSettingsId ?? null,
  };
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
  const { cause, goal, issue, notificationSettingsId } = normalizeThemeInput(input);

  requireTextFields({ issue, cause, goal });

  return {
    id: createEntityId("theme", now),
    issue,
    cause,
    goal,
    notificationSettingsId,
    isArchived: input.isArchived ?? false,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateReflectionTheme(
  theme: ReflectionTheme,
  input: ThemeInput,
  now = Date.now(),
): ReflectionTheme {
  const { cause, goal, issue, notificationSettingsId } = normalizeThemeInput(input);

  requireTextFields({ issue, cause, goal });

  return {
    ...theme,
    issue,
    cause,
    goal,
    notificationSettingsId,
    updatedAt: now,
  };
}

export function archiveReflectionTheme(
  theme: ReflectionTheme,
  now = Date.now(),
): ReflectionTheme {
  return {
    ...theme,
    isArchived: true,
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

export function updateReflectionReview(
  review: ReflectionReview,
  input: UpdateReflectionReviewInput,
  now = Date.now(),
): ReflectionReview {
  if (!isReviewScore(input.score)) {
    throw new Error("score must be between 1 and 7");
  }

  return {
    ...review,
    score: input.score,
    note: normalizeText(input.note ?? ""),
    reviewedAt: input.reviewedAt,
    updatedAt: now,
  };
}

export function findDuplicateReview(
  reviews: ReflectionReview[],
  candidate: ReviewDuplicateCandidate,
): ReflectionReview | null {
  return (
    reviews.find((review) => {
      if (candidate.excludeReviewId && review.id === candidate.excludeReviewId) {
        return false;
      }

      return review.themeId === candidate.themeId && review.reviewedAt === candidate.reviewedAt;
    }) ?? null
  );
}

function createEmptyChannelSettings(): NotificationChannelSettings {
  return {
    enabled: false,
    rules: [],
  };
}

function normalizeTimes(times: string[]) {
  const values = times
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const invalidTime = values.find((value) => !/^\d{2}:\d{2}$/.test(value));
  if (invalidTime) {
    throw new Error("times must use HH:MM format");
  }

  return [...new Set(values)].sort();
}

function normalizeWeekdays(weekdays: number[]) {
  const values = [...new Set(weekdays)].sort((left, right) => left - right);
  const invalidWeekday = values.find((value) => !Number.isInteger(value) || value < 0 || value > 6);
  if (invalidWeekday !== undefined) {
    throw new Error("weekdays must be between 0 and 6");
  }

  return values;
}

function normalizeNotificationRule(rule: NotificationRule): NotificationRule {
  if (rule.type === "every-n-days") {
    if (!Number.isInteger(rule.intervalDays) || rule.intervalDays < 1) {
      throw new Error("intervalDays must be 1 or greater");
    }

    return {
      ...rule,
      anchorDate: rule.anchorDate.trim(),
      times: normalizeTimes(rule.times),
    };
  }

  return {
    ...rule,
    weekdays: normalizeWeekdays(rule.weekdays),
    times: normalizeTimes(rule.times),
  };
}

function normalizeChannelSettings(
  settings: NotificationChannelSettingsInput,
): NotificationChannelSettings {
  return {
    enabled: settings.enabled,
    rules: settings.rules.map(normalizeNotificationRule),
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

export function updateNotificationSettings(
  settings: NotificationSettings,
  input: NotificationSettingsInput,
  now = Date.now(),
): NotificationSettings {
  return {
    ...settings,
    enabled: input.enabled,
    channels: {
      checkIn: normalizeChannelSettings(input.channels.checkIn),
      review: normalizeChannelSettings(input.channels.review),
    },
    lastNotifiedSlotId: input.lastNotifiedSlotId ?? null,
    lastCheckedAt: input.lastCheckedAt ?? null,
    updatedAt: now,
  };
}
