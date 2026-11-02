# TrailSync Milestones

The roadmap, in build order. Each phase depends on the ones before it.

- Business rules and open decisions: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)
- API endpoints: [`API_CONTRACT_V1.md`](API_CONTRACT_V1.md)
- Engineering conventions: [`CODING_PRINCIPLES.md`](CODING_PRINCIPLES.md)
- The guide app is the Flutter project in the separate `TrailSync-Mountain-Trek-Guide-Application` repo. Its paths below start with `lib/` or `test/`.

`[x]` done · `[~]` partly done · `[ ]` not started · **Blocked:** needs a business decision first

_Last reviewed 2026-11-02, against web repo #70 and guide app #8._

---

## Status

| Phase                                     | Status                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1. Project foundation                     | ✅ Done                                                                                                   |
| 2. Authentication and user profiles       | ✅ Mostly done: 4 cleanup items still open                                                                |
| 3. Hiker home                             | ✅ Done                                                                                                   |
| 4. Trails and booking                     | ✅ Done: capacity, larger groups, and reschedule rules blocked                                            |
| 5. Coordinator review, check-in, dispatch | ✅ Done: review, check-in, FIFO dispatch, completion, dashboard                                           |
| 6. Guide mobile app and trek sessions     | ✅ Done: availability, queue position, trek start/complete, per-trail map                                 |
| 7. Group monitoring and offline sync      | 🟡 In progress: live GPS and coordinator live map done; offline storage, QR checkpoints open              |
| 8. Weather, safety, and SOS               | ✅ Done on web and guide app: thresholds, notifications, escalation blocked                               |
| 9. Certificates and analytics             | 🟡 In progress: emailed PDF certificates and coordinator analytics done; certificate download not started |
| 10. Production readiness                  | ⬜ Ongoing                                                                                                |

**Next up: not decided yet.** Candidates, to be agreed first:

- Phase 7: keep unsent GPS points on the phone when the app is killed, and stop duplicate location uploads.
- Guide app: limit fake-location mode to debug builds.
- Phase 9: certificate download for hikers, and the guide app's certificate status line.
- Phase 2: cleanup items.

---

## 1. Project foundation ✅

- [x] Web app: React, Vite, TypeScript, Tailwind, React Router, ESLint, Prettier, Vitest.
- [x] API: Express 5, TypeScript, Prisma, PostgreSQL, `GET /health`.
- [x] Structured logging (Pino) with request IDs and credential redaction.
- [x] Root script runs frontend and backend together.

## 2. Authentication and user profiles

- [x] Login and registration pages with client-side validation.
- [x] Firebase email/password sign-in, registration, app-wide auth state, logout.
- [x] Backend verifies Firebase ID tokens; identity is never taken from the request body.
- [x] `User` model; `POST /users` creates a `HIKER` profile; `GET /api/v1/users/me`.
- [x] Registration requires age 18 or older (`User.age`).
- [x] Registration requires accepting the Terms and Privacy Policy. The accepted version and time are stored (`User.termsAcceptedAt`, `termsVersion`; `backend/src/lib/agreements.ts`).
- [x] Guide app: Firebase sign-in through the REST API (`lib/data/firebase_rest_auth_repository.dart`). Accounts without the `GUIDE` role are refused.
- [ ] Move `POST /users` to `/api/v1/users` and use the standard error envelope.
- [ ] Replace `console.log` in `RegisterPage` with proper error handling.
- [ ] Handle the case where Firebase sign-up succeeds but profile creation fails. Today the Firebase user is left without a profile and there is no way to recover.
- [~] Reusable role-check middleware: every router uses `requireRole` except `backend/src/routes/bookings.ts`, which still checks roles inline.
- [ ] Guide app: stay signed in after the app restarts (tokens are kept in memory only).
- [x] `GUIDE`/`COORDINATOR` accounts are promoted from the backend with `npm run set-role` (no HTTP endpoint). Self-service or admin-UI provisioning is not planned yet.

## 3. Hiker home ✅

- [x] Protected `/home` route with login redirects.
- [x] Responsive app shell, navigation, and booking entry point.
- [x] Shows the TrailSync profile from `GET /api/v1/users/me`.
- [x] Redesigned home: 3D Google Maps preview of Sulfatara and Mt. Malingatong (provisional KML), a next-trek card, a weather card, and trail cards.

