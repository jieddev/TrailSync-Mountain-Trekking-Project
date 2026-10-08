# TrailSync Booking API Contract Proposal

**Status: PROPOSED FOR TEAM REVIEW — not approved and not implemented**

Labels used below:

- **CONFIRMED** — stated as a current project decision or field-confirmed operation.
- **PROPOSED** — a recommended API design choice for review; not yet a business decision.
- **TBD** — the repository or field findings do not settle the requirement.

## 1. Purpose

This document proposes the first Hiker-facing Booking API for TrailSync. It defines resource boundaries, routes, request and response examples, security expectations, and unresolved decisions so the team can review the design before implementation.

This is a planning artifact only. The repository contains no booking API or booking database model today. Nothing in this proposal should be read as an approved contract or implemented business behavior.

## 2. Repository Findings

### Backend and current API

- **CONFIRMED in repository:** the backend is Node.js, Express 5, TypeScript, Prisma, and PostgreSQL. The Prisma schema currently contains only `User` and `UserRole`; no booking, participant, schedule, payment, guide assignment, or trek-session model exists.
- `backend/src/app.ts` currently defines the routes directly in one Express app module. It uses JSON parsing, CORS, `pino-http` request logging, and a global safe-error handler. There are not yet route/controller/service/domain folders to extend.
- The actual implemented versioned profile route is `GET /api/v1/users/me`. It is also registered under the legacy alias `/users/me`. `POST /users` is currently unversioned. For new routes, the versioned route is the clearest available precedent and matches `docs/API_CONTRACT_V1.md`.
- `GET /api/v1/users/me` requires a Firebase Bearer token, looks up the PostgreSQL user by the verified Firebase UID, and returns only `{ id, fullName, email, role }`. It does not trust request-body identity or role fields. A missing profile returns `404 PROFILE_NOT_FOUND`.
- `requireFirebaseAuth` verifies the Firebase ID token and places verified `firebaseUid` and optional email on the request. It does not load the TrailSync profile, authorize a role, or implement resource ownership checks. Booking handlers will need to resolve the profile and enforce authorization themselves or through a future shared helper.
- The current API has inconsistent error shapes: the versioned current-user route uses `{ error: { code, message }, requestId }` for 404/500, while authentication middleware and unversioned profile creation return a top-level `message`; profile creation also uses `400` for validation and `409` for unique conflicts. `docs/API_CONTRACT_V1.md` recommends an error envelope and documents `422` for well-formed requests failing validation. Booking endpoints should follow that documented envelope consistently; this is a proposed choice, not a description of all current routes.
- `pino-http` supplies a request ID and response header; the API contract recommends returning the request ID with errors. Internal errors are logged and should not be exposed.
- Current `GET /api/v1/users/me` tests use Vitest, Supertest, and mocked Firebase Admin/Prisma. Booking endpoint tests should follow that lightweight pattern and cover auth, ownership, validation, and conflicts.

### Frontend and API use

- The web app is React, Vite, TypeScript, and Tailwind. It has feature-oriented auth/home folders, React Router, and Vitest tests. No booking feature, booking form, or shared booking type exists.
- Firebase session state is provided by `AuthContext`. The home page obtains an ID token with `user.getIdToken()` and calls `getCurrentUserProfile`; the API wrapper uses `fetch` and an `ApiError` type. A future booking client can follow these conventions without assuming that frontend state is an authorization authority.
- Existing auth forms use local loading/error state and client validation. Booking validation may mirror those usability patterns, but the backend must repeat every business-critical check.

### Architecture implications

- TrailSync is a modular monolith. Keep booking logic within the existing Express/PostgreSQL application boundary; no service split or new infrastructure is justified by the repository.
- The existing API contract calls for `/api/v1`, Bearer Firebase ID tokens, opaque string IDs, JSON, safe errors, and backend ownership checks. This proposal follows those conventions while noting the current route/error inconsistencies above.

## 3. Confirmed Booking Business Rules

These are confirmed project rules and workflow clarifications, not API-design guesses:

- Lake Janagdan is the final project trail. TrailSync supports one trail only. Its authoritative maps, coordinates, route, boundaries, checkpoints, and hazards remain TBD until collected and verified.
- One booking represents one trekking group/package.
- A standard package costs **₱800** and includes one guide for up to **five participants total**. A group of one, two, three, four, or five still pays ₱800. The initial Booking API rejects a single booking above five; it does not split or link bookings automatically.
- The booking owner is also a participant. The owner counts within the five-person maximum; at most four additional participants may be listed. A one-person booking is valid.
- Current field-confirmed booking information is name, age, and address. Additional information may be required later but is TBD.
- Today's manual process uses Facebook/Messenger. The tourist chooses a date and time, supplies booking information, and makes a **50% downpayment**. This is current operational context, not a requirement that TrailSync use Facebook/Messenger.
- The Hiker submits a booking request; the Hiker does not confirm it. A submitted booking starts in `PENDING_CONFIRMATION`. The Tourism Officer reviews it and verifies the required downpayment before changing it to `CONFIRMED`.
- For current development, payment processing and the Tourism Officer's payment verification step are **SIMULATED / MOCK**. No real money is transferred or processed, and no provider or gateway is connected.
- The standard package downpayment requirement is 50% of ₱800, or **₱400**.
- Cancellation is not allowed. Rescheduling is allowed. The existing booking retains the same downpayment credit when rescheduled; a date change alone does not require a second 50% downpayment. A no-show may currently be handled through rescheduling.
- Physical check-in occurs at the tourism/operations office. Hikers do not choose a guide. Guide assignment happens automatically after check-in based on available guides; existing project intent is FIFO among eligible/available guides.
- If more people arrive than the booking allows, the additional/overlapping participant(s) require another package/guide arrangement. Exact handling of under-arrival and over-arrival combinations remains TBD and belongs in detailed booking/check-in requirements.
- Daily booking/visitor capacity is set operationally by the Tourism Officer and constrained by guide availability. There is no confirmed numeric capacity.

