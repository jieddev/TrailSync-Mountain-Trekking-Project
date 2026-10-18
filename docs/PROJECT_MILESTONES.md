# TrailSync Milestones

The roadmap, in build order. Each phase depends on the ones before it.

- Business rules and open decisions: [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md)
- API endpoints: [`API_CONTRACT_V1.md`](API_CONTRACT_V1.md)
- Engineering conventions: [`CODING_PRINCIPLES.md`](CODING_PRINCIPLES.md)

`[x]` done · `[~]` partly done · `[ ]` not started · **Blocked:** needs a business decision first

---

## Status

| Phase                                   | Status          |
| --------------------------------------- | --------------- |
| 1. Project foundation                   | ✅ Done         |
| 2. Authentication and user profiles     | ✅ Mostly done  |
| 3. Hiker home                           | ✅ Done         |
| 4. Trails and booking                   | ✅ Done — backend and hiker web UI; capacity and larger groups blocked |
| 5. Coordinator review, check-in, dispatch | ⬜ Not started |
| 6. Guide mobile app and trek sessions   | ⬜ Not started  |
| 7. Group monitoring and offline sync    | ⬜ Not started  |
| 8. Weather, safety, and SOS             | ⬜ Not started  |
| 9. Certificates and analytics           | ⬜ Not started  |
| 10. Production readiness                | ⬜ Ongoing      |

**Next up:** Phase 5 coordinator review (pending-booking queue and confirm screen).

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
- [ ] Reusable role-check middleware (booking routes currently check roles inline).
- [ ] **Blocked:** how `GUIDE` and `COORDINATOR` accounts are created.

## 3. Hiker home ✅

- [x] Protected `/home` route with login redirects.
- [x] Responsive app shell, navigation, and booking entry point.
- [x] Shows the TrailSync profile from `GET /api/v1/users/me`.

## 4. Trails and booking 🟡

**Backend — done**

- [x] Trail catalog: `trails` table, `GET /api/v1/trails`, `GET /api/v1/trails/:trailId`. Lake Janagdan (₱800) is the only trail so far.
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

## 5. Coordinator review, check-in, and dispatch

- [ ] Coordinator web area (role-gated).
- [ ] Pending-booking queue API and review screen using the existing confirm endpoint.
- [ ] Physical check-in: compare who arrived with who was booked.
- [ ] Guide model and availability.
- [ ] FIFO guide dispatch that cannot assign one guide twice (transactional).
- [ ] Return a finished guide to the end of the queue.
- [ ] **Blocked:** guide availability states and exact queue rules.
- [ ] **Blocked:** what happens when more or fewer people arrive than booked.

## 6. Guide mobile app and trek sessions

- [ ] Flutter guide app with Firebase sign-in.
- [ ] Guide sees their assignment, starts the trek, and completes it.
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
