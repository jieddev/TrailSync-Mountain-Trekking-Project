# TrailSync Software Engineering Principles & AI Coding Guidelines

## Purpose

This document defines the software engineering principles and coding rules that should guide development of **TrailSync**.

It is intended to be followed by:

- Developers
- Codex
- Claude
- Other AI coding agents
- Future contributors

The goal is to produce software that is:

- Understandable
- Maintainable
- Reliable
- Secure
- Testable
- Adaptable
- Appropriately performant
- Appropriate to the project's actual size and requirements

These principles should be applied with judgment rather than mechanically.

> **Do not follow a principle merely because it exists. Follow it when it improves the software.**

---

# 1. Engineering Philosophy

The most important principle is:

> **Solve the actual problem with the simplest design that is reasonably maintainable.**

Prioritize:

1. Correctness
2. Security
3. Reliability
4. Maintainability
5. Readability
6. Testability
7. Performance
8. Elegance

Do not optimize for architectural sophistication.

A small, understandable solution is often better than a highly abstract solution that provides no meaningful benefit.

---

# 2. KISS — Keep It Simple

Prefer simple solutions over unnecessarily complicated ones.

### Principles

- Prefer straightforward code.
- Prefer obvious control flow.
- Prefer readable solutions over clever solutions.
- Avoid unnecessary abstraction.
- Avoid unnecessary layers.
- Avoid unnecessary design patterns.
- Avoid deeply nested logic.
- Avoid clever one-liners when they reduce readability.
- Avoid complexity without a demonstrated need.

Before adding complexity, ask:

> **What problem does this complexity solve?**

If there is no meaningful answer, do not add it.

---

# 3. YAGNI — You Aren't Gonna Need It

Build for known requirements.

Do not build functionality simply because it might be useful later.

Avoid:

- Unrequested features
- Unused abstractions
- Unused configuration systems
- Unused API endpoints
- Unused database structures
- Hypothetical scalability systems
- Generalized frameworks for one use case

When a future requirement actually appears, refactor appropriately.

> **Do not pay today's complexity cost for tomorrow's hypothetical problem.**

---

# 4. DRY — Don't Repeat Yourself

Avoid unnecessary duplication of important knowledge and business logic.

Good candidates for reuse include:

- Business rules
- Validation rules
- Shared constants
- API behavior
- Reusable UI components
- Utilities
- Configuration

However:

> **Do not create an abstraction simply because two pieces of code look similar.**

Duplication can sometimes be safer than a bad abstraction.

DRY should primarily eliminate duplicated **knowledge**, not every instance of similar syntax.

---

# 5. SOLID

Apply SOLID principles when they improve the design.

Do not force SOLID patterns into simple code merely to make the architecture appear sophisticated.

### Single Responsibility

A module should have a clear responsibility.

Avoid modules that simultaneously handle:

- UI rendering
- API communication
- Authentication
- Validation
- Business rules
- Database access
- Logging
- Unrelated logic

### Open/Closed

Use extension-friendly designs when behavior is genuinely expected to grow.

Do not build elaborate extension systems prematurely.

### Liskov Substitution

When inheritance is used, implementations must behave consistently with the abstraction.

Prefer composition when it represents the problem more naturally.

### Interface Segregation

Prefer focused interfaces and service boundaries instead of large "god interfaces."

### Dependency Inversion

High-level business logic should not be tightly coupled to low-level implementation details.

Conceptually:

```text
Business Logic
      ↓
Service / Abstraction
      ↓
Infrastructure
```

Infrastructure may include:

- PostgreSQL
- Firebase
- HTTP clients
- External APIs
- File systems
- Cloud services

---

# 6. Separation of Concerns

Keep different responsibilities appropriately separated.

A common structure is:

```text
Presentation
     ↓
Application Logic
     ↓
Domain / Business Logic
     ↓
Infrastructure
```

Not every feature requires every layer.

The important principle is:

> **Unrelated responsibilities should not become unnecessarily coupled.**

---

# 7. TrailSync Architecture

TrailSync should use architecture proportional to the project's requirements.

The backend architecture should follow:

> **Modular Monolith + Domain-Driven Design principles + Clean/Hexagonal Architecture boundaries**

This does not mean creating excessive layers or abstractions.

The backend should be organized around meaningful business capabilities such as:

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