## 4. TBD / Unresolved Decisions

| Decision                                                                                                                                                             | Why it affects the API                                                                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whether pending requests hold capacity, and if so for how long                                                                                                       | Determines whether a pending request reserves a date/time before officer confirmation and how expiry/review delays affect availability.                              |
| How a Tourism Officer handles a pending booking that cannot be confirmed                                                                                             | The confirmation action is defined, but a decline/rejection outcome and Hiker notification are not.                                                                  |
| Representation of `CHECKED_IN`, no-show, and remaining booking-state transitions                                                                                     | Defines which operational actions affect Booking versus related check-in/trek-session records. The initial `PENDING_CONFIRMATION` → `CONFIRMED` flow is established. |
| Date/time model, operating time zone, granularity, and whether there are offered slots                                                                               | Determines request shape, schedule validation, and conflict boundaries.                                                                                              |
| Availability and daily-capacity formula, including Tourism Officer override and guide capacity                                                                       | Determines which booking requests Officers can confirm. Visitor, group/package, and guide capacity must not be assumed to be equivalent.                             |
| Exact rules for groups above five: group split, maximum per additional package, package count, guide count, separate payer, and pricing                              | Determines whether one booking can represent related packages or whether a group requires multiple bookings.                                                         |
| Guide availability states and the exact FIFO interaction                                                                                                             | Determines which operational facts the Booking/coordinator confirmation flow can rely on.                                                                            |
| Exact mock-verification interaction for development; future real provider, transaction reference, actual status, gateway, verification, and refunds                  | Keeps the current simulated step simple while identifying future real-money integration needs. No provider or real processing is selected now.                       |
| Reschedule count, notice period, eligible dates, availability behavior, post-date behavior, and whether a rescheduled confirmed booking needs officer reconfirmation | Determines validation, status transitions, and conflict outcomes. The same downpayment credit stays with the same booking.                                           |
| Whether a no-show reuses the same booking, has a deadline, or has repeat consequences                                                                                | Determines no-show transitions and rescheduling eligibility. Any rescheduling retains the same booking's downpayment credit.                                         |
| Exact participant fields and age/address validation requirements                                                                                                     | Determines request validation and participant response shape. Name, age, and address are confirmed as collected; more fields and field constraints are not.          |
| Whether a Hiker notification or booking reference is needed after Tourism Officer confirmation                                                                       | Determines whether the Hiker's booking-status view is sufficient or another user-facing confirmation mechanism is needed.                                            |
| Exact booking schema and frontend booking flow                                                                                                                       | Affects persistence and client integration; neither is implemented.                                                                                                  |
| Role provisioning and role authorization mechanism                                                                                                                   | The User role exists, but the backend does not yet implement role authorization. Hiker-only access needs a defined enforcement point.                                |

The contract below gives practical recommendations where possible. The pending-to-confirmed workflow and simulated payment verification are the current recommended project workflow. Other **PROPOSED** details remain design recommendations, not business rules. Implementation should wait on open questions that affect the applicable operation.

## 5. Recommended API Design

The Hiker-facing Version 1 routes are **PROPOSED** under `/api/v1` and require a Firebase ID token in `Authorization: Bearer <token>`. The authenticated application user is resolved from the verified Firebase UID. Clients never send an owner ID, role, price, guide, booking status, or downpayment status as authority.

The coordinator confirmation operation is documented separately below. It is an operational API action, not a Hiker endpoint.

### 5.1 Create booking

**Method:** `POST`  
**Path:** `/api/v1/bookings`  
**Purpose:** Submit a booking request for one party/package. It is not confirmed at creation.  
**Authentication:** Required.  
**Authorization:** Authenticated TrailSync user; proposed Hiker-only authorization. The backend must resolve the user profile from the verified Firebase UID and bind it as booking owner. It must not accept `ownerId`, `userId`, `firebaseUid`, or role from the body.

**Headers:**

