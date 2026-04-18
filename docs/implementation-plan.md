# Periodically Retrospectives Implementation Plan

## Goal

反省点管理、7 段階の振り返り、PWA 通知を備えたローカルファーストなアプリを段階的に実装する。

この文書は親プランであり、仕様本文は `docs/features/` と `docs/design/` を参照する。

## Related Documents

### 機能仕様

- [反省点管理](./features/theme-management.md)
- [振り返りフロー](./features/review-workflow.md)
- [通知フロー](./features/notification-workflow.md)

### 設計仕様

- [ドメインモデル](./design/domain-model.md)
- [データ設計](./design/data-model.md)
- [画面フロー](./design/screen-flow.md)
- [振り返り可視化設計](./design/review-visualization.md)
- [PWA 通知アーキテクチャ](./design/pwa-notification-architecture.md)
- [通知ストレージと判定ロジック](./design/notification-storage-and-scheduling.md)
- [通知実装ファイル構成](./design/notification-implementation-layout.md)

## Implementation Phases

### Phase 1. ドメインと保存層の再定義

参照:

- [反省点管理](./features/theme-management.md)
- [振り返りフロー](./features/review-workflow.md)
- [ドメインモデル](./design/domain-model.md)
- [データ設計](./design/data-model.md)

作業:

- `entries` ベースの現在モデルを廃止する
- 反省点、振り返り、通知設定の型を定義する
- Dexie schema を複数テーブル構成へ移行する

完了条件:

- 反省点・振り返り・通知設定を個別に保存できる

### Phase 2. 反省点管理の実装

参照:

- [反省点管理](./features/theme-management.md)
- [画面フロー](./design/screen-flow.md)

作業:

- 反省点の作成、編集、一覧、アーカイブを実装する
- ダッシュボードと詳細ページを実装する

完了条件:

- ユーザーが課題・原因・ゴールと通知設定との関連づけを保存、更新できる

### Phase 3. 振り返り入力の実装

参照:

- [振り返りフロー](./features/review-workflow.md)
- [ドメインモデル](./design/domain-model.md)
- [画面フロー](./design/screen-flow.md)
- [振り返り可視化設計](./design/review-visualization.md)

作業:

- 7 段階評価 UI を実装する
- 振り返り結果の保存を実装する
- `/themes/:id` の推移グラフを実装する
- グラフの表示間隔切替と週次・月次集約表示を実装する
- `note` 付きデータ点の詳細表示を実装する

完了条件:

- 振り返りを時点評価として記録でき、表示間隔を切り替えながら推移グラフで確認できる

### Phase 4. 通知スケジューリングの実装

参照:

- [通知フロー](./features/notification-workflow.md)
- [データ設計](./design/data-model.md)
- [PWA 通知アーキテクチャ](./design/pwa-notification-architecture.md)
- [通知ストレージと判定ロジック](./design/notification-storage-and-scheduling.md)
- [通知実装ファイル構成](./design/notification-implementation-layout.md)

作業:

- `checkAndNotify()` を中心に通知判定を実装する
- `check-in` / `review` 別の通知ルール保存を実装する
- 起動時、復帰時、`periodicsync` 時の判定を実装する
- 通知クリック時の遷移情報を整える

完了条件:

- `check-in` 通知と `review` 通知が適切な画面へ誘導できる

### Phase 5. PWA 統合

参照:

- [通知フロー](./features/notification-workflow.md)
- [PWA 通知アーキテクチャ](./design/pwa-notification-architecture.md)
- [通知実装ファイル構成](./design/notification-implementation-layout.md)

作業:

- manifest と Service Worker を実装する
- 通知許可フローを UI に組み込む
- `check-in` / `review` を別個に設定できる通知ルール UI を組み込む
- 通知クリック時の画面遷移を完成させる
- `reflection-notification-check` の periodic sync 登録を組み込む

完了条件:

- PWA としてインストールでき、通知から対象画面を開ける

### Phase 6. 品質向上

参照:

- [反省点管理](./features/theme-management.md)
- [振り返りフロー](./features/review-workflow.md)
- [通知フロー](./features/notification-workflow.md)
- [データ設計](./design/data-model.md)

作業:

- duplicate review 防止を確認する
- グラフ表示切替、平均値丸め、`note` 集約表示の動作を確認する
- 日付境界と通知ルール解釈のテストを追加する
- README とドキュメント索引を更新する
- PWA 専用ランディングや onboarding を検討し、インストール訴求と初回導線を必要に応じて追加する

完了条件:

- 主要ロジックの再現性をテストで確認できる

## Initial File Targets

最初に置き換える対象は次の通り。

- `src/db.ts`
- `src/store.ts`
- `src/App.tsx`

その後、責務ごとに分割する。

- `src/db/`
- `src/store/`
- `src/features/notifications/`
- `src/pages/`
- `src/components/`

## Phase Completion Checklist

各 Phase の実装を完了扱いにする前に、次を順に実施する。

1. その Phase で追加・変更したロジックに対するテスト、型チェック、build を実行する
2. chrome-devtools MCP を使ってブラウザ上で対象機能の E2E 検証を行う
3. 少なくとも次を確認する
   - 初期表示時に console error が出ていない
   - その Phase の主要導線を実際に操作できる
   - 画面遷移、保存、表示更新が仕様どおりに動く
4. 問題が見つかった場合は、その場で原因を特定して修正し、同じ E2E 手順で再確認する
5. 上記の確認が終わってから、その Phase を完了とみなす

## Acceptance Summary

- 反省点を登録、編集、一覧表示、アーカイブできる
- 振り返りを 7 段階評価で保存できる
- `/themes/:id` で振り返り推移を折れ線グラフで確認できる
- グラフの表示間隔を `そのまま` `週単位` `月単位` で切り替えられる
- `note` 付きデータ点からメモ内容を確認できる
- `check-in` / `review` を別個のルールで通知できる
- 通知から対象画面へ遷移できる
- アプリ再起動後もデータが保持される
