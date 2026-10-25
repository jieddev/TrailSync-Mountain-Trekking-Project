# TrailSync API Contract (v1)

This is the single source of truth for the HTTP API shared by the web frontend, the future guide mobile app, and the backend. It documents **implemented** endpoints in full and lists planned resources briefly. Business rules live in [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md); the roadmap lives in [`PROJECT_MILESTONES.md`](PROJECT_MILESTONES.md).

---

## 1. Conventions

### Architecture

TrailSync is a modular monolith exposing a REST-style JSON API under `/api/v1`. Clients talk only to the API, never to PostgreSQL. Firebase Authentication is the identity provider; PostgreSQL is the application database.

```text
Web / Mobile ──HTTPS + JSON──▶ TrailSync API (Express) ──▶ PostgreSQL
                                     │
                                     └── Firebase Admin (token verification)
```

### Authentication

Authenticated requests send a Firebase ID token:

```http
Authorization: Bearer <firebase-id-token>
```

The backend verifies the token with Firebase Admin, takes the Firebase UID from the verified token, and loads the matching TrailSync `User`. The client is never authoritative for identity, role, ownership, price, status, or guide assignment; such fields in a request body are ignored.

### Requests and responses

- JSON bodies with `Content-Type: application/json`.
- IDs are opaque strings. Timestamps are ISO 8601 (`2026-10-07T01:00:00.000Z`).
- A single resource is returned directly. A collection is returned as `{ "items": [...] }`. Add pagination only when an endpoint needs it.

### Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Review the booking details and try again.",
    "details": [{ "field": "trailId", "code": "UNSUPPORTED_TRAIL", "message": "Select a supported trail." }]
  },
  "requestId": "request-id"
}
```

`details` is optional and appears on validation errors. Messages are safe for clients; stack traces, database/Firebase internals, and secrets are never returned. `requestId` matches the `X-Request-Id` response header and the server logs.

| Status | Use                                                                 |
| ------ | ------------------------------------------------------------------- |
| `200`  | Success                                                             |
| `201`  | Resource created                                                    |
| `400`  | Malformed request (`INVALID_JSON`)                                  |
| `401`  | Missing or invalid token (`UNAUTHORIZED`)                           |
| `403`  | Authenticated but not allowed (`FORBIDDEN`)                         |
| `404`  | Resource missing or not visible to the caller                       |
| `409`  | Request conflicts with the resource's current state                 |
| `422`  | Well-formed request that fails validation (`VALIDATION_ERROR`)      |
| `500`  | Unexpected server error (`INTERNAL_SERVER_ERROR`)                   |

### Roles and authorization

Roles are `HIKER`, `GUIDE`, and `COORDINATOR`, stored on the backend. The frontend may use the role for navigation, but every protected endpoint checks the role itself; a hidden button is not authorization. Public registration always creates a `HIKER`. There is no endpoint for changing roles: an operator promotes an already-registered user from the backend with `npm run set-role -- <email> <ROLE>` (see `backend/README.md`).

### Changing the contract

Any new or changed endpoint must be documented here in the same PR: method, path, auth, role, request, success response, and error codes. Renaming or removing a field that another layer depends on is a breaking change and must be agreed first; additive changes are preferred.

---

## 2. Users

### `POST /users`

Creates the TrailSync profile for the verified Firebase account. **Auth:** Bearer token. **Role:** any.

```json
{ "fullName": "Juan Dela Cruz" }
```

`201` returns the created user. Email and Firebase UID come from the token; the role is always `HIKER`.

| Status | Body                                                              |
| ------ | ----------------------------------------------------------------- |
| `400`  | `{ "message": "fullName is required and must be a non-empty string." }` |
| `400`  | Verified account has no email                                     |
| `401`  | `UNAUTHORIZED`                                                    |
| `409`  | Profile with this Firebase UID or email already exists            |

> Legacy: this route is unversioned and returns a top-level `message` instead of the error envelope. Move it to `/api/v1/users` with the standard envelope when it is next changed.

### `GET /api/v1/users/me`

Returns the caller's profile. **Auth:** Bearer token. **Role:** any. (Also served at the legacy alias `/users/me`.)

```json
{ "id": "user-id", "fullName": "Juan Dela Cruz", "email": "juan@example.com", "role": "HIKER" }
```

Errors: `401 UNAUTHORIZED`, `404 PROFILE_NOT_FOUND` (valid Firebase account without a TrailSync profile), `500 INTERNAL_SERVER_ERROR`.

---

## 3. Trails

TrailSync is a multi-trail system. Trails are catalog rows with stable IDs; the active trails are Sulfatara (`trl_sulfatara`) and Mt. Malingatong (`trl_mt_malingatong`); Lake Janagdan (`trl_lake_janagdan`) has been retired. Trails are added or retired by database migration (see `backend/README.md`); there are no create/update endpoints.

### `GET /api/v1/trails`

Lists active trails, ordered by name. **Auth:** none.

```json
{
  "items": [
    {
      "id": "trl_mt_malingatong",
      "slug": "mt-malingatong",
      "name": "Mt. Malingatong",
      "description": null,
      "package": { "price": { "amount": 680, "currency": "PHP" }, "maximumParticipants": 5, "guideCount": 1 },
      "paymentRequirement": { "downpaymentPercent": 50, "amount": 340, "currency": "PHP" }
    },
    {
      "id": "trl_sulfatara",
      "slug": "sulfatara",
      "name": "Sulfatara",
      "description": null,
      "package": { "price": { "amount": 550, "currency": "PHP" }, "maximumParticipants": 5, "guideCount": 1 },
      "paymentRequirement": { "downpaymentPercent": 50, "amount": 275, "currency": "PHP" }
    }
  ]
}
```

### `GET /api/v1/trails/:trailId`

Returns one active trail in the same shape. Errors: `404 TRAIL_NOT_FOUND` (unknown or inactive), `500`.

Map, route, checkpoint, and geographic fields will be added only when verified trail data exists.

---

## 4. Bookings

One booking is one trekking group/package: one guide, up to five participants **including the owner**, and the selected trail's full package price regardless of group size. A 50% downpayment is required; verification is **simulated** — no real payment is processed.

All booking routes require a Bearer token. Hiker routes are scoped to bookings the caller owns.

### Booking representation

Returned by every booking endpoint:

```json
{
  "id": "booking-id",
  "trail": { "id": "trl_sulfatara", "name": "Sulfatara" },
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "status": "PENDING_CONFIRMATION",
  "downpaymentStatus": "PENDING_VERIFICATION",
  "participants": [
    { "id": "p1", "kind": "BOOKING_OWNER", "name": "Juan Dela Cruz", "age": 28, "address": "Ormoc City, Leyte", "attendance": null },
    { "id": "p2", "kind": "ADDITIONAL_PARTICIPANT", "name": "Maria Dela Cruz", "age": 26, "address": "Ormoc City, Leyte", "attendance": null }
  ],
  "participantCount": 2,
  "guide": null,
  "checkedInAt": null,
  "guideAssignedAt": null,
  "completedAt": null,
  "package": { "price": { "amount": 550, "currency": "PHP" }, "maximumParticipants": 5, "guideCount": 1 },
  "paymentRequirement": { "downpaymentPercent": 50, "amount": 275, "currency": "PHP" },
  "createdAt": "2026-10-07T01:00:00.000Z",
  "updatedAt": "2026-10-07T01:00:00.000Z"
}
```

- `participants` are ordered owner first, then additional participants, then walk-ins. `kind` is `BOOKING_OWNER`, `ADDITIONAL_PARTICIPANT`, or `WALK_IN` (added at check-in). `attendance` is `PRESENT`, `ABSENT`, or `null` before check-in.
- `guide` is `{ "id", "fullName" }` once a guide is assigned at check-in, otherwise `null`. It stays set after completion.
- `checkedInAt`, `guideAssignedAt`, and `completedAt` are ISO timestamps, or `null` until that step happens.

`package.price.amount` and `paymentRequirement.amount` are **snapshots** taken from the trail when the booking was created; later catalog price changes do not affect existing bookings.

### Lifecycle

| `status`               | `downpaymentStatus`    | Meaning                                                  |
| ---------------------- | ---------------------- | -------------------------------------------------------- |
| `PENDING_CONFIRMATION` | `PENDING_VERIFICATION` | New request awaiting coordinator review                  |
| `CONFIRMED`            | `VERIFIED`             | Coordinator confirmed and (simulated) downpayment verified |
| `PENDING_CONFIRMATION` | `VERIFIED`             | Rescheduled; new date awaits review, downpayment credit kept |
| `CHECKED_IN`           | `VERIFIED`             | Group checked in at the office; waiting for a free guide |
| `GUIDE_ASSIGNED`       | `VERIFIED`             | Guide dispatched from the FIFO queue; group on the trek  |
| `COMPLETED`            | `VERIFIED`             | Group returned; the guide rejoined the end of the queue  |

```text
PENDING_CONFIRMATION → CONFIRMED → CHECKED_IN → GUIDE_ASSIGNED → COMPLETED
                           ↑   └──────────────────↗ (check-in assigns a guide immediately when one is available)
               reschedule ─┘ (CONFIRMED → PENDING_CONFIRMATION)
