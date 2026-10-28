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

### `GET /api/v1/trails/:trailId/restrictions`

Lists the trail's closures that apply today or later (not lifted, `endDate` on or after today's Asia/Manila date), soonest first. **Auth:** none. Coordinator names are not included.

```json
{
  "items": [
    { "id": "restriction-id", "startDate": "2026-10-27", "endDate": "2026-10-28", "reason": "PAGASA heavy rainfall warning", "status": "UPCOMING" }
  ]
}
```

`status` is `ACTIVE` (applies today) or `UPCOMING`. Errors: `404 TRAIL_NOT_FOUND` (unknown or inactive), `500`. Restrictions are managed in §8.

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
    { "id": "p1", "kind": "BOOKING_OWNER", "name": "Juan Dela Cruz", "age": 28, "address": "Ormoc City, Leyte", "email": "juan@example.com", "attendance": null, "certificateSentAt": null },
    { "id": "p2", "kind": "ADDITIONAL_PARTICIPANT", "name": "Maria Dela Cruz", "age": 26, "address": "Ormoc City, Leyte", "email": null, "attendance": null, "certificateSentAt": null }
  ],
  "participantCount": 2,
  "guide": null,
  "checkedInAt": null,
  "guideAssignedAt": null,
  "trekStartedAt": null,
  "completedAt": null,
  "package": { "price": { "amount": 550, "currency": "PHP" }, "maximumParticipants": 5, "guideCount": 1 },
  "paymentRequirement": { "downpaymentPercent": 50, "amount": 275, "currency": "PHP" },
  "trailRestriction": null,
  "createdAt": "2026-10-07T01:00:00.000Z",
  "updatedAt": "2026-10-07T01:00:00.000Z"
}
```

- `participants` are ordered owner first, then additional participants, then walk-ins. `kind` is `BOOKING_OWNER`, `ADDITIONAL_PARTICIPANT`, or `WALK_IN` (added at check-in). `attendance` is `PRESENT`, `ABSENT`, or `null` before check-in. `email` is where the participant's certificate goes (`null`: it goes to the booking owner); `certificateSentAt` is when it was emailed (§5).
- `guide` is `{ "id", "fullName" }` once a guide is assigned at check-in, otherwise `null`. It stays set after completion.
- `checkedInAt`, `guideAssignedAt`, `trekStartedAt`, and `completedAt` are ISO timestamps, or `null` until that step happens. `trekStartedAt` stays `null` when the coordinator completes a trek the guide never started.
- `trailRestriction` is `{ "startDate", "endDate", "reason" }` when a coordinator has closed the booking's trail on its `scheduledDate` (§8), otherwise `null`. The booking itself is not changed by a closure; the hiker can reschedule.

`package.price.amount` and `paymentRequirement.amount` are **snapshots** taken from the trail when the booking was created; later catalog price changes do not affect existing bookings.

### Lifecycle

| `status`               | `downpaymentStatus`    | Meaning                                                  |
| ---------------------- | ---------------------- | -------------------------------------------------------- |
| `PENDING_CONFIRMATION` | `PENDING_VERIFICATION` | New request awaiting coordinator review                  |
| `CONFIRMED`            | `VERIFIED`             | Coordinator confirmed and (simulated) downpayment verified |
| `PENDING_CONFIRMATION` | `VERIFIED`             | Rescheduled; new date awaits review, downpayment credit kept |
| `CHECKED_IN`           | `VERIFIED`             | Group checked in at the office; waiting for a free guide |
| `GUIDE_ASSIGNED`       | `VERIFIED`             | Guide dispatched from the FIFO queue; trek not started yet |
| `IN_PROGRESS`          | `VERIFIED`             | The guide started the trek from the guide app            |
| `COMPLETED`            | `VERIFIED`             | Group returned; the guide rejoined the end of the queue  |

```text
PENDING_CONFIRMATION → CONFIRMED → CHECKED_IN → GUIDE_ASSIGNED → IN_PROGRESS → COMPLETED
                           ↑   └──────────────────↗           └──────────────────↗
               reschedule ─┘   (check-in assigns a guide       (coordinator fallback: complete
     (CONFIRMED → PENDING_      immediately when one is          a trek the guide never started)
      CONFIRMATION)             available)