Only introduce a module when there is meaningful functionality belonging to that domain.

Do not create modules merely because the architecture diagram looks cleaner.

---

# 8. TrailSync Technology Boundaries

## Frontend

TrailSync uses:

- React
- Vite
- TypeScript
- Tailwind CSS
- Firebase Authentication
- ESLint
- Prettier

## Backend

The backend uses:

- Node.js
- Express.js
- PostgreSQL
- Firebase Authentication token verification

## Mobile

The guide application uses:

- Flutter

---

# 9. Frontend / Backend Boundary

The frontend is responsible for:

- UI
- Components
- Pages
- Client-side validation
- Firebase client authentication
- Authentication state
- API requests
- Loading states
- Error states
- Frontend routing
- Frontend tests

The backend is responsible for:

- Express routes
- API controllers
- Business logic
- PostgreSQL
- Database queries
- Server-side validation
- Authorization
- Firebase ID-token verification
- Business-critical state transitions
- Backend tests

The frontend must **never communicate directly with PostgreSQL**.

The intended flow is:

```text
React
  ↓
Firebase Authentication
  ↓
Firebase ID Token
  ↓
Express API
  ↓
Firebase Token Verification
  ↓
PostgreSQL
```

---

# 10. Firebase Authentication Boundary

Firebase Authentication is responsible for identity authentication.

The frontend may use Firebase Authentication to:

- Register users
- Log users in
- Log users out
- Observe authentication state
- Obtain Firebase ID tokens

The backend is responsible for verifying Firebase ID tokens.

Do not treat frontend authentication state as proof of authorization.

Authentication and authorization are different concerns.

```text
Authentication
"Who are you?"

Authorization
"What are you allowed to do?"
```

---

# 11. Do Not Trust the Client

Anything originating from a client can potentially be manipulated.

Never rely on frontend code alone for:

- Authorization
- Permissions
- Pricing
- Financial calculations
- Role assignment
- Ownership checks
- Business-critical state transitions
- Capacity enforcement
- Guide assignment
- Safety decisions

Client-side validation improves user experience.

Server-side validation provides authority.

---

# 12. Business Logic Must Be Explicit

Important TrailSync business rules should be easy to locate.

Examples include:

- Booking rules
- Pricing rules
- Capacity rules
- Guide dispatch rules
- FIFO queue behavior
- Trek status transitions
- Checkpoint requirements
- Weather lockout rules
- Safety rules
- Certificate eligibility
- User permissions

Do not bury important business rules inside React components.

The backend should remain authoritative for business-critical rules.

---

# 13. TrailSync Booking Model

The current business model is:

> **One booking represents one trekking group.**

A booking may contain one or multiple participants.

Therefore, do not assume:

```text
One booking = One hiker
```

Instead, conceptually:

```text
Booking
   ↓
Multiple Participants
```

A solo visitor is still treated as a booking/group.

Do not hardcode pricing or participant limits until the actual tourism rules have been confirmed.

If pricing or capacity rules are unknown:

> **Mark them as unresolved rather than inventing values.**

---

# 14. Guide Assignment

Guide assignment currently occurs during **physical check-in**, not online booking.

Therefore:

```text
Online Booking
      ↓
Guide = NULL
      ↓
Physical Check-in
      ↓
FIFO Dispatch
      ↓
Guide Assigned
```

The hiker does not currently choose a guide.

Do not implement guide selection unless the project requirements are explicitly changed.

---

# 15. FIFO Guide Dispatch

Guide scheduling should follow the project's defined FIFO rules.

Conceptually:

```text
AVAILABLE
    ↓
QUEUED
    ↓
ASSIGNED
    ↓
ON TRAIL
    ↓
COMPLETED
    ↓
CHECKED OUT
    ↓
END OF QUEUE
```

A guide who completes a trek and checks out should return to the end of the active queue according to the agreed business rules.

Do not silently change FIFO behavior because another scheduling approach appears more sophisticated.

---

# 16. Capacity Rules

Do not invent the official daily carrying capacity.

Capacity should be configurable by authorized tourism personnel when appropriate.

Do not hardcode arbitrary values such as:

```text
MAX_HIKERS = 50
```

unless the actual project requirement explicitly establishes that value.

Also distinguish between:

- Package capacity
- Actual participant count
- Environmental carrying capacity

