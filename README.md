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

Available frontend checks:

```bash
npm run typecheck
npm run lint
npm run build
npm run format:check
```

## Technology direction

- Web: React, Vite, TypeScript, Tailwind CSS, Firebase Authentication
- Backend: Node.js, Express, PostgreSQL, Firebase ID-token verification
- Mobile: Flutter

The frontend communicates with the backend through an agreed API contract and never accesses PostgreSQL directly.

## Project documentation

- [Project context](docs/PROJECT_CONTEXT.md)
- [Frontend milestones](docs/FRONTEND_MILESTONES.md)
- [Coding principles](docs/CODING_PRINCIPLES.md)
