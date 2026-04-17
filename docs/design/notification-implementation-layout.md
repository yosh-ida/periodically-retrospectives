# Notification Implementation Layout

## Goal

通知ロジックを UI と密結合させず、最小構成のファイル単位で責務分離する。

## Required Files

- `index.html`
- `app.js`
- `service-worker.js`
- `manifest.webmanifest`
- `db.js` または `schedule.js`
- `README.md`

## Responsibilities

### `index.html`

- PWA のエントリ HTML
- 通知設定 UI のマウント先を提供する

### `app.js`

- Service Worker を登録する
- `navigator.serviceWorker.ready` の後で `periodicSync` 利用可否を判定する
- `Notification.requestPermission()` を扱う
- 対応状況と登録状態を UI に表示する
- 手動テスト実行ボタンを提供する

### `service-worker.js`

- バックグラウンド処理基盤
- `periodicsync` を受けて `checkAndNotify()` を呼ぶ
- `activate` や `message` からも同じ判定関数を再利用する
- `notificationclick` を処理する

### `manifest.webmanifest`

- PWA として成立する最低限のメタデータを持つ
- 必須項目:
  - `name`
  - `short_name`
  - `start_url`
  - `display: "standalone"`
  - 適切な `icons`

### `db.js` または `schedule.js`

- IndexedDB への保存処理
- 通知設定の取得/更新
- スロット判定ヘルパー

### `README.md`

- 制約
- セットアップ手順
- 確認手順
- 対応ブラウザ条件

## Registration Rules

- `navigator.serviceWorker.ready` の後で `periodicSync` の可否を確認する
- 利用可能なら `reflection-notification-check` のようなタグ名で登録する
- `minInterval` は 12 時間を基本値とする
- ブラウザ裁量で実行頻度が変わる前提を崩さない

## Unsupported Cases

次のケースは UI 上で未対応として明示する。

- `serviceWorker` 非対応
- `periodicSync` 非対応
- `Notification` 非対応

この場合でも、無理に `setInterval` などでバックグラウンド動作を擬似実装しない。
