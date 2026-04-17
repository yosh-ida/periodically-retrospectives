# Data Model Design

## Storage Strategy

Dexie と IndexedDB を使い、ローカルファーストで反省点、振り返り、通知設定を保持する。

通知は未来分の予定を事前生成して保存するのではなく、Periodic Background Sync 実行時に保存済みルールから都度判定する。

## Tables

```ts
db.version(1).stores({
  themes: "id, notificationSettingsId, isArchived, updatedAt",
  reviews: "id, themeId, reviewedAt, updatedAt",
  notificationSettings: "id, enabled, updatedAt"
});
```

## Table Roles

### `themes`

- 反省点本体を保持する
- 通知設定との関連づけを保持する
- 一覧表示とアーカイブ制御に使う

### `reviews`

- 振り返り履歴を保持する
- テーマ別履歴と時系列表示に使う
- 期間評価ではなく、その時点での自己評価を保持する
- 折れ線グラフと週次・月次集約表示のデータソースとして使う

### `notificationSettings`

- 通知設定本体を保持する
- `check-in` / `review` のチャネル別ルールを保持する
- 直近で通知したスロット ID と最終判定時刻を保持する

## Record Shapes

### `themes`

```ts
type ThemeRecord = {
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

### `reviews`

```ts
type ReviewRecord = {
  id: string;
  themeId: string;
  score: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  note: string;
  reviewedAt: number;
  createdAt: number;
  updatedAt: number;
};
```

### `notificationSettings`

```ts
type NotificationRule =
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

type NotificationChannelSettings = {
  enabled: boolean;
  rules: NotificationRule[];
};

type NotificationSettingsRecord = {
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

## Index Policy

- `themes.notificationSettingsId`
  - テーマと通知設定の関連検索用
- `themes.isArchived`
  - アクティブ一覧の抽出用
- `themes.updatedAt`
  - 更新順表示用
- `reviews.themeId`
  - テーマ別履歴用
- `reviews.reviewedAt`
  - 振り返りの新しい順表示用
- `reviews.themeId + reviewedAt`
  - テーマ別の推移グラフ描画用
- `reviews.updatedAt`
  - 再編集後の並び替え用
- `notificationSettings.enabled`
  - 有効な通知設定の抽出用
- `notificationSettings.updatedAt`
  - 更新順確認用

## Consistency Rules

- `themes.notificationSettingsId` を持つ場合、参照先の `notificationSettings.id` が存在する
- テーマ更新時に通知設定参照が変わることはあるが、通知予定の事前生成は行わない
- アーカイブ時も `reviews` 履歴は保持する
- `reviews` は期間単位の upsert を前提にせず、各記録を時点評価として保存する
- 推移グラフは `reviews.themeId` と `reviewedAt` の昇順で描画する
- 週次・月次の集約値や `note` 一覧は保存せず、描画時に `reviews` から導出する
- 通知判定時は `notificationSettings.channels.checkIn` / `review` を別々に評価する
- 同一スロットの二重通知防止は `lastNotifiedSlotId` で管理する

## Notification Runtime Storage

Periodic Background Sync ベースの通知実装では、`notificationSettings` テーブルの中に通知実行に必要な状態を保持する。

- 通知有効フラグ
- 通知種別ごとのルール
  - `check-in`
  - `review`
  - `every-n-days`
  - `weekly-days`
  - 時刻リスト
- 直近で通知したスロット ID
- 最後に判定した時刻

詳細は [通知ストレージと判定ロジック](./notification-storage-and-scheduling.md) を参照する。