These concepts must not automatically be treated as the same thing.

---

# 17. State Transitions

Entities with important lifecycles should have explicit states.

For example:

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

Other states may include:

```text
CANCELLED
NO_SHOW
SUSPENDED
EMERGENCY
```

Do not allow arbitrary state changes.

Define valid transitions.

State-transition rules should be enforced by the strongest appropriate layer, especially on the backend.

---

# 18. GPS Tracking Model

TrailSync does **not** claim to know the exact location of every individual hiker.

The current tracking model is:

```text
Trekking Group
      ↓
Assigned Guide
      ↓
Guide's Smartphone GPS
      ↓
TrailSync
      ↓
Coordinator Map
```

The guide's device represents the trekking group.

Use terminology such as:

> **Near-real-time GPS monitoring of trekking groups through assigned guide devices.**

Do not describe this as exact real-time tracking of every individual tourist.

---

# 19. Near-Real-Time vs Real-Time

Do not claim true real-time behavior when the system uses periodic GPS updates.

If GPS points are sent periodically, describe the feature as:

> **Near-real-time GPS tracking**

rather than:

> **Real-time GPS tracking**

The exact interval should come from the project requirements and actual implementation.

---

# 20. Offline GPS and Synchronization

When the guide's device loses connectivity:

```text
GPS Location
     ↓
Local Storage
     ↓
Connection Restored
     ↓
Synchronization
     ↓
Backend
```

Use a **store-and-forward** approach when appropriate.

The system should preserve locally captured GPS data instead of discarding it simply because connectivity is unavailable.

However:

> **Offline synchronization is delayed synchronization, not real-time communication.**

Do not claim otherwise.

---

# 21. Offline Data

If offline functionality is implemented:

- Clearly define what works offline.
- Clearly define what requires connectivity.
- Store necessary local data safely.
- Queue appropriate unsynchronized operations.
- Handle reconnection.
- Prevent duplicate synchronization.
- Preserve important locally captured data.
- Consider conflicting changes.

Do not introduce complicated synchronization architecture without a demonstrated need.

---

# 22. External Services

External services may fail.

TrailSync may depend on services such as:

- Firebase Authentication
- Weather APIs
- Mapping/GPS services
- Notification services

Always consider:

- Network failures
- Timeouts
- Rate limits
- Invalid responses
- Authentication expiration
- Service outages
- API changes

Where appropriate, isolate external services behind service boundaries.

---

# 23. Weather and Safety Rules

Weather and safety behavior should be treated as business-critical functionality.

Do not bury safety rules inside UI components.

Weather thresholds should not be arbitrarily hardcoded if the project requires them to be configurable.

If authorized tourism personnel need to change thresholds, the system should support configuration rather than requiring code changes.

Never allow AI or frontend logic to independently override authoritative safety rules.

---

# 24. AI Features

AI should be treated as an optional supporting capability unless the project explicitly requires it.

AI may assist with:

- Analytics
- Summaries
- Recommendations
- Advisories
- Pattern detection

AI should **not independently make safety-critical decisions** when deterministic rules or authorized personnel should control the decision.

For example:

```text
Weather Data
     ↓
Deterministic Safety Rules
     ↓
Official Decision
```

AI may assist with interpretation or recommendations where appropriate, but it should not silently override the authoritative system rules.

---

# 25. Abstraction

Create abstractions when they hide meaningful complexity.

Good:

```text
AuthenticationService
WeatherService
NotificationService
PaymentService
```

Bad:

```text
GenericManager
UniversalProcessor
BaseService
AbstractHandler
```

created without a real need.

> **Abstract based on demonstrated behavior, not imagined future requirements.**

---

# 26. Avoid Premature Abstraction

Use this progression:

```text
Understand the problem
        ↓
Implement clearly
        ↓
Observe repetition / complexity
        ↓
Identify the real abstraction
        ↓
Refactor
```

Do not attempt to predict the perfect abstraction before the problem is understood.

---

# 27. State Management

Not every piece of state belongs in global state.

First determine what kind of state something is:

- Local component state
- Form state
- URL state
- Authentication state
- Server/API state
- Application-wide state

Use the simplest appropriate mechanism.

Do not introduce a global state-management library merely because one exists.

---

# 28. React Principles

React components should primarily focus on presentation and user interaction.

Avoid putting large amounts of:

- API logic
- Authentication logic
- Business rules
- Complex data transformations
- Infrastructure code

directly inside components.

Prefer meaningful boundaries such as:

```text
Component
    ↓
Hook / Service
    ↓
API / Authentication
```

Do not create hooks or services simply for the sake of having more files.

---

# 29. TypeScript

Use TypeScript to improve correctness and maintainability.

Prefer meaningful types for:

- API responses
- API requests
- Authentication state
- Domain data
- Component props
- Important application state

Avoid:

```typescript
any
```

when a meaningful type can reasonably be defined.

However, do not create hundreds of unnecessary types for trivial values.

Types should communicate meaningful contracts.

---

# 30. API Contracts

Frontend and backend communication must use an explicit API contract.

The contract should define:

- Endpoint
- HTTP method
- Authentication
- Headers
- Parameters
- Request body
- Response body
- Status codes
- Error format

### Critical Rule

> **Never invent an API contract when the backend already exists or is being developed by another collaborator.**

If the backend contract is unclear:

```text
Unknown
   ↓
Identify missing information
   ↓
Ask collaborator
   ↓
Confirm contract
   ↓
Implement frontend
```

The actual agreed backend contract takes precedence over an earlier proposed design.

---

# 31. Database Principles

PostgreSQL is the TrailSync application database.

The frontend must never access PostgreSQL directly.

Database design should:

- Use meaningful relationships.
- Use appropriate primary keys.
- Use foreign keys where appropriate.
- Protect data integrity.
- Use migrations.
- Use transactions when necessary.
- Add indexes based on actual query requirements.
- Avoid unnecessary duplication.
- Design around actual business requirements.

Do not design the database around hypothetical future scale.

---

# 32. Transactions and Concurrency

Use transactions when multiple related operations must succeed or fail together.

Consider concurrency for:

- Bookings
- Capacity limits
- Guide queue operations
- Payments
- Synchronization
- Multiple users modifying the same resource

Use appropriate mechanisms such as:

- Transactions
- Unique constraints
- Database constraints
- Idempotency
- Locks
- Versioning

Only use the mechanism required by the actual problem.

---

# 33. Idempotency

Operations that may be retried should be designed carefully.

This is particularly important for:

- Payments
- API retries
- Offline synchronization
- Background jobs
- Network requests

Do not assume a network request executes exactly once.

---

# 34. Validation

Validate data at appropriate boundaries.

### Client-side validation

Used for:

- Immediate feedback
- Better UX
- Preventing obviously invalid submissions

### Server-side validation

Used for:

- Security
- Data integrity
- Business rules
- Authorization boundaries

Important validation must not exist only on the frontend.

---

# 35. Error Handling

Errors are normal application behavior.

Good error handling should:

- Distinguish expected failures from unexpected failures.
- Give useful information to developers.
- Give understandable information to users.
- Avoid exposing sensitive internal details.
- Preserve debugging context.
- Avoid silently ignoring important failures.

Avoid:

```javascript
try {
  doSomething()
} catch (error) {}
```

unless there is an intentional reason to ignore the error.

---

# 36. Fail Explicitly

When the application cannot safely continue, fail clearly.

Prefer:

```text
Invalid state
     ↓
Explicit error
```

over:

```text
Invalid state
     ↓
Silently continue with incorrect data
```

Incorrect software that appears to work can be more dangerous than software that clearly fails.

---

# 37. Defensive Programming

Consider realistic failures at system boundaries.

Examples:

- Missing data
- Invalid input
- Network failure
- API failure
- Authentication expiration
- Unexpected API responses
- Empty collections
- Null/undefined values
- Database failures
- Concurrent operations
- Offline conditions

Do not add defensive code for every imaginable scenario.

Focus on realistic and consequential failure modes.

---

# 38. Naming

Good naming is one of the cheapest forms of documentation.

Prefer:

```typescript
isAuthenticated
isLoading
hasPermission
getUserProfile
calculateTotalPrice
```

Avoid:

```text
data
temp
x
flag
doStuff
```

Avoid unnecessary abbreviations.

Consistency matters more than personal preference.

---

# 39. Functions

Functions should have clear responsibilities.

Prefer functions that:

- Have descriptive names.
- Have understandable inputs.
- Produce predictable outputs.
- Have limited side effects.
- Avoid excessive parameters.
- Avoid deeply nested logic.

