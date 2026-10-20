# TrailSync Milestones

The roadmap, in build order. Each phase depends on the ones before it.

- Business rules and open decisions: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)
- API endpoints: [`API_CONTRACT_V1.md`](API_CONTRACT_V1.md)
- Engineering conventions: [`CODING_PRINCIPLES.md`](CODING_PRINCIPLES.md)

`[x]` done · `[~]` partly done · `[ ]` not started · **Blocked:** needs a business decision first

---

## Status

| Phase                                     | Status                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| 1. Project foundation                     | ✅ Done                                                                |
| 2. Authentication and user profiles       | ✅ Mostly done                                                         |
| 3. Hiker home                             | ✅ Done                                                                |
| 4. Trails and booking                     | ✅ Done — backend and hiker web UI; capacity and larger groups blocked |
| 5. Coordinator review, check-in, dispatch | ✅ Done — review, check-in, FIFO dispatch, completion                  |
| 6. Guide mobile app and trek sessions     | ⬜ Not started                                                         |
| 7. Group monitoring and offline sync      | ⬜ Not started                                                         |
| 8. Weather, safety, and SOS               | ⬜ Not started                                                         |
| 9. Certificates and analytics             | ⬜ Not started                                                         |
| 10. Production readiness                  | ⬜ Ongoing                                                             |

**Next up:** Phase 6, the guide app: availability toggle, assignment view, and trek start/complete.

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
- [ ] Move `POST /users` to `/api/v1/users` and use the standard error envelope.
- [ ] Replace `console.log` in `RegisterPage` with proper error handling.
- [ ] Handle the case where Firebase sign-up succeeds but profile creation fails.
- [~] Reusable role-check middleware: `requireRole` is used by coordinator routes; hiker booking routes still check roles inline.
- [x] `GUIDE`/`COORDINATOR` accounts are promoted from the backend with `npm run set-role` (no HTTP endpoint). Self-service or admin-UI provisioning is not planned yet.

## 3. Hiker home ✅

- [x] Protected `/home` route with login redirects.
- [x] Responsive app shell, navigation, and booking entry point.
- [x] Shows the TrailSync profile from `GET /api/v1/users/me`.

## 4. Trails and booking 🟡

**Backend — done**

- [x] Trail catalog: `trails` table, `GET /api/v1/trails`, `GET /api/v1/trails/:trailId`. Active trails: Sulfatara (₱550, ₱275 downpayment) and Mt. Malingatong (₱680, ₱340 downpayment); Lake Janagdan was retired.
- [x] Bookings and participants; the owner counts toward the 5-person limit.
- [x] Create requires a valid `trailId`; price and 50% downpayment are copied from the trail.
- [x] Hiker list, detail, and reschedule (keeps trail, price, and downpayment credit).
- [x] Coordinator confirm with simulated downpayment verification.
- [x] API tests for users, trails, and bookings.

**Web — done**

- [x] Trails page (`/trails`) from `GET /api/v1/trails`; each card links to the booking form with that trail preselected.
- [x] Booking form (`/bookings/new`): pick a trail, date/time, owner age/address, up to 4 more participants (limit from the API package).
- [x] Show price and downpayment returned by the API (never calculated in the browser).
- [x] My bookings list (`/bookings`) and booking detail (`/bookings/:bookingId`) with status.
- [x] Reschedule a confirmed booking.
- [x] No cancel button and no guide picker (not allowed by the rules).
- Past dates are blocked in the date picker as a usability guard only; the API does not enforce a date rule yet.

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
- [x] Coordinator screens: Check-in & dispatch (`/coordinator/dispatch`) and Guide queue (`/coordinator/guides`). The booking queue has tabs for the new statuses.
- [x] Guide endpoints for the app: `GET /api/v1/guides/me`, `POST /api/v1/guides/me/availability`, `GET /api/v1/guides/me/hike-requests`.
- [ ] **Blocked:** packages and guides for the people beyond 5 in the "booked 3, arrived 7" case.
- [ ] **Blocked:** no-show handling.

## 6. Guide mobile app and trek sessions

- [~] Flutter guide app (separate repo) with Firebase sign-in and the account request flow. Its dashboard reads `GET /api/v1/guides/me/hike-requests`.
- [ ] Guide app: an availability toggle using `POST /api/v1/guides/me/availability`, and a queue-position view from `GET /api/v1/guides/me`.
- [ ] Guide app: parse the new booking statuses. It currently treats anything other than `CONFIRMED` as "pending".
- [ ] Guide sees their assignment, starts the trek, and completes it. Completion reuses `completeTrek` in `backend/src/lib/guide-queue.ts`.
- [ ] Trek session model linked to booking, guide, and trail, with server-enforced state changes.

## 7. Group monitoring and offline sync

The guide's phone tracks the **group**; TrailSync does not track every individual hiker.

- [ ] Guide app sends GPS about every 60 seconds while a trek is active.
- [ ] Store GPS and QR checkpoint events offline and sync safely when back online.
- [ ] Coordinator map of active groups, showing how fresh each location is.
- [ ] **Blocked:** verified route, checkpoint, and boundary data for each trail.
- [ ] **Blocked:** how long location data is kept.

## 8. Weather, safety, and SOS

- [ ] Weather provider integration.
- [ ] Trail restrictions stored per trail and enforced by the server.
- [ ] In-app guide SOS and coordinator incident handling.
- [ ] **Blocked:** official weather thresholds, notification channels, incident escalation.

## 9. Certificates and analytics

- [ ] PDF completion certificate for a completed trek.
- [ ] Coordinator analytics from stored bookings, treks, guides, and incidents.
- [ ] **Blocked:** certificate design/signing; real payment provider (payments stay simulated until decided).

## 10. Production readiness (ongoing)

- [x] Backend tests, typecheck, and Prisma validation run locally.
- [ ] Frontend component tests beyond validation and the users API client.
- [ ] End-to-end tests: register → log in → book → coordinator confirms.
- [ ] Production HTTPS, CORS origins, secrets for Firebase Admin and PostgreSQL.
- [ ] Database backups, migration deployment, and data-privacy handling.
- [ ] Accessibility and responsive testing.
