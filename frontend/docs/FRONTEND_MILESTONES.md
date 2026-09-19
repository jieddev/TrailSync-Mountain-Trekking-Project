# TrailSync Frontend Implementation Milestones

## Purpose

This roadmap reflects the repository as reviewed on **2026-09-19**. It records
code that exists, work verified locally, and remaining work. A checked item
means it is present in the repository; it does not imply external services
such as Firebase have been verified live.

TrailSync is an eco-tourism system for Barangay Cabintan, Ormoc City. The web
application serves hikers and tourism coordinators. The Flutter guide
application is not yet present in this repository.

## Current System Snapshot

### Implemented

- [x] Root `npm run dev` starts frontend and backend development servers.
- [x] Frontend uses React, Vite, TypeScript, Tailwind CSS, React Router, and
  Firebase client libraries.
- [x] `/login` and `/register` routes exist; other paths redirect to `/login`.
- [x] Reusable authentication layout, form-field, and submit-button components
  are in place.
- [x] Login and registration forms provide validation, loading states, password
  visibility controls, and user-facing error messages.
- [x] Firebase initialization reads `VITE_FIREBASE_*` environment variables.
- [x] Registration creates a Firebase account, sets its display name, calls the
  backend to create a profile, signs out, then redirects to login.
- [x] Login uses Firebase email/password sign-in and displays a success message.
- [x] The frontend sends `POST /users` with a bearer Firebase ID token through
  `src/lib/users-api.ts`.
- [x] Backend uses Express, Prisma, and PostgreSQL configuration; it exposes
  `GET /health` and `POST /users`.
- [x] Prisma defines a `User` with Firebase UID, full name, email, role, and
  timestamps. New profiles default to `HIKER`.

### Not Yet Implemented

- [ ] Central authentication service and application-wide authentication state.
- [ ] Protected routes, role-based routing, dashboard, logout UI, and a
  post-login destination.
- [ ] Trail browsing, bookings/groups, check-in, guide dispatch, tracking,
  safety, certificates, and analytics UI.
- [ ] Frontend component/integration tests beyond validation-unit tests.
- [ ] Mobile guide application and the broader backend domain/API.

## Verified Locally

The following passed during this review:

```bash
cd frontend && npm run typecheck
cd frontend && npm run lint
cd frontend && npm test       # 1 file, 10 tests passed
cd frontend && npm run build
cd backend && npm run typecheck
```

Live Firebase behaviour, database connectivity, API behaviour against a live
database, and the root development command were not exercised in this review.

## Frontend / Backend Boundary

The frontend must never access PostgreSQL directly. The intended production
flow is:

```text
React UI
  -> Firebase Authentication
  -> Firebase ID token
  -> Express API
  -> Firebase Admin ID-token verification
  -> PostgreSQL
```

### Current API Contract in Code

| Endpoint | Current request | Current response |
| --- | --- | --- |
| `GET /health` | No authentication | `200 { "status": "ok" }` |
| `POST /users` | `Authorization: Bearer <Firebase ID token>` and JSON `{ fullName }` | `201` created user; `400`, `401`, `409`, or `500` with `{ message }` |

### Authentication Security

`POST /users` now verifies the Firebase ID token with Firebase Admin SDK and
derives the Firebase UID and email from verified token claims. Public profile
creation does not accept a role and creates the Prisma default `HIKER` role.

- [x] Verify bearer tokens with Firebase Admin SDK.
- [x] Derive Firebase UID and email from verified token claims, not the body.
- [x] Prevent public registration from assigning a privileged role.
- [x] Return `401` for missing, invalid, or expired tokens.

Live Firebase and database registration verification is still required before
this flow is considered production-ready.

## Milestones

### Phase 1 — Frontend Foundation

**Status: complete and locally verified.**

- [x] React + Vite + TypeScript application exists.
- [x] Tailwind is configured through the Vite plugin and global stylesheet.
- [x] Feature-oriented auth structure exists under `src/features/auth`.
- [x] ESLint, Prettier scripts, TypeScript, Vitest, and production build are
  configured.
- [x] Development, lint, typecheck, test, and build commands exist.

### Phase 2 — Authentication UI

**Status: complete.**

- [x] Login and registration routes and navigation links.
- [x] Accessible labels, field error regions, and form-level feedback regions.
- [x] Full name, email, password, and confirmation fields where appropriate.
- [x] Loading state and duplicate-submission prevention.
- [x] Password visibility toggles and registration password-strength display.

### Phase 3 — Client-Side Validation

**Status: complete and unit tested.**

- [x] Required full name and email format validation.
- [x] Required login password validation.
- [x] Registration eight-character minimum and password-confirmation matching.
- [x] Validation logic is separated in `src/features/auth/validation.ts`.
- [x] Ten Vitest cases cover validation and password-strength behavior.

The eight-character minimum is a client-side usability rule. A server-side
password policy still needs agreement; Firebase remains authoritative for its
own password policy.

