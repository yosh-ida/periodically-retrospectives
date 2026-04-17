# Review Workflow Feature

## Purpose

ユーザーが反省点ごとに、通知設定に対応した達成度を 7 段階で振り返り、履歴として蓄積できるようにする。

## User Value

- ゴールに対する達成度を定期的に可視化できる
- 自己評価を履歴として残せる
- 通知設定に応じた振り返り運用に対応できる
- 振り返り結果の推移をグラフで見返せる

## Review Rules

- 評価値は `1` から `7`
- 任意メモを残せる
- 振り返りの通知導線や通知頻度の定義は [Notification Workflow Feature](./notification-workflow.md) を正とする
- 振り返りは期間集計ではなく、その時点での自己評価として記録する

## Behaviors

### 新規記録

- `review` 通知または詳細ページから振り返りページを開ける
- テーマ内容を確認したうえで評価を保存できる

### 再編集

- 既存の振り返り記録を更新できる
- 履歴一覧から過去の振り返りを見返せる

### 推移の可視化

- `/themes/:id` で過去の振り返り結果を折れ線グラフとして表示する
- 横軸の表示間隔は `そのまま` `週単位` `月単位` で切り替えられる
- `そのまま` では横軸は `reviewedAt` の時系列、縦軸は 7 段階評価の `score` とする
- `週単位` と `月単位` では、その期間内の平均スコアを丸めて縦軸の値とする
- `note` を持つデータ点は識別できる見た目にする
- 集約表示では、対象期間内にある `note` をまとめて確認できる
- `note` を持つデータ点を選択したとき、そのメモ内容を確認できる
- `note` がないデータ点では追加情報を表示しない

## Main Screens

- 振り返りページ `/themes/:id/review`
- 反省点詳細ページ `/themes/:id`

## Dependencies

- [ドメインモデル](../design/domain-model.md)
- [データ設計](../design/data-model.md)
- [画面フロー](../design/screen-flow.md)
- [振り返り可視化設計](../design/review-visualization.md)
- [通知フロー](./notification-workflow.md)
