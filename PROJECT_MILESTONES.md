# TrailSync Project Milestones

This is the current, code-reconciled roadmap for the TrailSync system.

It is based on the current project context, confirmed business decisions, and the implementation evidence available in the repository.

Legend:

- `[x]` implemented and evidenced in the repository
- `[\~]` partially implemented
- `[ ]` not yet implemented
- `[?]` requires verification outside the repository or in a less restricted environment

---

# Current Project Status

| Area                                                       | Status                | Evidence / note                                                                                                                                     |
| ---------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web application foundation                                 | Implemented           | React, Vite, TypeScript, Tailwind CSS, routing, lint/test/build scripts, and feature-oriented source structure exist.                               |
| Authentication UI and client validation                    | Implemented           | Login and registration pages, reusable form components, Firebase email/password calls, validation logic, and validation tests exist.                |
| Firebase authentication                                    | Implemented in code   | Client sign-in/registration/session/logout and backend Firebase ID-token verification are wired; live Firebase behavior has not been verified here. |
| PostgreSQL user profile                                    | Implemented in code   | Prisma `User` model and migration, authenticated profile creation, and current-user lookup exist; live database/migration execution is unverified.  |
| Authorization and role-based experience                    | Partially implemented | Firebase authentication exists; booking handlers enforce HIKER/COORDINATOR roles inline. Reusable role policies, authorized role provisioning, and broader role-specific experiences remain unimplemented. |
| Authenticated hiker home                                   | Implemented in code   | `/home` is protected and responsive; welcome/account details come from Firebase session data, not the PostgreSQL current-user endpoint.             |
| Booking foundation                                         | Partially implemented | Backend booking persistence and authenticated create/list/detail/reschedule/coordinator-confirm operations are implemented; no booking UI, check-in, or dispatch exists. |
| Guide mobile application                                   | Not implemented       | No Flutter/mobile application is present.                                                                                                           |
| Trek monitoring, safety, certificates, analytics, real payments | Not implemented    | These feature domains have no implementation evidence; booking downpayment verification is simulated only.                                            |
| Automated verification                                     | Partially implemented | Backend tests (19), TypeScript typecheck, Prisma validation, and client generation passed; live Firebase/PostgreSQL integration is not verified.     |

---

# 1. Project Foundation

## Frontend

- [x] React, Vite, TypeScript, and Tailwind CSS application foundation.
- [x] React Router route setup for login and registration.
- [x] ESLint, Prettier, TypeScript, Vitest, development, and production-build scripts.
- [x] Feature-oriented authentication folder structure and shared auth form components.

## Backend

- [x] Node.js Express API foundation with JSON parsing, CORS configuration, and `GET /health`.
- [x] PostgreSQL Prisma configuration, generated-client dependency, and initial migration structure.
- [x] Structured HTTP logging, request IDs, and redaction for common credential fields.
- [x] Root development script starts the frontend and backend development commands.

## Dependencies

- All application features build on the React → Express → PostgreSQL application boundary.
- Mobile work requires a Flutter project before mobile milestones can begin.

---

# 2. Authentication and User Profiles

## Frontend

- [x] Login and registration routes with accessible labels, feedback regions, loading states, and password visibility controls.
- [x] Client-side registration and login validation, including password confirmation and password-related feedback.
- [x] Firebase client initialization from `VITE_FIREBASE_*` configuration.
- [x] Email/password registration and Firebase sign-in wiring.
- [x] Profile-creation request boundary that sends the Firebase ID token and required profile information to the backend.
- [x] Registration flow returns the user to the login experience after the required registration/profile process.
- [~] User-facing Firebase and API error handling exists; registration still logs caught errors with `console.log` and should use appropriate handling without exposing sensitive details.
- [ ] Extract direct Firebase operations from page components into an authentication service where this remains part of the agreed frontend architecture.
- [x] Establish a single app-wide Firebase auth-state listener with loading, authenticated, and unauthenticated states.
- [x] Add logout UI using the existing Firebase Authentication flow.
- [x] Add protected client routing for the authenticated home.
- [ ] Add role-aware client routing only as a UI/navigation concern; client roles must never be the authorization authority.
- [?] Verify registration, login, duplicate-email, expired-session, logout, and failure behavior against live Firebase/backend infrastructure.

## Backend

