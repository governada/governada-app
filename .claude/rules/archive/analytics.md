---
paths:
  - 'lib/posthog*.ts'
  - 'components/**'
  - 'app/**/page.tsx'
---

# Analytics Rules

- Every new user interaction must include a PostHog event in the same diff
- Client: `posthog.capture()` via `lib/posthog.ts`
- Server: `captureServerEvent()` via `lib/posthog-server.ts`
- Event naming convention: `noun_verb` (e.g., `drep_viewed`, `quiz_completed`, `delegation_started`)
- After deploy: verify with `npm run posthog:check <event_name>`