```http
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

An idempotency key is not required for the initial Booking Foundation; see section 14.

**Request:**

```json
{
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "ownerDetails": {
    "age": 28,
    "address": "Ormoc City, Leyte"
  },
  "additionalParticipants": [
    {
      "name": "Maria Dela Cruz",
      "age": 26,
      "address": "Ormoc City, Leyte"
    },
    {
      "name": "Pedro Santos",
      "age": 31,
      "address": "Ormoc City, Leyte"
    }
  ]
}
```

`scheduledDate` and `scheduledTime` illustrate a **PROPOSED** local-date/local-time representation. `Asia/Manila` is the operational context, but the team must confirm that timezone and scheduling granularity before implementation. The authenticated Firebase UID resolves the TrailSync `User` profile; the backend uses that profile ID and `fullName` as the booking owner identity/name. The client supplies only booking-specific owner details not stored on the current profile (`age` and `address`). `additionalParticipants` contains only people besides the owner and may be empty.

**Do not accept as client authority:** trail selection, owner/user IDs, participant count, package price, downpayment amount, lifecycle status, guide ID, payment verification/status, or capacity override. The server derives the fixed trail and package price from confirmed project configuration and calculates count from the owner plus the array.

**Success:** `201 Created` with the submitted booking in `PENDING_CONFIRMATION` and `downpaymentStatus: PENDING_VERIFICATION`. The response confirms only that the request was recorded; the Hiker has not confirmed the booking and no real payment was processed. A Tourism Officer must review the request and complete the simulated 50% downpayment verification before the booking becomes `CONFIRMED` and the downpayment status becomes `VERIFIED`.

Example response:

```json
{
  "id": "bk_opaque_123",
  "status": "PENDING_CONFIRMATION",
  "downpaymentStatus": "PENDING_VERIFICATION",
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "participantCount": 3,
  "package": {
    "price": { "amount": 800, "currency": "PHP" },
    "maximumParticipants": 5,
    "guideCount": 1
  },
  "paymentRequirement": {
    "downpaymentPercent": 50,
    "amount": 400,
    "currency": "PHP"
  }
}
```

The expected downpayment is currently **simulated/mock** in development; no actual funds move. The amount and requirement do not indicate that a payment was made or verified. Tourism Officer confirmation is still required. The full owner-scoped response DTO is illustrated later in this section.

**Errors:** `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 PROFILE_NOT_FOUND`; `422 VALIDATION_ERROR` (including more than four additional participants); `500 INTERNAL_SERVER_ERROR`. A booking may remain pending for Tourism Officer review; no V1 rejection action is specified.

**Notes:** Create exactly one booking/package. Reject a request exceeding five total participants; do not silently split it or create linked bookings. Validate schedule information and applicable operational constraints on the server. The exact capacity model and whether a pending request holds capacity until officer review remain TBD; no separate availability engine is part of Version 1.

### 5.2 Retrieve one booking

**Method:** `GET`  
**Path:** `/api/v1/bookings/:bookingId`  
**Purpose:** Retrieve one booking visible to its owner.  
**Authentication:** Required.  
**Authorization:** Resolve owner from verified token/profile and constrain the lookup by both booking ID and owner ID. Return the same `404 BOOKING_NOT_FOUND` for nonexistent and non-owned IDs to avoid disclosing another user's booking.

**Request:** No body. `bookingId` is an opaque string.

**Success:** `200 OK`, returning the booking representation shown below.  
**Errors:** `401 UNAUTHORIZED`; `404 BOOKING_NOT_FOUND`; `500 INTERNAL_SERVER_ERROR`.

**Notes:** No endpoint accepts an owner identifier from the client. Coordinator visibility belongs to a future separately authorized operational API.

### 5.3 List the authenticated user's bookings

**Method:** `GET`  
**Path:** `/api/v1/bookings`  
**Purpose:** List bookings owned by the authenticated user.  
**Authentication:** Required.  
**Authorization:** Backend scopes all rows to the authenticated profile. Ignore/reject owner identity or role query parameters.

**Query parameters:** None required for the initial contract. Proposed stable ordering is newest booking first. Pagination and filters are TBD and should be added when actual usage justifies them.

**Success:** `200 OK`:

```json
{
  "items": [
    {
      "id": "bk_opaque_123",
      "trail": "Lake Janagdan",
      "scheduledDate": "2026-11-20",
      "scheduledTime": "08:00",
      "status": "PENDING_CONFIRMATION",
      "downpaymentStatus": "PENDING_VERIFICATION",
      "participants": [
        {
          "id": "pt_opaque_owner",
          "kind": "BOOKING_OWNER",
          "name": "Juan Dela Cruz",
          "age": 28,
          "address": "Ormoc City, Leyte"
        }
      ],
      "participantCount": 1,
      "package": {
        "price": {
          "amount": 800,
          "currency": "PHP"
        },
        "maximumParticipants": 5,
        "guideCount": 1
      },
      "paymentRequirement": {
        "downpaymentPercent": 50,
        "amount": 400,
        "currency": "PHP"
      },
      "createdAt": "2026-10-07T01:00:00.000Z"
    }
  ]
}
```

The example values/shape are **PROPOSED**. `downpaymentStatus` describes only the current mock verification step: newly submitted requests use `PENDING_VERIFICATION`; a Tourism Officer confirmation action changes it to `VERIFIED`. This is not a payment transaction or payment-provider status. The response does not claim actual payment or real-money processing.

**Errors:** `401 UNAUTHORIZED`; `404 PROFILE_NOT_FOUND`; `500 INTERNAL_SERVER_ERROR`.

### 5.4 Reschedule a booking

**Method:** `POST`  
**Path:** `/api/v1/bookings/:bookingId/reschedule`  
**Purpose:** Request a new date/time for an eligible booking as an explicit domain action.  
**Authentication:** Required.  
**Authorization:** Owner only; backend uses authenticated profile ownership. A future coordinator operation should use a separate authorization policy.

**Request:**

```json
{
  "scheduledDate": "2026-11-21",
  "scheduledTime": "09:00"
}
```

**Success:** `200 OK` with the same booking ID and updated date/time. For a reschedule of a `CONFIRMED` booking, the recommended Version 1 behavior returns the booking to `PENDING_CONFIRMATION`; its already verified downpayment status remains `VERIFIED`. The Tourism Officer reviews the new date/time and confirms the booking again. No second downpayment or simulated re-verification is required solely because the date changed.

**Errors:** `401 UNAUTHORIZED`; `404 BOOKING_NOT_FOUND`; `422 VALIDATION_ERROR`; `409 RESCHEDULE_NOT_ALLOWED` or `409 AVAILABILITY_CONFLICT`; `500 INTERNAL_SERVER_ERROR`.

**Notes:** This proposed action is for an owned, currently `CONFIRMED` booking. It keeps the same booking ID, package, participants, and downpayment credit; only the schedule changes. The booking returns to `PENDING_CONFIRMATION`; `downpaymentStatus` remains `VERIFIED`. The number of reschedules, notice period, and date eligibility remain TBD. No cancellation route is proposed.

### 5.5 Tourism Officer confirms a booking (Coordinator API)

**Method:** `POST`  
**Path:** `/api/v1/bookings/:bookingId/confirm`  
**Purpose:** Review a pending request, record simulated downpayment verification, and confirm the booking. This is a coordinator-side operation, not a Hiker endpoint.  
**Authentication:** Required; Firebase ID token.  
**Authorization:** Require an authorized coordinator. The repository's existing role enum is `COORDINATOR` (there is no `TOURISM_OFFICER` role); using that role is **PROPOSED** and must be enforced by the backend when role authorization is designed. The request cannot grant its caller a role.

**Request:** No body. The authenticated coordinator's action represents the review and simulated verification. The backend derives the required ₱400 amount and must not accept a client-provided verified flag, amount, payment status, or provider reference.

**Success:** `200 OK` with the updated booking. The backend verifies that the booking is eligible and currently `PENDING_CONFIRMATION`. For a newly submitted booking with `downpaymentStatus: PENDING_VERIFICATION`, the coordinator action performs the simulated verification and sets it to `VERIFIED`. For a rescheduled booking whose downpayment is already `VERIFIED`, the action reviews the new schedule and retains that status; it does not require another payment or verification. In either case, the booking changes to `CONFIRMED`.

Example response fields:

```json
{
  "id": "bk_opaque_123",
  "status": "CONFIRMED",
  "downpaymentStatus": "VERIFIED",
  "package": {
    "price": { "amount": 800, "currency": "PHP" },
    "maximumParticipants": 5,
    "guideCount": 1
  },
  "paymentRequirement": {
    "downpaymentPercent": 50,
    "amount": 400,
    "currency": "PHP"
  }
}
```

This records only the project's simulated/mock verification. It does not represent money received or a payment provider transaction. The Hiker cannot call this operation. The coordinator's pending-booking list/review API, check-in API, exact role provisioning, and full coordinator authorization contract are outside this proposal.

**Errors:** `401 UNAUTHORIZED`; `403 FORBIDDEN`; `404 BOOKING_NOT_FOUND`; `409 BOOKING_NOT_CONFIRMABLE` when the booking is no longer pending or fails an approved confirmation rule; `500 INTERNAL_SERVER_ERROR`.

**Notes:** `PENDING_CONFIRMATION` plus `PENDING_VERIFICATION` is the state for a newly submitted booking. After simulated verification and confirmation, the state pair is `CONFIRMED` plus `VERIFIED`. A rescheduled booking may be `PENDING_CONFIRMATION` plus `VERIFIED` while the Tourism Officer reviews its new schedule; confirmation retains the verified credit.

### Shared booking response representation

The following is a proposed public DTO, not a raw Prisma object:

```json
{
  "id": "bk_opaque_123",
  "trail": "Lake Janagdan",
  "scheduledDate": "2026-11-20",
  "scheduledTime": "08:00",
  "status": "PENDING_CONFIRMATION",
  "downpaymentStatus": "PENDING_VERIFICATION",
  "participants": [
    {
      "id": "pt_opaque_owner",
      "kind": "BOOKING_OWNER",
      "name": "Juan Dela Cruz",
      "age": 28,
      "address": "Ormoc City, Leyte"
    },
    {
      "id": "pt_opaque_2",
      "kind": "ADDITIONAL_PARTICIPANT",
      "name": "Maria Dela Cruz",
      "age": 26,
      "address": "Ormoc City, Leyte"
    }
  ],
  "participantCount": 2,
  "package": {
    "price": { "amount": 800, "currency": "PHP" },
    "maximumParticipants": 5,
    "guideCount": 1
  },
  "paymentRequirement": {
    "downpaymentPercent": 50,
    "amount": 400,
    "currency": "PHP"
  },
  "createdAt": "2026-10-07T01:00:00.000Z",
  "updatedAt": "2026-10-07T01:00:00.000Z"
}
```

A newly submitted booking has `PENDING_CONFIRMATION` plus `PENDING_VERIFICATION`. Tourism Officer confirmation changes it to `CONFIRMED` plus `VERIFIED` using the simulated/mock process. A rescheduled booking awaiting review has `PENDING_CONFIRMATION` plus `VERIFIED`. Participant `kind`, participant IDs, date/time representation, and exact timestamps are proposed shapes. The backend derives the owner participant name from the authenticated TrailSync profile and links the participant to that owner; no Firebase UID or internal auth claim belongs in the response. Do not include an assigned guide on a newly created booking; guide assignment follows office check-in. Payment fields express the requirement and mock verification only, not actual payment processing.

## 6. Booking and Participant Data Model Expectations

Conceptual only; no schema is prescribed here.

```text
Booking
  ├── authenticated owner reference (server-derived)
  ├── one fixed project trail reference (server-derived)
  ├── selected date/time
  ├── package price snapshot (server-derived)
  ├── booking status (`PENDING_CONFIRMATION` → `CONFIRMED` → `CHECKED_IN`)
  ├── downpayment status (`PENDING_VERIFICATION` → `VERIFIED`, simulated in V1)
  └── Booking Participants
        ├── exactly one owner participant
        └── zero to four additional participants