```

Hikers cannot cancel or confirm bookings and never choose a guide. Coordinators list and review bookings through §5 and confirm them with `POST /api/v1/bookings/:bookingId/confirm`. Check-in and guide assignment are coordinator operations in §5. The assigned guide starts and completes the trek from the guide app (§6); the coordinator can also complete it as a fallback (§5).

### `POST /api/v1/bookings`

Creates a booking. **Role:** `HIKER`.

```json
{
  "trailId": "trl_sulfatara",
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "ownerDetails": { "age": 28, "address": "Ormoc City, Leyte" },
  "additionalParticipants": [{ "name": "Maria Dela Cruz", "age": 26, "address": "Ormoc City, Leyte", "email": "maria@example.com" }]
}
```

- `trailId` must be an active catalog trail.
- `scheduledDate` is `YYYY-MM-DD`; `scheduledTime` is 24-hour `HH:mm`.
- The owner's name comes from their profile; `ownerDetails` supplies only age and address.
- `additionalParticipants` is optional, at most 4 people. Ages are positive integers; names and addresses are non-blank.
- `email` is optional for each additional participant and used only for their certificate; an invalid one is `INVALID_EMAIL`. The owner's participant email is taken from their profile.
- Owner, price, downpayment, status, and participant count are server-derived; client values are ignored.

`201` returns the booking with `PENDING_CONFIRMATION` / `PENDING_VERIFICATION`.

`422 VALIDATION_ERROR` detail codes: `REQUIRED`, `UNSUPPORTED_TRAIL`, `INVALID_DATE`, `INVALID_TIME`, `INVALID_AGE`, `INVALID_TYPE`, `PARTICIPANT_LIMIT_EXCEEDED`. Other errors: `409 TRAIL_RESTRICTED` (the trail is closed on `scheduledDate`, §8), `401`, `403 FORBIDDEN`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/bookings`

Lists the caller's bookings, newest first, as `{ "items": [...] }`. **Role:** `HIKER`. Errors: `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/bookings/:bookingId`

Returns one booking owned by the caller. **Role:** `HIKER`. Errors: `401`, `403`, `404 BOOKING_NOT_FOUND` (also for bookings owned by someone else), `500`.

### `POST /api/v1/bookings/:bookingId/reschedule`

Moves a `CONFIRMED` booking to a new date/time. **Role:** `HIKER` (owner).

```json
{ "scheduledDate": "2026-11-21", "scheduledTime": "09:00" }
```

`200` returns the same booking with the new schedule and `status: PENDING_CONFIRMATION`. Trail, participants, price, and verified downpayment credit are kept; no second downpayment is required. Errors: `422 VALIDATION_ERROR`, `404 BOOKING_NOT_FOUND`, `409 RESCHEDULE_NOT_ALLOWED` (not currently `CONFIRMED`), `409 TRAIL_RESTRICTED` (the booking's trail is closed on the new date), `401`, `403`, `500`.

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
| `status`        | `PENDING_CONFIRMATION`, `CONFIRMED`, `CHECKED_IN`, `GUIDE_ASSIGNED`, `IN_PROGRESS`, `COMPLETED` | all statuses |
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
  "walkIns": [{ "name": "Pedro Santos", "age": 30, "address": "Ormoc City, Leyte", "email": "pedro@example.com" }]
}
```

- The booking must be `CONFIRMED` and scheduled for **today's Asia/Manila date**.
- `attendance` must list every booked participant exactly once.
- At least one booked participant must be present.
- `walkIns` is optional. Present participants plus walk-ins must not exceed 5. Walk-ins are stored as `WALK_IN` participants marked `PRESENT`. A walk-in's `email` is optional, as in booking creation.
- The package price never changes. Extra people beyond one package are handled outside TrailSync for now.

`200` returns the coordinator booking as `GUIDE_ASSIGNED` (with `guide`) or `CHECKED_IN` (`guide: null`).

Errors:
- `422 VALIDATION_ERROR`, with detail codes `REQUIRED`, `INVALID_TYPE`, `INVALID_AGE`, `INVALID_EMAIL`, `UNKNOWN_PARTICIPANT`, `DUPLICATE_PARTICIPANT`, `MISSING_PARTICIPANT`, `AT_LEAST_ONE_PRESENT`, `PARTICIPANT_LIMIT_EXCEEDED`.
- `409 CHECK_IN_NOT_ALLOWED`: the booking is not `CONFIRMED`, which also covers a repeated check-in.
- `409 NOT_SCHEDULED_TODAY`: the group must reschedule first.
- `409 TRAIL_RESTRICTED`: the trail is closed today (§8); nothing is changed.
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/bookings/:bookingId/assign-guide`

Assigns the guide at the front of the queue to a group waiting in `CHECKED_IN`. No request body. `200` returns the booking as `GUIDE_ASSIGNED`.

