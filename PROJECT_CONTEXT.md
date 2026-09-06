# TrailSync — Project Context

## 1. Project Overview

**TrailSync: Smart Eco-Tourism and Trail Management System with Automated Guide Dispatching, Real-Time Trekker Monitoring, Weather Intelligence, Digital Certification, and Tourism Analytics for Barangay Cabintan**

TrailSync is an eco-tourism trail management system designed for **Barangay Cabintan, Ormoc City, Leyte**.

The system aims to improve how trekking activities are managed by replacing manual processes with a centralized system for:

- Tourist booking
- Visitor and group management
- Guide dispatching
- Trek monitoring
- GPS-based group tracking
- Trail safety monitoring
- Weather-based trail restrictions
- Offline checkpoint verification
- Digital certificates
- Tourism analytics

The primary trails in scope are:

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

TrailSync is intended to provide a centralized digital system that improves operational visibility, fairness, safety, and record keeping.

---

# 3. System Users

TrailSync has three primary user roles.

## 3.1 Mountain Hiker / Tourist

Platform:

- Web application

Responsibilities:

- Register and log in
- View available trails
- Make a booking
- Provide booking/group information
- View booking status
- Receive relevant notifications
- View trekking information
- Access digital completion certificate

The hiker does **not** choose a guide in the current design.

Guide assignment is handled automatically through the guide dispatch system.

---

## 3.2 Local Tour Guide

Platform:

- Flutter mobile application

Responsibilities:

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

---

## 3.3 Tourism Coordinator

Platform:

- Web application

Responsibilities:

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

These rules are important system assumptions and should not be changed casually.

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

until the group is physically checked in and assigned a guide.

---

## 5.3 FIFO Guide Dispatch

Guide assignment uses a **First-In, First-Out (FIFO)** queue.

The basic concept is:

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

The important principle is that the system should not rely on vague boolean flags when the business process has meaningful states.

---

# 7. GPS Tracking

GPS tracking is one of TrailSync's major features.

## Tracking Model

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

The system should describe this as:

> Near-real-time GPS monitoring of trekking groups through assigned guide devices.

Avoid claiming:

> Real-time tracking of every individual hiker.

That would overstate what the system actually measures.

---

## GPS Frequency

The current proposal uses approximately:

```text
60-second GPS updates
```

Therefore, the system should generally use the term:

**near-real-time**

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

Do not invent GPS coordinates, trail boundaries, or checkpoint locations.

Actual trail geographic data should come from an appropriate legitimate source or field collection process.

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

Important:

### Weather thresholds should be configurable.

Do not hardcode safety values throughout the application.

For example, thresholds such as:

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

The capacity should be configurable rather than hardcoded.

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

The exact pricing rules for each trail are currently **TBD**.

For example, a previously discussed price/package concept for Sulfatara Trail has **not** been finalized and must not be treated as an established business rule.

The application should therefore avoid hardcoding assumptions such as:

```text
5 people = ₱550
```

until the actual pricing policy has been confirmed.

Pricing should eventually be represented as configurable business data rather than scattered hardcoded values.

---

# 15. Guide Selection

Currently:

> Hikers do not choose their guide.

Guide assignment is automatic through the FIFO dispatch system.

Whether hikers should eventually be allowed to request/select a specific guide is **TBD** and should be discussed with the tourism coordinator before implementation.

Do not add guide-selection UI unless this requirement is explicitly approved.

---

# 16. Offline Checkpoint Architecture

The guide mobile application should support offline checkpoint operations.

Conceptually:

```text
Flutter App
    ↓
Local SQLite Storage
    ↓
Checkpoint verification
    ↓
Internet unavailable
    ↓
Data remains locally stored
    ↓
Internet returns
    ↓
Synchronization
    ↓
Backend
    ↓
PostgreSQL
```

The local database should be treated as temporary offline storage, while PostgreSQL remains the authoritative server-side database.

Synchronization behavior should be designed carefully to prevent:

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

For example:

```text
Weather API
      ↓
Deterministic safety rules
      ↓
Trail restriction
```

is preferable for safety-critical decisions.

AI may later assist with non-critical analytics, summaries, or recommendations if there is a genuine use case.

---

# 20. Technology Stack

The current technology stack is:

### Web Frontend

- React.js
- Vite
- JavaScript
- Tailwind CSS

### Mobile

- Flutter

The mobile application is primarily for local tour guides.

### Backend

- Node.js
- Express.js

### Database

- PostgreSQL

### Authentication

- Firebase Authentication

Firebase Authentication is used for identity/authentication.

It is **not** the application's primary database.

PostgreSQL is the application database.

### Development Tools

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
Token Verification
      ↓
Application User
      ↓
