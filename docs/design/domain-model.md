# Domain Model Design

## Overview

本アプリは、反省点、振り返り、通知設定を別々の責務として扱う。

## ReflectionTheme

継続的に意識するテーマ。

```ts
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
```

## ReflectionReview

ある時点で記録された評価履歴。

```ts
export type ReviewScore = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ReflectionReview = {
  id: string;
  themeId: string;
  score: ReviewScore;
  note: string;
  reviewedAt: number;
  createdAt: number;
  updatedAt: number;
};
```

## NotificationSettings

ローカル通知判定のための設定本体。

```ts
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
```

## Relationships

- `ReflectionTheme` 1 件に対して `ReflectionReview` は複数件存在する
- `NotificationSettings` 1 件を複数の `ReflectionTheme` から参照できる
- `ReflectionReview` はテーマごとの時点評価を表す
- `NotificationSettings` は `check-in` / `review` の通知ルールと直近判定状態を表す