Errors:
- `409 BOOKING_NOT_WAITING`: the booking is not `CHECKED_IN`.
- `409 NO_GUIDE_AVAILABLE`: the queue is empty.
- `409 TRAIL_RESTRICTED`: the trail is closed today (§8).
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/bookings/:bookingId/complete`

Marks the trek completed and puts the guide back at the **end** of the queue (`AVAILABLE`). No request body. `200` returns the booking as `COMPLETED`.

This is the office fallback for when the guide cannot complete the trek from the app (for example, a dead phone). It accepts a trek that is `GUIDE_ASSIGNED` (never started) or `IN_PROGRESS`.

After responding, the backend emails the certificates, as in the guide's completion (§6).

Errors:
- `409 BOOKING_NOT_ON_TREK`: the booking is not `GUIDE_ASSIGNED` or `IN_PROGRESS`, so a retried completion is harmless.
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/bookings/:bookingId/certificates/resend`

Emails the certificates of a `COMPLETED` trek that have not been sent yet (`certificateSentAt: null`), for example after an email failure. Already-sent certificates are never sent again. No request body. `200` returns `{ "sent": 2, "booking": { ...coordinator booking } }`.

Errors:
- `409 BOOKING_NOT_COMPLETED`: the trek is not completed.
- `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

---

## 6. Guides and dispatch

Guides are `GUIDE` users. Each has a dispatch state, created `OFF_DUTY` when a coordinator approves their account request:

| `dutyStatus` | Meaning                                        | Set by                               |
| ------------ | ---------------------------------------------- | ------------------------------------ |
| `OFF_DUTY`   | Not at the office; not in the queue            | Guide or coordinator                 |
| `AVAILABLE`  | Reported in; waiting in the FIFO queue         | Guide or coordinator                 |
| `ASSIGNED`   | Dispatched to a checked-in group, until the trek is completed | System only (check-in / assign-guide) |

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
- `currentBooking` is `{ "id", "status", "trail": { "id", "name" }, "scheduledDate", "scheduledTime" }` while the guide is `ASSIGNED`, otherwise `null`. `status` is `GUIDE_ASSIGNED` (not started yet) or `IN_PROGRESS`.

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

**Role:** `GUIDE`. Lists the bookings dispatched to the caller as `{ "items": [...] }` in the §4 representation. The active (`GUIDE_ASSIGNED` or `IN_PROGRESS`) trek comes first, then completed treks, newest first. Errors: `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `POST /api/v1/guides/me/hike-requests/:bookingId/start`

**Role:** `GUIDE`. Starts the trek session for a group dispatched to the caller: `GUIDE_ASSIGNED` → `IN_PROGRESS`, and sets `trekStartedAt`. No request body. `200` returns the booking (§4). The guide stays `ASSIGNED`.

Errors:
- `409 TREK_NOT_STARTABLE`: the booking is not `GUIDE_ASSIGNED` (already started or completed), so a retried start is harmless.
- `409 TRAIL_RESTRICTED`: the trail is closed today (§8). A trek already `IN_PROGRESS` is not interrupted by a closure.
- `404 BOOKING_NOT_FOUND`: unknown, or dispatched to another guide.
- `404 GUIDE_NOT_FOUND`, `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `POST /api/v1/guides/me/hike-requests/:bookingId/complete`

**Role:** `GUIDE`. The guide's complete-and-check-out step: `IN_PROGRESS` → `COMPLETED`, and the guide goes back to the **end** of the queue (`AVAILABLE`), the same rule as the coordinator's completion. No request body. `200` returns the booking (§4).

After responding, the backend emails each hiker who was not marked absent a PDF certificate of achievement with their name, the trail, the completion date (Asia/Manila) and the guide. It goes to the participant's `email`, or to the booking owner's email when they have none. Email failures never undo the completion; they are logged and can be retried with the coordinator's resend.

Errors:
- `409 TREK_NOT_IN_PROGRESS`: the trek was not started (start it first) or is already completed, so a retried completion is harmless.
- `404 BOOKING_NOT_FOUND`: unknown, or dispatched to another guide.
- `404 GUIDE_NOT_FOUND`, `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

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

## 8. Trail restrictions

A coordinator closes one trail for an inclusive range of Asia/Manila dates, for example for bad weather or trail damage. Weather data never closes a trail automatically: official weather thresholds are not decided yet (`PROJECT_CONTEXT.md` §11).

While a restriction applies to a trail and date, the server refuses with `409 TRAIL_RESTRICTED`:

- new bookings and reschedules onto that date (§4)
- check-in and guide assignment (§5)
- the guide's trek start (§6)

Existing bookings are not changed or cancelled; their `trailRestriction` field shows the closure. Restrictions are lifted, never deleted.

### Restriction representation

```json
{
  "id": "restriction-id",
  "trail": { "id": "trl_sulfatara", "name": "Sulfatara" },
  "startDate": "2026-10-27",
  "endDate": "2026-10-28",
  "reason": "PAGASA heavy rainfall warning",
  "status": "UPCOMING",
  "createdBy": { "id": "user-id", "fullName": "Office Coordinator" },
  "createdAt": "2026-10-26T01:00:00.000Z",
  "liftedAt": null,
  "liftedBy": null
}
```

