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

Roles are `HIKER`, `GUIDE`, and `COORDINATOR`, stored on the backend. The frontend may use the role for navigation, but every protected endpoint checks the role itself; a hidden button is not authorization. Public registration always creates a `HIKER`. Provisioning of `GUIDE`/`COORDINATOR` accounts is not yet defined.

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
    { "id": "p1", "kind": "BOOKING_OWNER", "name": "Juan Dela Cruz", "age": 28, "address": "Ormoc City, Leyte" },
    { "id": "p2", "kind": "ADDITIONAL_PARTICIPANT", "name": "Maria Dela Cruz", "age": 26, "address": "Ormoc City, Leyte" }
  ],
  "participantCount": 2,
  "package": { "price": { "amount": 550, "currency": "PHP" }, "maximumParticipants": 5, "guideCount": 1 },
  "paymentRequirement": { "downpaymentPercent": 50, "amount": 275, "currency": "PHP" },
  "createdAt": "2026-10-07T01:00:00.000Z",
  "updatedAt": "2026-10-07T01:00:00.000Z"
}
```

`package.price.amount` and `paymentRequirement.amount` are **snapshots** taken from the trail when the booking was created; later catalog price changes do not affect existing bookings.

### Lifecycle

| `status`               | `downpaymentStatus`    | Meaning                                                  |
| ---------------------- | ---------------------- | -------------------------------------------------------- |
| `PENDING_CONFIRMATION` | `PENDING_VERIFICATION` | New request awaiting coordinator review                  |
| `CONFIRMED`            | `VERIFIED`             | Coordinator confirmed and (simulated) downpayment verified |
| `PENDING_CONFIRMATION` | `VERIFIED`             | Rescheduled; new date awaits review, downpayment credit kept |

Hikers cannot cancel or confirm bookings and never choose a guide. Check-in and guide assignment are future coordinator operations.

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

## 5. Planned APIs

Not implemented. Each will be specified here once its business rules are confirmed (see the TBD list in `PROJECT_CONTEXT.md`); do not build against these names yet.

| Resource                     | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Coordinator booking queue    | List pending bookings for review                                     |
| `/api/v1/check-ins`          | Physical office check-in, comparing arrivals with booked participants |
| `/api/v1/guides`             | Guide availability and FIFO dispatch                                 |
| `/api/v1/treks`              | Trek sessions started/ended from the guide's app                     |
| `/api/v1/treks/:id/locations`, `/api/v1/checkpoints` | Group location updates and offline-synced checkpoint events |
| `/api/v1/incidents`, `/api/v1/trails/:id/restrictions` | SOS, incidents, weather-based trail restrictions |
| `/api/v1/certificates`       | Digital completion certificates                                      |
| `/api/v1/analytics`          | Coordinator tourism and operations analytics                         |
| `PATCH /api/v1/users/me`     | Profile edits (never `role`), once editable fields are confirmed     |
