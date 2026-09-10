# TrailSync backend

Node.js, Express, Prisma, and PostgreSQL foundation for the TrailSync API.

This is our TrailSync backend. It uses Express for the API, Prisma to communicate with PostgreSQL, and PostgreSQL for storing data.

To set it up, create your .env, install dependencies, verify Prisma, and start the server.

We haven't designed the database yet, so **don't create random models**. When a feature and its business rules are understood, create the appropriate **Prisma model and generate a migration**.

**The frontend should communicate with the backend API, not directly with PostgreSQL.**

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` to your local PostgreSQL connection string.
2. Install dependencies with `npm install`.
3. Check the database configuration with `npm run prisma:validate`.
4. Start the API with `npm run dev`.

The health check is available at `GET /health`.

## Prisma workflow

The schema deliberately contains no models yet: the project’s data model has not been finalized. Add a model only with the feature and confirmed business rules it supports, then create a versioned migration:

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
