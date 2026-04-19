# Periodic Retrospectives

Periodic Retrospectives is a local-first reflection app for tracking themes,
recording 7-point reviews, visualizing changes over time, and scheduling
`check-in` / `review` reminders.

The current implementation includes:

- theme creation, editing, archiving, and dashboard listing
- review entry and editing on `/themes/:id/review`
- raw / weekly / monthly review charts on `/themes/:id`
- duplicate-review prevention for the same theme and `reviewedAt`
- per-theme notification settings for `check-in` and `review`
- installable PWA metadata, Service Worker registration, Periodic Sync wiring, and onboarding guidance for installed-PWA usage

## Commands

```bash
npm install
npm run dev
npm test
npm run check
```

## PWA / Notification Notes

- Open the app in Chrome or another Chromium browser for the full PWA flow.
- Background notification flow assumes an installed PWA launched in standalone app mode.
- Unsupported environments should be treated as unavailable rather than partially supported.
- Visit a theme's notification settings page to:
  - follow the onboarding message for install / permission / periodic sync order
  - request notification permission
  - register `reflection-notification-check`
  - run the notification judge manually
  - inspect install availability and standalone status
- The Service Worker handles:
  - `activate`
  - `message`
  - `periodicsync`
  - `notificationclick`

## Review Notes

- Reviews are point-in-time records, not period upserts.
- A theme cannot store two reviews with the same `reviewedAt`; edit the existing record instead.
- Notes are shown only for chart points or aggregate periods that actually include notes.

## Documents

- Plan: [docs/implementation-plan.md](./docs/implementation-plan.md)
- Features:
  - [docs/features/theme-management.md](./docs/features/theme-management.md)
  - [docs/features/review-workflow.md](./docs/features/review-workflow.md)
  - [docs/features/notification-workflow.md](./docs/features/notification-workflow.md)
- Design:
  - [docs/design/domain-model.md](./docs/design/domain-model.md)
  - [docs/design/data-model.md](./docs/design/data-model.md)
  - [docs/design/screen-flow.md](./docs/design/screen-flow.md)
  - [docs/design/review-visualization.md](./docs/design/review-visualization.md)
  - [docs/design/pwa-notification-architecture.md](./docs/design/pwa-notification-architecture.md)
  - [docs/design/notification-storage-and-scheduling.md](./docs/design/notification-storage-and-scheduling.md)
  - [docs/design/notification-implementation-layout.md](./docs/design/notification-implementation-layout.md)