- [x] `User` Prisma model with Firebase UID and email uniqueness, full name, `HIKER` default role, and timestamps.
- [x] Initial PostgreSQL migration defining the `UserRole` enum and `users` table.
- [x] Firebase Admin token middleware derives identity from verified token claims.
- [x] User profile creation validates required profile information and does not trust client-supplied privileged identity/role fields.
- [x] Public profile creation defaults new users to `HIKER`.
- [x] API error responses and logging avoid exposing internal server details.
- [x] API tests cover user creation and current-user lookup, including missing/invalid tokens, validation, duplicates, not-found, and safe server errors; execution and live integration remain unverified in this review.
- [x] Add authenticated current-user/profile endpoints at `GET /users/me` and `GET /api/v1/users/me`; both derive identity from verified Firebase claims.
- [x] Return a safe `404 PROFILE_NOT_FOUND` response when the verified Firebase account has no TrailSync profile.
- [~] Align profile-creation error responses with the documented API error contract; current validation/conflict responses use a top-level `message`.
- [x] Enforce HIKER/COORDINATOR roles in existing booking handlers.
- [ ] Add reusable role-authorization middleware/policies for future endpoints.
- [ ] Implement the authorized process for provisioning `GUIDE` and `COORDINATOR` roles.
- [ ] Define and implement recovery behavior if Firebase account creation succeeds but PostgreSQL profile creation fails.
- [?] Verify Firebase Admin credentials, database connectivity, migrations, and complete registration/profile synchronization in a live development environment.

## Dependencies

- Protected user experiences require a working authenticated application state.
- Role-based operations require backend authorization.
- The public profile-creation process must not allow a normal user to assign themselves a privileged role.

---

# 3. Authenticated Hiker Home

## Frontend

**Goal:** Provide the main application page that a hiker sees after successfully logging in.

- [x] Create the authenticated hiker home page and modular application shell.
- [x] Establish the authenticated `/home` route using the app-wide Firebase auth state.
- [x] Make the home page the post-login destination for authenticated users.
- [x] Redirect unauthenticated users who visit `/home` to `/login` and authenticated users who visit `/login` to `/home`.
- [x] Provide responsive navigation separated from the main content area.
- [x] Display a welcome message and account summary using Firebase display name, with email-based/fallback labeling when a display name is unavailable.
- [x] Provide a visible booking entry point; booking UI and trail selection remain unimplemented.
- [x] Show an authentication loading state while Firebase restores the current session.
- [x] Keep the shell independent of future trail catalog details.
- [x] Avoid inventing booking or trail information.
- [ ] Add trail details, booking records, or other feature data only when supported by an agreed backend contract and implemented feature.
- [?] Verify route transitions and responsive behavior through interactive browser testing.

## Backend

- The home page currently uses the Firebase user already available in the client; it does not call the implemented PostgreSQL current-user endpoint.
- [ ] Integrate `GET /api/v1/users/me` if the shell should display the authoritative TrailSync profile and role.
- [ ] Provide authenticated booking data through an agreed API contract when booking is implemented.

## Dependencies

- Firebase authentication/session state is available through the existing Firebase client.
- The shared auth-state listener supplies loading and authenticated/unauthenticated states to routing and the home shell.
- Booking information should only be added after the booking API contract exists.

## Important Scope Note

This page is an **authenticated application home**, not the public marketing/landing page for TrailSync. It establishes a shell for future features without implementing booking or assuming a permanent selected trail.

```text
Login
   ↓
Firebase Authentication
   ↓
Authenticated User
   ↓
Hiker Home
```

---

# 4. Trails, Booking, and Trekker Groups

## Frontend

- [ ] Build trail/trek information views for the initial Lake Janagdan release; future approved trails need their own verified information and map/route data.
- [ ] Let the hiker select exactly one supported trail during booking; Lake Janagdan is the only initially supported trail; future approved trails may be added by controlled development/configuration change.
- [ ] Build the group booking form and participant-entry flow.
- [ ] Build hiker booking status, reschedule, and no-show policy information views after API contracts exist. Hiker cancellation is not allowed; do not add a cancellation action. Refund policy remains TBD.
- [ ] Present capacity, pricing, and availability supplied by the backend.
- [ ] Do not add guide-selection UI: assignment occurs at physical check-in under the current project rule.

## Backend

