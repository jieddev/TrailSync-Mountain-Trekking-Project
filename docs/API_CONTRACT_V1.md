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
| `410`  | Resource has expired (e.g. a sign-up code, `CODE_EXPIRED`)          |
| `422`  | Well-formed request that fails validation (`VALIDATION_ERROR`)      |
| `429`  | Too many requests or attempts; may carry a `Retry-After` header     |
| `500`  | Unexpected server error (`INTERNAL_SERVER_ERROR`)                   |

### Roles and authorization

Roles are `HIKER`, `GUIDE`, and `COORDINATOR`, stored on the backend. The frontend may use the role for navigation, but every protected endpoint checks the role itself; a hidden button is not authorization. Public registration always creates a `HIKER`. There is no endpoint for changing roles: an operator promotes an already-registered user from the backend with `npm run set-role -- <email> <ROLE>` (see `backend/README.md`).

### Changing the contract

Any new or changed endpoint must be documented here in the same PR: method, path, auth, role, request, success response, and error codes. Renaming or removing a field that another layer depends on is a breaking change and must be agreed first; additive changes are preferred.

---

## 2. Users

### Sign-up email verification

A new hiker proves they own their email before the account exists. The web sign-up form sends the code, the hiker enters it, and only then are the Firebase login and `POST /users` called. These two routes take **no token**, because there is no account yet.

- A code is 6 digits. It expires after **10 minutes**, and only its SHA-256 hash is stored (`email_verifications` table).
- A new code may be requested **60 seconds** after the last one. Requesting a new code replaces the old one and resets the attempt count.
- After **5** wrong tries the code is locked, and the hiker must request a new one.
- A verified email may be used by `POST /users` for **30 minutes**. The verification is deleted once the profile is created.
- Emails are normalized (trimmed, lowercased) the same way as `POST /users`.
- Without `BREVO_API_KEY` or `SMTP_USER`, no email is sent and the code is written to the server log (dev and tests only).

Rules live in `backend/src/lib/email-verification.ts`.

### `POST /api/v1/email-verifications`

Emails a new code. **Auth:** none.

```json
{ "email": "juan@example.com" }
```

`201`:

```json
{ "email": "juan@example.com", "expiresAt": "2026-11-06T06:10:00.000Z", "resendAvailableAt": "2026-11-06T06:01:00.000Z" }
```

The code is never returned.

Errors:
- `422 VALIDATION_ERROR`: `INVALID` on `email`.
- `409 ACCOUNT_EXISTS`: a TrailSync account already uses this email; no code is sent.
- `429 RESEND_TOO_SOON`: within 60 seconds of the last code. `Retry-After` gives the seconds left, and the earlier code still works.
- `500`.

### `POST /api/v1/email-verifications/verify`

Checks a code. **Auth:** none.

```json
{ "email": "juan@example.com", "code": "123456" }
```

`200` returns `{ "email": "juan@example.com", "verified": true }`. Verifying an email that is already verified also returns `200`, so a hiker can retry account creation after a network error.

Errors:
- `422 VALIDATION_ERROR`: `INVALID` on `email`, or on `code` if it isn't exactly 6 digits. Neither counts as an attempt.
- `404 CODE_NOT_FOUND`: no code was requested for this email.
- `400 CODE_INCORRECT`: wrong code; counts as an attempt.
- `410 CODE_EXPIRED`: older than 10 minutes.
- `429 TOO_MANY_ATTEMPTS`: 5 wrong tries; request a new code.
- `500`.

### `POST /users`

Creates the TrailSync profile for the verified Firebase account. **Auth:** Bearer token. **Role:** any. The token's email must have passed sign-up email verification (above) within the last 30 minutes.

```json
{
  "firstName": "Juan",
  "middleName": "Santos",
  "lastName": "Dela Cruz",
  "suffix": "Jr.",
  "age": 28,
  "acceptedTermsVersion": "2026-10-30"
}
```

`201` returns the created user. Email and Firebase UID come from the token; the role is always `HIKER`.

The name comes in parts:
- `firstName` and `lastName` are required, at most 50 characters each.
- `middleName` (at most 50) and `suffix` (at most 10, e.g. `Jr.`, `III`) are optional. Leaving one out, `null`, or blank saves it as `null`.
- Each part is trimmed and its inner spaces collapsed.
- The server builds `fullName` from the parts present, in order: `"Juan Santos Dela Cruz Jr."`. A `fullName` in the body is ignored. Every other endpoint keeps showing `fullName`.

`age` is a whole number of at least 18 (`MIN_BOOKING_OWNER_AGE`). It is saved on the profile and used as the owner's age on their bookings.

