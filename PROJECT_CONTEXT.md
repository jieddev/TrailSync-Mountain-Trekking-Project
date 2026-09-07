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

The primary trails currently in scope are:

- **Sulfatara Trail**
- **Alto Peak**

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
- View available trails
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

A booking represents **one trekking group**.

A group may contain one or multiple hikers.

Therefore, the data model should distinguish between:

```text
Booking
   ↓
Booking Participants
```

rather than assuming that one booking always represents exactly one individual.

A hiker booking alone is valid and represents a one-person group.

---

# 5. Important Business Rules

These are current project decisions and should not be changed casually.

## 5.1 One Booking = One Group

Each booking represents one trekking group.

A group can contain:

- 1 participant
- Multiple participants

The system should record the actual participants separately from the booking itself.

---

## 5.2 Guide Assignment Happens at Check-In

A guide is **not assigned when the online booking is created**.

The current workflow is:

```text
Online Booking
      ↓
Tourist Arrives
      ↓
Coordinator Checks In Group
      ↓
FIFO Guide Dispatch
      ↓
Guide Assigned
```

Therefore, a newly created booking may initially have:

```text
guide_id = NULL
```

until the group is physically checked in and a guide is assigned.

---

## 5.3 FIFO Guide Dispatch

Guide assignment uses a **First-In, First-Out (FIFO)** queue.

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

The goal is to provide a fair and predictable rotation of guide assignments.

A guide should return to the end of the queue only after completing the appropriate work cycle.

The exact queue state transitions may evolve as implementation requirements become clearer.

---

## 5.4 Hikers Do Not Choose Guides

Current rule:

> Hikers do not choose their guide.

Guide assignment is automatic through the FIFO dispatch system.

Whether hikers should eventually be allowed to request/select a specific guide is **TBD**.

Do not add guide-selection UI unless this requirement is explicitly approved.

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

Other possible states include:

```text
CANCELLED
NO_SHOW
SUSPENDED
EMERGENCY
```

The exact final state machine should be finalized during backend/domain implementation.

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

That would overstate what the system actually measures.

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

The exact checkpoint locations have **not yet been finalized**.

Do not invent:

- GPS coordinates
- Trail boundaries
- Checkpoint locations
- Hazard locations

Actual geographic data should come from an appropriate legitimate source or field collection process.

---

# 10. Geofencing and Safety

TrailSync may use geographic boundaries to identify relevant trail areas and potentially hazardous zones.

Potential uses include:

- Hazard warnings
- Trail boundary monitoring
- Location-based safety notifications
- Operational monitoring

Actual geographic boundaries and hazard coordinates are currently **TBD** until reliable trail data is obtained.

Do not create fake coordinates for demonstration and then treat them as real production data.

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

The exact official capacity for each trail is currently:

**TBD**

The system should be designed so that capacity can eventually be configured by authorized tourism personnel.

Capacity may need to distinguish between:

- Maximum visitors per day
- Maximum groups per day
- Maximum participants per booking/group

These rules must be confirmed before being treated as final business rules.

Do not invent capacity numbers.

---

# 14. Booking and Pricing

A booking represents a trekking group.

The exact pricing rules for each trail are currently:

**TBD**

A previously discussed Sulfatara pricing/package concept has **not** been finalized and must not be treated as an established business rule.

Do not hardcode assumptions such as:

```text
5 people = ₱550
```

until the actual pricing policy has been confirmed.

Pricing should eventually be represented as configurable business data rather than scattered hardcoded values.

---

# 15. Booking Participants

Because one booking represents one group, the system should conceptually support:

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
   └── Hiker 4
```

or:

```text
Booking B
   └── Hiker 1
```

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

---

# 22. Frontend / Backend Separation

TrailSync is being developed collaboratively.

The current development arrangement is:

```text
Frontend Developer
      ↓
React / Vite / TypeScript / Tailwind / Firebase Auth
```

and:

```text
Backend Collaborator
      ↓
Node.js / Express / PostgreSQL
```

The two sides should communicate through an agreed API contract.

---

## 22.1 Frontend Responsibilities

The frontend is responsible for:

- UI
- React components
- Pages
- Client-side routing
- Client-side validation
- Firebase client authentication
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

The authentication work is being developed in stages.

The frontend currently has a React/Vite/Tailwind foundation.

The authentication UI and Firebase integration are being implemented separately from the backend API.

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
Auth Service
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

The current sequence is:

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

Only implement the current phase unless a task explicitly requires something from a later phase.

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

The application can be:

```text
npm run dev
npm run lint
npm run build
```

The next planned frontend work is:

> **Phase 2 — Authentication UI**

---

# 37. Frontend / Backend Collaboration Workflow

The frontend and backend are being developed separately.

The frontend developer should not assume backend implementation details.

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

- Official trail carrying capacity
- Exact trail pricing
- Exact group/package pricing rules
- Official trail GPS coordinates
- Trail boundaries
- Checkpoint locations
- Hazard zones
- Official weather safety thresholds
- Exact authentication API contract
- Exact API response formats
- Final database schema
- Exact guide queue state machine
- Final payment implementation
- Final certificate signing process
- Whether hikers may request/select guides
- Advanced AI analytics requirements

When encountering one of these areas, do not invent a requirement.

Instead:

1. Use the currently agreed behavior if one exists.
2. Identify the missing decision.
3. Ask for clarification when necessary.

---

# 39. Things AI Coding Agents Must Not Assume

AI coding agents working on TrailSync must not assume:

- A specific trail capacity
- A specific trail price
- Fake GPS coordinates
- Fake checkpoint locations
- A finalized API response
- That Firebase is the database
- That PostgreSQL can be accessed directly from the frontend
- That hikers have GPS tracking on their own phones
- That every hiker is individually tracked
- That guide selection is available
- That AI controls safety decisions
- That the backend architecture can be changed freely
- That an unrequested library is necessary
- That a future idea is automatically a current requirement
- That an older MongoDB instruction is still valid
- That previously proposed API endpoints are automatically final
- That the frontend may modify backend responsibilities without agreement

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

FRONTEND_IMPLEMENTATION_MILESTONES.md
        ↓
What should the frontend implement?
What is the development sequence?

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

TrailSync will eventually require real geographic information.

Until legitimate data is obtained, do not invent:

- Trail coordinates
- Checkpoint coordinates
- Hazard zones
- Trail boundaries
- Route paths
- Elevation data

Mock data may be used for development only when it is clearly identified as mock/test data and is not represented as real trail information.

---

# 47. Do Not Invent Business Rules

Do not invent:

- Pricing
- Capacity
- Guide selection rules
- Weather thresholds
- Payment rules
- Queue policies
- Certificate requirements

when the actual rule has not been confirmed.

If necessary, use:

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

The system documentation, UI, proposal, and implementation should not overclaim system capabilities.

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

# 52. Current Development Priority

The immediate frontend priority is:

```text
Phase 2 — Authentication UI
```

The frontend should proceed through the milestone document sequentially.

The backend collaborator will independently develop the Node.js/Express/PostgreSQL side.

When backend authentication details become available, the frontend API integration should be updated according to the **actual agreed API contract**, not assumptions from older tasks.

---

# 53. Final Rule

The most important rule for TrailSync development is:

> **Build the simplest system that reliably solves the real problem and can be responsibly maintained.**

Do not guess.

Do not over-engineer.

Do not invent requirements.

Do not cross architectural boundaries without agreement.

Do not claim capabilities the system does not actually provide.

Implement incrementally.

Verify before claiming completion.
