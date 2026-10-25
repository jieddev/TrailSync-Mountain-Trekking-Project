# TrailSync

TrailSync is a smart eco-tourism and trail management system for Barangay Cabintan, Ormoc City, Leyte. It supports trekking bookings, guide dispatching, near-real-time group monitoring through assigned guide devices, safety operations, digital certificates, and tourism analytics.

## Repository structure

```text
.
├── docs/       Project requirements, engineering principles, and frontend milestones
├── frontend/   React, Vite, TypeScript, and Tailwind CSS web application
├── backend/    Reserved for the Node.js, Express, and PostgreSQL API
└── mobile/     Reserved for the Flutter guide application
```

`backend/` and `mobile/` will be added by their respective collaborators when their applications are ready. They are intentionally not scaffolded in this restructuring commit.

## Frontend

To run the web application:

```bash
cd frontend
npm ci
npm run dev
```

### Google Maps 3D preview

The authenticated home page includes a Google Maps 3D preview for the
provisional Sulfatara trail. Its route (`public/trails/sulfatara.kml`) is the
Cabintan jump-off to Sulfatara section of the Wikiloc track in
`public/trails/alto-peak-via-lake-janagdan-and-malingatong.kml`, not verified
trail data. To enable it:

1. Create or select a Google Cloud project, enable billing, and enable the
   Maps JavaScript API with 3D Maps support.
2. Create a browser-restricted API key with referrers for local development
   and the deployed frontend.
3. Copy `.env.example` to `.env.local` and set
   `VITE_GOOGLE_MAPS_API_KEY` to the restricted key.

The key is exposed to the browser by Vite, so it must be restricted in Google
Cloud and must not be committed to the repository. See Google's
[3D Maps getting started guide](https://developers.google.com/maps/documentation/javascript/3d/get-started)
for the current Maps Platform setup details.

Available frontend checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run format:check
npm test
```

## Frontend unit tests and TDD

Frontend unit tests use Vitest and live next to the logic they cover, using
`*.test.ts` or `*.test.tsx` (for example,
`src/features/auth/validation.test.ts`). Run the full suite with:

```bash
npm test
```

Use the RED → GREEN → REFACTOR workflow for new deterministic frontend
business logic:

1. Write a test that describes the expected behavior.
2. Run it and confirm it fails for the expected reason (RED).
3. Add the minimum implementation needed to pass (GREEN).
4. Refactor while keeping the tests passing (REFACTOR).
5. Keep the test in the codebase as a permanent regression check; do not
   delete passing tests.

The initial unit tests are intentionally isolated from Firebase, APIs, and the
database. Integration testing for those boundaries belongs to future work.

## Technology direction

- Web: React, Vite, TypeScript, Tailwind CSS, Firebase Authentication
- Backend: Node.js, Express, PostgreSQL, Firebase ID-token verification
- Mobile: Flutter

The frontend communicates with the backend through an agreed API contract and never accesses PostgreSQL directly.

## Project documentation

- [Project context](../docs/PROJECT_CONTEXT.md)
- [Project milestones](../docs/PROJECT_MILESTONES.md)
- [API contract](../docs/API_CONTRACT_V1.md)
- [Coding principles](../docs/CODING_PRINCIPLES.md)