```

Recommended expectations:

- Represent the owner in the participant set so counts are accurate, while retaining an association that identifies who owns the booking. An explicit `BOOKING_OWNER` participant kind is one proposed representation.
- The authenticated TrailSync user/profile ID owns the booking. Do not use Firebase UID supplied by the client as a resource foreign key; resolve it from verified claims.
- The owner participant name is derived from the authenticated TrailSync `User.fullName`; the `ownerDetails` request supplies only booking-specific age and address. The backend links that participant to the authenticated owner. Additional participant objects contain no user/owner IDs.
- Participant count is derived, never accepted as authoritative: `1 + additionalParticipants.length`.
- Do not model the booking owner as an extra person outside the five-person limit. A one-person booking has one owner participant and zero additional participants.
- Store the applied package price with the booking so later price changes do not rewrite historical bookings; source the current price from server-side configuration/domain policy. Whether price configuration requires a table is an implementation choice; do not introduce a pricing subsystem absent a need.
- TrailSync is single-trail. The client need not submit a trail ID; the backend binds the final Lake Janagdan project trail. Any persisted trail reference/schema is an implementation decision.
- `downpaymentStatus` is a minimal simulated-workflow field, not a payment subsystem. Do not add payment transactions/providers. Guide assignment, check-in records, and trek sessions are separate concerns and should not be modeled as participant fields.

## 7. Validation Rules

### Confirmed business validation

- Exactly one booking owner is present, derived from auth and represented in participants.
- `additionalParticipants` contains at most four people. Therefore, total participants are from one through five.
- One booking maps to one standard package. More than five must be rejected for this endpoint; do not silently split, link multiple bookings, or multiply price/guide counts. A party of six cannot be represented as one six-participant request.
- Package price is server-owned and is ₱800 regardless of participant count from one to five.
- Trail is fixed to Lake Janagdan and server-owned.
- Hikers cannot choose or submit a guide.

### Proposed request validation

- Require valid JSON with `scheduledDate`, `scheduledTime`, `ownerDetails`, and `additionalParticipants`; `ownerDetails` contains age/address only, and the additional-participant array may be empty.
- Require the authenticated owner profile to have a usable `fullName`; use it as the owner participant name rather than accepting a second owner name from the request. Require non-empty trimmed owner address and integer age; require non-empty trimmed name/address and integer age for each additional participant. Exact age bounds, maximum field lengths, address normalization, Unicode/name rules, and time/date lead-time rules are TBD and must not be invented.
- Reject unexpected authority fields (`userId`, `ownerId`, `firebaseUid`, `role`, `price`, `status`, `guideId`, `trailId`, `participantCount`) rather than trusting them. Whether to reject all unknown properties or ignore non-authority extras should be standardized with the backend request-validation convention.
- Validate date/time syntax and reject dates/times that fail the approved scheduling policy. Do not hardcode a capacity number in frontend or backend validation.
- Apply participant, schedule-format, ownership, package, and any approved operational checks on the server even if the UI performs client-side validation.

## 8. Pricing and Downpayment

### Confirmed business information

- Standard package price: **₱800** for one guide and up to five participants.
- Required downpayment: **50%**, currently calculated as **₱400**.
- The same downpayment credit stays with the same booking when it is rescheduled; a date change alone does not require a second downpayment.

### Current development behavior

Payment processing and payment verification are **SIMULATED / MOCK**. No actual money is transferred, and the project is not currently connected to a real payment provider or gateway. The Tourism Officer's verification step is also represented as a simulated/mock operational action.

For this simulated workflow, the proposed minimal `downpaymentStatus` values are:

```text
PENDING_VERIFICATION
VERIFIED
```

A new Hiker submission is `status: PENDING_CONFIRMATION` plus `downpaymentStatus: PENDING_VERIFICATION`. The coordinator confirmation action changes it to `status: CONFIRMED` plus `downpaymentStatus: VERIFIED`. If a previously confirmed booking is rescheduled, it returns to `PENDING_CONFIRMATION` while retaining `downpaymentStatus: VERIFIED`; the Officer reviews the new schedule without requiring a second downpayment or simulated verification.

The Hiker booking response may show the ₱800 package price and ₱400 requirement. `PENDING_CONFIRMATION` means the Hiker submitted the booking; it is not a payment status. Only the Tourism Officer's review plus simulated verification advances the booking to `CONFIRMED`. Do not imply from the API response that payment was submitted, received, or transferred.

### Future payment boundary

Keep payment as a clean boundary. The real booking workflow and ownership/lifecycle can remain in place while mock verification is later replaced by a real payment implementation. A future provider, transaction/reference, actual payment status, gateway, real verification, and refunds remain **TBD** and outside the initial implementation unless a future issue explicitly includes them. Do not add a payment microservice, payment gateway, or complex payment resource to this proposal. The backend derives price and downpayment; the client cannot submit authoritative amounts.

## 9. Availability and Capacity

**CONFIRMED:** Daily capacity exists but has no fixed numeric value. The Tourism Officer controls it operationally, available guides constrain it, and the exact time-slot rules are not finalized. Visitor capacity, group/package capacity, and guide availability must not be treated as mathematically identical without a confirmed rule.

**Version 1 recommendation:** Do not include a separate availability endpoint or build an availability engine. The Hiker submits the requested date/time; the backend validates the request shape and applies only agreed server-side checks. The Tourism Officer reviews and confirms the request. A submitted request is not a guarantee of an available/confirmed slot.

**TBD for future availability work:** numeric/formal capacity rules, date/time granularity, whether pending requests hold capacity, how guide availability affects confirmation, and how operational capacity overrides are represented. No number or slot model is invented here. A separate availability query can be considered after these rules exist.

## 10. Booking Lifecycle

The current recommended booking workflow is:

```text
Hiker Web Application
        ↓
