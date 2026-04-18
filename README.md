# Periodic Retrospectives

Phase 1 of the implementation plan is now the active scope.

This repository currently keeps only the domain and storage foundation for:

- `ReflectionTheme`
- `ReflectionReview`
- `NotificationSettings`

The app intentionally does not include later-phase navigation, visualization, or PWA behavior yet.

## Current UI

The temporary UI is a Phase 1 workspace that helps confirm:

- the three domain models are separate
- the Dexie table definitions match the data model
- sample records can be inserted into IndexedDB and cleared again

## Commands

```bash
npm install
npm run dev
npm test
node ./node_modules/typescript/bin/tsc -b
```

`npm test` runs the Phase 1 domain and schema checks without adding an external test runner.

## Documents

- Plan: [docs/implementation-plan.md](./docs/implementation-plan.md)
- Features:
  - [docs/features/theme-management.md](./docs/features/theme-management.md)
  - [docs/features/review-workflow.md](./docs/features/review-workflow.md)
  - [docs/features/notification-workflow.md](./docs/features/notification-workflow.md)
- Design:
  - [docs/design/domain-model.md](./docs/design/domain-model.md)
  - [docs/design/data-model.md](./docs/design/data-model.md)

## Phase 1 Notes

- `src/domain.ts` defines the Phase 1 domain types and constructors.
- `src/db.ts` defines the Dexie schema and a small demo-data helper.
- `src/store.ts` only manages lightweight UI status for the Phase 1 workspace.
- `src/App.tsx` is a temporary inspection screen, not the final product UI.