### Phase 4 — Authentication Service and State

**Status: partially complete.**

- [x] A narrow API boundary exists in `src/lib/users-api.ts`.
- [ ] Create an `authService` boundary for registration, login, logout, and
  current-user operations.
- [ ] Move direct Firebase calls out of `LoginPage.tsx` and `RegisterPage.tsx`.
- [ ] Establish one Firebase auth-state listener and expose loading,
  authenticated, and unauthenticated states to the app.
- [ ] Add a visible logout action.
- [ ] Define the post-login route and protect session-required routes.

### Phase 5 — Firebase Authentication and Profile Creation

**Status: code implemented; live verification and backend security are pending.**

- [x] Firebase config is loaded from Vite environment variables.
- [x] Email/password registration and login calls are implemented.
- [x] Firebase errors are mapped to understandable messages.
- [x] Registration sets Firebase display name and creates the backend profile.
- [x] Duplicate profile conflicts are surfaced through `ApiError`.
- [x] Registration signs out before redirecting to login.
- [ ] Confirm Email/Password provider is enabled in Firebase.
- [ ] Verify Firebase environment values in a running environment.
- [ ] Manually test registration, login, invalid credentials, duplicate email,
  network failure, and logout against Firebase.
- [x] Secure backend token verification in code and backend tests.
- [ ] Decide recovery if Firebase account creation succeeds but backend profile
  creation fails; the current flow can leave an orphaned Firebase account.
- [ ] Remove `console.log(error)` from registration or replace it with approved,
  sanitized observability.

### Phase 6 — Backend API Integration

**Status: initial profile endpoint integrated, not complete.**

- [x] `VITE_API_BASE_URL` has a local default.
- [x] Frontend calls `POST /users`, sends the token, and handles non-success
  JSON responses.
- [x] Backend validates required strings and prevents duplicate UID/email
  records with database uniqueness constraints.
- [x] Secure the endpoint through verified Firebase claims.
- [x] Add API tests for `400`, `401`, and `409` paths.
- [ ] Add an API test for the generic `500` path.
- [ ] Define authenticated current-user/profile endpoints after server auth.
- [ ] Establish contracts for all later domains before building their UI.

### Phase 7 — Application Shell and Role-Based Experience

**Status: not started.**

- [ ] Create an authenticated shell and navigation.
- [ ] Route hikers to booking pages and coordinators to operations pages using
  backend-authorized roles.
- [ ] Add loading, unauthorized, not-found, and recoverable error pages.
- [ ] Do not rely on client role state as authorization.

### Phase 8 — Hiker Booking Experience

**Status: not started.**

- [ ] Trail listing and availability UI for Sulfatara Trail and Alto Peak.
- [ ] Group booking form and booking participant management.
- [ ] Booking status, notifications, trek information, and certificates.
- [ ] Preserve the rule that one booking represents one group.
- [ ] Do not provide guide selection; assignment happens at physical check-in
  through FIFO dispatch.
- [ ] Wait for confirmed capacity, pricing, and booking API rules rather than
  inventing client values.

### Phase 9 — Coordinator Operations Experience

**Status: not started.**

- [ ] Booking management and group check-in.
- [ ] Guide availability and FIFO dispatch visibility.
- [ ] Active trek monitoring, safety/incident workflow, weather status, and
  operational settings.
- [ ] Tourism analytics and system-record management.
- [ ] Use accurate wording: near-real-time group monitoring through assigned
  guide devices, not individual-hiker real-time tracking.

### Phase 10 — Quality and Release Verification

**Status: started only for validation-unit coverage.**

- [x] Validation unit tests.
- [ ] Component tests for login, registration, feedback, and loading behavior.
- [ ] Mocked Firebase/auth-service tests.
- [ ] API-service tests for success, authentication, validation, conflict,
  network, and server errors.
- [ ] End-to-end tests for registration, login, refresh persistence, logout,
  and protected routing.
- [ ] Accessibility review of authentication and later feature pages.
- [ ] Production environment configuration and secret review.
- [ ] Final lint, tests, typechecks, builds, and manual smoke test.

## Recommended Next Work

1. Secure `POST /users` by verifying Firebase tokens and deriving identity on
   the backend.
2. Extract Firebase calls into an authentication service and add shared auth
   state.
3. Add logout, protected routes, and an authenticated landing page.
4. Add tests for auth service, auth pages, and the user-profile API boundary.
5. Agree on the booking domain/API contract before implementing booking UI.

## Implementation Rules

- Implement one milestone at a time and update this document after verification.
- Keep roles, capacity, pricing, dispatch, safety, and state transitions
  authoritative on the backend.
- Do not connect the frontend directly to PostgreSQL.
- Do not invent trail coordinates, capacity limits, pricing, checkpoint data,
  weather thresholds, or guide-selection behavior.
- Record whether each result is locally verified, mocked, or verified against
  live services.