`acceptedTermsVersion` must equal the current Terms of Use and Privacy Policy version (`backend/src/lib/agreements.ts`). The server stores it with the acceptance time as `termsVersion` / `termsAcceptedAt`.

| Status | Body                                                              |
| ------ | ----------------------------------------------------------------- |
| `400`  | `{ "message": "firstName is required and must be a non-empty string." }`; likewise for `lastName` |
| `400`  | A name part is too long, or `middleName` / `suffix` is not a string |
| `400`  | `age` missing, not a whole number, or under 18                    |
| `400`  | Current terms not accepted (`acceptedTermsVersion` missing or outdated) |
| `400`  | Verified account has no email                                     |
| `401`  | `UNAUTHORIZED`                                                    |
| `403`  | `{ "code": "EMAIL_NOT_VERIFIED", "message": "…" }`: email not verified, or verified more than 30 minutes ago |
| `409`  | Profile with this Firebase UID or email already exists            |

> Legacy: this route is unversioned and returns a top-level `message` instead of the error envelope. Move it to `/api/v1/users` with the standard envelope when it is next changed.

### `GET /api/v1/users/me`

Returns the caller's profile. **Auth:** Bearer token. **Role:** any. (Also served at the legacy alias `/users/me`.)

```json
{
  "id": "user-id",
  "fullName": "Juan Santos Dela Cruz Jr.",
  "firstName": "Juan",
  "middleName": "Santos",
  "lastName": "Dela Cruz",
  "suffix": "Jr.",
  "email": "juan@example.com",
  "age": 28,
  "role": "HIKER"
}
```

`firstName`, `middleName`, `lastName` and `suffix` are `null` for accounts made before sign-up asked for name parts, and for guides; those accounts have only `fullName`.

`age` is `null` for accounts made before registration asked for it; those accounts cannot book.

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
      "fees": { "garbage": 20, "environmental": 30, "entrancePerPerson": 50 },
      "paymentRequirement": { "downpaymentPercent": 50, "amount": 390, "currency": "PHP", "fullAmount": 780, "method": { "provider": "GCASH", "accountName": "TrailSync Tourism Office (TEST)", "accountNumber": "0917 000 0000", "qrImagePath": "/payments/gcash-qr-sample.png", "testMode": true } }
    },
    {
      "id": "trl_sulfatara",
      "slug": "sulfatara",
      "name": "Sulfatara",
      "description": null,
      "package": { "price": { "amount": 550, "currency": "PHP" }, "maximumParticipants": 5, "guideCount": 1 },
      "fees": { "garbage": 20, "environmental": 30, "entrancePerPerson": 50 },
      "paymentRequirement": { "downpaymentPercent": 50, "amount": 325, "currency": "PHP", "fullAmount": 650, "method": { "…": "as above" } }
    }
  ]
}
```

`paymentRequirement.amount` is the 50% downpayment and `fullAmount` the full package price; the hiker pays one of them by GCash when booking (§4). `method` is where to send it: the account name and number for a manual transfer, and `qrImagePath`, a QR image served by the web app (`frontend/public`). The account comes from `GCASH_ACCOUNT_NAME` / `GCASH_ACCOUNT_NUMBER` (placeholders by default). `testMode` is always `true` for now: no money moves through TrailSync.

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

One booking is one trekking group/package: one guide, up to five participants **including the owner**, and the selected trail's full package price regardless of group size. When booking, the hiker pays by GCash either the 50% downpayment (`DOWNPAYMENT`; the rest is paid in cash at check-in) or the full price (`FULL`), and uploads a screenshot of the GCash receipt. A coordinator views the screenshot and accepts it (confirming the booking) or rejects it with a reason, after which the hiker uploads a new one. **Test mode:** no money moves through TrailSync and any image is accepted as a receipt; the coordinator checks it by eye.

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
  "paymentRequirement": { "downpaymentPercent": 50, "amount": 350, "currency": "PHP" },
  "payment": {
    "option": "DOWNPAYMENT",
    "currency": "PHP",
    "fees": { "garbage": 20, "environmental": 30, "entrance": 100 },
    "totalAmount": 700,
    "amountDueOnline": 350,
    "balanceDueOnSite": 350,
    "balanceCollectedAt": null,
    "method": { "provider": "GCASH", "accountName": "TrailSync Tourism Office (TEST)", "accountNumber": "0917 000 0000", "qrImagePath": "/payments/gcash-qr-sample.png", "testMode": true },
    "receipts": [
      { "id": "receipt-id", "amount": 350, "referenceNumber": null, "status": "SUBMITTED", "rejectionReason": null, "reviewedAt": null, "createdAt": "2026-10-07T01:00:00.000Z" }
    ]
  },
  "trailRestriction": null,
  "createdAt": "2026-10-07T01:00:00.000Z",
  "updatedAt": "2026-10-07T01:00:00.000Z"
}
```