New booking submitted
        ↓
PENDING_CONFIRMATION
        ↓
Tourism Officer reviews booking and performs simulated verification of the 50% downpayment requirement
        ↓
CONFIRMED
        ↓
Tourist arrives at office
        ↓
Physical office CHECK-IN
```

- `PENDING_CONFIRMATION` means the Hiker successfully submitted the request and it awaits Tourism Officer review. For a new booking, `downpaymentStatus` is `PENDING_VERIFICATION` until the Officer performs the simulated/mock verification of the 50% requirement. It does not represent an integrated payment gateway.
- `CONFIRMED` means the Tourism Officer reviewed the booking and the required downpayment is verified through the simulated/mock process. `downpaymentStatus` is `VERIFIED`.
- A rescheduled confirmed booking returns to `PENDING_CONFIRMATION` for review of the new date/time while retaining `downpaymentStatus: VERIFIED`; no second payment or verification is required solely due to rescheduling.
- `CHECKED_IN` follows physical check-in at the tourism/operations office. Whether this is represented as a Booking status or a related check-in record is a modeling decision; the operation belongs to the coordinator side.

This pending → confirmed sequence is the **current recommended project workflow**, replacing the earlier uncertainty about whether create might return a confirmed reservation. `POST /api/v1/bookings` must return `PENDING_CONFIRMATION`, never `CONFIRMED`.

### Hiker and Tourism Officer web boundary

The Hiker Web Application supports login, clicking **New Booking**, entering booking information, submitting a request, viewing the Hiker's own bookings and status, and requesting rescheduling. A Hiker cannot confirm a booking, verify payment, check in, assign a guide, or perform coordinator operations.

The future Tourism Officer/Coordinator Web Application reviews pending requests, performs the simulated downpayment verification, confirms eligible bookings, and later handles physical office check-in and operational dispatch. Confirmation is a secure coordinator-authorized Booking-domain operation, separate from the Hiker-facing API. The proposed confirmation endpoint is defined in section 5.5; implementation of coordinator authorization, role provisioning, and other coordinator operations remains outside this proposal.

Conceptually:

```text
Tourism Officer
      ↓