Do not obsess over arbitrary function-length limits.

A function should be large enough to express one coherent responsibility, but no larger than necessary.

---

# 40. Pure Functions and Side Effects

Prefer pure functions where practical.

A pure function generally follows:

```text
Same input → Same output
```

and does not unexpectedly modify external state.

Pure functions are easier to:

- Understand
- Test
- Reuse
- Debug

Side effects are necessary in real applications.

The goal is not to eliminate side effects.

> **The goal is to control and isolate them.**

Examples of side effects:

- API requests
- Authentication
- Database writes
- File operations
- Logging
- Notifications
- State mutation

---

# 41. Comments

Comments should explain **why**, not simply restate what the code does.

Bad:

```javascript
// Increment counter
counter++
```

Good:

```javascript
// The external API limits each request to 100 records.
```

Useful comments explain:

- Business decisions
- Non-obvious behavior
- Workarounds
- External limitations
- Architectural decisions
- Safety-critical behavior

If code requires excessive comments to explain itself, improve the code where practical.

---

# 42. Readability

Optimize code for human comprehension.

Consider:

- Naming
- Structure
- Formatting
- Control flow
- Function boundaries
- Abstraction level

Prefer readable code over clever code.

Do not sacrifice readability for insignificant micro-optimizations.

---

# 43. Consistency

Once the project establishes a convention, follow it.

Be consistent with:

- Naming
- File organization
- Formatting
- Error handling
- API structure
- React component structure
- Imports
- State management
- Testing
- TypeScript usage

Do not introduce a completely different style for every feature.

---

# 44. Dependency Management

Dependencies have long-term costs.

Before adding a dependency, ask:

1. Does the project actually need it?
2. Can the problem be solved with existing tools?
3. Is the dependency maintained?
4. Does it introduce security concerns?
5. Does it increase complexity or bundle size?
6. Will the development team understand how it works?

Avoid dependencies for trivial functionality.

---

# 45. Security

Security must be considered from the beginning.

Never:

- Commit secrets.
- Expose database credentials to clients.
- Log passwords.
- Log sensitive authentication tokens unnecessarily.
- Trust client-provided authorization information.
- Rely solely on frontend validation.
- Expose unnecessary internal errors.
- Store sensitive information without a legitimate reason.

Use:

- Appropriate authentication
- Proper authorization
- Input validation
- Secure communication
- Least privilege
- Secure secret management
- Appropriate dependency management

---

# 46. Configuration and Secrets

Configuration and secrets are different.

Configuration may include:

- API URLs
- Feature settings
- Environment names
- Public Firebase configuration values

Secrets may include:

- Passwords
- Private keys
- Database credentials
- Server-side authentication secrets
- Private API keys

Never assume frontend environment variables are secret.

> **Anything shipped to a browser can potentially be inspected by the user.**

---

# 47. Accessibility

For user interfaces:

- Use semantic HTML.
- Label form controls.
- Support keyboard navigation.
- Maintain visible focus.
- Provide meaningful error messages.
- Do not rely only on color.
- Use accessible names for interactive elements.
- Use ARIA only when necessary.
- Consider screen-reader behavior.

Accessibility should be part of implementation, not an afterthought.

---

# 48. User Experience

Technical correctness does not automatically create good UX.

Consider:

- Loading states
- Empty states
- Error states
- Success states
- Disabled states
- Confirmation for destructive actions
- Clear feedback
- Responsive behavior

Users should understand what the application is doing.

---

# 49. Performance

Performance matters, but premature optimization creates unnecessary complexity.

Follow:

```text
Correctness
    ↓
Measure
    ↓
Identify bottleneck
    ↓
Optimize
    ↓
Measure again
```

Do not optimize code simply because it "might be slow."

Prioritize meaningful performance problems.

---

# 50. Complexity

Consider two types of complexity:

### Runtime complexity

How computationally expensive is the operation?

### Human complexity

How difficult is the code for developers to understand and maintain?

An algorithm that is theoretically faster but dramatically harder to understand may not be the best choice for a small dataset.

Choose based on actual requirements.

---

# 51. Testing

Tests should provide confidence in behavior.

Prioritize testing:

- Important business rules
- Critical user flows
- Validation
- Authentication
- Authorization
- Error handling
- Data integrity
- Important edge cases
- Offline behavior where applicable