PostgreSQL
```

The backend should verify Firebase authentication tokens.

The frontend should not directly connect to PostgreSQL.

The frontend should communicate with the backend through defined API contracts.

The exact API contract is currently **not finalized**.

---

# 22. Frontend / Backend Boundary

TrailSync has a clear separation between frontend and backend responsibilities.

## Frontend Responsibilities

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

## Backend Responsibilities

The backend is responsible for:

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

The frontend must never be treated as the authority for security or business-critical rules.

---

# 23. Database Architecture

PostgreSQL is the authoritative application database.

The conceptual data model may include entities such as:

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

This is a conceptual model, not a finalized database schema.

Do not create every table immediately.

Only introduce entities when they are required by an actual feature or confirmed business rule.

---

# 24. Architecture Style

TrailSync should use:

> **Modular Monolith + Domain-Driven Design Principles + Clean/Hexagonal Architecture Boundaries**

The backend should be organized around business capabilities rather than technical layers alone.

Potential modules include:

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

Do not turn the project into a microservice architecture.

Do not introduce unnecessary infrastructure simply to appear enterprise-grade.

---

# 25. Backend Architectural Layers

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

### Presentation

Handles:

- HTTP routes
- Controllers
- Request/response handling

### Application

Handles:

- Use cases
- Application workflows
- Coordination between domain components

### Domain

Handles:

- Business rules
- Business entities
- Policies
- Important state transitions

### Infrastructure

Handles:

- PostgreSQL
- Firebase verification integration
- External APIs
- Weather provider
- File/PDF generation
- Other external services

The domain should not become tightly coupled to infrastructure details.

---

# 26. Frontend Architecture

The React application should generally use a feature-oriented structure.

A conceptual structure is:

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

# 27. API Contract Principle

The frontend and backend must agree on API contracts.

Before implementing an API integration, establish:

- Endpoint
- HTTP method
- Purpose
- Authentication requirements
- Headers
- Request body
- Success status
- Response body
- Error status codes
- Error response format

For example, an API endpoint should not be implemented based on assumptions such as:

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

The actual agreed backend contract takes precedence over assumptions in frontend documentation.

---

# 28. Security Principles

Security is a system responsibility, not only a frontend concern.

Important rules include:

- Never trust client-side validation as security.
- Validate important data on the backend.
- Never expose secrets in frontend source code.
- Never commit API keys or private credentials.
- Verify authentication tokens on the backend.
- Enforce authorization on the backend.
- Use HTTPS in deployed environments.
- Use least-privilege access.
- Protect sensitive data.
- Do not log passwords or authentication credentials.

Client-side validation exists primarily for usability.

Server-side validation exists for security and data integrity.

---

# 29. Data Integrity

Important business operations should preserve consistent data.

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

# 30. Offline and Synchronization Principle

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

PostgreSQL is the server-side source of truth.

Local SQLite is temporary client-side storage for offline operation.

---

# 31. Current Development Approach

Development should proceed incrementally.

The frontend currently follows a milestone-based implementation plan.

The intended sequence is:

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

Only implement the current phase unless the task explicitly requires something from a later phase.

---

# 32. Current Project Status

The frontend has completed:

**Phase 1 — Frontend Foundation**

The next planned task is:

**Phase 2 — Authentication UI**

The frontend and backend are being developed separately.

The backend API contract for authentication is not yet considered finalized until the frontend and backend collaborators agree on it.

---

# 33. What Is Not Yet Finalized

The following should be treated as **TBD** rather than assumptions:

- Official trail carrying capacity
- Exact trail pricing
- Exact group/package pricing rules
- Official trail GPS coordinates
- Trail boundaries
- Checkpoint locations
- Hazard zones
- Official weather safety thresholds
- Exact API contracts
- Final database schema
- Exact guide queue state machine
- Final payment implementation
- Final certificate signing process
- Whether hikers may request/select guides
- Advanced AI analytics requirements

When encountering one of these areas, the agent should **not invent a requirement**.

Instead, it should either:

1. use the currently agreed behavior if one exists, or
2. identify the missing decision and ask for clarification.

---

# 34. Things AI Agents Must Not Assume

AI coding agents working on TrailSync must not assume:

- A specific trail capacity
- A specific trail price
- Fake GPS coordinates
- Fake checkpoint locations
- A finalized API response
- That Firebase is the database
- That hikers have GPS tracking on their own phones
- That every hiker is individually tracked
- That guide selection is available
- That AI controls safety decisions
- That the backend architecture can be changed freely
- That an unrequested library is necessary
- That a feature should be implemented simply because it is mentioned as a future idea

If a requirement is unclear, **do not guess**.

---

# 35. AI Coding Agent Working Rules

When an AI agent works on TrailSync:

### Inspect First

Understand the existing repository before changing it.

### Work Incrementally

Implement only the requested task or milestone.

### Preserve Existing Work

Do not rewrite working code unnecessarily.

### Respect Boundaries

Do not modify backend responsibilities while working on frontend tasks unless explicitly requested.

### Do Not Over-Engineer

Prefer the simplest design that satisfies the actual requirement.

### Do Not Invent Requirements

Use confirmed requirements and documented decisions.

### Verify

Run appropriate tests, linting, builds, or other verification before claiming the task is complete.

### Explain Important Decisions

If a meaningful architectural decision is required, explain it rather than silently introducing it.

---

# 36. Project Documentation Hierarchy

TrailSync uses several documents with different purposes.

```text
PROJECT_CONTEXT.md
        ↓
What is TrailSync?
What are the system rules?
What has been decided?

FRONTEND_IMPLEMENTATION_MILESTONES.md
        ↓
What should the frontend implement?
What is the development sequence?

CODING_PRINCIPLES.md
        ↓
How should code be written?
How should an AI agent behave?
```

These documents should not duplicate each other's responsibilities unnecessarily.

---

# 37. Source of Truth Principle

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

---

# 38. Engineering Philosophy

TrailSync is a capstone project, but it should be engineered with professional software development practices.

At the same time, the project should remain appropriately scoped.

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

Do not introduce microservices, event sourcing, CQRS, Kubernetes, unnecessary design patterns, or other infrastructure unless a real requirement justifies them.

---

# 39. North Star

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

If a proposed feature does not solve a real problem, improve the system's reliability, or satisfy a confirmed requirement, question whether it belongs in the current scope.