- [x] Add booking and booking-participant persistence with owner relationships and a migration.
- [x] Implement authenticated booking creation with profile-derived owner identity and transactional participant creation.
- [x] Implement owner-scoped booking list and detail operations.
- [x] Implement confirmed-booking rescheduling in place, retaining participants and verified downpayment credit.
- [x] Implement coordinator-only confirmation with simulated downpayment verification.
- [x] Validate participant information, schedule format, and the maximum of five participants including the owner.
- [x] Existing implementation hardcodes Lake Janagdan, ₱800 price, and a calculated ₱400 downpayment; it does not yet retrieve price from a trail catalog.
- [x] Add backend booking endpoint tests and verify typecheck, Prisma validation, and Prisma Client generation.
- [ ] Enforce daily trail capacity transactionally once the official daily capacity policy is confirmed.
- [ ] Add server-side idempotency if a future requirement establishes a retry guarantee.
- [ ] Implement check-in, guide assignment, and trek lifecycle operations in their respective milestones.

## Confirmed Booking Package

The shared package rules for every supported trail are:

```text
1 Booking / Package
   ↓
1 Guide
   ↓
Up to 5 Guests
   ↓
Full selected-trail package price
```

The following are valid examples:

```text
1 guest  → full selected-trail price
2 guests → full selected-trail price
3 guests → full selected-trail price
4 guests → full selected-trail price
5 guests → full selected-trail price
```

A group does **not** receive a lower price simply because it has fewer than five participants. Lake Janagdan costs ₱800, so its 50% downpayment is ₱400. Future approved trails may have different approved prices; their downpayment is 50% of that trail price. Rules for groups exceeding five remain TBD.

## Dependencies

- Booking APIs require Firebase-authenticated profiles; the existing Booking Foundation implements core operations, while the revised trail-aware contract remains proposed.
- The shared package rules (one guide, five participants maximum, 50% downpayment, full price for one to five participants) are confirmed; price is set per trail.
- Daily trail carrying capacity remains TBD.
- Payment provider and real payment processing remain out of scope; current verification is simulated.
- Hiker cancellation is not allowed. Refund policy details remain TBD/out of scope; no cancellation action is planned.

---

# 5. Coordinator Check-In, Guides, and FIFO Dispatch

## Frontend

- [ ] Build coordinator booking lookup and physical check-in UI.
- [ ] Build guide availability and FIFO queue visibility.
- [ ] Build guide assignment, active assignment, completion, and check-out views.
- [ ] Show actionable authorization, empty, loading, and conflict states.

## Backend

- [ ] Define guide profile/availability and queue persistence models.
- [ ] Implement coordinator-authorized check-in operations.
- [ ] Implement FIFO dispatch so a checked-in group receives an available guide.
- [ ] Return a completed/checked-out guide to the end of the queue according to confirmed queue rules.
- [ ] Apply transactions/concurrency controls so simultaneous dispatches cannot assign one guide twice or violate queue order.
- [ ] Record assignment and lifecycle audit information appropriate for operations.

## Confirmed Dispatch Rule

The current operational sequence is:

```text
Booking
   ↓
Tourist Arrives
   ↓
Coordinator Check-In
   ↓
FIFO Guide Dispatch
   ↓
Guide Assigned
```

Guide selection by hikers is not part of the current design.

## Dependencies

- Dispatch requires booking check-in.
- Dispatch requires authorized coordinator/guide roles.
- Trek sessions, tracking, checkpoints, SOS, and related features depend on a valid guide assignment.

---

# 6. Guide Mobile App and Trek Sessions

## Mobile

- [ ] Create the Flutter guide application foundation.
- [ ] Integrate Firebase authentication according to the agreed mobile authentication contract.
- [ ] Build guide availability.
- [ ] Build assignment display.
- [ ] Build trek start.
- [ ] Build in-progress trekking workflow.
- [ ] Build completion and check-out workflows.
- [ ] Surface assignment, network, permission, and safety states clearly.

## Backend

- [ ] Define authenticated guide-facing API contracts and authorization rules.
- [ ] Add trek-session persistence.
- [ ] Enforce valid trek state transitions.
- [ ] Connect a trek session to the booking/group, assigned guide, and selected trail.

## Dependencies

- Requires guide dispatch.
- Requires confirmed guide/mobile/API contracts.
- The mobile app must not treat local client state as authoritative for assignment or trek transitions.

---

# 7. Near-Real-Time Group Monitoring, Checkpoints, and Offline Sync

## Mobile

- [ ] Capture guide-device GPS for the assigned trekking group with permission/error handling.
- [ ] Send connected GPS points at an agreed/configurable interval.
- [ ] The current proposal is approximately 60-second updates.
- [ ] Store GPS and QR checkpoint events locally during connectivity loss.
- [ ] Synchronize queued offline records after reconnection.
- [ ] Use stable identifiers and retry-safe synchronization.
- [ ] Stop or pause tracking at the appropriate confirmed session lifecycle points.

