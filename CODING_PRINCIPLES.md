# Software Engineering Principles & Best Practices

## Purpose

This document defines the general software engineering principles that should guide development across projects and tasks.

It is intended to be read by both developers and AI coding agents before implementing or modifying software.

These principles are **project-agnostic**. They should remain useful across different languages, frameworks, architectures, and types of applications.

The goal is to produce software that is:

- Understandable
- Maintainable
- Reliable
- Secure
- Testable
- Adaptable
- Appropriately performant
- Appropriate to the project's size and requirements

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

Good engineering should reduce unnecessary cognitive load.

### Principles

- Prefer straightforward code.
- Prefer obvious control flow.
- Prefer simple data structures when they are sufficient.
- Prefer readable solutions over clever solutions.
- Avoid unnecessary abstraction.
- Avoid unnecessary layers.
- Avoid unnecessarily complicated design patterns.
- Avoid deeply nested logic.
- Avoid clever one-liners when they reduce readability.
- Avoid introducing complexity without a demonstrated need.

Before adding complexity, ask:

> "What problem does this complexity solve?"

If there is no meaningful answer, do not add it.

---

# 3. YAGNI — You Aren't Gonna Need It

Do not build functionality simply because it might be useful in the future.

Build for known requirements.

Avoid:

- Future features that have not been requested
- Unused abstractions
- Unused configuration systems
- Unused extension points
- Unused API endpoints
- Unused database structures
- Generalized frameworks for one use case

When future requirements actually appear, the system can be refactored appropriately.

> **Do not pay today's complexity cost for tomorrow's hypothetical problem.**

---

# 4. DRY — Don't Repeat Yourself

Avoid unnecessary duplication of knowledge and business logic.

Good candidates for reuse include:

- Business rules
- Validation rules
- Shared constants
- Common API behavior
- Reusable UI components
- Repeated utilities
- Shared configuration

However:

> **Do not create an abstraction simply because two pieces of code look similar.**

Duplication is sometimes preferable to a bad abstraction.

DRY should primarily eliminate duplicated **knowledge**, not every instance of similar syntax.

---

# 5. SOLID Principles

SOLID principles should be applied when they improve the design.

Do not force SOLID into small or simple code where it adds unnecessary complexity.

---

## 5.1 Single Responsibility Principle

A module should have a clear responsibility.

Avoid modules that simultaneously handle:

- UI rendering
- Database access
- Authentication
- Validation
- Business rules
- External API communication
- Logging
- Unrelated application logic

Separate responsibilities when doing so improves clarity and maintainability.

---

## 5.2 Open/Closed Principle

Software should be reasonably open to extension without requiring unnecessary modification of stable code.

Use this principle when behavior is genuinely expected to grow.

Do not build elaborate extension systems before there is a real need.

---

## 5.3 Liskov Substitution Principle

When abstractions or inheritance are used, implementations should behave consistently with the expectations of the abstraction.

Avoid misleading inheritance relationships.

Prefer composition when it represents the problem more naturally.

---

## 5.4 Interface Segregation Principle

Avoid forcing consumers to depend on functionality they do not need.

Prefer focused interfaces and service boundaries over large "god interfaces."

---

## 5.5 Dependency Inversion Principle

High-level business logic should not be tightly coupled to low-level implementation details.

For example:

```text
Business Logic
      ↓
Service / Abstraction
      ↓
Infrastructure
```

rather than spreading infrastructure-specific code throughout the application.

Examples of infrastructure include:

- Databases
- HTTP clients
- Authentication providers
- File systems
- External APIs
- Cloud services

---

# 6. Separation of Concerns

Different responsibilities should remain appropriately separated.

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

Not every project needs every layer.

The important idea is that unrelated responsibilities should not become tightly coupled.

---

# 7. Composition Over Inheritance

Prefer composition when possible.

Composition generally makes behavior easier to:

- Reuse
- Test
- Replace
- Understand
- Modify

Avoid deep inheritance hierarchies.

Inheritance should represent a genuine "is-a" relationship rather than simply being used as a code-reuse mechanism.

---

# 8. Single Source of Truth

Important information should have one authoritative source.

Avoid maintaining multiple independent representations of the same state when they can become inconsistent.

Examples:

- Authentication state
- Configuration
- Business rules
- Application settings
- User permissions
- API contracts

When multiple sources are unavoidable, define clearly which one is authoritative.

---

# 9. Separation of State

Not every piece of state belongs in global state.

First determine what kind of state something is:

- Local component state
- Form state
- URL state
- Authentication state
- Server/API state
- Application-wide state

Use the simplest appropriate mechanism.