Review PENDING_CONFIRMATION booking
      ↓
Verify simulated downpayment
      ↓
Coordinator-authorized confirmation action
      ↓
CONFIRMED
```

If the coordinator action fails because the booking is no longer pending or its schedule cannot be accepted, it should return a safe business conflict. Exact coordinator error codes and details belong in the future operational contract.

### Booking vs. Trek Session

After booking check-in, guide assignment and trekking belong to future operational domains:

```text
CHECKED_IN
      ↓
GUIDE_ASSIGNED
      ↓
TREK_STARTED
      ↓
IN_PROGRESS
      ↓
COMPLETED
```

These guide/trek states belong to Guide Dispatch and Trek Session/operational resources, not as a sequence of Hiker Booking API actions. Guide assignment occurs after check-in, uses guide availability and the existing FIFO intent among eligible guides, and is never selected by the Hiker.

Other confirmed boundaries:

- Check-in must compare actual arrivals with booked participants. Additional arrivals require another package/guide arrangement under current practice; precise handling and pricing remain TBD. Under-arrival does not imply a refund or price change in this proposal.
- Cancellation is not allowed as a Hiker action; no Hiker cancellation endpoint is proposed.
- A no-show may currently be handled by rescheduling. No separate no-show subsystem is proposed; detailed policy remains TBD.

## 11. Rescheduling

**CONFIRMED:** Rescheduling is allowed; cancellation is not. The same booking ID and package continue, and the same downpayment credit stays with that booking. A date change alone does not require a second 50% downpayment.

```text
CONFIRMED + downpaymentStatus VERIFIED
      ↓
Hiker requests reschedule
      ↓
Same Booking ID + Same Package + Same Participants
      ↓
New Date/Time
      ↓
PENDING_CONFIRMATION + downpaymentStatus VERIFIED
      ↓
Tourism Officer reviews revised schedule
      ↓
CONFIRMED (same downpayment credit; no second payment)
```

**PROPOSED:** Use a dedicated action route, `POST /api/v1/bookings/:bookingId/reschedule`, instead of a generic patch to the booking. Rescheduling is a business action with eligibility and Tourism Officer review; an explicit route is easier to authorize and validate without allowing arbitrary status/price/owner updates through a generic resource patch.

The operation must:

1. Authenticate the Hiker and resolve the booking owner on the server.
2. Confirm the booking is eligible under the approved policy.
3. Validate the requested local date/time.
4. Update the same booking's date/time and return it to `PENDING_CONFIRMATION` for Tourism Officer review, keeping its verified downpayment status.
5. Return the updated booking or a safe conflict.

Rescheduling retains the same booking ID, package, participants, and ₱400 downpayment credit. A date change alone does not require another 50% downpayment. The number of reschedules, notice period, date range, and behavior after the original date remain **TBD**. Since the request returns to officer review, the Hiker receives `PENDING_CONFIRMATION` while `downpaymentStatus` remains `VERIFIED`; the Officer reviews and confirms the revised schedule.

## 12. Security and Authorization

- Require `Authorization: Bearer <Firebase ID token>` and verify it through the existing Firebase Admin middleware.
- Derive Firebase UID from verified token claims, then resolve the TrailSync `User` profile. Do not accept the booking owner ID, Firebase UID, email, or role in booking request bodies.
- Bind `ownerId` from the resolved profile in the backend. Filter list queries by this owner. For detail/reschedule, scope by both booking ID and owner ID, returning 404 for missing and non-owned bookings.
- Enforce the intended Hiker role server-side if role policy is adopted. The current repository has a role column but no role authorization middleware; role assignment/provisioning and enforcement need to be agreed. Never rely on a frontend route or submitted role.
- Reject or ignore authority fields from the client; never allow client values to set trail, package price, participants count, booking state, payment state, or guide assignment.
- Do not expose Firebase UIDs, credentials, raw Prisma objects, stack traces, SQL details, or internal guide availability data in Hiker responses.
- Coordinator list/check-in/dispatch routes need separate authorization and are out of this Hiker contract.

## 13. Error Handling

**PROPOSED:** Booking routes use the documented shared envelope consistently, even though existing profile creation/auth middleware still have legacy top-level-message responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Review the booking details and try again.",
    "details": [
      {
        "field": "additionalParticipants",
        "code": "PARTICIPANT_LIMIT_EXCEEDED",
        "message": "A package can include at most five participants, including the booking owner."
      }
    ]
  },
  "requestId": "req_opaque"
}
```

