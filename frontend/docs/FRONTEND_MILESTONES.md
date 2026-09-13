# TrailSync Frontend Implementation Milestones

## Purpose

This document is the implementation roadmap for the **TrailSync frontend**.

The coding agent (Codex/Claude) should use this document to implement the frontend **step by step**.

The frontend is being developed separately from the backend. The backend collaborator is responsible for the Node.js/Express/PostgreSQL side.

---

# Technology Stack

### Frontend

- [ ] React
- [ ] Vite
- [ ] TypeScript
- [ ] Tailwind CSS
- [ ] Firebase Authentication
- [ ] ESLint
- [ ] Prettier
- [ ] Git / GitHub

### Backend

Handled by the backend collaborator:

- [ ] Node.js
- [ ] Express.js
- [ ] PostgreSQL
- [ ] Firebase Authentication token verification
- [ ] Backend API
- [ ] Database
- [ ] Server-side business logic

---

# Frontend / Backend Boundary

The frontend is responsible for:

- [ ] React UI
- [ ] Page and component structure
- [ ] Client-side validation
- [ ] Firebase client authentication
- [ ] API requests
- [ ] Frontend authentication state
- [ ] Loading states
- [ ] Error handling
- [ ] Frontend tests
- [ ] Routing

The backend collaborator is responsible for:

- [ ] Express API
- [ ] PostgreSQL database
- [ ] Database queries
- [ ] Backend business logic
- [ ] Firebase ID-token verification
- [ ] API authentication/authorization
- [ ] Backend validation
- [ ] Backend tests

The frontend should **never communicate directly with PostgreSQL**.

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

# Coding Agent Rules

The coding agent should follow these rules throughout the implementation:

- [ ] Inspect the existing repository before making changes.
- [ ] Do not recreate files or structure that already exist.
- [ ] Work only on the requested phase.
- [ ] Do not jump ahead to future phases.
- [ ] Do not introduce unnecessary architecture.
- [ ] Do not install unnecessary libraries.
- [ ] Follow the existing project conventions once established.
- [ ] Keep frontend and backend responsibilities separated.
- [ ] Run appropriate verification after implementation.
- [ ] Report what files were changed.
- [ ] Report what was implemented.
- [ ] Report verification results.
- [ ] Report any problems or decisions that require clarification.

---

# Phase 1 — Frontend Foundation

## Goal

Establish the React/Vite/TypeScript/Tailwind frontend foundation and clean project structure.

### Tasks

- [x] Inspect the current repository.
- [x] Determine what already exists.
- [x] Initialize React with Vite if a React application does not already exist.
- [x] Configure Tailwind CSS.
- [x] Establish the initial frontend directory structure.
- [x] Use a feature-oriented structure.
- [x] Configure TypeScript.
- [x] Ensure the Vite React application uses TypeScript.
- [x] Verify TypeScript configuration and compiler behavior.
- [x] Configure ESLint.
- [x] Configure Prettier.
- [x] Remove unnecessary Vite starter/demo code.
- [x] Establish a clean application entry point.
- [x] Confirm the application starts successfully.
- [x] Run `npm run dev`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.

### Expected Result

A clean React + Vite + TypeScript + Tailwind frontend foundation that is ready for authentication UI development.

---

# Phase 2 — Authentication UI

## Goal

Build the Login and Registration interfaces without connecting them to Firebase yet.

### Tasks

- [x] Create the Login page.
- [x] Create the Registration page.
- [x] Add the required form fields.
- [x] Add email field.
- [x] Add password field.
- [x] Add full-name field where required.
- [x] Add confirm-password field where required.
- [x] Add appropriate labels.
- [x] Add accessible form controls.
- [x] Add areas for displaying validation errors.
- [x] Add areas for displaying authentication errors.
- [x] Prepare loading-state UI.
- [x] Create `/login` route.
- [x] Create `/register` route.
- [x] Add navigation between Login and Registration where appropriate.

### Expected Result

Users can navigate between Login and Registration pages and interact with the forms, but authentication is not connected yet.

---

# Phase 3 — Client-Side Validation

## Goal

Implement frontend validation before authentication requests are made.

### Tasks

- [x] Validate email format.
- [x] Validate password requirements.
- [x] Validate full name where required.
- [x] Validate confirm password.
- [x] Display field-level validation errors.
- [x] Prevent submission when validation fails.
- [x] Ensure validation messages are understandable.
- [x] Ensure password values are never logged.
- [x] Keep validation logic separate from UI where practical.

### Expected Result

Invalid forms cannot be submitted and users receive clear validation feedback.

**Password policy note:** No final password policy has been established for TrailSync. Phase 3 validates only that password fields are present and that confirmation matches. The authentication system/backend must enforce the final password requirements.