> **Do not introduce global state management merely because a library exists.**

---

# 10. Abstraction

Abstraction is useful when it hides meaningful complexity.

Bad abstraction:

```text
GenericManager
UniversalProcessor
BaseService
AbstractHandler
```

created only because the architecture appears more professional.

Good abstraction:

```text
AuthenticationService
PaymentGateway
WeatherService
NotificationService
```

where the abstraction represents a meaningful concept.

### Rule

> Abstract based on demonstrated behavior, not imagined future requirements.

---

# 11. Avoid Premature Abstraction

Do not abstract too early.

A useful progression is:

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

This is often safer than attempting to predict the perfect abstraction before understanding the problem.

---

# 12. Separation of Business Logic

Business rules should be explicit and easy to locate.

Examples include:

- Pricing rules
- Permission rules
- Booking rules
- Scheduling rules
- Status transitions
- Eligibility requirements
- Validation rules
- Safety rules

Do not bury important business rules inside unrelated UI code or infrastructure code.

The backend should remain authoritative for security-sensitive and business-critical rules when a client/server architecture is involved.

---

# 13. Do Not Trust the Client

Anything originating from a client can potentially be manipulated.

Never rely on frontend code alone for:

- Authorization
- Permissions
- Pricing
- Financial calculations
- Security decisions
- Role assignment
- Ownership checks
- Business-critical state transitions

Client-side validation improves user experience.

Server-side validation provides authority.

---

# 14. Validation

Validate data at the appropriate boundaries.

### Client-side validation

Purpose:

- Improve UX
- Give immediate feedback
- Prevent obviously invalid submissions

### Server-side validation

Purpose:

- Protect the system
- Protect data integrity
- Enforce business rules
- Protect security boundaries

Important validation should not exist only on the client.

---

# 15. Error Handling

Errors are part of normal software behavior.

Handle them intentionally.

Good error handling should:

- Distinguish expected failures from unexpected failures.
- Provide useful information to developers.
- Provide understandable information to users.
- Avoid exposing sensitive internal details.
- Preserve useful debugging context.
- Avoid silently ignoring important failures.

Avoid:

```javascript
try {
  doSomething();
} catch (error) {}
```

unless there is an intentional reason to ignore the error.

---

# 16. Fail Explicitly

When something cannot safely continue, fail clearly rather than silently producing incorrect behavior.

Prefer:

```text
Invalid state → explicit error
```

over:

```text
Invalid state → silently continue with incorrect data
```

Incorrect software that appears to work can be more dangerous than software that clearly fails.

---

# 17. Defensive Programming

Consider what can go wrong at system boundaries.

Examples:

- Missing data
- Invalid input
- Network failure
- API failure
- Authentication expiration
- Unexpected API responses
- Empty collections
- Null/undefined values
- File-system failures
- Database failures
- Concurrent operations

Do not add defensive code for every imaginable scenario.

Focus on realistic and consequential failure modes.

---

# 18. Naming

Good naming is one of the cheapest and most effective forms of documentation.

Prefer names that communicate intent.

Good:

```javascript
isAuthenticated;
isLoading;
hasPermission;
getUserProfile;
calculateTotalPrice;
```

Poor:

```javascript
flag;
data;
temp;
x;
doStuff;
```

Avoid unnecessary abbreviations.

Consistency matters more than personal preference.

---

# 19. Functions

Functions should have clear responsibilities.

Prefer functions that:

- Have descriptive names
- Have understandable inputs
- Produce predictable outputs
- Have limited side effects
- Avoid excessive parameters
- Avoid deeply nested logic

Do not obsess over arbitrary function-length limits.

A function should be as large as necessary to express one coherent responsibility, but no larger than necessary.

---

# 20. Pure Functions

Prefer pure functions when practical.

A pure function:

```text
same input → same output
```

and does not unexpectedly modify external state.

Pure functions are generally easier to:

- Understand
- Test
- Reuse
- Debug

However, side effects are necessary in real applications.

The goal is not to eliminate side effects.

The goal is to **control and isolate them**.

---

# 21. Side Effects

Make important side effects explicit.

Examples:

- Database writes
- API requests
- File operations
- Authentication
- Logging
- Notifications
- State mutation

Keep side effects close to the appropriate application boundary.

Avoid hiding significant side effects inside functions that appear to simply calculate or transform data.

---

# 22. Comments

Comments should explain **why**, not simply restate what the code already says.

Bad:

```javascript
// Increment counter
counter++;
```

Good:

```javascript
// The external API allows a maximum of 100 records per request.
```

Useful comments explain:

- Business decisions
- Non-obvious behavior
- Workarounds
- External limitations
- Important architectural decisions
- Safety-critical behavior

If code requires excessive comments to explain itself, consider improving the code.

---

# 23. Readability

Code should be optimized for human comprehension.

Prefer:

```javascript
const isEligible = user.age >= minimumAge;
```

over a clever but difficult-to-read expression.

Consider:

- Naming
- Structure
- Formatting
- Control flow
- Function boundaries
- Abstraction level

before considering micro-optimizations.

---

# 24. Consistency

Once a project establishes a convention, follow it.

Be consistent with:

- Naming
- File organization
- Formatting
- Error handling
- API structure
- Component structure
- Import style
- State management
- Testing style

Do not introduce a new style for every feature.

---

# 25. Convention Over Configuration

Prefer established project conventions where they make sense.

Do not repeatedly introduce custom patterns when the framework or project already has a clear convention.

However, do not blindly follow framework conventions when they conflict with actual requirements.

---

# 26. Dependency Management

Dependencies have long-term costs.

Before adding a dependency, ask:

1. Does the project actually need it?
2. Can the problem be solved simply with existing tools?
3. Is the dependency maintained?
4. Does it introduce security concerns?
5. Does it significantly increase complexity or bundle size?
6. Will the development team understand how it works?

Avoid dependencies for trivial functionality.

---

# 27. Security

Security should be considered from the beginning.

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

# 28. Least Privilege

Give users, services, and components only the permissions they actually need.

Do not give broad permissions simply because they are convenient.

Least privilege should apply to:

- Users
- Roles
- API credentials
- Database accounts
- Services
- Cloud resources
- Application components

---

# 29. Configuration and Secrets

Configuration and secrets must be treated differently.

Configuration may include:

- API URLs
- Feature settings
- Environment names

Secrets may include:

- Passwords
- Private keys
- Database credentials
- Authentication secrets
- Private API keys

Never assume that frontend environment variables are secret.

Anything shipped to a browser can potentially be inspected by the user.

---

# 30. API Contracts

When frontend and backend communicate, use an explicit API contract.

Define:

- Endpoint
- HTTP method
- Authentication
- Headers
- Parameters
- Request body
- Response body
- Status codes
- Error format

Never invent an API contract when the backend already exists.

If the contract is unclear, clarify it before implementing dependent functionality.

---

# 31. Database Principles

When working with databases:

- Use meaningful relationships.
- Use appropriate primary keys.
- Use foreign keys where appropriate.
- Protect data integrity.
- Use migrations.
- Use transactions when operations must succeed or fail together.
- Add indexes based on actual query requirements.
- Avoid unnecessary duplication.
- Avoid storing derived data unless justified.
- Design around actual business requirements.

Do not optimize database structure based purely on hypothetical future scale.

---

# 32. Transactions

Use transactions when multiple related operations must behave atomically.

For example:

```text
Operation A succeeds
Operation B succeeds
Operation C fails
```

If A and B must not remain committed without C, they should be handled within an appropriate transaction.

Do not use transactions unnecessarily for independent operations.

---

# 33. Concurrency

Consider concurrent operations when they can affect correctness.

Examples:

- Two users modifying the same resource
- Duplicate requests
- Multiple bookings
- Inventory changes
- Queue operations
- Payment processing
- Synchronization

Do not assume requests always happen sequentially.

Use appropriate mechanisms such as:

- Transactions
- Constraints
- Idempotency
- Locks
- Versioning
- Unique constraints

when the actual problem requires them.

---

# 34. Idempotency

Operations that may be retried should be designed carefully.

An operation is idempotent when repeating it does not unintentionally produce additional effects.

This is especially important for:

- Payments
- Synchronization
- Network retries
- Background jobs
- API requests

Do not assume a network request is executed exactly once.

---

# 35. Performance

Performance matters, but premature optimization creates unnecessary complexity.

Follow this order:

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

Avoid optimizing code simply because it "might be slow."

Prioritize meaningful performance issues.

---

# 36. Complexity

When evaluating an implementation, consider both:

- Runtime complexity
- Human complexity

An algorithm that is theoretically faster but dramatically harder to understand may not be the best choice for a small dataset.

Choose based on actual requirements.

---

# 37. Testing

Tests should provide confidence in behavior.

Prioritize testing:

- Important business rules
- Critical user flows
- Validation
- Error handling
- Authentication
- Authorization
- Data integrity
- Important edge cases

Avoid writing tests that merely reproduce implementation details.

Prefer behavior-focused tests.

---

# 38. Test Pyramid

When appropriate, use a balanced testing strategy:

```text
        End-to-End
       /          \
   Integration
   /            \
      Unit Tests
```

Generally:

- Many focused unit tests
- A meaningful number of integration tests
- Fewer expensive end-to-end tests

The exact balance depends on the project.

---

# 39. Testing Edge Cases

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

# 40. Observability

For systems that need operational visibility, make important behavior observable.

Useful observability includes:

- Logs
- Metrics
- Error reporting
- Health checks
- Tracing where appropriate

Avoid excessive logging.

Never log sensitive information unnecessarily.

---

# 41. Accessibility

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

Accessibility should be part of implementation rather than an afterthought.

---

# 42. User Experience

Technical correctness does not automatically create a good user experience.

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

# 43. State Transitions

When an entity has multiple states, make the lifecycle explicit.

For example:

```text
PENDING
   ↓
APPROVED
   ↓
ACTIVE
   ↓
COMPLETED
```

Define valid transitions rather than allowing arbitrary state changes.

This becomes especially important for:

- Orders
- Bookings
- Payments
- Authentication
- Workflows
- Jobs
- Reservations

---

# 44. Data Integrity

Important rules should be enforced at the strongest appropriate layer.

For critical data:

```text
UI validation
      ↓
API validation
      ↓
Business rules
      ↓
Database constraints
```

Do not rely on only one layer when multiple layers provide meaningful protection.

---

# 45. Offline and Synchronization

If an application supports offline operation:

- Clearly define what works offline.
- Clearly define what requires connectivity.
- Store necessary local data safely.
- Queue unsynchronized operations when appropriate.
- Handle reconnection.
- Prevent duplicate synchronization.
- Consider conflicting changes.
- Preserve important locally captured data.

Do not claim real-time behavior when the system actually provides delayed synchronization.

---

# 46. External Services

External APIs and services are dependencies and may fail.

Always consider:

- Timeouts
- Rate limits
- Invalid responses
- Service outages
- Network failures
- Authentication expiration
- API version changes

Do not assume external services are always available.

Where appropriate, isolate external services behind service boundaries.

---

# 47. Architecture

Architecture should be proportional to the problem.

A useful rule:

> **Use the simplest architecture that can comfortably support the current requirements and foreseeable near-term changes.**

Do not automatically choose:

- Microservices
- Event-driven architecture
- CQRS
- Event sourcing
- Kubernetes
- Distributed systems
- Multiple databases

unless the requirements actually justify them.

A modular monolith is often an excellent starting point for small and medium applications.

---

# 48. Anti-Overengineering

This is a high-priority principle.

Do not confuse:

```text
More architecture
```

with:

```text
Better architecture
```

Overengineering can appear as:

- Too many abstraction layers
- Too many design patterns
- Excessive interfaces
- Excessive classes
- Unnecessary microservices
- Unnecessary state-management libraries
- Excessive configuration
- Generic systems for one use case
- Complex dependency injection
- Premature scalability solutions
- Unnecessary caching
- Unnecessary event systems

Before introducing complexity, ask:

> What concrete problem does this solve today?

If the answer is hypothetical, reconsider.

---

# 49. Avoid "Enterprise Theater"

Do not add architectural ceremony simply to make a project look professional.

Examples:

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

when the actual operation is simply:

```text
Receive request
   ↓
Validate
   ↓
Perform operation
   ↓
Return result
```

Architecture should serve the software, not the other way around.

---

# 50. Refactoring

Refactor when the current structure is causing a real problem.

Good reasons include:

- Difficult-to-understand code
- Significant duplication
- Growing complexity
- Mixed responsibilities
- Difficult testing
- Repeated bugs
- Poor maintainability

Do not refactor merely because another architecture looks more sophisticated.

Refactoring should preserve intended behavior unless changing behavior is explicitly part of the task.

---

# 51. Boy Scout Rule

When touching existing code:

> **Leave the code slightly better than you found it, when doing so is safe and relevant.**

However, this does not mean rewriting unrelated code.

Small improvements are welcome when they are:

- Relevant
- Low risk
- Easy to verify

Do not turn a small feature into an unrelated refactoring project.

---

# 52. Change Minimization

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

# 53. Backward Compatibility

When modifying existing systems, consider whether existing behavior must continue working.

Before making a breaking change, determine:

- Who depends on this behavior?
- Is the API already being used?
- Is the database schema already deployed?
- Will existing users be affected?
- Can the change be introduced gradually?

Do not introduce breaking changes casually.

---

# 54. Git Practices

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

# 55. Code Review Mindset

Before considering code complete, ask:

### Correctness

Does it actually solve the requirement?