## Frontend

- [ ] Build coordinator active-trek monitoring and location-map UI after the map/location API is agreed.
- [ ] Display connection/data freshness so delayed offline data is not presented as near-real-time.
- [ ] Build checkpoint and operational-status views.

## Backend

- [ ] Add location, checkpoint, and synchronization contracts/data models after actual trail data and retention requirements are confirmed.
- [ ] Validate guide/session ownership for every tracking and checkpoint event.
- [ ] Preserve timestamps.
- [ ] Make offline synchronization idempotent.
- [ ] Expose authorized coordinator monitoring data.
- [ ] Add geofencing only after legitimate trail boundaries/hazard data is supplied.

## Scope

Monitoring and checkpoint functionality must be associated with the selected trail; the initial release supports Lake Janagdan only.

Lake Janagdan remains supported. Its geographic details remain unverified/TBD; each supported trail needs its own verified map/route information.

## Dependencies

- Requires an active trek session.
- Requires guide mobile authentication.
- Requires legitimate geographic/checkpoint data.
- PostgreSQL remains authoritative.
- Mobile SQLite is temporary offline storage.

The system must be described as:

> Near-real-time monitoring of trekking groups through assigned guide devices.

It must not be described as:

> Individual real-time tracking of every hiker.

---

# 8. Weather, Safety, Incidents, and SOS

## Frontend and Mobile

- [ ] Show authorized weather restrictions and safety alerts to relevant users.
- [ ] Add coordinator incident-handling views.
- [ ] Add an application-level guide SOS flow.
- [ ] Do not claim lock-screen/native emergency-service functionality.

## Backend

- [ ] Integrate the selected weather provider after credentials and operational requirements are confirmed.
- [ ] Persist configurable, authorized weather safety policies.
- [ ] Persist trail restriction state.
- [ ] Apply deterministic server-side safety rules.
- [ ] Record SOS and incident events.
- [ ] Notify the appropriate coordinator channel after notification requirements are decided.

## Dependencies

- Official weather thresholds are still TBD.
- Notification channels are still TBD.
- Incident escalation procedures are still TBD.
- Safety restrictions should integrate with booking/check-in/active-trek lifecycle rules.

AI must not make safety-critical decisions.

---

# 9. Payments, Certificates, Notifications, and Analytics

## Frontend and Mobile

- [ ] Build payment/verification status UI after the payment workflow is confirmed.
- [ ] Allow hikers to access verified completion certificates.
- [ ] Build coordinator tourism and operational analytics views from stored data.
- [ ] Add notifications after channel, delivery, and preference requirements are defined.

## Backend

- [x] Existing booking API hardcodes Lake Janagdan’s ₱800 price and calculates ₱400 downpayment; it still needs trail-derived pricing for future approved trails.
- [x] Implement simulated coordinator verification; no real money is processed.
- [ ] Define a real payment provider and verification workflow if future scope requires it.
- [ ] Define refund policy details. Hiker cancellation is not allowed.
- [ ] Define retry/idempotency behavior for payment operations.
- [ ] Generate a digital completion certificate as a PDF for an eligible completed trek.
- [ ] Confirm certificate design/signing requirements.
- [ ] Define certificate storage/access authorization and issuance history.
- [ ] Implement analytics queries from persisted bookings, sessions, guide activity, incidents, and restrictions.
- [ ] Avoid AI analytics/recommendations unless a non-critical, confirmed use case is approved.

## Confirmed Pricing Rule

Shared package rules for every supported trail are one guide, up to five participants including the owner, 50% downpayment, and full trail price for one through five participants. Lake Janagdan costs ₱800 with a ₱400 downpayment. Other approved trails may have different prices.

## Dependencies

- Payment implementation depends on the confirmed payment workflow.
- Certificates depend on confirmed trek completion and certificate requirements.
- Analytics depend on actual operational records.

---

# 10. Security, Quality Assurance, and Production Readiness

## Security and Operations

- [x] Backend verifies Firebase ID tokens for the implemented profile endpoint.
- [x] Backend logging redacts common credential/token fields and emits request IDs.
- [ ] Apply backend authentication and authorization consistently to every future protected domain endpoint.
- [ ] Define least-privilege roles/permissions.
- [ ] Define audit requirements.
- [ ] Configure production HTTPS.
- [ ] Configure production CORS origins.
- [ ] Configure Firebase Admin credentials securely.
- [ ] Configure PostgreSQL credentials and secret management.
- [ ] Add dependency/security review.
- [ ] Add an appropriate operational error-reporting/monitoring approach.
- [ ] Define backups, migration deployment, recovery, retention, and privacy handling for location and participant data.