`details` is optional and contains safe, field-level information. Do not return database/Firebase internals. Preserve the request ID when available. Suggested status and code mapping:

| HTTP  | Error code                       | Use                                                                                                              |
| ----- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `400` | `INVALID_QUERY` / `INVALID_JSON` | Malformed query or JSON syntax.                                                                                  |
| `401` | `UNAUTHORIZED`                   | Missing, malformed, expired, or invalid Firebase token.                                                          |
| `403` | `FORBIDDEN`                      | Authenticated user lacks the required role for the operation.                                                    |
| `404` | `PROFILE_NOT_FOUND`              | Verified Firebase user has no TrailSync profile.                                                                 |
| `404` | `BOOKING_NOT_FOUND`              | Booking does not exist or is not owned by the caller.                                                            |
| `409` | `AVAILABILITY_CONFLICT`          | A confirmed operational capacity rule makes a requested schedule unacceptable; use only once such a rule exists. |
| `409` | `RESCHEDULE_NOT_ALLOWED`         | Booking is not eligible under the approved policy.                                                               |
| `409` | `BOOKING_NOT_CONFIRMABLE`        | Coordinator cannot confirm the booking in its current state.                                                     |
| `422` | `VALIDATION_ERROR`               | Well-formed request violates participant/date/time rules.                                                        |
| `500` | `INTERNAL_SERVER_ERROR`          | Unexpected failure; safe generic message only.                                                                   |

The shared `docs/API_CONTRACT_V1.md` documents 422 for validation, while implemented `POST /users` currently uses 400. The proposal intentionally follows the documented contract for new Booking routes; the team may instead choose to standardize all validation responses on 400 before implementation. The proposed coordinator confirmation action uses a safe conflict when a booking is not pending or cannot be confirmed under approved operational rules.

## 14. Idempotency and Concurrency

### Initial Booking Foundation

**Recommendation:** Do not require an `Idempotency-Key` or build a separate idempotency store in Version 1. Keep the initial implementation simple: the Hiker UI should prevent repeated clicks while a submission is pending, and the API should avoid automatic client retries for a booking POST unless the team later adds a server-side idempotency guarantee. This UI behavior is not a substitute for a future server guarantee, but the current capstone scope does not justify a major idempotency subsystem.

Idempotency can be revisited as a future reliability hardening task if duplicate submissions or retry behavior become a demonstrated concern. No V1 `IDEMPOTENCY_KEY_REUSED` error is proposed.

### Capacity and confirmation concurrency

Version 1 has no availability endpoint or capacity engine. The backend still validates booking input and persists a pending request safely. The Tourism Officer review/confirmation operation is the operational gate for changing a request to `CONFIRMED`; the detailed capacity policy and how pending requests affect capacity remain TBD. Do not claim a particular transaction/locking strategy until those rules and persistence constraints are designed.

Use ordinary database transaction boundaries to avoid partially saving a booking and its participants. If later requirements introduce concurrent capacity allocation, define an atomic concurrency-control rule as part of that capacity feature. A conflict can use `409 AVAILABILITY_CONFLICT` when a confirmed operational constraint makes the requested booking/reschedule unacceptable.

## 15. Alternative Designs Considered

### Reschedule: generic patch vs explicit action

- `PATCH /api/v1/bookings/:bookingId` is flexible, but risks permitting unrelated booking fields/status updates and hides a meaningful policy transition.
- `POST /api/v1/bookings/:bookingId/reschedule` makes the intent and authorization point explicit.
- **Recommendation:** explicit reschedule action.

### Availability: V1 endpoint vs deferred capacity feature

- A separate availability endpoint would need a finalized time-slot model and capacity calculation that the project does not yet have.
- The initial workflow can accept a requested schedule for officer review without promising immediate availability.
- **Recommendation:** leave availability out of Version 1; consider a server-authoritative advisory endpoint in a later issue after capacity, guide, and schedule rules are agreed.

### Participants: flat count vs participant objects

- A client-supplied participant count cannot identify whose information is being booked and can be manipulated.
- Participant objects preserve the confirmed name/age/address data and let the backend validate each person.
- **Recommendation:** owner object plus an array of additional participant objects; backend materializes the owner as one participant.

### Payment: full payment resource now vs simulated requirement only

- A real payment resource/status workflow would require a future provider, transaction, actual status, deadline, refund, and real verification decisions that are not confirmed.
- Returning the confirmed package price and expected 50% downpayment makes the current requirement visible while the development verification remains mocked.
- **Recommendation:** return the price snapshot and payment requirement only; keep Tourism Officer verification simulated in the current workflow and defer future real-payment resources, statuses, and endpoints.

### Hiker API and coordinator operation boundary

