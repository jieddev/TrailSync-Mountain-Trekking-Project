# Deploying TrailSync (Render free tier)

TrailSync runs online as follows:

| Piece | Where | Cost |
|---|---|---|
| Web app (`frontend/`) | Render Static Site `trailsync-web` | Free. It never sleeps. |
| API (`backend/`) | Render Web Service `trailsync-api` | Free. It sleeps after 15 min idle (see step 7). |
| Database | Neon Postgres | Free, 0.5 GB, no expiry. |
| Email (sign-up codes, certificates) | Brevo HTTP API | Free, 300 emails a day. |
| Guide app | Release APK sent to the client | Not hosted. |

Both Render services are defined in `render.yaml`.

These free-tier limits shaped the setup:
- **Render's free Postgres is deleted after 30 days.** The database is on Neon instead.
- **Render's free disk is wiped on every restart and redeploy.** GCash receipt screenshots are stored in the database (`payment_receipt_files`), not in `backend/uploads`.
- **Render's free services block SMTP ports.** Mail goes through Brevo's HTTP API (`BREVO_API_KEY`), not Gmail SMTP.

## 1. Database (Neon)

1. Sign up at neon.tech and create a project. Pick the region closest to Singapore.
2. Go to **Connect**, turn **Connection pooling off**, and copy the connection string. It looks like `postgresql://…@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
   - Use the direct string, not `-pooler`, because Prisma migrations need a direct connection.
3. This is `DATABASE_URL`. Migrations run on every Render deploy, and they also add the two trails.

## 2. Email (Brevo)

1. Sign up at brevo.com.
2. Go to **Senders, domains & dedicated IPs → Senders → Add a sender**. Enter the Gmail address that should send TrailSync mail, then click the link Brevo emails to it.
3. Go to **SMTP & API → API keys → Generate a new API key**. This is `BREVO_API_KEY`.
4. `MAIL_FROM` is `TrailSync <that-verified-address@gmail.com>`.

5. Go to **Security → Authorized IPs** and turn IP blocking off. Render's free tier has no fixed outbound IP, so with it on Brevo answers `401 unrecognised IP address` and sign-up shows "Could not send the verification code."

Use an API key (it starts with `xkeysib-`), not the SMTP key (`xsmtpsib-`). If sign-up still fails, search the API logs for `Verification code request failed`; the error shows Brevo's answer.

Brevo may ask you to finish your profile before it sends. Mail from a free Gmail sender can land in spam, so tell testers to check there.

## 3. Render

1. Push this branch to GitHub, then merge it to `main`.
2. In the Render dashboard go to **New → Blueprint**, connect the GitHub repo, and pick `main`. Render reads `render.yaml` and asks for every `sync: false` value.

   **`trailsync-api`**

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | The Neon string from step 1. |
   | `CORS_ORIGIN` | `https://trailsync-web.onrender.com`: the web app's URL, with no trailing slash. If the name is taken, Render adds a suffix. Copy the real URL after the first deploy and update this value. |
   | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Same as in `backend/.env`. Keep the key on one line with `\n`. |
   | `BREVO_API_KEY`, `MAIL_FROM` | From step 2. |
   | `OPENWEATHER_API_KEY` | Same as in `backend/.env`. |
   | `GCASH_ACCOUNT_NAME`, `GCASH_ACCOUNT_NUMBER` | The tourism office's account, or leave them blank to show the placeholders. |

   **`trailsync-web`**

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://trailsync-api.onrender.com`: the API's real URL, with no trailing slash. |
   | `VITE_FIREBASE_*`, `VITE_GOOGLE_MAPS_API_KEY` | Same as in `frontend/.env`. |

3. Click **Apply**. The first API build takes a few minutes.
4. Open `https://<api>.onrender.com/health`. It should show `{"status":"ok"}`.
5. If you changed a URL after the first deploy, redeploy the affected service:
   - `VITE_*` values are baked in at build time, so a change needs a new **web** build.
   - A changed `CORS_ORIGIN` needs an **API** restart.

## 4. Firebase and Google Maps

- **Firebase Console → Authentication → Settings → Authorized domains**: add `trailsync-web.onrender.com`. Without it, login fails on the live site.
- **Google Cloud Console → APIs & Services → Credentials**: if the Maps JavaScript key is restricted by HTTP referrer, add `https://trailsync-web.onrender.com/*`.

## 5. Coordinator account

1. Register normally on the live site.
2. From your machine, promote the account against the Neon database:

```bash
cd backend
DATABASE_URL="<neon string>" npm run set-role -- coordinator@example.com COORDINATOR
```

Guides apply in the guide app, and the coordinator approves them on the web.

## 6. Guide app (APK for the client)

In `TrailSync-Mountain-Trek-Guide-Application`:

1. Set `.env` for production. It is bundled into the APK.

   ```
   FIREBASE_API_KEY=<same as VITE_FIREBASE_API_KEY>
   API_BASE_URL=https://trailsync-api.onrender.com
   START_ON_MAP=false
   FAKE_LOCATION=false
   DEV_GUIDE_NAME=
   ```

   `FAKE_LOCATION` and `START_ON_MAP` must be `false`, or guides skip login or upload fake positions.
2. Check that `android/local.properties` has `MAPS_API_KEY=…`. If the key is restricted to Android apps, its package name must be `com.example.mountrain_trek_guide_application`.
3. Build the APK: `flutter build apk --release`.
4. Send `build/app/outputs/flutter-apk/app-release.apk`. The client installs it with "Install unknown apps" allowed.

The APK is signed with the debug key. That is fine for sideloading, but the Play Store would need a real signing key.

## 7. Keep the API awake

A free Render service sleeps after 15 minutes without requests, and the next request then waits about 30–60 seconds.

To keep it awake, create a free monitor at uptimerobot.com (or cron-job.org):
- Type HTTP(s), URL `https://<api>.onrender.com/health`, every 5–10 minutes.

One service running all month uses about 730 of Render's 750 free hours, so keep only this one service awake. The static site does not count toward those hours.

## Checking a deploy

1. A new hiker signs up, and the 6-digit code arrives by email.
2. The hiker books a trail and uploads a GCash screenshot.
3. In Render, run **Manual Deploy → Deploy latest commit** on the API. The coordinator can still open the screenshot afterward.
4. The coordinator confirms the booking. Check-in assigns a guide, and the guide sees the hike in the APK on mobile data.
5. The guide's live location shows on the coordinator's live-treks map.
6. The guide completes the trek, and hikers get the certificate email.

## Limits to tell the client

- The Neon free plan has 0.5 GB of storage. Receipt screenshots take up most of it, at roughly 0.2–1 MB each, so that is about 500+ bookings.
- Neon keeps 6 hours of history for restores on the free plan. Export a backup now and then with `pg_dump "<neon string>" > backup.sql`.
- Brevo's free plan sends 300 emails a day.
- Logs are in Render → `trailsync-api` → **Logs**.