`status` is derived from today's Asia/Manila date: `ACTIVE` (applies today), `UPCOMING`, `ENDED` (its last day has passed), or `LIFTED`.

### `GET /api/v1/coordinator/trail-restrictions`

**Role:** `COORDINATOR`. Returns `{ "items": [...] }`, newest `startDate` first, including ended and lifted restrictions.

### `POST /api/v1/coordinator/trail-restrictions`

**Role:** `COORDINATOR`.

```json
{ "trailId": "trl_sulfatara", "startDate": "2026-10-27", "endDate": "2026-10-28", "reason": "PAGASA heavy rainfall warning" }
```

- `trailId` must be an active catalog trail.
- `startDate` and `endDate` are `YYYY-MM-DD`; `endDate` is on or after `startDate` and not before today. A range may start in the past if it still applies today.
- `reason` is required, at most 500 characters, and is shown to hikers and guides.
- The coordinator is taken from the verified token.

`201` returns the restriction. Errors: `422 VALIDATION_ERROR` (`REQUIRED`, `INVALID_DATE`, `END_BEFORE_START`, `DATE_IN_PAST`, `TOO_LONG`, `UNSUPPORTED_TRAIL`), `401`, `403`, `500`.

### `POST /api/v1/coordinator/trail-restrictions/:restrictionId/lift`

**Role:** `COORDINATOR`. Reopens the trail for the restriction's dates. No request body. `200` returns the restriction as `LIFTED`. Errors: `409 RESTRICTION_ALREADY_LIFTED`, `404 RESTRICTION_NOT_FOUND`, `401`, `403`, `500`.

---

## 9. Weather

Advisory weather from OpenWeather for one point both trails share: the Cabintan jump-off, taken from the provisional trail KML (`WEATHER_LAT`/`WEATHER_LNG` override it). Weather never closes a trail or refuses an action; a coordinator closes trails by hand (§8).

### `GET /api/v1/weather`

**Public.** The OpenWeather key stays on the server.

```json
{
  "location": { "name": "Cabintan jump-off", "latitude": 11.080324, "longitude": 124.722855, "provisional": true },
  "current": {
    "observedAt": "2026-10-28T13:21:39.000Z",
    "temperatureC": 19.4,
    "feelsLikeC": 19.9,
    "humidityPercent": 97,
    "windSpeedMs": 1.1,
    "windGustMs": 2.1,
    "rainLastHourMm": 0,
    "condition": { "code": 800, "main": "Clear", "description": "clear sky", "icon": "01n" }
  },
  "daily": [
    {
      "date": "2026-10-29",
      "minTemperatureC": 18.5,
      "maxTemperatureC": 26,
      "rainMm": 5.2,
      "rainChancePercent": 100,
      "maxWindSpeedMs": 1.5,
      "maxWindGustMs": 3,
      "thunderstorm": false,
      "condition": { "code": 500, "main": "Rain", "description": "light rain", "icon": "10d" }
    }
  ],
  "fetchedAt": "2026-10-28T13:23:42.687Z",
  "stale": false
}
```

- `daily` has about five Asia/Manila days from today, built from the 3-hourly forecast. Today and the last day only cover the hours still in the forecast. `rainMm` is the day's total; the other values are the day's extremes. `condition` is the day's most significant condition (thunderstorm, then rain, drizzle, snow, fog/haze, clouds, clear); `thunderstorm` is true if any forecast hour has one. Condition codes and `icon` are OpenWeather's.
- Responses are cached for 10 minutes. If OpenWeather fails or takes more than 5 seconds, the last good weather (up to 6 hours old) is returned with `stale: true`, and OpenWeather is not asked again for a minute.

Errors: `503 WEATHER_UNAVAILABLE` (no API key is configured, or OpenWeather failed with nothing cached), `500`.

---

## 10. Planned APIs

Not implemented. Each will be specified here once its business rules are confirmed (see the TBD list in `PROJECT_CONTEXT.md`); do not build against these names yet.

| Resource                     | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `/api/v1/guides/me/hike-requests/:bookingId/locations`, checkpoints | Group location updates and offline-synced checkpoint events for an `IN_PROGRESS` trek (Phase 7). Trek start/complete is in §6. |
| `/api/v1/incidents`          | Guide SOS and coordinator incident handling (Phase 8)                |
| `/api/v1/certificates`       | Downloading certificates. Emailing them on completion is in §5 and §6. |
| `/api/v1/analytics`          | Coordinator tourism and operations analytics                         |
| `PATCH /api/v1/users/me`     | Profile edits (never `role`), once editable fields are confirmed     |
