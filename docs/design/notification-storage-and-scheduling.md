# Notification Storage And Scheduling Design

## Goal

サーバーを使わず、ローカル保存だけでユーザー指定の頻度と時刻に基づく通知を 1 回ずつ管理する。

## Storage Policy

保存は IndexedDB を優先する。

最低限保持する情報:

- 通知有効フラグ
- 通知種別ごとのルール
  - `check-in`
  - `review`
  - 各ルールは `every-n-days` または `weekly-days`
  - 各ルールは時刻リストを持つ
- 直近で通知したスロット ID
- 次回判定基準時刻または最後に判定した時刻

## Suggested Shape

```ts
type NotificationRule =
  | {
      type: "every-n-days";
      intervalDays: number;
      times: string[]; // ["09:00"]
      anchorDate: string; // "2026-04-18"
    }
  | {
      type: "weekly-days";
      weekdays: number[]; // 0=Sun ... 6=Sat
      times: string[]; // ["08:30", "20:00"]
    };

type NotificationChannelSettings = {
  enabled: boolean;
  rules: NotificationRule[];
};

type NotificationSettings = {
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

## Slot Calculation

- 現在時刻をローカルタイムで取得する
- `check-in` / `review` それぞれの保存済みルールから、現在までに成立している通知候補スロットを計算する
- 現在がどのスロットを過ぎているかを判定する
- そのスロットが未通知なら通知する

## `checkAndNotify()` Requirements

`checkAndNotify()` は UI から独立した共通関数として設計する。

処理手順:

1. 現在時刻をローカルタイムで取得する
2. 保存済みの `check-in` / `review` ルールを読み込む
3. 各通知種別について現在までに成立している最新スロットを求める
4. そのスロット ID が未通知なら通知する
5. 通知後に `lastNotifiedSlotId` を保存する
6. `lastCheckedAt` を更新する

### Rule Evaluation Notes

- `every-n-days`
  - `anchorDate` を基準日とし、`intervalDays` ごとに通知対象日を決める
- `weekly-days`
  - `weekdays` に含まれる曜日だけ通知対象日にする
- `check-in` / `review` は別チャネルとして評価する
- どちらのルールでも `times` を展開してスロットを生成する
- 同一日時に複数ルールが重なる場合は、通知を 1 件にまとめるか、スロット ID にルール識別子を含めて別通知扱いにするかを実装時に決める

## Duplicate Prevention

- 同一スロット ID では二重通知しない
- `check-in` と `review` は同時刻でも別スロットとして扱える
- `10:30` に起動された場合でも、その時点で直近の未通知スロットを 1 回だけ通知できる
- `22:00` に起動された場合は、その時点で直近の未通知スロットだけを対象とする
- 過去の未通知スロットをまとめて複数件出すのではなく、その時点で対象となる 1 スロットだけを扱う

## Logging

DevTools の Periodic Background Sync デバッグを前提に、判定ログを明確に出す。

最低限出す内容:

- `checkAndNotify()` 実行元
  - `periodicsync`
  - `activate`
  - `message`
- 現在時刻
- 判定された対象スロット
- 通知したかどうか
- 重複スキップ理由