## 4. Trails and booking ✅

**Backend: done**

- [x] Trail catalog: `trails` table, `GET /api/v1/trails`, `GET /api/v1/trails/:trailId`. Active trails: Sulfatara (₱550, ₱275 downpayment) and Mt. Malingatong (₱680, ₱340 downpayment); Lake Janagdan was retired.
- [x] Bookings and participants; the owner counts toward the 5-person limit.
- [x] Create requires a valid `trailId`; price and 50% downpayment are copied from the trail.
- [x] Hiker list, detail, and reschedule (keeps trail, price, and downpayment credit).
- [x] GCash payment in test mode:
  - the hiker chooses 50% or full payment and uploads a receipt screenshot with the booking
  - the coordinator views it, then accepts (confirms) or rejects it with a reason; after a rejection the hiker uploads again
  - the 50% balance is collected in cash at check-in
  - screenshots are stored on the backend disk (`UPLOAD_DIR`) and served only to the owner and coordinators; every upload is kept (`payment_receipts`)
- [x] Owner and every participant must be 18 or older (`backend/src/lib/package-policy.ts`).
- [x] Trek waiver accepted at booking; the accepted version and time are stored (`Booking.waiverAcceptedAt`, `waiverVersion`).
- [x] API tests for users, trails, bookings, and payments.

**Web: done**

- [x] Trails page (`/trails`) from `GET /api/v1/trails`; each card links to the booking form with that trail preselected.
- [x] Booking form (`/bookings/new`): pick a trail, date/time, owner age/address, up to 4 more participants (limit from the API package), payment option and receipt, waiver checkbox.
- [x] Show price and downpayment returned by the API (never calculated in the browser).
- [x] My bookings list (`/bookings`) and booking detail (`/bookings/:bookingId`) with status.
- [x] Reschedule a confirmed booking.
- [x] No cancel button and no guide picker (not allowed by the rules).
- Past dates are blocked in the date picker as a usability guard only; the API does not enforce a date rule yet.

**Open**

- [ ] Walk-ins added at check-in are not age-checked; only a positive age is required.
- [ ] The draft Terms and Waiver text (`frontend/src/features/legal/agreements.ts`) still lets under-18 participants join with a guardian, which contradicts the 18+ rule.
- [ ] Final legal text from the tourism office; the current text is a draft with blanks.

**Later / blocked**

- [ ] Add more trails once their names and prices are verified (one migration each).
- [ ] **Blocked:** daily capacity rule.
- [ ] **Blocked:** groups larger than 5.
- [ ] **Blocked:** reschedule limits and notice period; no-show policy.

## 5. Coordinator review, check-in, and dispatch ✅

Rules: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) §5.2–5.3, agreed in [`CHECK_IN_AND_DISPATCH_RULES.md`](CHECK_IN_AND_DISPATCH_RULES.md).

- [x] Coordinator web area in the same web app: one shared `/login`, then role-based redirects to the coordinator layout under `/coordinator/*`.
- [x] Booking queue API (`GET /api/v1/coordinator/bookings`, `GET /api/v1/coordinator/bookings/:bookingId`) and review screens (`/coordinator/bookings`, `/coordinator/bookings/:bookingId`) that use the existing confirm endpoint.
- [x] Guide account requests: guides apply from the guide app; coordinators approve or decline at `/coordinator/guide-applications`.
- [x] Physical check-in on the scheduled Manila date (`POST …/check-in`, page `/coordinator/bookings/:bookingId/check-in`):
  - mark booked participants present or absent
  - add walk-ins up to 5 people in total
  - the price never changes
- [x] Guide dispatch state (`guides` table: `OFF_DUTY` / `AVAILABLE` / `ASSIGNED`), created when a guide is approved or promoted with `set-role`.
- [x] FIFO dispatch at check-in, in the same transaction. Two safeguards ensure one guide is never assigned twice:
  - a queue lock (`pg_advisory_xact_lock`)
  - a partial unique index (one active trek per guide)