- `participants` are ordered owner first, then additional participants, then walk-ins. `kind` is `BOOKING_OWNER`, `ADDITIONAL_PARTICIPANT`, or `WALK_IN` (added at check-in). `attendance` is `PRESENT`, `ABSENT`, or `null` before check-in. `email` is where the participant's certificate goes (`null`: it goes to the booking owner); `certificateSentAt` is when it was emailed (§5).
- `guide` is `{ "id", "fullName" }` once a guide is assigned at check-in, otherwise `null`. It stays set after completion.
- `checkedInAt`, `guideAssignedAt`, `trekStartedAt`, and `completedAt` are ISO timestamps, or `null` until that step happens. `trekStartedAt` stays `null` when the coordinator completes a trek the guide never started.
- `payment.fees` (`garbage`, `environmental`, `entrance`) are snapshotted at booking; `entrance` is the per-person fee times the booked participants. `payment.totalAmount` is the package price plus those fees, and the downpayment is 50% of it. In the trail catalog, `paymentRequirement.amount` and `fullAmount` quote a one-person booking.
- `payment.option` is `DOWNPAYMENT` or `FULL`. `amountDueOnline` is what the hiker pays by GCash (the downpayment, or the full total); `balanceDueOnSite` is the cash due at check-in (`0` for `FULL`). `balanceCollectedAt` is set when the coordinator records the cash balance at check-in.
- `payment.receipts` lists every uploaded GCash screenshot, newest first. `status` is `SUBMITTED` (awaiting review), `ACCEPTED`, or `REJECTED` (with the coordinator's `rejectionReason`). `referenceNumber` is the optional 13-digit GCash Ref. No. The image itself is read from the receipt file routes below; its stored file name is never returned.
- `downpaymentStatus` describes the GCash payment as a whole, despite its name: `PENDING_VERIFICATION` (a receipt awaits review), `VERIFIED`, or `REJECTED` (the last receipt was rejected; the hiker must upload a new one).
- `trailRestriction` is `{ "startDate", "endDate", "reason" }` when a coordinator has closed the booking's trail on its `scheduledDate` (§8), otherwise `null`. The booking itself is not changed by a closure; the hiker can reschedule.

`package.price.amount` and `paymentRequirement.amount` are **snapshots** taken from the trail when the booking was created; later catalog price changes do not affect existing bookings.

### Lifecycle

| `status`               | `downpaymentStatus`    | Meaning                                                  |
| ---------------------- | ---------------------- | -------------------------------------------------------- |
| `PENDING_CONFIRMATION` | `PENDING_VERIFICATION` | New request; its GCash receipt awaits coordinator review |
| `PENDING_CONFIRMATION` | `REJECTED`             | Receipt rejected; waiting for the hiker to upload a new one |
| `CONFIRMED`            | `VERIFIED`             | Coordinator accepted the receipt and confirmed the trek  |
| `PENDING_CONFIRMATION` | `VERIFIED`             | Rescheduled; new date awaits review, downpayment credit kept |
| `CHECKED_IN`           | `VERIFIED`             | Group checked in (cash balance collected for `DOWNPAYMENT`); waiting for a free guide |
| `GUIDE_ASSIGNED`       | `VERIFIED`             | Guide dispatched from the FIFO queue; trek not started yet |
| `IN_PROGRESS`          | `VERIFIED`             | The guide started the trek from the guide app            |
| `COMPLETED`            | `VERIFIED`             | Group returned; the guide rejoined the end of the queue  |

```text
payment:  PENDING_VERIFICATION ──accept──→ VERIFIED
                │   ↑
          reject│   │hiker uploads a new receipt
                ↓   │
              REJECTED

PENDING_CONFIRMATION → CONFIRMED → CHECKED_IN → GUIDE_ASSIGNED → IN_PROGRESS → COMPLETED
                           ↑   └──────────────────↗           └──────────────────↗
               reschedule ─┘   (check-in assigns a guide       (coordinator fallback: complete
     (CONFIRMED → PENDING_      immediately when one is          a trek the guide never started)
      CONFIRMATION)             available)
```

Hikers cannot cancel or confirm bookings and never choose a guide. Coordinators list and review bookings through §5 and confirm them with `POST /api/v1/bookings/:bookingId/confirm`. Check-in and guide assignment are coordinator operations in §5. The assigned guide starts and completes the trek from the guide app (§6); the coordinator can also complete it as a fallback (§5).

### `POST /api/v1/bookings`

Creates a booking together with its GCash receipt. **Role:** `HIKER`.

The request is `multipart/form-data` with these parts:

| Part              | Content                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `booking`         | The booking details below, as a JSON string                             |
| `receipt`         | The GCash receipt screenshot: one JPEG, PNG, or WebP image, at most 5 MB |
| `referenceNumber` | Optional 13-digit GCash Ref. No. (spaces are ignored)                   |

The `booking` JSON:

```json
{
  "trailId": "trl_sulfatara",
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "ownerDetails": { "address": "Ormoc City, Leyte" },
  "additionalParticipants": [{ "name": "Maria Dela Cruz", "age": 26, "address": "Ormoc City, Leyte", "email": "maria@example.com" }],
  "paymentOption": "DOWNPAYMENT",
  "acceptedWaiverVersion": "2026-11-01"
}
```

- `trailId` must be an active catalog trail.
- `scheduledDate` is `YYYY-MM-DD`; `scheduledTime` is 24-hour `HH:mm`.
- The owner's name and age come from their profile; `ownerDetails` supplies only the address (a client-sent age is ignored). An account with no saved age (made before registration asked for it) is refused with `PROFILE_AGE_MISSING` on field `ownerAge`.
- The owner must be 18 or older (`MIN_BOOKING_OWNER_AGE`); a younger owner is `OWNER_UNDERAGE` (field `ownerAge`). Each additional participant must also be 18 or older (`MIN_PARTICIPANT_AGE`); a younger one is `PARTICIPANT_UNDERAGE` on `additionalParticipants.<i>.age`. Walk-ins added at check-in may be under 18.
- `additionalParticipants` is optional, at most 4 people. Ages are positive integers; names and addresses are non-blank.
- `email` is optional for each additional participant and used only for their certificate; an invalid one is `INVALID_EMAIL`. The owner's participant email is taken from their profile.
- `acceptedWaiverVersion` must equal the current Trek Waiver and Trail Rules version (`backend/src/lib/agreements.ts`); otherwise `WAIVER_NOT_ACCEPTED`. The owner accepts for the whole group. The server stores it with the acceptance time as `waiverVersion` / `waiverAcceptedAt`. Rescheduling does not ask again.
- `paymentOption` is `DOWNPAYMENT` or `FULL`; anything else is `INVALID_PAYMENT_OPTION`.
- The receipt is required (`RECEIPT_REQUIRED`). Its type is read from the file's first bytes, not its name (`UNSUPPORTED_FILE_TYPE`); over 5 MB is `RECEIPT_TOO_LARGE`. Any image is accepted in test mode.
- The booking and its first receipt (`SUBMITTED`, `amount` = `payment.amountDueOnline`) are stored together; if the booking is refused, the uploaded file is discarded.
- Owner, price, amounts, status, and participant count are server-derived; client values are ignored.

`201` returns the booking with `PENDING_CONFIRMATION` / `PENDING_VERIFICATION`.

`422 VALIDATION_ERROR` detail codes: `REQUIRED`, `UNSUPPORTED_TRAIL`, `INVALID_DATE`, `INVALID_TIME`, `INVALID_AGE`, `INVALID_TYPE`, `PARTICIPANT_LIMIT_EXCEEDED`, `OWNER_UNDERAGE`, `INVALID_PAYMENT_OPTION`, `RECEIPT_REQUIRED`, `UNSUPPORTED_FILE_TYPE`, `RECEIPT_TOO_LARGE`, `INVALID_REFERENCE_NUMBER`, `WAIVER_NOT_ACCEPTED`, and `INVALID_JSON` (field `booking`). Other errors: `409 TRAIL_RESTRICTED` (the trail is closed on `scheduledDate`, §8), `401`, `403 FORBIDDEN`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/bookings`

Lists the caller's bookings, newest first, as `{ "items": [...] }`. **Role:** `HIKER`. Errors: `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/bookings/:bookingId`

Returns one booking owned by the caller. **Role:** `HIKER`. Errors: `401`, `403`, `404 BOOKING_NOT_FOUND` (also for bookings owned by someone else), `500`.

### `POST /api/v1/bookings/:bookingId/reschedule`

Moves a `CONFIRMED` booking to a new date/time. **Role:** `HIKER` (owner).

```json
{ "scheduledDate": "2026-11-21", "scheduledTime": "09:00" }
```

`200` returns the same booking with the new schedule and `status: PENDING_CONFIRMATION`. Trail, participants, price, and the verified payment are kept; no new receipt is required. Errors: `422 VALIDATION_ERROR`, `404 BOOKING_NOT_FOUND`, `409 RESCHEDULE_NOT_ALLOWED` (not currently `CONFIRMED`), `409 TRAIL_RESTRICTED` (the booking's trail is closed on the new date), `401`, `403`, `500`.

### `POST /api/v1/bookings/:bookingId/payment-receipt`

Uploads a new GCash receipt after the coordinator rejected the last one. **Role:** `HIKER` (owner). Same `multipart/form-data` parts as booking creation, without `booking`: `receipt` (required) and `referenceNumber` (optional).

`201` returns the booking with a new `SUBMITTED` receipt and `downpaymentStatus: PENDING_VERIFICATION`. Errors: `422 VALIDATION_ERROR` (receipt detail codes as above), `404 BOOKING_NOT_FOUND` (also for another owner's booking), `409 RECEIPT_UPLOAD_NOT_ALLOWED` (the booking is not `PENDING_CONFIRMATION` / `REJECTED`), `401`, `403`, `500`.

### `GET /api/v1/bookings/:bookingId/payment-receipts/:receiptId/file`

Streams the owner's receipt image with its stored `Content-Type` and `Cache-Control: private, no-store`. **Role:** `HIKER` (owner). Clients send the Bearer token, so the web app fetches the image and shows it from an object URL. Errors: `404 RECEIPT_NOT_FOUND` (also for another owner's receipt), `404 RECEIPT_FILE_MISSING`, `401`, `403`, `500`.

### `POST /api/v1/bookings/:bookingId/confirm`

Coordinator review: accepts the GCash payment and confirms the booking. **Role:** `COORDINATOR`. No request body.

- A new booking must be `PENDING_VERIFICATION` with its latest receipt `SUBMITTED`; that receipt becomes `ACCEPTED`, with the reviewer and time recorded.
- A rescheduled booking (`VERIFIED`) is confirmed again without a new receipt.

`200` returns the booking with `CONFIRMED` / `VERIFIED`. Errors: `404 BOOKING_NOT_FOUND`, `409 BOOKING_NOT_CONFIRMABLE` (not `PENDING_CONFIRMATION`, no receipt awaiting review, or the receipt was rejected), `401`, `403`, `500`.

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
| `downpaymentStatus` | One or more of `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`, comma-separated | all          |

`today` and `scheduledDate` cannot be combined.

Errors: `422 VALIDATION_ERROR` (detail codes `INVALID_STATUS`, `INVALID_DOWNPAYMENT_STATUS`, `INVALID_DATE`, `INVALID_VALUE`, `CONFLICTING_FILTERS`), `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 PROFILE_NOT_FOUND`, `500`.

### `GET /api/v1/coordinator/bookings/:bookingId`

Returns any booking in the coordinator representation. Errors: `404 BOOKING_NOT_FOUND`, `401`, `403`, `404 PROFILE_NOT_FOUND`, `500`.

To accept the payment and confirm, use `POST /api/v1/bookings/:bookingId/confirm` (§4); its response is the §4 representation without `owner`.

### `POST /api/v1/coordinator/bookings/:bookingId/payment/reject`

Rejects the receipt awaiting review. The booking stays `PENDING_CONFIRMATION` and the hiker can upload a new receipt (§4).

```json
{ "reason": "The amount on the screenshot does not match." }
```

- `reason` is required, at most 500 characters, and shown to the hiker.
- The booking must be `PENDING_CONFIRMATION` / `PENDING_VERIFICATION` with its latest receipt `SUBMITTED`.

`200` returns the coordinator booking with `downpaymentStatus: REJECTED` and the receipt `REJECTED`. Errors: `422 VALIDATION_ERROR` (detail codes `REQUIRED`, `TOO_LONG`), `409 PAYMENT_NOT_REJECTABLE`, `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `GET /api/v1/coordinator/bookings/:bookingId/payment-receipts/:receiptId/file`

Streams any booking's receipt image, as in §4. Errors: `404 RECEIPT_NOT_FOUND`, `404 RECEIPT_FILE_MISSING`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/bookings/:bookingId/check-in`

Physical check-in at the office (rules in `PROJECT_CONTEXT.md` §5.2). In the **same transaction**, the guide at the front of the FIFO queue is assigned. With no guide available the booking stays `CHECKED_IN`.

```json
{
  "attendance": [
    { "participantId": "p1", "present": true },
    { "participantId": "p2", "present": false }
  ],
  "walkIns": [{ "name": "Pedro Santos", "age": 30, "address": "Ormoc City, Leyte", "email": "pedro@example.com" }],
  "balanceCollected": true
}
```

- The booking must be `CONFIRMED` and scheduled for **today's Asia/Manila date**.
- `attendance` must list every booked participant exactly once.
- At least one booked participant must be present.
- `walkIns` is optional. Present participants plus walk-ins must not exceed 5. Walk-ins are stored as `WALK_IN` participants marked `PRESENT`. A walk-in's `email` is optional, as in booking creation.
- The package price never changes. Extra people beyond one package are handled outside TrailSync for now.
- For a `DOWNPAYMENT` booking, `balanceCollected: true` is required: the coordinator has received the cash balance (`payment.balanceDueOnSite`). Check-in records `payment.balanceCollectedAt` and the coordinator. It is ignored for `FULL` bookings.

`200` returns the coordinator booking as `GUIDE_ASSIGNED` (with `guide`) or `CHECKED_IN` (`guide: null`).

Errors:
- `422 VALIDATION_ERROR`, with detail codes `REQUIRED`, `INVALID_TYPE`, `INVALID_AGE`, `INVALID_EMAIL`, `UNKNOWN_PARTICIPANT`, `DUPLICATE_PARTICIPANT`, `MISSING_PARTICIPANT`, `AT_LEAST_ONE_PRESENT`, `PARTICIPANT_LIMIT_EXCEEDED`, `BALANCE_NOT_COLLECTED`.
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

## 10. SOS and incidents

A guide sends an SOS from the guide app for their group; it becomes an incident that a coordinator acknowledges and then resolves. The booking's status is never changed. Notifications outside the app (SMS, push) and escalation are not decided yet (`PROJECT_CONTEXT.md` §12).

| `status`       | Meaning                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `OPEN`         | Sent by the guide; no coordinator has acknowledged it yet              |
| `ACKNOWLEDGED` | A coordinator has seen it; the guide's app shows this                  |
| `RESOLVED`     | Closed with a note on how it ended. A new SOS can then be sent         |

A booking has at most one unresolved incident (a partial unique index enforces it).

### Incident representation

```json
{
  "id": "incident-id",
  "status": "OPEN",
  "booking": {
    "id": "booking-id",
    "status": "IN_PROGRESS",
    "scheduledDate": "2026-10-29",
    "scheduledTime": "08:00",
    "trail": { "id": "trl_sulfatara", "name": "Sulfatara" },
    "owner": { "fullName": "Hiker One" },
    "participantCount": 4
  },
  "guide": { "id": "guide-id", "fullName": "Juan Dela Cruz" },
  "location": { "latitude": 11.0812, "longitude": 124.7301, "accuracyM": 12, "recordedAt": "2026-10-29T01:59:30.000Z" },
  "note": "Hiker twisted an ankle",
  "createdAt": "2026-10-29T02:00:00.000Z",
  "acknowledgedAt": null,
  "acknowledgedBy": null,
  "resolvedAt": null,
  "resolvedBy": null,
  "resolutionNote": null
}
```

`location` is `null` when the guide had no GPS fix.

### `POST /api/v1/guides/me/hike-requests/:bookingId/sos`

**Role:** `GUIDE`, for their own booking while it is `GUIDE_ASSIGNED` or `IN_PROGRESS`. Every field is optional, so an SOS can be sent with no fix and no typing:

```json
{ "latitude": 11.0812, "longitude": 124.7301, "accuracyM": 12, "recordedAt": "2026-10-29T01:59:30Z", "note": "Hiker twisted an ankle" }
```

- `latitude` and `longitude` come together (−90…90, −180…180); `accuracyM` is zero or more metres; `recordedAt` is when the fix was taken (a future time is replaced by the server's).
- `note` is at most 500 characters.
- **Safe to retry.** `201` returns a new incident. If the booking already has an unresolved incident, `200` returns that one instead, updated with the new location when it is newer.

Errors: `422 VALIDATION_ERROR` (`INVALID_LOCATION`, `INVALID_DATE`, `INVALID_NOTE`, `TOO_LONG`), `409 SOS_NOT_ALLOWED` (the trek is not dispatched or in progress), `404 BOOKING_NOT_FOUND` (also for another guide's booking), `401`, `403`, `500`.

### `GET /api/v1/guides/me/hike-requests/:bookingId/sos`

**Role:** `GUIDE`, for their own booking. Returns `{ "incident": ... }` with the booking's newest incident, or `{ "incident": null }`, so the app can show whether a coordinator has acknowledged it. Errors: `404 BOOKING_NOT_FOUND`, `401`, `403`, `500`.

### `GET /api/v1/coordinator/incidents`

**Role:** `COORDINATOR`. Optional `?status=OPEN|ACKNOWLEDGED|RESOLVED`. Returns `{ "items": [...] }`: `OPEN`, then `ACKNOWLEDGED`, then `RESOLVED`, newest first within each, at most 100. The web app checks for new SOS alerts every 20 seconds. Errors: `422 VALIDATION_ERROR` (`INVALID_STATUS`), `401`, `403`, `500`.

### `POST /api/v1/coordinator/incidents/:incidentId/acknowledge`

**Role:** `COORDINATOR`. `OPEN` → `ACKNOWLEDGED`, recording who and when. No request body. Errors: `409 INCIDENT_ALREADY_ACKNOWLEDGED`, `409 INCIDENT_ALREADY_RESOLVED`, `404 INCIDENT_NOT_FOUND`, `401`, `403`, `500`.

### `POST /api/v1/coordinator/incidents/:incidentId/resolve`

**Role:** `COORDINATOR`. `OPEN` or `ACKNOWLEDGED` → `RESOLVED`.

```json
{ "note": "Group walked down safely with the guide" }
```

`note` is required, at most 500 characters. Errors: `422 VALIDATION_ERROR` (`REQUIRED`, `TOO_LONG`), `409 INCIDENT_ALREADY_RESOLVED`, `404 INCIDENT_NOT_FOUND`, `401`, `403`, `500`.

---

## 11. Live guide tracking

While a trek is `IN_PROGRESS`, the guide app uploads the guide's GPS fixes so a coordinator can follow the group on the live map. Every fix is stored, so the map shows the latest position and the path walked so far. The app uploads about every 15 seconds and queues fixes while it has no signal, then sends them in batches when it reconnects.

### `POST /api/v1/guides/me/hike-requests/:bookingId/locations`

**Role:** `GUIDE`, for their own booking while it is `IN_PROGRESS`.

```json
{
  "points": [
    { "latitude": 11.0812, "longitude": 124.7301, "accuracyM": 8, "recordedAt": "2026-11-01T01:59:30Z" }
  ]
}
```

- `points` holds 1 to 50 fixes. `latitude` (−90…90), `longitude` (−180…180) and `recordedAt` (when the phone took the fix) are required; `accuracyM` is optional, zero or more metres.
- A `recordedAt` in the future is replaced by the server's time. Fixes taken before the trek started are dropped without an error.
- `202` returns `{ "accepted": 1 }`, the number of fixes stored.

Errors: `422 VALIDATION_ERROR` (`REQUIRED`, `TOO_MANY`, `INVALID_LOCATION`, `INVALID_DATE`, with fields such as `points[1].latitude`), `409 TREK_NOT_IN_PROGRESS` (not started, or already completed — the app stops uploading), `404 BOOKING_NOT_FOUND` (also for another guide's booking), `401`, `403`, `500`.

### `GET /api/v1/coordinator/live-treks`

**Role:** `COORDINATOR`. Returns every `IN_PROGRESS` trek, longest on the trail first. The web app's live map checks every 10 seconds.

```json
{
  "items": [
    {
      "bookingId": "booking-id",
      "trail": { "id": "trl_sulfatara", "slug": "sulfatara", "name": "Sulfatara" },
      "guide": { "id": "guide-id", "fullName": "Juan Dela Cruz" },
      "trekStartedAt": "2026-11-01T01:00:00.000Z",
      "participantCount": 4,
      "latest": { "latitude": 11.0812, "longitude": 124.7301, "accuracyM": 8, "recordedAt": "2026-11-01T01:59:30.000Z" },
      "path": [{ "latitude": 11.0801, "longitude": 124.7290, "recordedAt": "2026-11-01T01:00:15.000Z" }]
    }
  ]
}
```

- `latest` is `null` until the first fix arrives.
- `path` is in time order and thinned to at most 500 points; it always ends at `latest`.

Errors: `401`, `403`, `500`.

---

## 12. Coordinator summary

### `GET /api/v1/coordinator/summary`

Coordinator only. Counts for the coordinator dashboard and navigation badges, grouped by what the coordinator does next. "Today" is the Asia/Manila date.

```json
{
  "bookings": { "needsReview": 3, "waitingOnHiker": 1, "upcoming": 8, "arrivingToday": 2, "completed": 40 },
  "dispatch": { "waitingForGuide": 1, "onTrail": 2 },
  "guides": { "available": 3, "onTrek": 2, "nextUp": { "id": "guide-1", "fullName": "Juan Dela Cruz" } },
  "guideApplications": { "pending": 1 },
  "incidents": { "open": 0 },
  "trailRestrictions": { "active": 1 }
}
```

| Field | Counts |
| ----- | ------ |
| `bookings.needsReview` | `PENDING_CONFIRMATION` with downpayment `PENDING_VERIFICATION` (receipt to review) or `VERIFIED` (reschedule to confirm) |
| `bookings.waitingOnHiker` | `PENDING_CONFIRMATION` with downpayment `REJECTED` (the hiker must upload a new receipt) |
| `bookings.upcoming` | `CONFIRMED` |
| `bookings.arrivingToday` | `CONFIRMED` and scheduled today |
| `bookings.completed` | `COMPLETED` |
| `dispatch.waitingForGuide` | `CHECKED_IN` |
| `dispatch.onTrail` | `GUIDE_ASSIGNED` + `IN_PROGRESS` |
| `guides.available` / `guides.onTrek` | Guides `AVAILABLE` / `ASSIGNED`; `nextUp` is the front of the FIFO queue, or `null` |
| `guideApplications.pending` | Guide account requests `PENDING` |
| `incidents.open` | SOS incidents `OPEN` (not yet acknowledged) |
| `trailRestrictions.active` | Restrictions not lifted whose date range covers today |

Errors: `401`, `403`, `500`.

---

## 13. Coordinator analytics

### `GET /api/v1/coordinator/analytics`

Coordinator only (`401` without a token, `403` for other roles). Read-only tourism and operations figures for a range of Asia/Manila dates, computed from stored records.

Query:

| Parameter | Format       | Default                                 |
| --------- | ------------ | --------------------------------------- |
| `from`    | `YYYY-MM-DD` | First day of the month five months back |
| `to`      | `YYYY-MM-DD` | Today (Manila)                          |

`400 VALIDATION_ERROR` (with `details[0].field`) when a date is not a real date, `from` is after `to`, or the range is longer than 366 days.

What the range applies to:

- Bookings, visitors, guide activity, and booked value use the booking's `scheduledDate`.
- Incidents use when the SOS was raised (`createdAt`, Manila midnight to Manila midnight).
- Closures count the days they overlap the range.

Rules:

- **Visitor:** a participant on a `COMPLETED` booking who is not marked `ABSENT`, walk-ins included. This is the same rule as certificates.
- **Trails:** every active trail, plus retired trails that have treks or closures in the range. The list is in a stable order (by name).
- **Guides:** every account with the `GUIDE` role, including guides with no treks; most treks first.
- **Response times:** medians in whole minutes from the SOS to acknowledgement and to resolution; `null` when there is none.
- **Closure days:** inclusive days of each restriction inside the range. A lifted closure stops counting on the Manila day it was lifted.
- **Booked value:** the sum of `packagePrice` of completed bookings. `testMode` is `true` while GCash runs in test mode; it is not money received.

`200`:

```json
{
  "range": { "from": "2026-06-01", "to": "2026-11-02" },
  "months": ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"],
  "trails": [
    {
      "id": "trl_sulfatara",
      "name": "Sulfatara",
      "completedTreks": 2,
      "visitors": 7,
      "averageGroupSize": 3.5
    }
  ],
  "visitors": {
    "total": 7,
    "walkIns": 1,
    "byMonth": [
      {
        "month": "2026-06",
        "byTrail": { "trl_sulfatara": 3, "trl_mt_malingatong": 0 }
      }
    ]
  },
  "completedTreks": 2,
  "bookingsByStatus": { "CONFIRMED": 3, "COMPLETED": 2 },
  "guides": [
    { "id": "guide-id", "fullName": "Juan Dela Cruz", "completedTreks": 2 }
  ],
  "safety": {
    "incidents": 1,
    "openIncidents": 0,
    "medianMinutesToAcknowledge": 3,
    "medianMinutesToResolve": 42,
    "closureDaysByTrail": [
      { "trailId": "trl_sulfatara", "name": "Sulfatara", "days": 2 }
    ]
  },
  "bookedValue": {
    "testMode": true,
    "total": 1100,
    "byMonth": [{ "month": "2026-06", "amount": 550 }]
  }
}
```

`averageGroupSize` is `null` for a trail with no completed treks. `bookingsByStatus` lists only statuses that have bookings.

## 14. Planned APIs

Not implemented. Each will be specified here once its business rules are confirmed (see the TBD list in `PROJECT_CONTEXT.md`); do not build against these names yet.

| Resource                     | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| Checkpoints for `/api/v1/guides/me/hike-requests/:bookingId` | Offline-synced checkpoint events for an `IN_PROGRESS` trek (Phase 7). Location updates are in §11; trek start/complete is in §6. |
| `/api/v1/certificates`       | Downloading certificates. Emailing them on completion is in §5 and §6. |
| `PATCH /api/v1/users/me`     | Profile edits (never `role`), once editable fields are confirmed     |