## Testing and Verification

- [x] Frontend validation unit tests are present in the repository; execution was not verified during this review.
- [?] Frontend typecheck, lint, production build, and formatting checks were not run during this review.
- [x] Backend API tests for user/profile and booking endpoints pass (19 tests).
- [x] Backend TypeScript typecheck, Prisma schema validation, and Prisma Client generation pass.
- [?] Backend has no build or lint script; live Firebase/PostgreSQL integration and migration application were not verified.
- [ ] Run frontend and backend checks and record their results.
- [ ] Add frontend component tests for auth feedback, loading, protected routing, and Firebase/API service boundaries. (Existing suite currently covers validation only.)
- [ ] Add end-to-end coverage for registration, login, session restoration, logout, protected routing, and booking role checks.
- [ ] Add integration tests for PostgreSQL migrations and the Firebase-token boundary using safe test credentials/mocks.
- [ ] Add domain tests for package pricing, capacity, FIFO dispatch, lifecycle transitions, authorization, idempotency, offline sync, and safety controls as those domains are built.
- [ ] Perform accessibility testing.
- [?] Perform interactive responsive testing of the authenticated shell.
- [ ] Perform broader error/empty-state testing for future feature data.
- [ ] Perform manual production smoke testing.

---

# Recommended Next Development Steps

## Completed Step — Authentication, User Profiles, and Authenticated Hiker Home

The initial authenticated shell is implemented:

- [x] Authenticated home route and shared auth-state loading.
- [x] Post-login redirect and protected route behavior.
- [x] Responsive authenticated navigation, Firebase session summary, and logout.
- [x] Clear booking entry point reserved for future booking functionality.
- [x] Backend authenticated current-user lookup and API tests are implemented.
- [ ] Connect the hiker shell to the authoritative TrailSync profile endpoint if required for the intended profile/role experience.
- [?] Run automated checks and interactive browser verification; results have not been confirmed in this review.

The shell does not implement booking UI or trail-specific information views. Booking records and the backend booking API are tracked in the booking milestone below.

---

## Completed Step — Establish the Backend Booking Foundation

The Version 1 backend booking persistence and API are implemented:

- [x] Persist bookings and owner/additional participants.
- [x] Create bookings for authenticated Hikers using verified Firebase identity and the TrailSync profile.
- [x] Enforce owner-as-participant and the five-person total limit.
- [x] Existing implementation hardcodes Lake Janagdan and ₱800, then calculates ₱400 downpayment; implement catalog-based selected trail and trail-derived price before Hiker Booking UI.
- [x] Start bookings as `PENDING_CONFIRMATION` with `PENDING_VERIFICATION` downpayment status.
- [x] Support owner-scoped list/detail and eligible rescheduling.
- [x] Support coordinator-only confirmation with simulated downpayment verification.
- [x] Add booking API tests; backend tests (19), typecheck, Prisma validation, and client generation passed.
- [ ] Implement Hiker booking UI in its separate frontend milestone.
- [ ] Implement coordinator check-in and guide dispatch in their separate milestones.
- [ ] Verify migrations and end-to-end behavior against live PostgreSQL/Firebase infrastructure.

Shared package rules for every supported trail are one booking/package, one guide, up to five participants including the owner, 50% downpayment, and full selected-trail price for one through five participants. Lake Janagdan costs ₱800, with a ₱400 downpayment. Verification is simulated; no real payment is processed.

---

## Following Step — Guide Dispatch

After booking and check-in:

- [ ] Confirm guide availability states.
- [ ] Confirm FIFO queue transitions.
- [ ] Implement transactional guide dispatch.
- [ ] Implement guide assignment lifecycle.
- [ ] Establish Flutter guide-app foundation.

---

## Following Step — Trek Session and Monitoring

After guide dispatch:

- [ ] Establish trek-session lifecycle.
- [ ] Implement guide-device GPS tracking.
- [ ] Implement checkpoint verification.
- [ ] Implement offline storage and synchronization.
- [ ] Implement coordinator monitoring.
- [ ] Implement safety/geofencing features using legitimate trail data.

---

# Current Confirmed Business Rules

The following are currently confirmed:

```text
Initial release trail:
Lake Janagdan only

Future scope:
Additional approved trails through controlled development/configuration change

Booking:
One booking = one trekking group/package

Shared package rules:
1 guide per booking/package
Up to 5 participants including owner
Full selected-trail price for 1 through 5 participants
50% downpayment

Lake Janagdan price:
₱800

Lake Janagdan downpayment:
₱400 (simulated verification only)

Guide assignment:
At physical check-in

Guide selection by hiker:
Not allowed

Guide dispatch:
FIFO

Group tracking:
Through assigned guide device

GPS proposal:
Approximately every 60 seconds

Offline tracking:
Store-and-forward

Database:
PostgreSQL

Authentication:
Firebase Authentication

Application architecture:
Modular Monolith
```

---

# TBD / Decisions Still Needed

- [x] Lake Janagdan is the sole initial-release trail
- [ ] Add approved trail catalog and stable trail references
- [ ] Derive and snapshot selected trail price and 50% downpayment
- [ ] Legitimate trail coordinates
- [ ] Trail boundaries
- [ ] Checkpoint locations
- [ ] Hazard zones
- [ ] Official daily trail capacity
- [ ] Rules for groups exceeding 5 guests
- [ ] Real payment provider and real-money verification workflow
- [x] Hiker cancellation is not allowed
- [ ] Refund policy details
- [ ] Official weather safety thresholds
- [ ] Weather restriction authority/workflow
- [ ] Final guide queue state transitions
- [ ] Guide-role provisioning process
- [ ] API response formats for future domain endpoints
- [ ] Database schemas for future domains
- [ ] Certificate design and signing process
- [ ] Certificate storage/access requirements
- [ ] Notification channels
- [ ] Incident/SOS escalation procedures
- [ ] Offline synchronization conflict and retention rules
- [ ] Privacy/retention rules for GPS and participant data
- [ ] Optional AI assistance and any approved non-safety-critical use case

---

# AI Coding Agent Rules

AI coding agents working on TrailSync must:

- Inspect the repository before changing anything.
- Work only on the requested milestone/task.
- Preserve working code.
- Avoid unrelated refactoring.
- Respect frontend/backend/mobile boundaries.
- Avoid unnecessary dependencies.
- Never invent business rules.
- Never invent geographic data.
- Never assume unconfirmed API responses.
- Never treat Firebase as the application database.
- Never allow frontend code to directly access PostgreSQL.
- Never treat client-side roles as authorization authority.
- Support an approved multi-trail catalog; keep Lake Janagdan supported.
- Do not invent catalog entries or let hikers create trails.
- Apply the shared package rules across supported trails; use each selected trail’s approved price. Lake Janagdan is the only initial-release trail and costs ₱800.
- Never invent rules for groups exceeding five guests.
- Verify implementation with appropriate tests, linting, typechecking, builds, and manual checks.
- Report important assumptions and unresolved decisions.

---

# Final Project Flow

The core TrailSync operational flow remains:

```text
BOOKING
   ↓
CHECK-IN
   ↓
GUIDE DISPATCH
   ↓
TREK SESSION
   ↓
TRACKING / CHECKPOINTS / SAFETY
   ↓
COMPLETION
   ↓
CERTIFICATE
   ↓
ANALYTICS
```

For the current frontend experience, the immediate user flow is:

```text
REGISTER
   ↓
LOGIN
   ↓
AUTHENTICATED HIKER HOME
   ↓
BOOKING
   ↓
TREKKING
   ↓
COMPLETION
```

The initial release supports Lake Janagdan only. The architecture allows additional approved trails through controlled development/configuration changes.

The system should remain simple, maintainable, testable, secure, and faithful to confirmed requirements.

> **Build the simplest system that reliably solves the real problem and can be responsibly maintained.**


## Lake Janagdan Booking Foundation Impact

The Booking Foundation exists: booking and participant persistence, authenticated creation, owner-scoped list/detail, rescheduling, and coordinator confirmation with simulated verification are implemented. The current backend hardcodes Lake Janagdan and ₱800, calculates ₱400, stores the trail as a defaulted string, and has no catalog endpoint or selected-trail validation. Before Hiker Booking UI, implement the approved trail catalog and stable trail reference, backend selected-trail validation, trail-derived price and 50% downpayment snapshots, and responses that return those values. Rescheduling must preserve the booking, participants, trail, price, and downpayment. Then implement the UI to load/select supported trails and show the selected trail and price. Shared package rules are confirmed. Capacity and detailed reschedule eligibility remain unresolved. Map/route data is separate work.
