# Daymark Habit Tracker

Daymark is a responsive habit tracker and daily routine planner with a glassmorphism interface (light and dark themes). It is a React frontend backed by a Spring Boot API and MySQL, and everything you see is persisted. There is no sign-in yet: the app runs as a single local profile.

## Run locally

Prerequisites: a MySQL 8 server on `localhost:3306` with a `daymark` database (root/root by default), Docker Desktop, Node.js 20.19+ (or 22.12+), and npm. Java and Maven run inside the API container.

1. `.env` holds local settings (`.env.example` documents the keys).
2. Start the API (Flyway creates the tables in `daymark` on first start):

   ```powershell
   docker compose up --build -d
   ```

3. Install and start the frontend:

   ```powershell
   npm.cmd --prefix frontend install
   npm.cmd --prefix frontend run dev
   ```

4. Open <http://localhost:5173>. The API health check is at <http://localhost:8080/api/health>.

To stop the API, run `docker compose down`. Your data stays in the MySQL `daymark` database.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `MYSQL_HOST` | `host.docker.internal` | MySQL host as seen from the API container (your machine) |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_DATABASE` | `daymark` | Database name |
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | `root` | MySQL password (local development only) |
| `API_PORT` | `8080` | Host port for the API |

`docker-compose.yml` turns these into the Spring datasource settings. Flyway applies schema changes at API startup.

Never use the root account or the example password in a deployed environment. Production should use a dedicated least-privilege database account, managed secrets, and HTTPS.

## What works

- Today: date navigation, clickable week strip, progress ring, check habits on or off for any date up to today.
- Calendar: month grid with a completion ring per day, clickable dates, category filter, and a side panel with that day's habits and routine steps.
- Habits: create, edit, archive/restore and delete; icon, goal, repeat days and category.
- Two tracking types per habit: **Yes / No** (did I pray today?) or **Measurable** with a target and unit (3 of 4 km). Measurable habits get −/+ controls and a tap-to-type amount; reaching the target marks the day complete.
- History editing: from a habit's menu choose **History** to open a month grid where you can add, change or clear entries for any past day.
- Reminders: each habit can have up to 10 time-based reminders that repeat every day, on the habit's days, on custom weekdays or every N days. Upcoming reminders show in the bell menu; browser notifications fire when the app is open in a tab and permission is granted (Settings → Reminders).
- Categories: create your own (name and colour), rename, recolour and delete, including inline from the habit dialog.
- Routines: ordered steps with per-day completion, mark all done or reset, edit and delete. Steps can be linked to existing habits (habit menu → **Add to routine**, or pick a habit in the routine dialog); completing a linked step checks the habit in, and vice versa.
- Insights: weekly check-ins, 30-day completion rate, streaks, per-habit last-7-days history and category breakdown.
- Settings: name, light / dark / system mode, six colour themes (Aurora, Ocean, Sunset, Forest, Blossom, Graphite — also from the palette button in the header), categories, time zone (follows the browser).

Not implemented yet: sign-in and accounts, Razorpay subscriptions, reminders while the app is closed (needs push/service worker), and production deployment.

## Verifying the API

With the API running:

```powershell
node scripts/smoke-api.mjs
```

The smoke test creates and removes its own data. The API Docker build also runs the Maven unit tests; rebuild after backend changes with `docker compose build api`.