- [x] Groups wait in `CHECKED_IN` when no guide is free. The coordinator clicks "Assign next guide".
- [x] "Mark trek completed" returns the guide to the end of the queue.
- [x] Coordinator screens: Check-in & dispatch (`/coordinator/dispatch`) and Guide queue (`/coordinator/guides`).
- [x] Guide endpoints for the app: `GET /api/v1/guides/me`, `POST /api/v1/guides/me/availability`, `GET /api/v1/guides/me/hike-requests`.
- [x] Coordinator dashboard (`/coordinator`):
  - alerts for trails closed today and thunderstorm advisories
  - today's schedule, sorted by time, with a next-step link for each group
  - a compact weather card
- [x] Grouped sidebar (Today / Bookings / Guides / Trails) with badges from `GET /api/v1/coordinator/summary`.
- [x] Action-based booking tabs: Needs review, Waiting on hiker, Upcoming, Completed.
- [ ] **Blocked:** packages and guides for the people beyond 5 in the "booked 3, arrived 7" case.
- [ ] **Blocked:** no-show handling.

## 6. Guide mobile app and trek sessions ✅

- [x] Flutter guide app (separate repo) with Firebase sign-in and the account request flow. Its dashboard reads `GET /api/v1/guides/me/hike-requests`.
- [x] Guide app: an "On duty" toggle using `POST /api/v1/guides/me/availability`, and the queue position from `GET /api/v1/guides/me`. The toggle is locked during a trek.
- [x] Guide app: parses `GUIDE_ASSIGNED`, `IN_PROGRESS`, and `COMPLETED`.
- [x] Guide sees their assignment, starts the trek, and completes it (`POST /api/v1/guides/me/hike-requests/:bookingId/start` and `…/complete`). Completion reuses `completeTrek` in `backend/src/lib/guide-queue.ts`.
- [x] Trek session = the booking: new `IN_PROGRESS` status and `trekStartedAt`, with server-enforced transitions (`backend/src/lib/guide-treks.ts`). The one-active-trek index covers `IN_PROGRESS`.
- [x] Coordinator web shows "not started yet" vs "trek started", and keeps "Mark trek completed" as a fallback.
- [x] Guide app map (Google Maps), with the route chosen by the booking's trail (`lib/models/trail_route.dart`):
  - off-trail warning beyond 50 m, and the remaining distance
  - a hike summary when the trek ends
- [~] The routes are provisional KML files cut from a Wikiloc track, the same files the web uses (`frontend/public/trails/`). **Blocked:** verified routes for each trail.

## 7. Group monitoring and offline sync 🟡

The guide's phone tracks the **group**; TrailSync does not track every individual hiker.

- [x] Guide app sends GPS while a trek is active (`lib/data/location_uploader.dart`):
  - Android foreground service with a "Trek in progress" notification
  - a new fix every 5 m moved; at most one fix every 15 s; only fixes accurate to 30 m or better
  - batches of up to 50 points to `POST /api/v1/guides/me/hike-requests/:bookingId/locations`
  - The interval is about 15 s, not the 60 s first proposed.
- [x] Backend stores the points (`guide_locations`, `backend/src/lib/guide-locations.ts`). It accepts them only while the trek is `IN_PROGRESS` and drops fixes from before the trek started.
- [x] Coordinator live map (`/coordinator/live-map`, `GET /api/v1/coordinator/live-treks`):
  - each active group's path and latest location
  - "x min ago", and a stale badge after 2 minutes without a fix
  - refreshes every 10 s
- [~] Offline: unsent points wait in an in-memory queue (up to 500) and are sent when the connection returns. They are lost if the app is killed. There is no local database yet.
- [ ] Duplicate-safe uploads: if a batch is saved but the reply times out, the app resends it and the points are stored twice. Neither the app nor the database detects this.
- [ ] Complete a trek while offline.
- [ ] QR checkpoint events, stored offline and synced (nothing built yet).
- [ ] **Blocked:** verified route, checkpoint, and boundary data for each trail.
- [ ] **Blocked:** how long location data is kept (all points are kept; there is no cleanup).

## 8. Weather, safety, and SOS ✅

Agreed approach: weather is advisory only; a coordinator closes a trail by hand. Nothing restricts a trail automatically until official thresholds are confirmed.

