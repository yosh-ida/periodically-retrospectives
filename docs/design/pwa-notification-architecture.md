# PWA Notification Architecture

## Goal

自前バックエンドや Push API を使わず、Periodic Background Sync + Service Worker + Notification API を使って、`反省点確認` と `振り返り` の 2 種類の通知を、ユーザー指定の頻度と時刻に基づいて実現する。

## Preconditions

- インストール済み PWA である
- 通常タブではなくアプリとして起動されている
- Chrome / Chromium 系 + Android 系相当を対象とする
- iOS 対応は行わない

## Design Principles

- 正確な定刻保証はしない
- 「定刻を少し過ぎても、そのスロットの通知を 1 回だけ出す」を採用する
- ブラウザ非対応時は明示的に unavailable とし、偽装しない
- Service Worker 側の共通判定関数を中心に構成する
- 通知判定は固定時刻ではなく、ユーザー保存済みルールから導出する
- `check-in` と `review` は別チャネルとして保存、判定、表示する

## Browser Capability Branches

UI では次を必ず分岐表示する。

- `serviceWorker` 非対応
- `Notification` 非対応
- `periodicSync` 非対応

非対応時の挙動:

- 通知機能は無効化する
- 他機能は継続利用可能にする
- 背景代替実装は行わない

## Runtime Architecture

### Frontend

- Service Worker を登録する
- `navigator.serviceWorker.ready` を待つ
- `registration.periodicSync` の利用可否を確認する
- 通知権限を確認、必要なら要求する
- `granted` の場合のみ periodic sync 登録を試みる
- 状態表示と通知ルール編集 UI を行う
- 通知時刻の編集は自由入力ではなく、誤入力を防げる選択式 UI を基本とする

### Service Worker

- `periodicsync` を受け取る
- `activate` でも必要に応じて同じ通知判定関数を呼べるようにする
- `message` 経由でも同じ通知判定関数を呼べるようにする
- `notificationclick` を処理する

### Common Notification Judge

- `checkAndNotify()` を中心に据える
- 判定、重複防止、通知表示、保存更新を一箇所に集約する
- フロントエンド、起動時補完、Service Worker のいずれから呼ばれてもローカルタイム基準で同じ結果になるようにする
- ルール解釈
  - `check-in`
  - `review`
  - `every-n-days`
  - `weekly-days`
  を同じ判定入口で扱う

## Periodic Sync Registration

- タグ名例: `reflection-notification-check`
- `minInterval` は 12 時間を基本値にする
- これは 1 日内の複数通知時刻を取りこぼしにくくするための基本値であり、実行保証値ではない
- ブラウザが頻度を裁量調整する前提で設計する

## Notification Display Rules

通知表示時は `registration.showNotification()` を使う。

最低限指定する項目:

- `title`
- `body`
- `tag`
- `renotify`

`tag` はスロット ID を使い、同一スロットの重複表示を避ける。

通知文面生成は通知種別ごとに分ける。

- `check-in`
  - 反省点確認ページへ誘導する
- `review`
  - 振り返りページへ誘導する

## Permission Handling

- 初回利用時に `Notification.requestPermission()` を行う
- `granted` 以外なら periodic sync 登録前に理由を UI で説明する
- 権限未許可時は通知機能を無効化する

## Dev Experience

開発用 UI には次を含める。

- 通知権限状態
- periodic sync 登録状態
- `check-in` の通知ルール
- `review` の通知ルール
- 最後に通知したスロット ID
- `checkAndNotify()` 手動実行ボタン

Chrome DevTools の Application パネルにある Periodic background sync デバッグを前提とし、Service Worker とフロントエンドの双方でログを明確に出す。

## Product UI Notes

- 一般ユーザー向け画面では、開発フェーズや未完成前提のコピーを表示しない
- product ready な画面では、状態説明と設定操作を中心に構成し、内部実装段階を想起させるラベルは避ける

## Related Documents

- [通知フロー](../features/notification-workflow.md)
- [通知ストレージと判定ロジック](./notification-storage-and-scheduling.md)
- [通知実装ファイル構成](./notification-implementation-layout.md)