**Implementation note:** The current UI also applies an eight-character minimum. Treat this as a provisional client-side usability rule until the project confirms its password policy.

---

# Phase 4 — Authentication Service Architecture

## Goal

Create a clean boundary between the React UI and authentication implementation.

### Tasks

- [ ] Create the authentication service.
- [ ] Establish `src/features/auth/services/authService.ts`.
- [ ] Define a registration function.
- [ ] Define a login function.
- [ ] Define a logout function.
- [ ] Define a way to retrieve the current authenticated user.
- [ ] Keep Firebase-specific implementation inside the authentication service where practical.
- [ ] Ensure UI components do not directly contain Firebase authentication logic.
- [ ] Make the authentication service the frontend boundary for authentication operations.

Conceptually:

```text
React Component
      ↓
authService
      ↓
Firebase Authentication
```

### Expected Result

The UI communicates with authentication through a clean service boundary rather than being tightly coupled to Firebase.

**Current implementation note:** Firebase operations are currently called directly from `LoginPage.tsx` and `RegisterPage.tsx`. This phase remains incomplete; move those operations into `authService.ts` before treating the Firebase implementation as architecturally complete.

---

# Phase 5 — Firebase Authentication

## Goal

Connect the frontend authentication service to Firebase Authentication.

### Tasks

- [x] Configure Firebase for the frontend.
- [x] Use environment variables for Firebase configuration.
- [x] Configure Firebase Authentication.
- [ ] Enable email/password authentication.
- [x] Implement registration.
- [x] Implement login.
- [x] Implement logout.
- [ ] Retrieve the authenticated Firebase user.
- [x] Handle Firebase authentication errors.
- [x] Map Firebase errors into user-friendly messages.
- [ ] Test successful registration.
- [ ] Test successful login.
- [ ] Test invalid credentials.
- [ ] Test duplicate/previously registered email behavior.
- [ ] Test logout.

### Expected Result

Users can successfully register, log in, and log out using Firebase Authentication.

**Current implementation note:** The UI contains the Firebase operations, but successful and failure behavior has not yet been verified against a Firebase project. Email/password enablement must also be confirmed in the Firebase console.

---

# Phase 6 — Backend API Integration

## Goal

Connect the authenticated frontend to the backend API.

**Important:** The API contract is intentionally **not finalized yet**.

The actual backend API contract must be obtained from and agreed upon with the backend collaborator before implementing this phase.

### Before Implementation

- [ ] Obtain the actual backend API contract from the collaborator.
- [ ] Confirm endpoint.
- [ ] Confirm HTTP method.
- [ ] Confirm authentication requirements.
- [ ] Confirm required headers.
- [ ] Confirm request body.
- [ ] Confirm successful response body.
- [ ] Confirm success status code.
- [ ] Confirm possible error status codes.
- [ ] Confirm error response format.
- [ ] Confirm whether the endpoint uses `/api/users/me` or another agreed endpoint.
- [ ] Confirm how the Firebase ID token is expected to be provided.

### Expected Authentication Flow

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

### Frontend Tasks

- [ ] Create an API service boundary.
- [ ] Keep API communication separate from UI components.
- [ ] Retrieve the Firebase ID token when required.
- [ ] Send the token according to the agreed backend contract.
- [ ] Implement the agreed user-profile API call.
- [ ] Handle successful API responses.
- [ ] Handle authentication failures.
- [ ] Handle network failures.
- [ ] Handle backend validation errors.
- [ ] Handle unexpected server errors.
- [ ] Do not communicate directly with PostgreSQL.

### Important Rule

If the collaborator's actual backend implementation differs from an earlier proposed design, **the actual agreed API contract takes precedence**.

Adapt the frontend service layer to the agreed contract rather than making unnecessary backend changes.

### Expected Result

The frontend can communicate correctly with the collaborator's backend through the agreed API contract.

---

# Phase 7 — Authentication State Management

## Goal

Make authentication state available throughout the React application.

### Tasks

- [ ] Establish a centralized authentication state.
- [ ] Listen for Firebase authentication state changes.
- [ ] Detect authenticated users.
- [ ] Detect unauthenticated users.
- [ ] Handle the initial authentication-loading state.
- [ ] Make the authenticated user available to relevant components.
- [ ] Ensure authentication state survives page refreshes where Firebase supports it.
- [ ] Avoid unnecessary duplicate authentication listeners.
- [ ] Keep authentication state logic separate from individual pages.

The application should conceptually support:

```text
Loading
   ↓
Authenticated

   or

Unauthenticated
```

### Expected Result

The application reliably knows whether the user is loading, authenticated, or unauthenticated.

---

# Phase 8 — Loading / Error / Success States

## Goal

