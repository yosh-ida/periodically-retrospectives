# Documentation Index

このディレクトリは、実装計画・機能仕様・設計仕様を分離して管理するための入口である。

## 読み始める順序

1. [implementation-plan.md](./implementation-plan.md)
2. [features/theme-management.md](./features/theme-management.md)
3. [features/review-workflow.md](./features/review-workflow.md)
4. [features/notification-workflow.md](./features/notification-workflow.md)
5. [design/domain-model.md](./design/domain-model.md)
6. [design/data-model.md](./design/data-model.md)
7. [design/screen-flow.md](./design/screen-flow.md)
8. [design/review-visualization.md](./design/review-visualization.md)
9. [design/pwa-notification-architecture.md](./design/pwa-notification-architecture.md)
10. [design/notification-storage-and-scheduling.md](./design/notification-storage-and-scheduling.md)
11. [design/notification-implementation-layout.md](./design/notification-implementation-layout.md)

## ディレクトリ構成

```text
docs/
  README.md
  implementation-plan.md
  features/
    theme-management.md
    review-workflow.md
    notification-workflow.md
  design/
    domain-model.md
    data-model.md
    notification-implementation-layout.md
    notification-storage-and-scheduling.md
    review-visualization.md
    screen-flow.md
    pwa-notification-architecture.md
```

## 役割分担

- `implementation-plan.md`
  - 実装順序、参照先、完了条件だけを持つ親プラン
- `features/`
  - ユーザー価値とユースケースを機能単位で記述する
- `design/`
  - 実装判断に必要な技術設計を責務ごとに記述する

## 命名方針

- ファイル名は小文字 kebab-case に統一する
- `features/` には「何を提供するか」を置く
- `design/` には「どう実現するか」を置く
- 1 ファイル 1 主題を原則とし、プランから参照しやすい粒度を保つ
