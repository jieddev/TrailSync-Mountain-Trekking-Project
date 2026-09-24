# TrailSync API Contract

## 1. Purpose

This document defines the communication contract between the TrailSync frontend, mobile application, and backend API.

The contract specifies:

- API URL structure
- HTTP methods
- Authentication requirements
- Request and response formats
- Error formats
- Resource naming
- Authorization expectations
- Rules for evolving the API

The goal is to allow frontend, backend, and mobile development to proceed independently without inventing incompatible request or response formats.

---

# 2. API Architecture

TrailSync uses a **REST-style JSON API**.

Recommended base path:

```text
/api/v1
```

Example:

```text
GET /api/v1/users/me
```

The API is part of the TrailSync **modular monolith**.

The frontend and mobile applications communicate with the backend API.

```text
Web Frontend
      │
      │ HTTPS + JSON
      ▼
TrailSync Backend API
      │
      ├── Authentication / Authorization
      ├── User Profiles
      ├── Trails
      ├── Bookings
      ├── Check-In / Dispatch
      ├── Trek Sessions
      ├── Monitoring
      ├── Safety / Incidents
      ├── Certificates
      └── Analytics
      │
      ▼
PostgreSQL
```

Firebase Authentication remains the authentication provider.

PostgreSQL remains the TrailSync application database.

The frontend and mobile applications must not access PostgreSQL directly.

---

# 3. Authentication Contract

TrailSync uses Firebase Authentication for user authentication.

Authenticated requests send the Firebase ID token using the standard Bearer authorization header:

```http
Authorization: Bearer <firebase-id-token>
```

Example:

```http
GET /api/v1/users/me
Authorization: Bearer eyJ...
```

The backend must:

1. Receive the Firebase ID token.
2. Verify the token using Firebase Admin.
3. Obtain the authenticated Firebase UID from the verified token.
4. Use that identity to locate the corresponding TrailSync user.
5. Apply backend authorization rules where required.

The client must not be treated as authoritative for:

- user identity
- user role
- guide assignment
- booking ownership
- trek ownership
- coordinator permissions
- safety permissions
- other privileged decisions

---

# 4. Common HTTP and JSON Rules

Requests and responses use JSON unless an endpoint explicitly requires another representation, such as a PDF certificate.

Recommended content type:

```http
Content-Type: application/json
```

Dates and timestamps should use ISO 8601 format.

Example:

```text
2026-09-24T15:30:00.000Z
```

IDs should be treated by clients as opaque strings.

The frontend must not depend on the internal database ID-generation implementation.

---

# 5. Common Success Responses

Successful responses should return the resource or result directly unless the endpoint has a specific reason to use another structure.

Example:

```json
{
  "id": "user-id",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "role": "HIKER"
}
```

For collections, use:

```json
{
  "items": []
}
```

Pagination should only be introduced on endpoints where it is actually needed.

Do not add pagination to every endpoint automatically.

---

# 6. Common Error Response

Backend errors should use a consistent JSON structure.

Recommended format:

```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile was not found."
  },
  "requestId": "request-id"
}
```

The `message` should be safe for clients.

The backend must not expose:

- stack traces
- database errors
- Firebase Admin internals
- SQL details
- secrets
- tokens
- internal implementation details

The existing request ID should be preserved when available.

---

# 7. Recommended HTTP Status Codes

Use HTTP status codes consistently.

| Status | Meaning                                               |
| ------ | ----------------------------------------------------- |
| `200`  | Successful request                                    |
| `201`  | Resource successfully created                         |
| `204`  | Successful request with no response body              |
| `400`  | Invalid request format                                |
| `401`  | Authentication missing or invalid                     |
| `403`  | Authenticated but not authorized                      |
| `404`  | Requested resource does not exist or is not available |
| `409`  | Request conflicts with current state                  |
| `422`  | Request is well-formed but fails validation           |
| `500`  | Unexpected server error                               |

The exact status should reflect the actual situation rather than being used arbitrarily.

---

# 8. Current User/Profile Contract

This is the first API contract required for the current Hiker Home task.