### Simplicity

Could the solution be simpler?

### Maintainability

Will another developer understand it?

### Security

Can users manipulate something they should not control?

### Reliability

What happens when things fail?

### Testing

What behavior needs verification?

### Scope

Did the implementation change anything unrelated?

---

# 56. AI Coding Agent Principles

AI coding agents should follow these rules on every task.

## Before Coding

The agent should:

1. Inspect the repository.
2. Understand the existing architecture.
3. Read relevant files.
4. Identify existing conventions.
5. Understand the task.
6. Identify dependencies.
7. Identify ambiguities.
8. Determine the smallest appropriate implementation.

The agent should not immediately start rewriting files.

---

## During Coding

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

---

## After Coding

The agent should:

1. Review its changes.
2. Check for unintended modifications.
3. Run relevant tests.
4. Run lint where available.
5. Run the build where appropriate.
6. Check for obvious runtime issues.
7. Check for security issues.
8. Confirm the requested behavior.
9. Report what changed.
10. Report what was verified.
11. Report any unresolved concerns.

The agent should not claim something works when it has not reasonably verified it.

---

# 57. AI Agent: Do Not Guess

When information is missing, the agent should not invent an answer.

Do not guess:

- API endpoints
- API response formats
- Database schemas
- Business rules
- Pricing
- Permissions
- Authentication behavior
- External service behavior
- File formats
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

If a safe, conventional assumption is made, it should be stated clearly.

---

# 58. AI Agent: Respect Existing Architecture

Before introducing a new architecture, determine what already exists.

The agent should not replace:

- Frameworks
- Libraries
- Project structure
- State management
- API patterns
- Authentication systems
- Database technologies

without a clear reason and explicit authorization when appropriate.

---

# 59. AI Agent: Do Not Over-Refactor

A task such as:

> "Add a login button."

should not become:

> "Rewrite the authentication architecture."

unless the existing architecture makes the requested task impossible or unsafe.

Keep changes proportional to the task.

---

# 60. AI Agent: Explain Important Decisions

When making a non-obvious technical decision, explain:

- What was chosen
- Why it was chosen
- What alternatives existed
- Why the alternative was not selected
- What trade-offs exist

Do not overwhelm the developer with explanations for trivial code.

---

# 61. AI Agent: Ask Before Crossing Boundaries

When a task crosses architectural boundaries, the agent should verify assumptions.

Examples:

```text
Frontend → Backend
Backend → Database
Application → External API
Authentication → Authorization
```

If the required contract is unclear, do not invent it.

---

# 62. AI Agent: Preserve Security Boundaries

The agent must never weaken security simply to make implementation easier.

Do not:

- Disable authentication to make testing easier.
- Expose secrets for convenience.
- Bypass authorization.
- Trust client-provided permissions.
- Log sensitive credentials.
- Disable validation without understanding the consequences.

Temporary development shortcuts should not become permanent security vulnerabilities.

---

# 63. AI Agent: Prefer Incremental Development

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

# 64. AI Agent: Definition of Done

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

# 65. Decision Framework

When deciding between two implementations, evaluate them using this order:

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

# 66. The Three Questions

Before introducing significant complexity, ask:

### 1. What problem are we solving?

Clearly identify the actual problem.

### 2. Why is the simpler solution insufficient?

If the simpler solution works, use it.

### 3. What evidence justifies the complexity?

Examples of evidence:

- Actual performance measurements
- Growing code duplication
- Real scalability requirements
- Security requirements
- Clear business complexity
- Existing production problems

Without evidence, prefer the simpler approach.

---

# 67. Engineering North Star

The goal of software engineering is not:

> "Write the most advanced code."

It is:

> **"Build the simplest system that reliably solves the real problem and can be responsibly maintained."**

Good engineers know many patterns.

Great engineers also know **when not to use them**.

---

# Final Principles

When in doubt:

> **Keep it simple.**

> **Do not build what is not needed.**

> **Do not repeat important knowledge.**

> **Keep responsibilities clear.**

> **Do not trust the client.**

> **Make business rules explicit.**

> **Protect security boundaries.**

> **Test important behavior.**

> **Measure before optimizing.**

> **Prefer composition over unnecessary inheritance.**

> **Refactor when complexity becomes real.**

> **Do not guess when requirements are unclear.**

> **Do not over-engineer.**

> **Make the smallest reasonable change.**

> **Verify before claiming completion.**

> **Choose clarity over cleverness.**

---

# Final Rule

> **Simple enough to understand. Structured enough to maintain. Secure enough to trust. Tested enough to rely on. Flexible enough to evolve.**