Prefer behavior-focused tests over tests that merely reproduce implementation details.

---

# 52. Testing Strategy

When appropriate, use:

```text
        End-to-End
       /          \
   Integration
   /            \
      Unit Tests
```

Generally:

- Many focused unit tests
- Meaningful integration tests
- Fewer expensive end-to-end tests

The exact balance should depend on the feature.

---

# 53. Edge Cases

Do not test only successful scenarios.

Consider:

- Empty input
- Invalid input
- Missing data
- Duplicate actions
- Network failure
- Unauthorized access
- Expired authentication
- Unexpected API responses
- Concurrent operations
- Offline conditions
- Boundary values

Focus especially on edge cases that can cause real failures.

---

# 54. Observability

Important system behavior should be observable.

Useful observability includes:

- Logs
- Metrics
- Error reporting
- Health checks
- Tracing where appropriate

Avoid excessive logging.

Never log sensitive information unnecessarily.

---

# 55. Refactoring

Refactor when the current structure causes a real problem.

Good reasons include:

- Difficult-to-understand code
- Significant duplication
- Growing complexity
- Mixed responsibilities
- Difficult testing
- Repeated bugs
- Poor maintainability

Do not refactor merely because another architecture looks more sophisticated.

Refactoring should preserve intended behavior unless behavior change is explicitly part of the task.

---

# 56. Boy Scout Rule

When touching existing code:

> **Leave the code slightly better than you found it, when doing so is safe and relevant.**

This does not mean rewriting unrelated code.

Small improvements are welcome when they are:

- Relevant
- Low risk
- Easy to verify

Do not turn a small feature into an unrelated refactoring project.

---

# 57. Change Minimization

When implementing a task:

> **Make the smallest reasonable change that solves the problem correctly.**

Avoid modifying unrelated files.

This reduces:

- Regression risk
- Review complexity
- Merge conflicts
- Debugging difficulty

Small changes are easier to understand and verify.

---

# 58. Git Practices

Git history should communicate meaningful changes.

Good commits are:

- Focused
- Descriptive
- Small enough to understand
- Related to one logical change

Prefer:

```text
feat(auth): add Firebase login flow
```

over:

```text
changed stuff
```

Before committing:

- Review the diff.
- Check changed files.
- Run relevant tests.
- Run lint.
- Check for secrets.
- Confirm unrelated files were not modified.

---

# 59. Backward Compatibility

When modifying existing behavior, consider what already depends on it.

Before making a breaking change, determine:

- Who depends on this behavior?
- Is the API already being used?
- Is the database schema already deployed?
- Will existing users be affected?
- Can the change be introduced gradually?

Do not introduce breaking changes casually.

---

# 60. AI Coding Agent — Before Coding

AI coding agents must:

1. Inspect the repository.
2. Understand the existing architecture.
3. Read relevant files.
4. Identify existing conventions.
5. Understand the requested task.
6. Identify dependencies.
7. Identify ambiguities.
8. Determine the smallest appropriate implementation.

The agent should **not immediately start rewriting files**.

---

# 61. AI Coding Agent — During Coding

The agent should:

- Follow existing project conventions.
- Make focused changes.
- Reuse existing functionality where appropriate.
- Avoid unnecessary dependencies.
- Avoid unnecessary refactoring.
- Preserve existing behavior.
- Keep responsibilities separated.
- Follow security boundaries.
- Avoid inventing requirements.
- Avoid inventing API contracts.
- Avoid inventing database structures.
- Avoid changing architectural decisions without justification.
- Use TypeScript consistently with the established project.
- Respect the frontend/backend boundary.

---

# 62. AI Coding Agent — Do Not Guess

When information is missing, the agent must not invent an answer.

Do not guess:

- API endpoints
- API response formats
- Database schemas
- Business rules
- Pricing
- Capacity limits
- Permissions
- Authentication behavior
- External service behavior
- Configuration values
- User requirements

Instead:

```text
Missing information
       ↓
Identify what is unknown
       ↓
Determine whether a safe assumption exists
       ↓
If not, ask for clarification
       ↓
Continue after confirmation
```

If a safe conventional assumption is made, clearly state the assumption.

---

# 63. AI Coding Agent — API Boundary

When frontend work depends on the backend:

> **Do not invent the backend contract.**

