# Periodic Retrospectives

反省点の管理、7 段階の振り返り、PWA 通知を組み合わせて、継続的な内省を支援するローカルファーストなアプリです。

## Features

- 反省点を課題、原因、ゴールとあわせて登録、編集、アーカイブできる
- 振り返りを 7 段階評価と任意メモで記録できる
- `/themes/:id` で振り返り推移を折れ線グラフとして確認できる
- グラフの表示間隔を `そのまま` `週単位` `月単位` で切り替えられる
- `note` がある点、または集約期間に含まれる `note` を確認できる
- `check-in` と `review` の 2 種類の通知を別個に設定できる
- 通知ルールは `何日に 1 回` または `毎週の何曜日` と、1 つ以上の時刻で指定できる

## Notification Constraints

- Push API は使わないため、自前サーバーは不要です
- 通知は Periodic Background Sync + Service Worker + Notification API を前提にします
- バックグラウンド実行の頻度とタイミングはブラウザ依存です
- インストール済み PWA をアプリとして起動している状態での利用を前提にしています
- 対応ブラウザでのみ動作します
- 正確な定刻通知は保証しません
- 対象は Chrome / Chromium 系 + Android 系相当です
- iOS 対応は行いません
- `serviceWorker` `periodicSync` `Notification` のいずれかが使えない場合は、未対応として明示し、無理に代替しません

## Tech Notes

- データ保存は IndexedDB / Dexie を前提にします
- 通知は未来分の予定を事前生成せず、保存済みルールから都度判定します
- 振り返りは期間集計ではなく、その時点での自己評価として保存します
- 週次・月次グラフの平均値や `note` 集約結果は保存せず、描画時に導出します

## Documentation

- 親プラン: [docs/implementation-plan.md](./docs/implementation-plan.md)
- ドキュメント索引: [docs/README.md](./docs/README.md)
- 機能仕様:
  - [docs/features/theme-management.md](./docs/features/theme-management.md)
  - [docs/features/review-workflow.md](./docs/features/review-workflow.md)
  - [docs/features/notification-workflow.md](./docs/features/notification-workflow.md)
- 設計仕様:
  - [docs/design/domain-model.md](./docs/design/domain-model.md)
  - [docs/design/data-model.md](./docs/design/data-model.md)
  - [docs/design/screen-flow.md](./docs/design/screen-flow.md)
  - [docs/design/review-visualization.md](./docs/design/review-visualization.md)
  - [docs/design/pwa-notification-architecture.md](./docs/design/pwa-notification-architecture.md)
  - [docs/design/notification-storage-and-scheduling.md](./docs/design/notification-storage-and-scheduling.md)
  - [docs/design/notification-implementation-layout.md](./docs/design/notification-implementation-layout.md)

## Local Development

```bash
npm install
npm run dev
```

`localhost` またはローカル HTTPS でアプリを起動し、PWA と Service Worker が使える状態で確認してください。

## Setup Steps

1. `localhost` またはローカル HTTPS でアプリを起動する
2. PWA をインストールする
3. 一度アプリとして起動する
4. 通知権限を許可する
5. periodic sync 登録状態を確認する
6. `check-in` / `review` の通知ルールを設定する
7. テーマを作成し、必要なら通知設定と関連づける

## Verification Steps

1. 通知権限状態を UI で確認する
2. periodic sync 登録状態を UI で確認する
3. 手動実行で `checkAndNotify()` を試す
4. `check-in` 通知と `review` 通知から対象画面へ遷移できることを確認する
5. 振り返りを記録し、`/themes/:id` に折れ線グラフが反映されることを確認する
6. グラフの表示間隔を `そのまま` `週単位` `月単位` で切り替えられることを確認する
7. `note` 付きデータ点、または集約点からメモ内容を確認できることを確認する
8. DevTools の Application パネルで Service Worker 状態を確認する
9. DevTools の Periodic background sync 状態を確認する

## Local Verification

```bash
npm run check
```

TypeScript build と Vite production build を実行します。

## Local Preview

```bash
npm run preview
```

`http://localhost:4173` でローカル preview を確認できます。