```

Hikers cannot cancel or confirm bookings and never choose a guide. Coordinators list and review bookings through §5 and confirm them with `POST /api/v1/bookings/:bookingId/confirm`. Check-in, guide assignment, and completion are coordinator operations in §5.

### `POST /api/v1/bookings`

Creates a booking. **Role:** `HIKER`.

```json
{
  "trailId": "trl_sulfatara",
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "ownerDetails": { "age": 28, "address": "Ormoc City, Leyte" },
  "additionalParticipants": [{ "name": "Maria Dela Cruz", "age": 26, "address": "Ormoc City, Leyte" }]
}
```

- `trailId` must be an active catalog trail.
- `scheduledDate` is `YYYY-MM-DD`; `scheduledTime` is 24-hour `HH:mm`.
- The owner's name comes from their profile; `ownerDetails` supplies only age and address.
- `additionalParticipants` is optional, at most 4 people. Ages are positive integers; names and addresses are non-blank.
- Owner, price, downpayment, status, and participant count are server-derived; client values are ignored.

`201` returns the booking with `PENDING_CONFIRMATION` / `PENDING_VERIFICATION`.

`422 VALIDATION_ERROR` detail codes: `REQUIRED`, `UNSUPPORTED_TRAIL`, `INVALID_DATE`, `INVALID_TIME`, `INVALID_AGE`, `INVALID_TYPE`, `PARTICIPANT_LIMIT_EXCEEDED`. Other errors: `401`, `403 FORBIDDEN`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/bookings`

Lists the caller's bookings, newest first, as `{ "items": [...] }`. **Role:** `HIKER`. Errors: `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/bookings/:bookingId`

Returns one booking owned by the caller. **Role:** `HIKER`. Errors: `401`, `403`, `404 BOOKING_NOT_FOUND` (also for bookings owned by someone else), `500`.

### `POST /api/v1/bookings/:bookingId/reschedule`

Moves a `CONFIRMED` booking to a new date/time. **Role:** `HIKER` (owner).

```json
{ "scheduledDate": "2026-11-21", "scheduledTime": "09:00" }
```

`200` returns the same booking with the new schedule and `status: PENDING_CONFIRMATION`. Trail, participants, price, and verified downpayment credit are kept; no second downpayment is required. Errors: `422 VALIDATION_ERROR`, `404 BOOKING_NOT_FOUND`, `409 RESCHEDULE_NOT_ALLOWED` (not currently `CONFIRMED`), `401`, `403`, `500`.

### `POST /api/v1/bookings/:bookingId/confirm`

Coordinator review: records simulated downpayment verification and confirms the booking. **Role:** `COORDINATOR`. No request body.

`200` returns the booking with `CONFIRMED` / `VERIFIED`. Errors: `404 BOOKING_NOT_FOUND`, `409 BOOKING_NOT_CONFIRMABLE` (not `PENDING_CONFIRMATION`), `401`, `403`, `500`.

---

## 5. Coordinator bookings

Coordinator-only views across **all** bookings. **Auth:** Bearer token. **Role:** `COORDINATOR` (checked against the stored profile; a role sent by the client is ignored).

### Coordinator booking representation

The booking representation from §4 plus the owner's contact details:

```json
{
  "id": "booking-id",
  "trail": { "id": "trl_sulfatara", "name": "Sulfatara" },
  "status": "PENDING_CONFIRMATION",
  "owner": { "id": "user-id", "fullName": "Juan Dela Cruz", "email": "juan@example.com" }
}
```

(Other fields are as in §4 and omitted here.)

### `GET /api/v1/coordinator/bookings`

Lists bookings as `{ "items": [...] }`, soonest trek first (`scheduledDate`, then `scheduledTime`, then `createdAt`, ascending).

With `status=CHECKED_IN` the order is by `checkedInAt` instead, so the group waiting longest comes first.

| Query           | Values                                                                          | Default      |
| --------------- | ------------------------------------------------------------------------------- | ------------ |
| `status`        | `PENDING_CONFIRMATION`, `CONFIRMED`, `CHECKED_IN`, `GUIDE_ASSIGNED`, `COMPLETED` | all statuses |
| `scheduledDate` | `YYYY-MM-DD`                                                                    | all dates    |
| `today`         | `true`: only bookings scheduled for today's Asia/Manila date                    | off          |

`today` and `scheduledDate` cannot be combined.

Errors: `422 VALIDATION_ERROR` (detail codes `INVALID_STATUS`, `INVALID_DATE`, `INVALID_VALUE`, `CONFLICTING_FILTERS`), `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/coordinator/bookings/:bookingId`