The agent should identify what is missing and request the agreed contract.

For TrailSync, confirm:

- Endpoint
- HTTP method
- Authentication requirements
- Firebase token transport
- Headers
- Request body
- Response body
- Status codes
- Error format

If the backend collaborator provides a different implementation from an earlier proposal, the actual agreed backend contract takes precedence.

---

# 64. AI Coding Agent — Respect Existing Architecture

Before introducing a new architecture, determine what already exists.

Do not replace:

- Frameworks
- Libraries
- Project structure
- State management
- API patterns
- Authentication systems
- Database technologies

without a clear reason and appropriate authorization.

---

# 65. AI Coding Agent — Do Not Over-Refactor

A task such as:

> "Add a login button."

should not become:

> "Rewrite the authentication architecture."

unless the existing architecture makes the requested task impossible or unsafe.

Keep changes proportional to the task.

---

# 66. AI Coding Agent — Ask Before Crossing Boundaries

When a task crosses an architectural boundary, verify assumptions.

Examples:

```text
Frontend → Backend
Backend → Database
Application → External API
Authentication → Authorization
Mobile → Backend
Offline Storage → Cloud Synchronization
```

If the required contract is unclear:

> **Do not invent it.**

---

# 67. AI Coding Agent — Explain Important Decisions

When making a non-obvious technical decision, explain:

- What was chosen
- Why it was chosen
- What alternatives existed
- Why the alternative was not selected
- What trade-offs exist

Do not overwhelm the developer with explanations for trivial code.

---

# 68. AI Coding Agent — Incremental Development

For complex tasks:

```text
Understand
    ↓
Implement small part
    ↓
Verify
    ↓
Continue
    ↓
Integrate
    ↓
Verify again
```

Do not attempt to modify the entire application at once when the task can reasonably be broken into smaller steps.

---

# 69. AI Coding Agent — Follow the Project Milestones

When a milestone document exists, the agent should follow it sequentially.

For TrailSync:

```text
Phase 1 — Frontend Foundation
        ↓
Phase 2 — Authentication UI
        ↓
Phase 3 — Client-Side Validation
        ↓
Phase 4 — Authentication Service
        ↓
Phase 5 — Firebase Authentication
        ↓
Phase 6 — Backend API Integration
        ↓
Phase 7 — Authentication State
        ↓
Phase 8 — Loading/Error/Success States
        ↓
Phase 9 — Frontend Testing
        ↓
Phase 10 — Final Verification
```

If instructed to implement one phase:

> **Implement only that phase.**

Do not silently implement future phases.

---

# 70. AI Coding Agent — Verification

After coding, the agent should:

1. Review its changes.
2. Check for unintended modifications.
3. Run relevant tests.
4. Run lint.
5. Run the build where appropriate.
6. Check for obvious runtime issues.
7. Check for security issues.
8. Confirm the requested behavior.
9. Report what changed.
10. Report what was verified.
11. Report unresolved concerns.

The agent must not claim something works when it has not reasonably verified it.

---

# 71. AI Coding Agent — Definition of Done

A task should generally be considered complete when:

- The requested behavior is implemented.
- Existing behavior remains intact where required.
- Code follows project conventions.
- No unnecessary complexity was introduced.
- Errors are handled appropriately.
- Security boundaries are preserved.
- Relevant edge cases were considered.
- Relevant tests were added or updated.
- Tests pass.
- Lint passes where applicable.
- Build passes where applicable.
- Changes were reviewed.
- Important documentation was updated when necessary.

---

# 72. Decision Framework

When choosing between two implementations, evaluate them in this order:

```text
Does it satisfy the requirement?
        ↓
Is it secure?
        ↓
Is it correct?
        ↓
Is it reliable?
        ↓
Is it simple?
        ↓
Is it maintainable?
        ↓
Is it testable?
        ↓
Is performance sufficient?
        ↓
Is additional complexity justified?
```

Do not select an implementation merely because it is more sophisticated.

---

# 73. The Three Questions

Before introducing significant complexity, ask:

### 1. What problem are we solving?

Clearly identify the actual problem.

### 2. Why is the simpler solution insufficient?

If the simpler solution works, use it.

### 3. What evidence justifies the complexity?

Examples:

- Actual performance measurements
- Growing duplication
- Real scalability requirements
- Security requirements
- Clear business complexity
- Existing production problems