Routes 5.1–5.4 are Hiker-facing operations. The `POST /api/v1/bookings/:bookingId/confirm` route in 5.5 is a separate coordinator operation requiring coordinator authorization. The proposal does not define the coordinator's pending-booking list/review, check-in, or guide-dispatch APIs.

### Trail selection: client field vs fixed server context

- A client-supplied trail ID adds a choice the product does not support and could imply multi-trail behavior.
- Server-derived single trail matches the confirmed scope.
- **Recommendation:** omit trail ID from create request and return Lake Janagdan in the booking representation.

## 16. Recommended Future Implementation Sequence

Planning only; no implementation is performed by this document.

1. Team confirms the remaining Booking contract decisions, especially schedule/timezone, how pending requests affect capacity, Hiker/coordinator authorization, and the simple mock-verification interaction. `PENDING_CONFIRMATION` is the initial status; real payment integration is not a prerequisite.
2. Frontend and backend review and approve the Hiker DTOs, error codes, timezone, and authorization. Keep idempotency outside the first implementation unless a concrete duplicate/retry requirement is identified.
3. Backend defines the minimal booking/participant persistence and concurrency guarantees consistent with approved rules; no schema is prescribed here.
4. Backend implements authenticated create, own-list, and own-detail operations. Create derives owner/trail/price/count, records `PENDING_CONFIRMATION`, and never confirms from the Hiker request.
5. Define and implement the secure coordinator-side simulated verification/confirmation operation in its own operational scope. It advances an eligible pending booking to `CONFIRMED` only after Tourism Officer review and simulated downpayment verification.
6. Backend adds the reschedule operation with the confirmed same-booking/same-downpayment behavior and returns the booking to `PENDING_CONFIRMATION` for Tourism Officer review. Capacity/availability automation is deferred until its rules are defined.
7. Frontend builds the Hiker flow and separate coordinator experience against their respective approved contracts; the Hiker cannot confirm or verify payment.
8. Team verifies end-to-end Hiker submission, officer review/mock verification, confirmation, rescheduling, and operational edge cases before enabling booking to users.

Real payment processing/provider integration is a future extension and should not complicate the initial workflow. Check-in, guide dispatch, and trek-session operations retain their own authorization and contracts.

## 17. Open Questions Before Implementation

These questions materially affect this contract:

1. What exact local date/time model and timezone should be used? Are times freely selected or chosen from operational slots, and is duration relevant?
2. What future capacity calculation should consider Tourism Officer decisions, current bookings, and guide availability, and what is its atomic capacity unit? No V1 availability endpoint is proposed.
3. Do pending requests hold capacity, and if so for how long? If they do not, what capacity check is required when the Tourism Officer confirms one?
4. The initial API rejects any single booking above five participants. If a group over five is represented through multiple separate bookings, should those bookings be linked, and what package/guide/pricing rules apply?
5. What participant age/address constraints apply, and are any participant fields required beyond name, age, and address?
6. What are the reschedule limit, notice period, eligible dates, and after-date behavior? Does a reschedule of a confirmed booking require officer reconfirmation? Does a no-show reuse the same booking, and are there repeat/no-show consequences? The same downpayment credit remains on the same booking.
7. Should `CHECKED_IN` be a Booking status or a related check-in record, how should no-show be represented, and which state changes are coordinator-only?
8. How will a verified token map to an authorized Hiker profile, and where will Hiker/Coordinator role authorization be enforced?
9. How should a Tourism Officer decline or otherwise resolve a pending request that cannot be confirmed, and how is the Hiker informed?
10. What, if any, mock-verification UX/details are needed for initial development? Future real-money provider, transaction/reference, payment status, deadline, verification, and refund rules remain outside the current workflow and TBD.
11. If duplicate/retry problems justify future hardening, what idempotency guarantee should the API provide? This is not a V1 blocker.
12. Is any Hiker notification or booking reference required beyond returning the created `PENDING_CONFIRMATION` resource?

## 18. Recommended Contract Summary

### Hiker API (Version 1)

```text
POST   /api/v1/bookings
       Submit a new booking request → PENDING_CONFIRMATION

GET    /api/v1/bookings
       List the authenticated user's bookings

GET    /api/v1/bookings/:bookingId
       Retrieve one owned booking and its status

POST   /api/v1/bookings/:bookingId/reschedule
       Request a new date/time for an owned CONFIRMED booking
       Same booking, participants, package, and downpayment credit;
       return to PENDING_CONFIRMATION for Tourism Officer review
```

### Coordinator operation (separate from the Hiker API)

```text
POST   /api/v1/bookings/:bookingId/confirm
       Tourism Officer reviews the pending booking, performs simulated
       downpayment verification when still pending, then confirms it
```

The backend derives the owner from the authenticated TrailSync profile, uses that profile's name for the owner participant, and derives participant count, Lake Janagdan, ₱800 package price, one-guide package, ₱400 expected downpayment, and initial statuses. The owner is one of at most five participants; at most four additional participants are accepted, and a larger single-booking request is rejected without splitting or linking bookings.

A new request starts as `PENDING_CONFIRMATION` plus `downpaymentStatus: PENDING_VERIFICATION`. Coordinator mock verification changes it to `CONFIRMED` plus `VERIFIED`. A rescheduled confirmed booking returns to `PENDING_CONFIRMATION` while retaining `VERIFIED` downpayment credit; no second downpayment is required for the date change. Payment processing is simulated/mock and no real money is transferred.

No V1 availability endpoint, Hiker cancellation, Hiker confirmation, guide selection, or guide dispatch endpoint is proposed. Check-in, guide assignment/FIFO, and trek-session actions remain operational responsibilities beyond the Hiker Booking API.

**Review status:** This proposal is not approved and the Booking API has not been implemented.