## Endpoint

```http
GET /api/v1/users/me
```

## Authentication

Required.

The request must contain:

```http
Authorization: Bearer <firebase-id-token>
```

## Request Body

None.

The frontend must not send:

```json
{
  "userId": "...",
  "firebaseUid": "...",
  "role": "HIKER"
}
```

The backend derives the authenticated identity from the verified Firebase token.

## Successful Response

```http
200 OK
```

Example:

```json
{
  "id": "user-id",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "role": "HIKER"
}
```

These are the currently appropriate profile fields for the authenticated application shell.

Additional profile fields may be added later through an explicit contract change.

## Missing Authentication

```http
401 Unauthorized
```

Example:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication is required."
  },
  "requestId": "request-id"
}
```

## Invalid Firebase Token

```http
401 Unauthorized
```

Example:

```json
{
  "error": {
    "code": "INVALID_AUTH_TOKEN",
    "message": "Authentication is invalid."
  },
  "requestId": "request-id"
}
```

## Firebase User Exists but TrailSync Profile Does Not Exist

Recommended response:

```http
404 Not Found
```

Example:

```json
{
  "error": {
    "code": "PROFILE_NOT_FOUND",
    "message": "User profile was not found."
  },
  "requestId": "request-id"
}
```

This situation should be handled explicitly rather than returning a fake profile.

---

# 9. Current Hiker Home Integration

The frontend Hiker Home can use the following flow:

```text
Firebase Authentication
        ↓
Authenticated Firebase Session
        ↓
GET /api/v1/users/me
        ↓
Backend verifies Firebase ID token
        ↓
Backend finds PostgreSQL User
        ↓
Profile returned
        ↓
Hiker Home displays profile information
```

Example frontend usage:

```text
GET /api/v1/users/me

200 OK

{
  "id": "...",
  "fullName": "Juan Dela Cruz",
  "email": "juan@example.com",
  "role": "HIKER"
}
```

The Hiker Home may then display:

```text
Welcome, Juan Dela Cruz