Without evidence, prefer the simpler approach.

---

# 74. Anti-Overengineering

This is a high-priority principle.

Do not confuse:

```text
More architecture
```

with:

```text
Better architecture
```

Avoid unnecessary:

- Microservices
- Event-driven systems
- CQRS
- Event sourcing
- Kubernetes
- Distributed systems
- Multiple databases
- State-management libraries
- Dependency injection frameworks
- Generic abstractions
- Caching
- Event buses
- Complex synchronization systems

unless actual requirements justify them.

For TrailSync, a **modular monolith** is the preferred starting architecture.

---

# 75. No Enterprise Theater

Do not add architectural ceremony simply to make the project look professional.

Avoid chains such as:

```text
Controller
   ↓
Service
   ↓
Manager
   ↓
Processor
   ↓
Handler
   ↓
Repository
   ↓
Adapter
   ↓
Factory
```

when the operation is simply:

```text
Receive request
   ↓
Validate
   ↓
Perform operation
   ↓
Return result
```

Architecture should serve the software.

> **The software should not exist to justify the architecture.**

---

# 76. TrailSync-Specific "Do Not Invent" Rules

The coding agent must not invent:

- Official tourism rules
- Trail coordinates
- Trail boundaries
- Daily carrying capacity
- Pricing
- Guide policies
- Weather thresholds
- API endpoints
- API response formats
- Database schemas
- Payment rules
- Official safety procedures
- Government requirements

When these are unknown, mark them as unresolved and ask for confirmation.

---

# 77. TrailSync-Specific Accuracy Rules

Do not overclaim system capabilities.

Examples:

### Correct

> Near-real-time GPS monitoring of trekking groups through guide devices.

### Incorrect

> Exact real-time GPS tracking of every hiker.

---

### Correct

> Offline GPS points are stored locally and synchronized when connectivity returns.

### Incorrect

> GPS remains real-time while completely offline.

---

### Correct

> Firebase Authentication handles user authentication while the backend verifies Firebase ID tokens.

### Incorrect

> Firebase Authentication automatically authorizes access to PostgreSQL.

---

# 78. Preserve Requirements

Do not silently change requirements because a different design appears technically attractive.

If a requirement appears problematic:

1. Identify the problem.
2. Explain the concern.
3. Suggest an alternative if appropriate.
4. Ask for confirmation before changing an important requirement.

Do not silently rewrite the project's business rules.

---

# 79. Collaboration Rules

TrailSync has separate frontend and backend responsibilities.

When working across the boundary:

```text
Frontend Developer
       ↕
Agreed API Contract
       ↕
Backend Developer
```

Neither side should independently invent incompatible assumptions.

If the backend collaborator provides an endpoint or response format, document it before implementing dependent frontend functionality.

The API contract becomes the shared source of truth.

---

# 80. Source of Truth

Important information should have one authoritative source.

Examples:

- Authentication state
- API contracts
- Business rules
- User permissions
- Configuration
- Database state
- Booking state
- Guide assignment state

When multiple representations are necessary, clearly define which one is authoritative.

---

# 81. Final Engineering North Star

The goal is not:

> **Write the most advanced code.**

The goal is:

> **Build the simplest system that reliably solves the real problem and can be responsibly maintained.**

Good engineers know many patterns.

Great engineers also know **when not to use them**.

---

# Final Rules

When in doubt:

> **Keep it simple.**

> **Do not build what is not needed.**

> **Do not repeat important knowledge.**

> **Keep responsibilities clear.**

> **Do not trust the client.**

> **Make business rules explicit.**

> **Protect security boundaries.**

> **Do not invent requirements.**

> **Do not invent API contracts.**

> **Do not invent database structures.**

> **Respect the frontend/backend boundary.**

> **Test important behavior.**

> **Measure before optimizing.**

> **Prefer composition over unnecessary inheritance.**

> **Refactor when complexity becomes real.**

> **Make the smallest reasonable change.**

> **Work incrementally.**

> **Follow the project milestones.**

> **Verify before claiming completion.**

> **Choose clarity over cleverness.**

> **Do not over-engineer.**

> **Ask when important information is missing.**

---

# Final Rule

> **Simple enough to understand. Structured enough to maintain. Secure enough to trust. Tested enough to rely on. Flexible enough to evolve.**