Make the authentication experience reliable and understandable.

### Tasks

- [x] Add registration loading state.
- [x] Add login loading state.
- [x] Disable duplicate submissions.
- [x] Display authentication errors.
- [x] Display validation errors.
- [ ] Display backend/API errors.
- [x] Display network errors.
- [x] Display appropriate success states.
- [x] Ensure loading indicators do not create confusing UI behavior.
- [x] Ensure users receive understandable feedback.
- [ ] Avoid unnecessary automatic navigation assumptions.

### Expected Result

Authentication operations clearly communicate what is happening and what went wrong when something fails.

---

# Phase 9 — Frontend Testing

## Goal

Verify the authentication frontend independently from the backend database.

### Tasks

- [ ] Test Login UI.
- [ ] Test Registration UI.
- [ ] Test form validation.
- [ ] Test invalid email behavior.
- [ ] Test invalid password behavior.
- [ ] Test password confirmation behavior.
- [ ] Test Firebase authentication behavior.
- [ ] Test authentication error handling.
- [ ] Test authentication state changes.
- [ ] Test API service behavior.
- [ ] Test API error handling.
- [ ] Test loading states.
- [ ] Test successful authentication flows.
- [ ] Ensure frontend unit/component tests do not require a live PostgreSQL database.

### Expected Result

The frontend authentication system is tested independently and reliably.

---

# Phase 10 — Final Authentication Verification

## Goal

Perform an end-to-end verification of the complete authentication flow.

### Registration

- [ ] Open Registration page.
- [ ] Enter valid registration information.
- [ ] Submit registration.
- [ ] Confirm Firebase account creation.
- [ ] Confirm backend profile synchronization if required by the API contract.
- [ ] Confirm appropriate success behavior.

### Login

- [ ] Open Login page.
- [ ] Enter valid credentials.
- [ ] Submit login.
- [ ] Confirm Firebase authentication.
- [ ] Confirm backend API interaction if required.
- [ ] Confirm authenticated application state.

### Logout

- [ ] Log out.
- [ ] Confirm Firebase session is cleared.
- [ ] Confirm application returns to unauthenticated state.

### Error Cases

- [ ] Test invalid credentials.
- [ ] Test invalid form input.
- [ ] Test duplicate registration.
- [ ] Test API failure.
- [ ] Test network failure.
- [ ] Test unexpected backend response.

### Refresh Behavior

- [ ] Refresh while authenticated.
- [ ] Confirm authentication state is restored correctly.
- [ ] Refresh while unauthenticated.
- [ ] Confirm unauthenticated state remains correct.

### Final Verification

- [ ] Run lint.
- [ ] Run tests.
- [ ] Run production build.
- [ ] Confirm there are no unnecessary console errors.
- [ ] Confirm there are no exposed secrets.
- [ ] Confirm the frontend communicates with the backend only through the agreed API.

---

# Future API Contract Documentation

Once the backend collaborator provides the actual API, document it using this structure:

## Endpoint

```text
[endpoint]
```

## HTTP Method

```text
[GET / POST / PUT / PATCH / DELETE]
```

## Purpose

```text
[What the endpoint does]
```

## Authentication

```text
[Required / Not required]

[How authentication is provided]
```

## Headers

```text
[Required headers]
```

## Request Body

```json
{
  "example": "value"
}
```

## Success Response

**Status:**

```text
[status code]
```

**Response:**

```json
{
  "example": "value"
}
```

## Error Responses

**Status:**

```text
[status code]
```

**Response:**

```json
{
  "error": "example"
}
```

---

# Development Rule

Implement **one phase at a time**.

When instructed:

```text
Implement Phase 1.
```

The coding agent should implement **only Phase 1**.

After Phase 1 is completed and verified:

```text
Implement Phase 2.
```

Then continue sequentially.

Do not implement future phases unless explicitly requested.

---

# Progress Tracking

## Overall Progress

- [x] Phase 1 — Frontend Foundation
- [x] Phase 2 — Authentication UI
- [x] Phase 3 — Client-Side Validation
- [ ] Phase 4 — Authentication Service Architecture
- [ ] Phase 5 — Firebase Authentication (partially implemented; pending service boundary and live verification)
- [ ] Phase 6 — Backend API Integration
- [ ] Phase 7 — Authentication State Management
- [ ] Phase 8 — Loading / Error / Success States (partially implemented; backend/API errors remain)
- [ ] Phase 9 — Frontend Testing
- [ ] Phase 10 — Final Authentication Verification

**Current Phase:** Phase 4

**Status:** Client-side validation is complete. Firebase registration and login are currently implemented directly in the UI, with loading and user-facing error states. The next task is to establish the Phase 4 authentication service boundary before continuing with authentication state, backend integration, and testing.