juan@example.com
Hiker
```

The exact visual presentation belongs to the frontend implementation.

---

# 10. User Role Contract

The current roles are:

```text
HIKER
GUIDE
COORDINATOR
```

Roles are authoritative on the backend.

The frontend may use the returned role to determine navigation or presentation.

For example:

```text
role = HIKER
→ Hiker experience
```

However:

```text
Frontend role check
≠
Backend authorization
```

A hidden button is not authorization.

Every protected backend operation must independently verify whether the authenticated user is allowed to perform that operation.

---

# 11. Resource Structure

As TrailSync grows, API endpoints should be organized around resources.

Recommended structure:

```text
/api/v1/users
/api/v1/trails
/api/v1/bookings
/api/v1/check-ins
/api/v1/guides
/api/v1/treks
/api/v1/locations
/api/v1/checkpoints
/api/v1/incidents
/api/v1/certificates
/api/v1/analytics
```

Not every resource needs to be implemented immediately.

This structure is a roadmap for API organization, not permission to implement all of these features now.

---

# 12. User API

Currently required:

```text
GET /api/v1/users/me
```

Future user-profile operations may include:

```text
PATCH /api/v1/users/me
```

but this should only be implemented when the editable profile fields and validation rules are confirmed.

The backend must never allow a normal user to modify privileged fields such as:

```text
role
```

through an ordinary profile-update endpoint.

---

# 13. Trail API

Trail functionality must support the current single-trail scope.

The API should not hardcode:

```text
Lake Janagdan
```

as a permanent system assumption.

Lake Janagdan is the current working trail, but the final selected trail may change.

A future trail contract can therefore use a trail resource such as:

```text
GET /api/v1/trails/{trailId}
```

Possible future response:

```json
{
  "id": "trail-id",
  "name": "Lake Janagdan",
  "description": "...",
  "..."
}
```

The exact fields remain TBD until legitimate trail information and project requirements are confirmed.

Do not invent:

- coordinates
- boundaries
- hazards
- checkpoints
- capacity
- weather thresholds

until those values are officially supplied.

---

# 14. Booking API

Booking is a future milestone and should not be implemented as part of the Hiker Home task.

Once booking requirements are finalized, the API should follow a resource-based structure such as:

```text
POST /api/v1/bookings
GET /api/v1/bookings/{bookingId}
GET /api/v1/users/me/bookings
```

Future state-changing operations may follow the resource:

```text
POST /api/v1/bookings/{bookingId}/cancel
```

but cancellation and refund rules must be confirmed first.

## Confirmed Booking Business Rule

The standard package is:

```text
1 booking
1 guide
up to 5 guests
₱550
```

Fewer than five guests still pay:

```text
₱550
```

The API must not invent discounted pricing for smaller groups.

Rules for groups exceeding five guests remain TBD.

Daily carrying capacity also remains TBD.

Therefore, the final booking request and response schema should not be considered finalized until those decisions are confirmed.

---

# 15. Check-In and Guide Dispatch API

These are future backend operations.

The future API should represent the operational sequence:

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

Potential resource structure:

```text
POST /api/v1/check-ins
GET /api/v1/guides/availability
GET /api/v1/guides/queue
POST /api/v1/assignments
```

These are proposed resource boundaries, not finalized contracts.

The exact request/response schemas must be agreed when the dispatch milestone begins.

The backend must enforce FIFO and concurrency rules.

The frontend must not decide which guide receives a group.

---

# 16. Trek Session API

A future trek session should represent the actual trekking operation after guide assignment.

Potential structure:

```text
POST /api/v1/treks
GET /api/v1/treks/{trekId}
POST /api/v1/treks/{trekId}/start
POST /api/v1/treks/{trekId}/complete
```

The exact lifecycle states must be confirmed before implementation.

The backend remains authoritative for trek state transitions.

---

# 17. Monitoring and Checkpoint API

Monitoring will describe:

```text
Near-real-time monitoring of trekking groups through assigned guide devices.
```

It must not be represented as:

```text
Individual real-time tracking of every hiker.
```

A future location endpoint may follow a structure such as:

```text
POST /api/v1/treks/{trekId}/locations
```

Checkpoint events may follow:

```text
POST /api/v1/treks/{trekId}/checkpoints
```

Offline synchronization must be designed to be retry-safe and idempotent.

The detailed request schema remains TBD until the legitimate trail/checkpoint data and synchronization requirements are confirmed.

---

# 18. Safety and Incident API

Future safety functionality should use resource-based endpoints such as:

```text
GET /api/v1/weather/restrictions
GET /api/v1/trails/{trailId}/restrictions
POST /api/v1/incidents
POST /api/v1/sos
```

These endpoint names are preliminary.

Official weather thresholds, incident procedures, notification channels, and SOS escalation rules remain TBD.

AI must not make safety-critical decisions.

Safety rules must be deterministic and enforced by the backend.

---

# 19. Certificate API

Future certificate access may follow:

```text
GET /api/v1/treks/{trekId}/certificate
```

or another finalized certificate resource.

The certificate must only be available when the trek meets the confirmed completion requirements.

Certificate design, signing, storage, and issuance-history requirements remain TBD.

---

# 20. Analytics API

Analytics should be built from persisted operational records.

A future coordinator-only structure could be:

```text
GET /api/v1/analytics/visitors
GET /api/v1/analytics/bookings
GET /api/v1/analytics/guides
GET /api/v1/analytics/incidents
```

The exact endpoints depend on the final coordinator requirements.

Analytics should not invent data or rely on AI recommendations unless a confirmed non-safety-critical use case exists.

---

# 21. Authorization Rules

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
Are you allowed to do this?
```

Firebase authentication provides identity.

TrailSync backend authorization determines permissions.

Examples:

```text
HIKER
→ access own profile
→ access own bookings
→ access own trekking information

GUIDE
→ access assigned guide operations
→ submit authorized trek/session information

COORDINATOR
→ perform authorized check-in
→ manage operational guide dispatch
→ access authorized monitoring data
→ access authorized analytics
```