Returns any booking in the coordinator representation. Errors: `404 BOOKING_NOT_FOUND`, `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

To confirm, use `POST /api/v1/bookings/:bookingId/confirm` (§4); its response is the §4 representation without `owner`.

### `POST /api/v1/coordinator/bookings/:bookingId/check-in`

Physical check-in at the office (rules in `PROJECT_CONTEXT.md` §5.2). In the **same transaction**, the guide at the front of the FIFO queue is assigned. With no guide available the booking stays `CHECKED_IN`.

```json
{
  "attendance": [
    { "participantId": "p1", "present": true },
    { "participantId": "p2", "present": false }
  ],
  "walkIns": [{ "name": "Pedro Santos", "age": 30, "address": "Ormoc City, Leyte" }]
}
```

- The booking must be `CONFIRMED` and scheduled for **today's Asia/Manila date**.
- `attendance` must list every booked participant exactly once.
- At least one booked participant must be present.
- `walkIns` is optional. Present participants plus walk-ins must not exceed 5. Walk-ins are stored as `WALK_IN` participants marked `PRESENT`.
- The package price never changes. Extra people beyond one package are handled outside TrailSync for now.

`200` returns the coordinator booking as `GUIDE_ASSIGNED` (with `guide`) or `CHECKED_IN` (`guide: null`).

Errors:
- `422 VALIDATION_ERROR`, with detail codes `REQUIRED`, `INVALID_TYPE`, `INVALID_AGE`, `UNKNOWN_PARTICIPANT`, `DUPLICATE_PARTICIPANT`, `MISSING_PARTICIPANT`, `AT_LEAST_ONE_PRESENT`, `PARTICIPANT_LIMIT_EXCEEDED`.
- `409 CHECK_IN_NOT_ALLOWED`: the booking is not `CONFIRMED`, which also covers a repeated check-in.
- `409 NOT_SCHEDULED_TODAY`: the group must reschedule first.
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/bookings/:bookingId/assign-guide`

Assigns the guide at the front of the queue to a group waiting in `CHECKED_IN`. No request body. `200` returns the booking as `GUIDE_ASSIGNED`.

Errors:
- `409 BOOKING_NOT_WAITING`: the booking is not `CHECKED_IN`.
- `409 NO_GUIDE_AVAILABLE`: the queue is empty.
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/bookings/:bookingId/complete`

Marks the trek completed and puts the guide back at the **end** of the queue (`AVAILABLE`). No request body. `200` returns the booking as `COMPLETED`.

Errors:
- `409 BOOKING_NOT_ON_TREK`: the booking is not `GUIDE_ASSIGNED`, so a retried completion is harmless.
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

---

## 6. Guides and dispatch

Guides are `GUIDE` users. Each has a dispatch state, created `OFF_DUTY` when a coordinator approves their account request:

| `dutyStatus` | Meaning                                        | Set by                               |
| ------------ | ---------------------------------------------- | ------------------------------------ |
| `OFF_DUTY`   | Not at the office; not in the queue            | Guide or coordinator                 |
| `AVAILABLE`  | Reported in; waiting in the FIFO queue         | Guide or coordinator                 |
| `ASSIGNED`   | Dispatched to a checked-in group               | System only (check-in / assign-guide) |

How the queue works:
- The queue is the `AVAILABLE` guides ordered by when they became available.
- Dispatch always takes the front guide; there is no skipping.
- A guide on an assigned trek cannot change their availability until the trek is completed.
- Every queue change is serialised by a database lock, so one guide can never be assigned to two groups. A partial unique index enforces the same rule.

### Guide representation

```json
{
  "id": "guide-id",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "dutyStatus": "AVAILABLE",
  "availableSince": "2026-10-20T00:15:00.000Z",
  "queuePosition": 1,
  "currentBooking": null
}
```

- `queuePosition` starts at 1 at the front of the queue, and is `null` unless the guide is `AVAILABLE`.
- `currentBooking` is `{ "id", "trail": { "id", "name" }, "scheduledDate", "scheduledTime" }` while the guide is `ASSIGNED`, otherwise `null`.

### `GET /api/v1/coordinator/guides`

**Role:** `COORDINATOR`. Returns `{ "items": [...] }` in this order:
1. The queue, front first.
2. Guides on a trek, by name.
3. Off-duty guides, by name.

Errors: `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `POST /api/v1/coordinator/guides/:guideId/availability`

