# AGENTS Guide

## Documentation Entry Points

実装前に次の順で確認すること。

1. `docs/implementation-plan.md`
2. 関連する `docs/features/`
3. 必要になったときだけ関連する `docs/design/`

## Document Map

### Plan

- `docs/implementation-plan.md`

### Feature Specs

- `docs/features/theme-management.md`
- `docs/features/review-workflow.md`
- `docs/features/notification-workflow.md`

### Design Specs

- `docs/design/domain-model.md`
- `docs/design/data-model.md`
- `docs/design/screen-flow.md`
- `docs/design/review-visualization.md`
- `docs/design/pwa-notification-architecture.md`
- `docs/design/notification-storage-and-scheduling.md`
- `docs/design/notification-implementation-layout.md`

## Usage Rules

- 実装順序は `docs/implementation-plan.md` に従う
- まず親プランを読んで、対象機能に関係する `docs/features/` だけを確認する
- 技術要件やデータ構造、画面詳細、通知実装などが必要になった時点で、対応する `docs/design/` を逐次参照する
- 機能要件は `docs/features/` を正とする
- 技術設計は参照した `docs/design/` を正とする
- 仕様変更時は、親プランと参照先の整合を保つ
