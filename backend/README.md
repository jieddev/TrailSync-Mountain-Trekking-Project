# TrailSync backend

Node.js, Express, Prisma, and PostgreSQL foundation for the TrailSync API.

This is our TrailSync backend. It uses Express for the API, Prisma to communicate with PostgreSQL, and PostgreSQL for storing data.

To set it up, create your .env, install dependencies, verify Prisma, and start the server.

The initial `User` model stores the application profile associated with a Firebase-authenticated account. Firebase owns credentials; passwords and authentication tokens are not stored in PostgreSQL. When a feature and its business rules are understood, create the appropriate **Prisma model and generate a migration**.

**The frontend should communicate with the backend API, not directly with PostgreSQL.**

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your local PostgreSQL connection string.
2. Install dependencies with `npm install`.
3. Check the database configuration with `npm run prisma:validate`.
4. Start the API with `npm run dev`.

The health check is available at `GET /health`.

## Logging

The API uses Pino for structured application logs and request logs. Local
development uses readable pretty logs by default, while production should emit
JSON logs for log collectors.

Set `LOG_LEVEL` to control verbosity. Common values are `debug`, `info`, `warn`,
and `error`. Set `LOG_PRETTY=false` to force JSON logs outside production.

Request logs include an `X-Request-Id` response header so API responses can be
matched to logs. Sensitive headers and credential-like fields are redacted.

## Create a user

Start the API, then send a `POST /users` request. The Firebase UID is the UID
from the authenticated Firebase user; do not send passwords to this API.

```json
{
  "firebaseUid": "firebase-user-uid",
  "fullName": "Jane Doe",
  "email": "jane@example.com",
  "role": "HIKER"
}
```

`role` is optional and defaults to `HIKER`. Valid roles are `HIKER`, `GUIDE`,
and `COORDINATOR`. A duplicate Firebase UID or email returns `409 Conflict`.

## Prisma workflow

Add models only with the feature and confirmed business rules they support, then create a versioned migration:

```bash
npm run prisma:migrate -- --name describe_the_change
```

Do not put `DATABASE_URL` in the frontend; only this backend connects to PostgreSQL.

```
sudo -u postgres psql
```

In another terminal

```
psql "[DATABASE_URL]"

```