**Role:** `COORDINATOR`. Body: `{ "status": "AVAILABLE" | "OFF_DUTY" }`. `200` returns the guide.
- `AVAILABLE` puts an off-duty guide at the **end** of the queue. A guide who is already `AVAILABLE` keeps their place.
- `OFF_DUTY` removes the guide from the queue. Use it when the front guide is not at the office.

Errors: `422 VALIDATION_ERROR` (`INVALID_STATUS`), `409 GUIDE_ON_TREK`, `404 GUIDE_NOT_FOUND`, `401`, `403`, `500`.

### `GET /api/v1/guides/me`

**Role:** `GUIDE`. Returns the caller's guide representation. Errors: `404 GUIDE_NOT_FOUND`, `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `POST /api/v1/guides/me/availability`

**Role:** `GUIDE`. Same body, rules, and errors as the coordinator endpoint, applied to the caller only.

### `GET /api/v1/guides/me/hike-requests`

**Role:** `GUIDE`. Lists the bookings dispatched to the caller as `{ "items": [...] }` in the §4 representation. The active (`GUIDE_ASSIGNED`) trek comes first, then completed treks, newest first. Errors: `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `POST /api/v1/guides/me/hike-requests/:bookingId/complete`

**Role:** `GUIDE`. The guide ends their own trek: the booking becomes `COMPLETED` (sets `completedAt`) and the guide rejoins the end of the queue as `AVAILABLE`, the same rule as the coordinator's complete. No body. Returns the §4 booking. Errors: `404 BOOKING_NOT_FOUND` (including another guide's booking), `409 BOOKING_NOT_ON_TREK` (not `GUIDE_ASSIGNED`), `404 GUIDE_NOT_FOUND`, `401`, `403`, `500`.

---

## 7. Guide account requests

A trek guide signs in with Firebase and requests an account. The `GUIDE` user, and their `OFF_DUTY` dispatch state, are created only when a coordinator approves the request.

Request representation:

```json
{
  "id": "application-id",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "status": "PENDING",
  "declineReason": null,
  "createdAt": "2026-10-19T00:00:00.000Z"
}
```

`status` is `PENDING`, `APPROVED`, or `DECLINED`. Coordinator responses also include `reviewedAt` and `reviewedBy: { "id", "fullName" }`.

### `POST /api/v1/guide-applications`

Bearer token, no TrailSync profile needed. Body: `{ "fullName": "…" }`. Email and identity come from the verified token.
- `201` returns the request.
- A previously `DECLINED` request is re-sent as `PENDING`.

Errors: `422 VALIDATION_ERROR` (`REQUIRED` on `fullName`), `400 EMAIL_REQUIRED`, `409 APPLICATION_EXISTS` (pending or approved), `409 ACCOUNT_EXISTS` (already has a TrailSync account), `401`, `500`.

### `GET /api/v1/guide-applications/me`

Returns the caller's request. Errors: `404 APPLICATION_NOT_FOUND`, `401`, `500`.

### `GET /api/v1/coordinator/guide-applications`

**Role:** `COORDINATOR`. Returns `{ "items": [...] }`, oldest first. Optional `?status=PENDING|APPROVED|DECLINED`.

### `POST /api/v1/coordinator/guide-applications/:applicationId/approve`

**Role:** `COORDINATOR`. Creates the `GUIDE` user and their dispatch state in the same transaction.

Errors: `409 APPLICATION_NOT_PENDING`, `404 APPLICATION_NOT_FOUND`, `409 ACCOUNT_EXISTS`.

### `POST /api/v1/coordinator/guide-applications/:applicationId/decline`

**Role:** `COORDINATOR`. Optional body `{ "reason": "…" }`, at most 500 characters.

Errors: `422 VALIDATION_ERROR` (`INVALID_REASON`, `TOO_LONG`), `409 APPLICATION_NOT_PENDING`, `404 APPLICATION_NOT_FOUND`.

---

## 8. Planned APIs

Not implemented. Each will be specified here once its business rules are confirmed (see the TBD list in `PROJECT_CONTEXT.md`); do not build against these names yet.

| Resource                     | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `/api/v1/treks`              | Trek sessions started/ended from the guide's app, including the guide's own complete-and-check-out step (reusing the §5 completion rules) |
| `/api/v1/treks/:id/locations`, `/api/v1/checkpoints` | Group location updates and offline-synced checkpoint events |
| `/api/v1/incidents`, `/api/v1/trails/:id/restrictions` | SOS, incidents, weather-based trail restrictions |
| `/api/v1/certificates`       | Digital completion certificates                                      |
| `/api/v1/analytics`          | Coordinator tourism and operations analytics                         |
| `PATCH /api/v1/users/me`     | Profile edits (never `role`), once editable fields are confirmed     |
