# TrailSync backend

Node.js, Express, Prisma, and PostgreSQL foundation for the TrailSync API.

This is our TrailSync backend. It uses Express for the API, Prisma to communicate with PostgreSQL, and PostgreSQL for storing data.

To set it up, create your .env, install dependencies, verify Prisma, and start the server.

The initial `User` model stores the application profile associated with a Firebase-authenticated account. Firebase owns credentials; passwords and authentication tokens are not stored in PostgreSQL. When a feature and its business rules are understood, create the appropriate **Prisma model and generate a migration**.

**The frontend should communicate with the backend API, not directly with PostgreSQL.**

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your local PostgreSQL connection string.
2. Configure Firebase Admin credentials. For local development, set
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
   `FIREBASE_PRIVATE_KEY` from a Firebase service account. Keep the private key
   on one line and use `\n` for its line breaks. Alternatively, configure
   Application Default Credentials through `GOOGLE_APPLICATION_CREDENTIALS`.
   Never commit credentials.
3. Install dependencies with `npm install`.
4. Check the database configuration with `npm run prisma:validate`.
5. Start the API with `npm run dev`.

The health check is available at `GET /health`.

## Certificate emails

When a trek is completed, each hiker gets a PDF certificate by email
(`src/lib/certificates.ts`). The template and fonts are in
`assets/certificates/`, matching the guide app's certificate card. Set
`SMTP_USER`, `SMTP_PASS` (a Gmail app password) and `MAIL_FROM` in `.env`.
Without `SMTP_USER`, emails are only logged.

## Logging

The API uses Pino for structured application logs and request logs. Local
development uses readable pretty logs by default, while production should emit
JSON logs for log collectors.

Set `LOG_LEVEL` to control verbosity. Common values are `debug`, `info`, `warn`,
and `error`. Set `LOG_PRETTY=false` to force JSON logs outside production.

Request logs include an `X-Request-Id` response header so API responses can be
matched to logs. Sensitive headers and credential-like fields are redacted.

## Create a user

`POST /users` requires a valid Firebase ID token. The backend verifies the
token and derives the Firebase UID and email from it. Do not send passwords,
Firebase UID, email, or role in the request body.

```json
{
  "fullName": "Jane Doe"
}
```

Public profile creation always uses the `HIKER` role. A duplicate Firebase UID
or email returns `409 Conflict`. Missing, invalid, or expired ID tokens return
`401 Unauthorized`.

## Coordinator and guide accounts

Registration always creates a `HIKER`. To give someone coordinator (or guide)
access, have them register first, then run from `backend/`:

```bash
npm run set-role -- coordinator@example.com COORDINATOR
```

The script uses `DATABASE_URL` from `.env` and prints the old and new role.
There is deliberately no API endpoint for changing roles. Coordinators use the same
`/login` page as hikers; the web app sends them to `/coordinator/bookings`.

Coordinator-only routes use the `requireRole` middleware
(`src/middleware/require-role.ts`) after `requireFirebaseAuth`.

## Trails

TrailSync supports multiple trails. The `trails` table is the approved catalog;
`GET /api/v1/trails` lists active trails and `GET /api/v1/trails/:trailId`
returns one. Bookings must send a `trailId` from this catalog. The backend copies
the trail's `packagePrice` and its 50% downpayment onto the booking, so later
price changes do not affect existing bookings.

The active catalog trails are Sulfatara (`trl_sulfatara`, ₱550) and Mt. Malingatong
(`trl_mt_malingatong`, ₱680).
Lake Janagdan (`trl_lake_janagdan`) was retired (`isActive = false`).
There is no trail admin API. To add a trail, create a migration that inserts a
row with verified data:

```bash
npm run prisma:migrate -- --name add_trail_<slug> --create-only
```

```sql
INSERT INTO "trails" ("id", "slug", "name", "packagePrice", "isActive", "updatedAt")
VALUES ('trl_<slug>', '<slug>', '<Trail Name>', <price>, true, CURRENT_TIMESTAMP);
```

To retire a trail, set `isActive = false` in a migration. Do not delete it,
because existing bookings still reference it.

## Tests

Run the backend tests with:

```bash
npm test
```

The API tests mock Firebase Admin and Prisma; they do not require Firebase or
PostgreSQL to be running.

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
