# Notification Workflow Feature

## Purpose

インストール済み PWA を通常タブではなくアプリとして起動している前提で、Periodic Background Sync + Service Worker + Notification API を使い、ユーザーが指定した頻度と時刻に基づく通知導線を提供する。通知は `反省点確認` と `振り返り` の 2 種類を持ち、それぞれ別個に設定できる。

## Scope

- ユーザー指定ルールに基づく通知判定
- 固定文面のローカル通知
- バックグラウンド起動が遅れた場合の 1 回だけ通知
- 非対応環境での unavailable 表示

この機能では、自前バックエンド、Push API、iOS 対応は扱わない。

## Target Environment

- Chrome / Chromium 系
- Android 系相当
- インストール済み PWA
- アプリ起動モード

## Out Of Scope

- iOS Safari / iOS PWA 対応
- Push API
- 自前サーバー
- 定刻どおりの厳密な通知保証
- 非対応環境での疑似バックグラウンド実装

## Notification Policy

- 通知は次の 2 種類を持つ
  - `check-in`
    - 反省点確認を誘導する通知
  - `review`
    - 振り返りを誘導する通知
- `check-in` と `review` は別個に通知ルールを指定できる
- 最低限サポートする指定形式:
  - 何日に 1 回
  - 毎週の何曜日
  - 1 日の中で 1 つ以上の通知時刻
- 例:
  - `check-in`: 2 日に 1 回の `09:00`
  - `review`: 毎週 月曜と木曜の `21:00`
  - `check-in`: 毎週 月曜と木曜の `08:30`
  - `review`: 毎週 月曜と木曜の `20:00`
- 時刻はユーザーのローカルタイムで扱う
- ブラウザ実行が遅れた場合でも、そのスロットが未通知なら 1 回だけ通知する
- 同一スロットでは二重通知しない

### Supported Rule Types

- `every-n-days`
  - 例: `intervalDays = 2`
- `weekly-days`
  - 例: `weekdays = [1, 4]`

どちらのルールでも、時刻は複数指定できる。

### Slot ID

通知の一意性はスロット ID で管理する。

- 例: `check-in-2026-04-18T09:00`
- 例: `review-2026-04-21T20:00`

必要ならルール識別子を含めてよい。

- 例: `review-rule-weekly-1-2026-04-21T20:00`

## User Flows

### 初回有効化

1. ユーザーが通知 UI を開く
2. ブラウザ互換性を確認する
3. 通知権限を要求する
4. `granted` の場合のみ periodic sync 登録を試みる
5. 結果を UI に表示する

### バックグラウンド通知

1. ブラウザが `periodicsync` を発火する
2. Service Worker が `checkAndNotify()` を呼ぶ
3. 現在時刻と `check-in` / `review` それぞれの設定ルールから通知対象スロットを判定する
4. 未通知なら 1 回だけ通知する

### ルール設定フロー

1. ユーザーが通知設定 UI を開く
2. `check-in` または `review` の設定対象を選ぶ
3. 頻度種別を選ぶ
4. 日数間隔または曜日を指定する
5. 通知時刻を 1 つ以上指定する
   - 時刻は自由テキストではなく、時計 UI や候補選択 UI から選べるようにする
6. 保存後、次回以降の判定に反映する

### アプリ起動時の補完

1. アプリ起動後に Service Worker の準備完了を待つ
2. periodic sync 利用可否を判定する
3. 必要に応じて Service Worker へ message を送り `checkAndNotify()` を再利用する

## UI Requirements

フロントエンドには最低限、次を表示する。

- 通知権限状態
- periodic sync 登録状態
- `check-in` の通知ルール
- `review` の通知ルール
- 最後に通知したスロット ID
- 対応状況
  - `serviceWorker` 非対応
  - `periodicSync` 非対応
  - `Notification` 非対応
- 頻度設定 UI
  - `check-in` 用
    - 日数間隔
    - 曜日選択
    - 時刻リスト
  - `review` 用
    - 日数間隔
    - 曜日選択
    - 時刻リスト
- `checkAndNotify()` 手動実行ボタン

### Input UX Requirements

- 通知時刻は `HH:MM` の自由入力ではなく、誤入力を避けられる選択式 UI で設定できる
- 時刻の追加、削除、並び替えは画面上で完結できる
- `every-n-days` の基準日と `weekly-days` の曜日選択も、入力ミスを起こしにくい UI で扱う
- 通知設定ページと `/themes/new` の簡易編集 UI で、同じルール編集体験を提供する

## Notification Content

通知本文は固定文面でよいが、将来的に差し替えやすいよう関数化する。

- `check-in`
  - 反省点確認用の文面
- `review`
  - 振り返り用の文面

最低限指定する項目:

- `title`
- `body`
- `tag`
- `renotify`

`tag` にはスロット ID を使い、同一スロットの重複表示を避ける。

## Dependencies

- [PWA 通知アーキテクチャ](../design/pwa-notification-architecture.md)
- [通知ストレージと判定ロジック](../design/notification-storage-and-scheduling.md)
- [通知実装ファイル構成](../design/notification-implementation-layout.md)
