# Theme Management Feature

## Purpose

ユーザーが継続的に意識したい反省点を登録し、必要に応じて更新しながら運用できるようにする。

## User Value

- 課題と原因を明文化できる
- 達成したいゴールを明確に持てる
- 通知設定と紐づけながら反省点を運用できる
- 反省点の作成中に通知設定もまとめて初期設定できる

## Inputs

- 課題
- 原因
- 達成したいゴール
- 通知設定への参照
  - 詳細な通知頻度・通知時刻・通知種別の定義は [Notification Workflow Feature](./notification-workflow.md) を正とする

## Behaviors

### 作成

- 必須項目を入力して反省点を作成できる
- 作成後はダッシュボードに反映される
- 作成時に通知設定との関連づけを保存できる
- `/themes/new` で通知設定を新規追加する場合、その場で初期ルールまで編集してから保存できる

### 編集

- 既存の反省点を更新できる
- 通知設定の変更は通知機能側の定義に従って反映される

### アーカイブ

- 不要になった反省点はアーカイブできる
- アーカイブ済み反省点は通常一覧から除外する
- 関連する振り返り履歴は保持する

## Validation Rules

- `issue`, `cause`, `goal` は必須
- 通知関連項目をテーマ管理機能内で独自定義しない
- 通知設定を参照する場合、その妥当性判定は [Notification Workflow Feature](./notification-workflow.md) の定義に従う

## Main Screens

- ダッシュボード `/`
- 反省点作成ページ `/themes/new`
- 反省点編集ページ `/themes/:id/edit`
- 反省点詳細ページ `/themes/:id`

## UX Notes

- 反省点作成ページでは、通知設定の参照先を選ぶだけでなく、新規追加した通知設定を同一画面で編集できるようにする
- ユーザー向け UI では開発フェーズや未完成前提を示す文言を表示しない

## Dependencies

- [ドメインモデル](../design/domain-model.md)
- [データ設計](../design/data-model.md)
- [画面フロー](../design/screen-flow.md)
- [通知フロー](./notification-workflow.md)
- [PWA 通知アーキテクチャ](../design/pwa-notification-architecture.md)