- [x] Weather provider integration (OpenWeather, one provisional point at the Cabintan jump-off; `backend/src/lib/weather.ts`, `GET /api/v1/weather`):
  - current conditions and a daily Asia/Manila forecast, cached for 10 minutes, with the last good forecast served as stale if OpenWeather fails
  - shown as advisory on the hiker home page, for the chosen booking date, beside the coordinator's restriction form, and on the coordinator dashboard
- [x] Trail restrictions stored per trail and enforced by the server (`trail_restrictions`, `backend/src/lib/trail-restrictions.ts`):
  - a coordinator closes a trail for a date range with a reason, and can lift it (`/coordinator/trail-restrictions`)
  - `409 TRAIL_RESTRICTED` on new bookings and reschedules onto those dates, check-in, guide assignment, and trek start
  - existing bookings are not changed; hikers, coordinators, and guides see the closure (`trailRestriction` on bookings)
  - a trek already in progress is not interrupted
- [x] In-app guide SOS and coordinator incident handling (`incidents`, `backend/src/lib/incidents.ts`):
  - the guide sends an SOS with their last location and a note; retries return the same unresolved incident
  - coordinators acknowledge and resolve incidents on `/coordinator/incidents`, with an open-SOS badge in the navigation (checked every 20 seconds)
  - the booking's status is not changed
- [x] Guide app safety features:
  - SOS button on the map and on the request details, showing "waiting", then "acknowledged by …" (checked every 20 s)
  - weather chip on the map and a forecast card on the request details
  - closure banner, with the refused trek start explained
- [ ] **Blocked:** official weather thresholds (automatic restrictions), notification channels, incident escalation.

## 9. Certificates and analytics 🟡

- [x] PDF completion certificate for each participant (`pdf-lib`, `backend/src/lib/certificate-pdf.ts`):
  - emailed over SMTP when the trek is completed by the guide or the coordinator (`backend/src/lib/certificates.ts`, `mailer.ts`)
  - absent participants are skipped
  - `certificateSentAt` stops a second send
  - the coordinator can resend from the booking detail
- [~] Guide app shows an on-screen certificate after the hike, made out to the guide only. Agreed direction: replace it with a "Certificates emailed to N hikers" status line.
- [ ] Certificate download for hikers (`/api/v1/certificates`, planned). Certificates are not stored.
- [x] Coordinator analytics (`/coordinator/analytics`, `GET /api/v1/coordinator/analytics`; `backend/src/lib/analytics.ts`):
  - date range with presets (default: last 6 months), by scheduled date
  - visitors per month by trail (absent excluded, walk-ins included), trail usage and average group size, bookings by status
  - completed treks per guide, to check that FIFO spreads work fairly
  - SOS count and median times to acknowledge and resolve, days each trail was closed
  - booked value per month, labelled test mode
  - charts with Recharts, loaded only on this page
- [ ] **Blocked:** official certificate signing; real GCash account and an automated payment provider (receipts are checked by hand in test mode until decided).

## 10. Production readiness (ongoing)

- [x] Backend: 18 Vitest + supertest files (Prisma and Firebase mocked), typecheck, and Prisma validation run locally.
- [x] Web: 21 tests of logic and API clients.
- [x] Guide app: 8 test files (repositories, uploader, registration, safety, hike flow, routes).
- [x] `npm run reset-data -- --yes` clears bookings and related test data and keeps users and trails.
- [ ] Web component tests (none yet).
- [ ] Guide app tests for the map/navigation screen, fake location, and certificate.
- [ ] End-to-end tests: register → log in → book → coordinator confirms.
- [ ] CI (no GitHub Actions workflows).
- [ ] Guide app: limit fake-location mode to debug builds. Today `FAKE_LOCATION` in the bundled `.env` works in any build, and fake positions are uploaded as real locations.
- [ ] Guide app docs (`docs/HOW_IT_WORKS.md`, `docs/developer_guide.md`) still describe GPS upload as future work.
- [ ] Production HTTPS, CORS origins (one `CORS_ORIGIN` today), secrets for Firebase Admin, PostgreSQL, and SMTP.
- [ ] Database backups, migration deployment, and data-privacy handling.
- [ ] Accessibility and responsive testing.
