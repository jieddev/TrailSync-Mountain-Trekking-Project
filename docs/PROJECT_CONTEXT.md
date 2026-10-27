# TrailSync — Project Context

## 1. Project Overview

**TrailSync: Smart Eco-Tourism and Trail Management System with Automated Guide Dispatching, Near-Real-Time Trekker Monitoring, Weather Intelligence, Digital Certification, and Tourism Analytics for Barangay Cabintan**

TrailSync is an eco-tourism trail management system designed for **Barangay Cabintan, Ormoc City, Leyte**.

The system aims to improve how trekking activities are managed by replacing manual processes with a centralized digital system for:

- Tourist booking
- Visitor and group management
- Guide dispatching
- Trek monitoring
- Near-real-time GPS-based group tracking
- Trail safety monitoring
- Weather-based trail restrictions
- Offline checkpoint verification
- Digital certificates
- Tourism analytics

TrailSync is a **multi-trail** system. Sulfatara and Mt. Malingatong are currently the trails in the approved catalog (Lake Janagdan was removed from scope and retired from the catalog). Additional approved trails are added through a controlled development change (a database migration with the trail's verified information); do not add unverified trails to the catalog.

Hikers select exactly one trail from the backend approved catalog when creating a booking. A booking retains that trail association when viewed or rescheduled unless a future approved workflow explicitly changes it. TrailSync does not allow hikers to create arbitrary trails. Adding a trail is a deliberate development/configuration change that includes an approved catalog entry and that trail's verified information and map/route data; it must not require redesigning booking around a particular trail.

Each trail is a first-class domain resource with a stable identifier. A booking references exactly one selected trail. The backend validates the selection against the approved catalog and supplies the catalog to the frontend through an API. The frontend is not the authority for trail validity or availability. Do not add a public trail-management dashboard or allow ordinary hikers to create/edit trails.

Trail-specific names, descriptions, maps/routes, geographic facts, and operational rules must be associated with the correct trail. Do not invent coordinates, routes, checkpoints, durations, difficulty, or safety restrictions. Details not confirmed for each trail remain unresolved. Shared workflows (authentication, booking management, participants, coordinator review, check-in, guide assignment, and related operations) should work across trails; add trail-specific behavior only after its requirements are established.
---

# 2. Problem Being Addressed

Current trail operations rely heavily on manual processes such as physical logbooks, manual communication, and manually coordinated guide deployment.

This can lead to:

- Difficulty monitoring active trekkers
- Poor visibility of groups currently on the trail
- Uneven guide assignments
- Uncontrolled visitor flow
- Difficulty enforcing daily trail capacity
- Delayed response to emergencies
- Difficulty handling bad weather conditions
- Weak historical records
- Limited tourism analytics

TrailSync is intended to provide a centralized digital system that improves:

- Operational visibility
- Guide assignment fairness
- Visitor management
- Trail safety
- Record keeping
- Tourism decision-making

---

# 3. System Users

TrailSync has three primary user roles.

## 3.1 Mountain Hiker / Tourist

**Platform:**

- Web application

**Responsibilities:**

- Register and log in
- View the initially supported trail and, as approved trails are added, browse the supported catalog
- Make a booking
- Provide booking/group information
- View booking status
- Receive relevant notifications
- View trekking information
- Access digital completion certificates

The hiker does **not** choose a guide in the current design.

Guide assignment is handled automatically through the guide dispatch system.

---

## 3.2 Local Tour Guide

**Platform:**

- Flutter mobile application

**Responsibilities:**

- Log in
- Set availability
- Receive guide assignments
- Start and manage trekking sessions
- Send GPS location data
- Verify trail checkpoints
- Receive safety/weather alerts
- Trigger SOS during emergencies
- Complete trekking sessions
- Check out after completing a trek

The guide's mobile device represents the location of the trekking group.

TrailSync does **not** claim to know the exact individual location of every hiker.

The correct system description is:

> Near-real-time GPS monitoring of trekking groups through assigned guide devices.

---

## 3.3 Tourism Coordinator

**Platform:**

- Web application

**Responsibilities:**

- Manage bookings
- Check in arriving groups
- Monitor guide availability
- Manage guide dispatch
- Monitor active trekking groups
- View GPS locations
- Manage trail information
- Configure capacity and safety policies
- Monitor weather conditions
- Manage incidents
- View tourism analytics
- Manage system records

---

# 4. Core System Concept

The central operational flow is:

```text
BOOKING

   ↓

CHECK-IN

   ↓

GUIDE DISPATCH

   ↓

TREK SESSION

   ↓

GPS / CHECKPOINT / SAFETY MONITORING

   ↓

TREK COMPLETION

   ↓

DIGITAL CERTIFICATE

   ↓

ANALYTICS
```

A booking represents **one trekking group/package**.

A group may contain one or multiple hikers.

The currently confirmed standard package is:

```text
1 Booking / Package

    ↓

Up to 5 Guests

    ↓

1 Assigned Guide

    ↓

₱550 Package Price
```

A group does **not** have to reach five participants to make a booking.

For example:

```text
3 Guests

   ↓

Still one booking/package

   ↓

Still assigned 1 guide

   ↓

Still pays the full package price
```

Therefore, the selected trail package price is **not reduced simply because the group has fewer than five participants**.

Every supported trail uses the five-participant maximum, one-guide package, and 50% downpayment rule. Each trail sets its own package price. Groups exceeding five require additional package/guide arrangements; exact grouping and pricing are **TBD**.

The data model should distinguish between:

```text
Booking

   ↓

Booking Participants
```

rather than assuming that one booking always represents exactly one individual.

A booking owner is also one of the guests/participants. A hiker booking alone is valid and represents a one-person group and one package; the owner is not counted in addition to the five-person limit.

---

# 5. Important Business Rules

These are current project decisions and should not be changed casually.

## 5.1 One Booking = One Group / Package

Each booking represents one trekking package/group with one guide and up to five participants total, including the booking owner. The package price belongs to the selected trail. For Sulfatara, the price is **₱550**; for Mt. Malingatong, it is **₱680**. Participants one through five pay the full package price for their selected trail. One-person bookings are valid.

The booking owner is also a participant and counts toward the five-guest limit: one owner plus up to four additional participants. The owner must be associated with the booking and represented among its participants, not counted in addition to the five-person limit.

The system should record participants separately from the booking itself. A standard package is limited to five; groups exceeding five require additional package/guide arrangements. Exact grouping, package count/pricing, and representation of related packages/groups remain **TBD**.

---

## 5.2 Guide Assignment Happens at Check-In

A guide is **not assigned when the booking is created**. Physical check-in occurs at the tourism/operations office. Current field information indicates that assignment occurs after check-in and depends on currently available guides.

The current operational flow is:

```text
Facebook / Messenger → Choose Date and Time → Provide Booking Information
→ 50% Downpayment → Booking → Tourist Arrives → Tourism/Operations Office Check-In
→ Automatic Guide Assignment from Available Guides
```

Therefore, a newly created booking may initially have:

```text
guide_id = NULL
```

until the group is physically checked in and a guide is assigned.

### Check-in rules (agreed 2026-10-18, implemented)

These apply to every supported trail.

**Who can be checked in**
- Only `CONFIRMED` bookings.
- Only on the booking's scheduled date, as an **Asia/Manila** calendar date. A group arriving on another day must reschedule first.

**When the number of arrivals differs from the booking**

| Case                                | Example             | Rule                                                                                                          |
| ----------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- |
| Fewer arrive                        | Booked 5, arrived 3 | Coordinator marks each listed participant **present** or **absent**. At least 1 must be present. Price unchanged. |
| More arrive, still within 1 package | Booked 3, arrived 5 | Coordinator adds the extra people as **walk-ins** (name, age, address). Present + walk-ins ≤ 5. Price unchanged. |
| More than 1 package arrives         | Booked 3, arrived 7 | Check in **at most 5** on the booking. The extra people are handled outside TrailSync for now (**TBD**).        |

## 5.3 FIFO Guide Dispatch

Guide assignment is automatic at physical check-in and follows the **First-In, First-Out (FIFO)** rule. These rules were agreed on 2026-10-18 and are implemented in `backend/src/lib/guide-queue.ts`.

**Guide states**

| State       | Meaning                                | Set by                 |
| ----------- | -------------------------------------- | ---------------------- |
| `OFF_DUTY`  | Not at the office; not in the queue    | Guide or coordinator   |
| `AVAILABLE` | Reported in; waiting in the FIFO queue | Guide or coordinator   |
| `ASSIGNED`  | Dispatched to a checked-in group       | System only (dispatch) |

A guide on an assigned trek cannot go off duty until the trek is completed. The coordinator sets availability on the web. Guides also set their own availability from the guide app.

**Queue**
- The queue is the `AVAILABLE` guides, ordered by **when they became available**.
- Becoming available puts the guide at the **end** of the queue. Going off duty removes them from it.
- Dispatch always takes the guide at the **front**. There is **no skipping**.
- If the front guide isn't present, the coordinator marks them off duty. They rejoin at the end when they become available again.

**Dispatch timing**
- Check-in **automatically assigns** the guide at the front of the queue, in the same transaction.
- If no guide is available, the booking stays `CHECKED_IN` (waiting). The coordinator clicks "Assign next guide" once a guide becomes available. There is no automatic assignment of waiting groups.
- Assignment is transactional and serialised, so one guide can never be assigned to two groups, even when two check-ins happen at the same time.

**Trek session and completion** (Phase 6)
- The assigned guide **starts** the trek from the guide app (`GUIDE_ASSIGNED` → `IN_PROGRESS`).
- When the group returns, the guide **completes** the trek from the app (complete-and-check-out). Only a started trek can be completed by the guide.
- The coordinator can also mark the trek completed on the web, as a fallback (for example, the guide's phone is dead). This works whether or not the guide started it.
- Either way, the guide becomes `AVAILABLE` again at the **end** of the queue.

Example:

```text
Available Guide Queue

Juan

Pedro

Maria

Carlo
```

If Juan receives an assignment:

```text
Pedro

Maria

Carlo
```

After Juan completes the trek and checks out:

```text
Pedro

Maria

Carlo

Juan
```

The goal is to provide a fair and predictable rotation of guide assignments. Do not change the FIFO behaviour without an explicit team decision.

---

## 5.4 Hikers Do Not Choose Guides

Current rule:

> Hikers do not choose their guide.

Guide assignment is automatic after physical check-in based on guide availability, following the existing FIFO ordering among available guides unless explicitly revised. Hikers do not choose guides.

Do not add guide-selection UI; tourists do not choose guides under the field-confirmed operation.

---

# 6. Trek Lifecycle

A trekking group should have an explicit lifecycle.

The conceptual lifecycle is:

```text
BOOKED

   ↓

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

The implemented booking statuses currently cover:

```text
PENDING_CONFIRMATION → CONFIRMED → CHECKED_IN → GUIDE_ASSIGNED → IN_PROGRESS → COMPLETED
```

- Rescheduling moves `CONFIRMED` back to `PENDING_CONFIRMATION`.
- Check-in goes straight to `GUIDE_ASSIGNED` when a guide is available. Otherwise the booking waits in `CHECKED_IN`.
- The conceptual `TREK_STARTED` and `IN_PROGRESS` are one state, `IN_PROGRESS`, set when the guide starts the trek from the app (`trekStartedAt`). The trek session is the booking itself; there is no separate table.
- The coordinator's fallback completion can go straight from `GUIDE_ASSIGNED` to `COMPLETED`.

Other possible states include:

```text
NO_SHOW

SUSPENDED

EMERGENCY
```

Hiker cancellation is not allowed. Rescheduling is allowed and retains the same booking, selected trail, participants, agreed package price, and downpayment credit; a date change alone does not require another downpayment. No-show handling details, reschedule limits, notice periods, and date eligibility remain TBD. Refund policy details remain TBD.

The system should avoid relying on vague boolean flags when the business process has meaningful states.

---

# 7. GPS Tracking

GPS tracking is one of TrailSync's major features.

## 7.1 Tracking Model

TrailSync tracks the **trekking group through the assigned guide's smartphone**.

Conceptually:

```text
Trekking Group

      ↓

Assigned Guide

      ↓

Guide's Smartphone

      ↓

GPS

      ↓

TrailSync Backend

      ↓

Coordinator Dashboard
```

The system should use the wording:

> Near-real-time GPS monitoring of trekking groups through assigned guide devices.

Avoid claiming:

> Real-time tracking of every individual hiker.

---

## 7.2 GPS Frequency

The current proposal uses approximately:

```text
60-second GPS updates
```

Therefore, the system should generally use:

> Near-real-time

rather than claiming strict real-time tracking.

The exact interval should remain configurable if practical.

---

# 8. Offline GPS Strategy

The guide application may encounter areas with poor or no cellular connectivity.

TrailSync should therefore use a **store-and-forward** strategy.

When connected:

```text
GPS Point

   ↓

Send to Backend
```

When offline:

```text
GPS Point

   ↓

Store Locally

   ↓

Connection Returns

   ↓

Synchronize Buffered Points

   ↓

Backend
```

This allows the system to preserve historical movement even when connectivity temporarily disappears.

Important distinction:

- Connected → near-real-time monitoring
- Offline → local storage and later synchronization

The system should not falsely claim near-real-time visibility while the device has no network connection.

---

# 9. Trail Checkpoints

Trail checkpoints are used for trail verification and operational tracking.

The system is expected to support:

- QR-based checkpoint verification
- Local/offline checkpoint recording
- Synchronization when connectivity returns

Checkpoint data must be associated with its trail; each supported trail may have its own verified checkpoint and route data.

The exact checkpoint locations and other authoritative geographic data for Sulfatara and Mt. Malingatong remain **TBD** until collected and verified.

Do not invent:

- GPS coordinates
- Trail boundaries
- Checkpoint locations
- Hazard locations

Actual geographic data should come from an appropriate legitimate source or field collection process.

Once collected and verified, each trail's geographic information (Sulfatara, Mt. Malingatong) belongs to that trail. Other trails require their own verified data.

---

# 10. Geofencing and Safety

TrailSync may use geographic boundaries to identify relevant trail areas and potentially hazardous zones.

Potential uses include:

- Hazard warnings
- Trail boundary monitoring
- Location-based safety notifications
- Operational monitoring

Geofencing and safety data must be associated with the relevant trail. Trail-specific boundaries and rules remain unresolved until confirmed.

Actual geographic boundaries and hazard coordinates for Sulfatara and Mt. Malingatong are currently **TBD** until reliable trail data is obtained.

Do not create fake coordinates for demonstration and then treat them as real production data.

Once legitimate geographic data is established, it belongs to the corresponding trail configuration.

---

# 11. Weather Intelligence

TrailSync integrates weather information to support trail safety.

The current proposal uses **OpenWeather** as the weather data provider.

Potential weather conditions include:

- Heavy rainfall
- High winds
- Severe storms
- Other configurable dangerous conditions

The system may prevent or restrict trekking when configured safety thresholds are reached.

## Important

**Weather thresholds should be configurable.**

Do not hardcode safety values throughout the application.

For example:

```text
Heavy rain > X

Wind > Y

Severe storm = true
```

should ultimately be controlled by appropriate authorized personnel or configuration.

The exact official safety thresholds are **TBD** and should be confirmed with the relevant tourism/safety authority.

Safety-critical decisions should not depend on an AI model.

### Current implementation (Phase 8, agreed 2026-10-26)

- Weather is **advisory only**. It is shown to people but never closes a trail by itself, because no official thresholds exist yet.
- A coordinator closes a trail manually for an inclusive range of Asia/Manila dates, with a reason (`trail_restrictions`; `API_CONTRACT_V1.md` §8).
- While a closure applies, the server refuses new bookings and reschedules onto those dates, check-in, guide assignment, and trek start (`TRAIL_RESTRICTED`).
- Existing bookings are not changed or cancelled; they show the closure and the hiker can reschedule. A trek already in progress is not interrupted; ending it early is the guide's and coordinator's call.
- Closures are lifted, never deleted, so they remain on record.

---

# 12. SOS

The guide mobile application should provide an **SOS button**.

The SOS feature is intended to allow a guide to quickly report an emergency to the system/coordinator.

The current scope does **not** claim that the application can bypass the operating system or function as a native lock-screen emergency service.

SOS is an application-level emergency feature.

---

# 13. Daily Capacity

TrailSync should support daily visitor/trail capacity management.

Capacity should be configurable rather than hardcoded.

Capacity rules may vary by trail; their cross-trail scope remains unconfirmed and capacity must be associated with the applicable trail.

The Tourism Officer determines daily booking/visitor capacity operationally, and available guides also constrain it. No fixed numeric capacity is confirmed. The formal capacity rule remains **TBD**. The system should be designed so capacity can eventually be configured by authorized tourism personnel.

Capacity may need to distinguish between:

- Maximum visitors per day
- Maximum groups per day
- Maximum participants per booking/group

These rules must be confirmed before being treated as final business rules.

Do not invent capacity numbers.

---

# 14. Booking and Pricing

The following are **field-confirmed current operational rules**:

```text
Current channel: Facebook / Messenger
Tourist chooses: date and time
Current booking information: name, age, address
Downpayment: 50%
Hiker cancellation: not allowed
Rescheduling: allowed; same booking, trail, participants, price, and downpayment credit retained
No-show: may be handled through rescheduling; details TBD
Refund policy: TBD
Check-in: physical tourism/operations office
Guide selection by tourist: not allowed
Guide assignment: automatic after check-in, based on guide availability

Package rules for every supported trail: one booking/package, one guide, up to 5 participants including the booking owner, 50% downpayment
Sulfatara package price: ₱550
Sulfatara downpayment: ₱275
Mt. Malingatong package price: ₱680
Mt. Malingatong downpayment: ₱340
For every supported trail, participants 1 through 5 pay that trail’s full package price
```

Facebook/Messenger describes today's manual real-world process. TrailSync's future goal is a centralized digital booking process; the current channel is not itself a TrailSync implementation requirement.

The booking owner provides their own information and may list other participants. The owner is represented as a booking participant and counts within the five-person maximum. A one-person booking is valid. Conceptually, preserve `Booking → Booking Participants`.

Groups exceeding five require additional package/guide arrangements. Exact grouping for 6–10 or larger groups, whether each additional group is capped at five, whether each package requires a guide, independent payment, multiple-package pricing, and database representation are **TBD**. Differences between booked guests and actual arrivals at check-in follow the rules in §5.2: booked 5/arrived 3 marks absentees, booked 3/arrived 5 adds walk-ins, and booked 3/arrived 7 checks in at most 5. The arrangement for the extra people remains **TBD**.

Every supported trail requires a 50% downpayment calculated from that selected trail’s package price. Sulfatara’s ₱550 price therefore requires ₱275, and Mt. Malingatong’s ₱680 price requires ₱340. Payment provider, deadline, refund rules, and other payment details remain **TBD**. TrailSync records the booking/downpayment statuses in its simulated workflow; real payment processing remains a future feature.

Daily booking/visitor capacity is determined operationally by the Tourism Officer and is also constrained by available guide capacity. No fixed numeric capacity is confirmed. The formal capacity rule and the relationship between visitor capacity, group/package capacity, and guide availability are **TBD**.

Rescheduling is allowed and retains the same booking, participants, selected trail, price, and downpayment credit. Number of reschedules, notice period, eligible dates, availability behavior, and treatment after the original date are **TBD**. A no-show may be handled through rescheduling; detailed no-show policy, deadlines, and consequences for repeated no-shows are **TBD**. Hiker cancellation is not allowed and refund policy details remain **TBD**.

The Booking Foundation workflow is implemented as `PENDING_CONFIRMATION` plus `PENDING_VERIFICATION`, followed by coordinator review and simulated verification to `CONFIRMED` plus `VERIFIED`. Bookings reference a catalog trail and snapshot its price and downpayment. Exact scheduling details remain **TBD**. Additional required participant information beyond name, age, and address is also **TBD**.

Pricing should eventually be represented as business data rather than scattered hardcoded values.

---

# 15. Booking Participants

Because one booking represents one group/package, the system should conceptually support:

```text
BOOKING

   ↓

BOOKING PARTICIPANTS
```

This allows:

```text
Booking A

   ├── Hiker 1

   ├── Hiker 2

   ├── Hiker 3

   ├── Hiker 4

   └── Hiker 5
```

or:

```text
Booking B

   ├── Hiker 1

   ├── Hiker 2

   └── Hiker 3
```

Both are valid bookings. In each, the booking owner is one of the participants and counts toward the five-person total; a five-person package allows the owner plus at most four additional participants.

The exact database implementation belongs to the backend.

---

# 16. Offline Checkpoint Architecture

The guide mobile application should support offline checkpoint operations.

Conceptually:

```text
Flutter App

    ↓

Local SQLite Storage

    ↓

Checkpoint Verification

    ↓

Internet Unavailable

    ↓

Data Remains Locally Stored

    ↓

Internet Returns

    ↓

Synchronization

    ↓

Backend

    ↓

PostgreSQL
```

The local database should be treated as temporary offline storage.

PostgreSQL remains the authoritative server-side database.

Synchronization must be designed carefully to prevent:

- Duplicate records
- Lost records
- Conflicting updates
- Incorrect timestamps
- Invalid state transitions

---

# 17. Digital Certificates

After a trekking group successfully completes its trek, TrailSync should be able to generate a digital completion certificate.

The certificate is expected to be generated as a PDF.

Potential information includes:

- Participant name
- Trail
- Date
- Completion information
- Authorized signature/e-signature

The exact certificate design and signing process are still subject to implementation requirements.

The certificate should identify the officially selected project trail.

---

# 18. Analytics

The Tourism Coordinator should have access to tourism and operational analytics.

Potential information includes:

- Number of visitors
- Number of bookings
- Trail usage
- Guide activity
- Trek completion
- Incidents
- Weather-related restrictions
- Historical tourism activity

Analytics should be based on actual stored system data.

Do not create unnecessary analytics simply because a chart is technically possible.

---

# 19. AI / Intelligent Features

AI-based analytics or recommendations may be considered for future development.

However:

- AI is not the core requirement of the system.
- AI should not make safety-critical decisions.
- AI should not replace deterministic business rules.
- AI should not be introduced merely to make the project appear more advanced.

For safety-critical decisions:

```text
Weather API

      ↓

Deterministic Safety Rules

      ↓

Trail Restriction
```

is preferable.

AI may later assist with non-critical:

- Analytics
- Summaries
- Recommendations

if there is a genuine use case.

---

# 20. Technology Stack

## Web Frontend

- React.js
- Vite
- TypeScript
- Tailwind CSS
- Firebase Authentication

The web frontend is used by:

- Mountain Hikers/Tourists
- Tourism Coordinators

---

## Mobile

- Flutter

The mobile application is primarily for:

- Local Tour Guides

---

## Backend

- Node.js
- Express.js

---

## Database

- PostgreSQL

PostgreSQL is the application's primary database.

---

## Authentication

- Firebase Authentication

Firebase Authentication is used for identity/authentication.

It is **not** the application's primary database.

PostgreSQL is the application database.

---

## Development Tools

- Git
- GitHub
- ESLint
- Prettier

---

# 21. Authentication Architecture

The intended authentication flow is:

```text
React / Flutter

      ↓

Firebase Authentication

      ↓

Firebase ID Token

      ↓

Express API

      ↓

Firebase Token Verification

      ↓

Application User

      ↓

PostgreSQL
```

The backend should verify Firebase authentication tokens.

The frontend should not directly connect to PostgreSQL.

The frontend should communicate with the backend through defined API contracts.

Firebase Authentication has already been established as part of the current authentication setup.

---

# 22. Frontend / Backend Separation

TrailSync is being developed collaboratively.

The current development arrangement is:

```text
Frontend Developer

      ↓

React / Vite / TypeScript / Tailwind
```

and:

```text
Backend Collaborator

      ↓

Node.js / Express / PostgreSQL
```

Firebase Authentication is part of the overall system authentication architecture, but backend authentication verification and PostgreSQL user management remain backend responsibilities.

The two sides should communicate through an agreed API contract.

---

## 22.1 Frontend Responsibilities

The frontend is responsible for:

- UI
- React components
- Pages
- Client-side routing
- Client-side validation
- Firebase client integration where applicable to the agreed frontend scope
- API requests
- UI state
- Loading states
- Error presentation
- User interactions
- Frontend tests

---

## 22.2 Backend Responsibilities

The backend collaborator is responsible for:

- Express routes
- Controllers
- Application/business logic
- Domain rules
- Authentication token verification
- Authorization
- PostgreSQL access
- Data persistence
- Server-side validation
- API responses
- Transactions
- Security enforcement

The frontend must never be treated as the authority for:

- Security
- Authorization
- Business-critical rules
- Database integrity

---

# 23. Current Authentication Development Situation

The authentication work has been developed in stages.

The frontend now has:

- React/Vite/Tailwind foundation
- Login page
- Registration page
- Client-side form validation
- Firebase Authentication integration as part of the current system authentication setup

The backend collaborator is responsible for the server-side authentication verification and application-user/database integration.

The backend collaborator previously proposed an authentication task involving:

- Firebase Authentication
- User profile synchronization
- User API endpoints
- Error handling
- End-to-end testing

The original backend task referenced MongoDB.

**MongoDB is no longer part of the project.**

The current database is:

> PostgreSQL

Therefore, any older MongoDB-based instructions must be treated as outdated.

---

# 24. Authentication API Contract

The authentication API contract is currently **not finalized**.

Previously discussed endpoint examples included:

```text
POST /api/users

GET /api/users/:firebaseUid
```

However, these should **not** automatically be treated as the final API.

A cleaner possible design is:

```text
GET /api/users/me
```

because the backend can identify the authenticated user from the Firebase ID token instead of trusting a Firebase UID supplied by the client.

However, this is a **proposal**, not a finalized requirement.

The final API must be agreed upon with the backend collaborator.

---

# 25. API Contract Requirements

Before frontend API integration is implemented, the frontend and backend must agree on:

- Endpoint
- HTTP method
- Purpose
- Authentication requirements
- Required headers
- Firebase ID-token transport
- Request body
- Required fields
- Success status code
- Success response body
- Possible error status codes
- Error response format
- Validation behavior
- Duplicate-user behavior

Example authentication request flow:

```text
React

   ↓

Firebase Authentication

   ↓

Firebase ID Token

   ↓

Authorization: Bearer <token>

   ↓

Express API

   ↓

Verify Firebase Token

   ↓

Identify Application User

   ↓

PostgreSQL
```

This is the intended architectural direction, but the exact implementation must follow the agreed backend API contract.

---

# 26. API Contract Rule

Never implement an API based on an assumption such as:

```text
"I think the backend probably returns this."
```

Instead:

```text
Frontend

   ↕

Agreed API Contract

   ↕

Backend
```

If the backend collaborator's actual implementation differs from an earlier proposal, the **actual agreed contract takes precedence**.

The frontend should adapt its API service layer to the agreed contract rather than unnecessarily forcing backend changes.

---

# 27. Database Architecture

PostgreSQL is the authoritative application database.

The conceptual data model may eventually include entities such as:

```text
Users

Guides

Trails

Trail Checkpoints

Trail Geofences

Bookings

Booking Participants

Trek Sessions

Locations

Checkpoint Logs

Guide Queue

Guide Assignments

Incidents

SOS Events

Weather Records

Weather Lockouts

Payments

Certificates

Notifications

Audit Logs
```

This is a **conceptual model**, not a finalized database schema.

TrailSync is a multi-trail system; Sulfatara and Mt. Malingatong are currently the catalog trails. Additional approved trails are added through controlled development changes. Represent each trail as a first-class resource with a stable identifier and associate bookings and trail-specific records (maps, routes, checkpoints, geofences, and other verified geographic data) with the correct trail. Hikers select from the approved catalog; adding a trail is a controlled project change.

Do not create every table immediately.

Only introduce entities when they are required by an actual feature or confirmed business rule.

---

# 28. Architecture Style

TrailSync should use:

> **Modular Monolith + Domain-Driven Design Principles + Clean/Hexagonal Architecture Boundaries**

The backend should be organized around business capabilities rather than technical layers alone.

Potential conceptual modules include:

```text
auth

users

trails

bookings

guides

dispatch

trekking

tracking

checkpoints

weather

safety

certificates

analytics
```

These are conceptual modules.

The implementation should remain proportional to the needs of the project.

Do **not** turn the project into a microservice architecture.

Do not introduce unnecessary infrastructure simply to appear enterprise-grade.

---

# 29. Backend Architectural Layers

The conceptual backend dependency direction is:

```text
Presentation

     ↓

Application

     ↓

Domain

     ↓

Infrastructure
```

## Presentation

Handles:

- HTTP routes
- Controllers
- Request/response handling

## Application

Handles:

- Use cases
- Application workflows
- Coordination between domain components

## Domain

Handles:

- Business rules
- Business entities
- Policies
- Important state transitions

## Infrastructure

Handles:

- PostgreSQL
- Firebase verification integration
- External APIs
- Weather provider
- File/PDF generation
- Other external services

The domain should not become tightly coupled to infrastructure details.

---

# 30. Frontend Architecture

The React application should generally use a feature-oriented structure.

Conceptually:

```text
src/

├── app/

├── components/

├── features/

│   ├── auth/

│   ├── booking/

│   ├── coordinator/

│   └── trekking/

├── hooks/

├── services/

└── ...
```

The exact folder structure may evolve as the application grows.

Do not create folders or abstractions merely because an architecture diagram says they should exist.

---

# 31. Frontend Authentication Architecture

The frontend authentication implementation should maintain a clear boundary:

```text
React Component

      ↓

Auth Service / Firebase Integration

      ↓

Firebase Authentication
```

The authentication service should conceptually provide operations such as:

```text
register()

login()

logout()

getCurrentUser()
```

Firebase-specific implementation should remain inside the authentication service where practical.

UI components should not become tightly coupled to Firebase APIs.

Where Firebase Authentication work is assigned to another developer, the frontend should integrate with the agreed authentication interface rather than duplicating authentication logic.

---

# 32. Security Principles

Security is a system responsibility, not only a frontend concern.

Important rules include:

- Never trust client-side validation as security.
- Validate important data on the backend.
- Never expose secrets in frontend source code.
- Never commit private credentials.
- Verify authentication tokens on the backend.
- Enforce authorization on the backend.
- Use HTTPS in deployed environments.
- Use least-privilege access.
- Protect sensitive data.
- Do not log passwords or authentication credentials.

Client-side validation primarily improves usability.

Server-side validation protects security and data integrity.

---

# 33. Data Integrity

Important business operations must preserve consistent data.

Examples include:

- Guide assignment
- Booking capacity
- Package pricing
- Trek state transitions
- GPS synchronization
- Checkpoint synchronization
- Certificate generation
- Payment processing

When an operation involves multiple related database changes, transactions should be considered.

The system should prefer reliable state transitions over scattered boolean flags.

---

# 34. Offline and Synchronization Principle

Offline functionality is not simply:

> "Save something locally."

It requires clear rules for:

- What can be changed offline
- What is authoritative
- How records are identified
- How synchronization works
- How duplicates are prevented
- How conflicts are handled
- What happens after synchronization

The current authority model is:

```text
PostgreSQL

   ↓

Server-side source of truth

SQLite

   ↓

Temporary local offline storage
```

---

# 35. Current Frontend Implementation Milestones

Frontend development follows a milestone-based approach.

The original frontend authentication milestone sequence was:

```text
Phase 1 — Frontend Foundation

Phase 2 — Authentication UI

Phase 3 — Client-Side Validation

Phase 4 — Authentication Service Architecture

Phase 5 — Firebase Authentication

Phase 6 — Backend API Integration

Phase 7 — Authentication State Management

Phase 8 — Loading / Error / Success States

Phase 9 — Frontend Testing

Phase 10 — Final Authentication Verification
```

However, the actual assigned frontend scope is limited to the frontend work agreed upon with the team.

The completed frontend tasks currently include:

```text
Phase 1 — Frontend Foundation

Phase 2 — Authentication UI

Phase 3 — Client-Side Validation
```

Firebase Authentication and backend integration should not automatically be treated as part of the remaining frontend assignment unless explicitly assigned.

Future frontend work should be based on newly agreed project tasks rather than automatically continuing the old milestone sequence.

---

# 36. Current Frontend Status

The frontend foundation has been established using:

- React
- Vite
- Tailwind CSS
- TypeScript
- ESLint
- Prettier

The initial Vite starter/demo content has been removed.

The frontend authentication UI has been implemented, including:

- Login page
- Registration page
- Client-side validation

Firebase Authentication is now part of the current overall authentication setup.

The previously defined authentication milestone work should be considered completed only to the extent that it has actually been implemented and verified.

The next frontend task should be explicitly agreed upon rather than assumed from the old authentication milestone sequence.

---

# 37. Frontend / Backend Collaboration Workflow

The frontend and backend are being developed separately.

The recommended collaboration process is:

```text
Frontend Requirement

       ↓

Draft/Discuss API Contract

       ↓

Backend Collaborator Reviews

       ↓

Agreed API Contract

       ↓

Frontend Implementation

       +

Backend Implementation

       ↓

Integration Testing
```

When an API contract is uncertain, discuss it with the backend collaborator before implementing assumptions into the frontend.

A frontend developer may propose an API design, but it should be treated as a proposal until agreed upon.

---

# 38. What Is Not Yet Finalized

The following should be treated as **TBD** rather than assumptions:

- Verified map/route and geographic data for each supported trail, including Sulfatara and Mt. Malingatong
- Exact formal daily capacity rule and its relationship to visitor, group/package, and guide capacity
- Exact grouping and additional-package rules for groups exceeding the standard five-guest package
- Exact additional-package pricing and whether each additional package requires another guide
- Whether participants may independently pay for another package and exact representation of related packages/groups
- Official weather safety thresholds
- Exact Booking API request/response format
- Booking states beyond `COMPLETED` (trek start/in progress, `NO_SHOW`, `SUSPENDED`, `EMERGENCY`)
- Exact date/time scheduling model
- Payment provider and downpayment verification process
- Payment deadline, refund rules, and payment status values
- Downpayment handling during rescheduling
- Rescheduling limits and notice period
- No-show policy details
- Whether participants need information beyond name, age, and address
- Exact booking confirmation process
- Exact booking database schema
- Exact frontend booking flow
- Exact authentication API contract
- Exact API response formats
- Final database schema
- Final payment implementation
- Final certificate signing process
- Advanced AI analytics requirements


## Booking implementation impact

The Booking Foundation already persists bookings/participants and supports authenticated create, owner-scoped list/detail, reschedule, and coordinator confirmation. Booking handlers enforce HIKER roles on hiker operations and COORDINATOR on confirmation through inline checks; reusable authorization middleware/policies, authorized role provisioning, and broader role-specific experiences remain unimplemented. The trail catalog is implemented: a `trails` table (seeded with Sulfatara at ₱550), public read-only `GET /api/v1/trails` and `GET /api/v1/trails/:trailId`, a required `trailId` on booking creation validated against active catalog trails, and `packagePrice`/`downpaymentAmount` snapshots copied from the selected trail. Booking responses return `trail: { id, name }` and the stored amounts. Rescheduling retains booking, participants, trail, price, and downpayment. Maps/routes and geographic integrations are separate work; capacity remains unresolved.

The following are currently **confirmed**:

- TrailSync is a multi-trail system; Sulfatara and Mt. Malingatong are currently the catalog trails.
- Additional approved trails may be added later through controlled development/configuration changes.
- Hikers select exactly one supported trail per booking; arbitrary user-created trails are not allowed.
- Adding a trail is a controlled development/configuration change with its approved catalog entry and trail-specific information/map data.
- The current manual booking channel is Facebook/Messenger; the tourist chooses date and time.
- Current booking information collected is name, age, and address. Additional required information is TBD.
- Every supported trail uses a 50% downpayment, calculated from its own package price.
- Rescheduling retains the same booking, participants, selected trail, and downpayment credit. Detailed limits, notice period, and capacity eligibility remain TBD. Hiker cancellation is not allowed; refund policy details remain TBD.
- Physical check-in, coordinator review, and guide assignment are common workflow concepts; per-trail operating differences need confirmation.
- One booking represents one trekking group/package in the existing contract.
- Every supported trail has one guide per package and a five-participant maximum including the owner. Participants one through five pay the selected trail’s full package price.
- Sulfatara costs ₱550 (₱275 downpayment) and Mt. Malingatong costs ₱680 (₱340 downpayment). Other trail prices are set when those trails are approved. Larger-group rules remain TBD.
- Guide assignment occurs at physical check-in from the FIFO queue of `AVAILABLE` guides (§5.2–5.3). Hikers do not choose guides under the established flow.
- Group tracking is based on the assigned guide's device rather than individual hiker devices.

When encountering an unresolved area, do not invent a requirement.

Instead:

1. Use the currently agreed behavior if one exists.
2. Identify the missing decision.
3. Ask for clarification when necessary.

---

# 39. Things AI Coding Agents Must Not Assume

AI coding agents working on TrailSync must not assume:


- That any trail besides Sulfatara and Mt. Malingatong is approved until it is added to the catalog with verified data.
- That hikers may create arbitrary trails.
- That trail-specific geographic or operating data is interchangeable across trails.
- A specific trail capacity.
- Treating Sulfatara’s ₱550 price as the price for every trail.
- That fewer than five guests receive a lower package price.
- Rules for groups exceeding five guests unless explicitly defined.
- Fake GPS coordinates.
- Fake checkpoint locations.
- A finalized API response.
- That Firebase is the database.
- That PostgreSQL can be accessed directly from the frontend.
- That hikers have GPS tracking on their own phones.
- That every hiker is individually tracked.
- That guide selection is available.
- That AI controls safety decisions.
- That the backend architecture can be changed freely.
- That an unrequested library is necessary.
- That a future idea is automatically a current requirement.
- That an older MongoDB instruction is still valid.
- That previously proposed API endpoints are automatically final.
- That the frontend may modify backend responsibilities without agreement.

If a requirement is unclear:

> **Do not guess.**

---

# 40. AI Coding Agent Working Rules

When an AI agent works on TrailSync:

## Inspect First

Understand the existing repository before changing it.

## Work Incrementally

Implement only the requested task or milestone.

## Preserve Existing Work

Do not rewrite working code unnecessarily.

## Respect Boundaries

Do not modify backend responsibilities while working on frontend tasks unless explicitly requested.

## Do Not Over-Engineer

Prefer the simplest design that satisfies the actual requirement.

## Do Not Invent Requirements

Use confirmed requirements and documented decisions.

## Respect Trail Selection

TrailSync supports multiple trails through the backend catalog; Sulfatara and Mt. Malingatong are currently the catalog trails. Hikers select one available catalog trail per booking; associate trail-specific data with its trail. Do not invent catalog entries or trail facts.

## Verify

Run appropriate tests, linting, builds, or other verification before claiming the task is complete.

## Explain Important Decisions

If a meaningful architectural decision is required, explain it rather than silently introducing it.

---

# 41. Project Documentation Hierarchy

TrailSync uses separate documents with different purposes.

```text
PROJECT_CONTEXT.md

        ↓

What is TrailSync?

What are the system rules?

What has been decided?

What is still TBD?

PROJECT_MILESTONES.md

        ↓

What should each application implement?

What is the development sequence?

API_CONTRACT_V1.md

        ↓

What endpoints exist?

What do requests and responses look like?

CODING_PRINCIPLES.md

        ↓

How should code be written?

How should an AI coding agent behave?
```

These documents should not duplicate each other's responsibilities unnecessarily.

---

# 42. Source of Truth Principle

When requirements conflict, prefer the most recently agreed and explicitly confirmed decision.

General priority:

```text
Explicitly confirmed project decision

        ↓

Current project documentation

        ↓

Current implementation

        ↓

Earlier assumptions

        ↓

AI guess
```

An AI agent should never treat its own assumption as more authoritative than an explicit project decision.

If the project context says something is **TBD**, the agent must not silently convert it into a fixed requirement.

---

# 43. Current Technology Decisions

The following are currently established:

```text
Web:

React

Vite

TypeScript

Tailwind CSS

Mobile:

Flutter

Backend:

Node.js

Express.js

Database:

PostgreSQL

Authentication:

Firebase Authentication

Development:

Git

GitHub

ESLint

Prettier
```

Do not replace these technologies without an explicit project decision.

---

# 44. Architecture Decisions

Current architectural direction:

```text
                    ┌─────────────────────┐

                    │   Mountain Hiker    │

                    │       Web App       │

                    └──────────┬──────────┘

                               │

                    ┌──────────▼──────────┐

                    │      React Web      │

                    │ Vite + TypeScript   │

                    │    Tailwind CSS     │

                    └──────────┬──────────┘

                               │

                               │ API

                               │

                    ┌──────────▼──────────┐

                    │   Node + Express    │

                    │   Backend API       │

                    └───────┬─────┬──────┘

                            │     │

                    ┌───────▼─┐ ┌─▼────────────┐

                    │Firebase │ │ PostgreSQL   │

                    │  Auth   │ │ Application  │

                    └─────────┘ └──────────────┘



                    ┌─────────────────────┐

                    │    Local Guide      │

                    │   Flutter Mobile    │

                    └──────────┬──────────┘

                               │

                               │ API / Sync

                               │

                    ┌──────────▼──────────┐

                    │   Node + Express    │

                    └─────────────────────┘
```

The architecture is intentionally a **modular monolith**, not microservices.

TrailSync is a multi-trail system. Sulfatara and Mt. Malingatong are currently the trails in the approved catalog; additional approved trails are added through a controlled development change (a database migration with verified trail data).

---

# 45. Engineering Philosophy

TrailSync is a capstone project, but it should be engineered using professional software development practices.

At the same time, the project must remain appropriately scoped.

The goal is not to create the largest or most complicated architecture.

The goal is to create a system that is:

- Understandable
- Maintainable
- Secure
- Testable
- Reliable
- Practical
- Appropriate for its actual requirements

Prefer:

```text
Simple + Well-structured
```

over:

```text
Complex + "Enterprise-looking"
```

Do not introduce:

- Microservices
- Event sourcing
- CQRS
- Kubernetes
- Unnecessary design patterns
- Unnecessary infrastructure

unless a real requirement justifies them.

---

# 46. Do Not Invent Trail Data

TrailSync requires trail-specific verified geographic information. Do not invent:

- Trail coordinates
- Checkpoint coordinates
- Hazard zones
- Trail boundaries
- Route paths
- Elevation data

Sulfatara and Mt. Malingatong are currently supported, and other approved trails require their own verified data. Mock data may be used only when clearly identified as mock/test data and not represented as real trail information.

---

# 47. Do Not Invent Business Rules

Do not invent:

- Capacity
- Rules for groups exceeding five guests
- Guide selection rules
- Weather thresholds
- Payment rules beyond the shared 50% downpayment and trail-specific package prices
- Queue policies
- Certificate requirements

when the actual rule has not been confirmed.

The confirmed shared package rules are one guide, up to five participants including the owner, and a 50% downpayment. Participants one through five pay the full price for their selected trail. Sulfatara costs ₱550, with a ₱275 downpayment, and Mt. Malingatong costs ₱680, with a ₱340 downpayment; other approved trails may have different prices.

If a rule is not confirmed, use:

```text
TBD
```

or make the value configurable.

---

# 48. Accuracy Principle

TrailSync should accurately describe what the system actually does.

Examples:

Correct:

> Near-real-time GPS monitoring of trekking groups through assigned guide devices.

Incorrect:

> Real-time GPS tracking of every hiker.

Correct:

> Application-level SOS feature for guides.

Incorrect:

> Native emergency service that works from the phone lock screen.

Correct:

> Offline GPS/checkpoint data is stored locally and synchronized later.

Incorrect:

> Real-time monitoring continues even without connectivity.

Correct:

> TrailSync supports multiple trails; Sulfatara and Mt. Malingatong are currently the catalog trails, and additional approved trails are added through controlled development changes.

Incorrect:

> Hikers may create arbitrary trails or TrailSync already supports every trail in the area.

Correct:

> Sulfatara’s package costs ₱550 for up to five participants with one guide; other trails have their own approved price.

Incorrect:

> The ₱550 package is a per-person charge.

Correct:

> Sulfatara and Mt. Malingatong are the currently supported trails, and each booking selects one trail from the approved catalog.

Incorrect:

> Trail-specific maps and rules can be freely switched or shared without validation.

The system documentation, UI, proposal, and implementation should not overclaim system capabilities or business rules.

---

# 49. Change Minimization

When modifying existing code:

- Prefer small changes.
- Preserve working behavior.
- Avoid unrelated refactoring.
- Do not rename files without a reason.
- Do not restructure the entire project for a small feature.
- Do not introduce dependencies unnecessarily.
- Do not modify unrelated modules.

A task should solve the requested problem without creating unnecessary changes elsewhere.

Adding a supported trail is a controlled project/configuration change because it requires an approved catalog entry and its own verified map/route and relevant information.

---

# 50. Definition of Done

A feature is not considered complete merely because code was written.

Completion should generally mean:

```text
Requirement understood

        ↓

Implementation completed

        ↓

Existing behavior preserved

        ↓

Relevant tests/checks completed

        ↓

Lint passes

        ↓

Build passes

        ↓

Important edge cases considered

        ↓

Result verified
```

An AI agent should not claim completion without appropriate verification.

---

# 51. Final Project North Star

The core TrailSync flow should remain understandable:

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

TrailSync is a multi-trail system. Sulfatara and Mt. Malingatong are currently the trails in the approved catalog; additional approved trails are added through a controlled development change (a database migration with verified trail data). Each booking selects exactly one catalog trail.

Every major feature should support this operational flow or provide a clear supporting capability.

If a proposed feature does not:

- Solve a real problem
- Improve system reliability
- Improve safety
- Improve operational visibility
- Improve maintainability
- Satisfy a confirmed requirement

then question whether it belongs in the current scope.

---

# 52. Current Development Status

The frontend authentication foundation has been completed to the currently assigned scope:

```text
Phase 1 — Frontend Foundation ✅

Phase 2 — Authentication UI ✅

Phase 3 — Client-Side Validation ✅
```

The project now also has Firebase Authentication as part of the overall authentication setup.

The backend collaborator is responsible for the Node.js/Express/PostgreSQL side, including server-side token verification and application-user/database integration.

The immediate next development task should be determined collaboratively rather than automatically continuing the previous frontend authentication milestone sequence.

---

# 53. Final Rule

The most important rule for TrailSync development is:

> **Build the simplest system that reliably solves the real problem and can be responsibly maintained.**

Do not guess.

Do not over-engineer.

Do not invent requirements.

Do not cross architectural boundaries without agreement.

Do not claim capabilities the system does not actually provide.

Keep Sulfatara and Mt. Malingatong as the current catalog trails. Additional trails require an approved controlled change. Shared package rules apply across trails, while price belongs to each trail. Do not invent trail facts.

Implement incrementally.

Verify before claiming completion.