These examples describe the intended direction of the role model.

Exact permissions should be finalized per feature rather than creating a huge permission system prematurely.

---

# 22. API Contract Rules for Both Developers

Whenever one developer creates or changes an API endpoint, the change should document:

```text
1. HTTP method
2. URL
3. Authentication requirement
4. Authorization requirement
5. Request headers
6. Request body
7. Success status
8. Success response
9. Possible error statuses
10. Error response
```

Example:

```text
Endpoint:
GET /api/v1/users/me

Auth:
Firebase Bearer token required

Request body:
None

Success:
200

Response:
{
  "id": "...",
  "fullName": "...",
  "email": "...",
  "role": "HIKER"
}

Errors:
401 UNAUTHORIZED
401 INVALID_AUTH_TOKEN
404 PROFILE_NOT_FOUND
```

The frontend and backend should implement the same contract.

---

# 23. Contract Change Rule

Do not silently change an API response after another part of the system depends on it.

For example, changing:

```json
{
  "fullName": "Juan Dela Cruz"
}
```

to:

```json
{
  "name": "Juan Dela Cruz"
}
```

is an API contract change.

Changes should be discussed before implementation when they affect another application layer.

Backward-compatible additions are preferred.

For example, adding:

```json
{
  "id": "...",
  "fullName": "...",
  "email": "...",
  "role": "HIKER",
  "createdAt": "..."
}
```

is generally easier to adopt than renaming an existing field.

---

# 24. Current Development Contract

For the immediate milestone, the only backend/frontend contract that needs to be finalized is:

```text
GET /api/v1/users/me
```

with:

```text
Authentication:
Firebase ID token

Response:
id
fullName
email
role
```

Therefore the two current tasks can proceed in parallel:

```text
YOU
────────────────────────────
Create Authenticated Hiker Home

- protected route
- post-login redirect
- application shell
- navigation
- booking entry point
- logout
- responsive UI
- loading/empty states
- consume current-user profile
────────────────────────────

COLLABORATOR
────────────────────────────
Create Current User/Profile API

- GET /api/v1/users/me
- verify Firebase token
- obtain Firebase UID
- query PostgreSQL User
- return profile
- handle 401/404/errors
- backend tests
────────────────────────────
```

Then integrate:

```text
Your frontend
      ↓
GET /api/v1/users/me
      ↓
Collaborator's backend
      ↓
Firebase Admin verification
      ↓
PostgreSQL
      ↓
User profile
      ↓
Hiker Home
```

---

# 25. What Is NOT Finalized Yet

The following must not be invented while implementing endpoints:

```text
Final trail
Trail coordinates
Trail boundaries
Checkpoint coordinates
Hazard zones
Daily capacity
Rules for groups > 5 guests
Payment provider
Payment verification
Cancellation/refunds
Weather thresholds
Notification channels
Incident escalation
Guide queue state transitions
Guide-role provisioning
Certificate signing
Certificate storage
GPS retention
Participant-data retention
Offline-sync conflict rules
```

When one of these becomes necessary for an API implementation, the business rule should be confirmed before encoding it into the API.

---

# 26. Recommended Repository Location

Store this contract in the repository as:

```text
docs/api-contract.md
```

The contract should evolve together with the project.

It should be updated when a domain's API is finalized, rather than attempting to fully specify every future feature before the business rules are known.

---

# 27. Core Principle

The API contract exists to answer one simple question for both developers:

> "What exactly does the frontend expect the backend to provide, and what exactly does the backend expect the frontend to send?"

For TrailSync, keep the contract explicit, small, and based only on confirmed requirements.

The current integration contract is:

```text
Firebase Authentication
        ↓
Firebase ID Token
        ↓
GET /api/v1/users/me
        ↓
Firebase Admin verification
        ↓
PostgreSQL User
        ↓
{
  id,
  fullName,
  email,
  role
}
        ↓
Hiker Home
```

This is the first stable boundary between the two developers and the foundation for the later booking, dispatch, trekking, monitoring, safety, certificate, and analytics APIs.
