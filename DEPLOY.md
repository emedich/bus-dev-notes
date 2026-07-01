# Deploying to Render

## Prerequisites
- A [Render](https://render.com) account (free tier is fine)
- A MySQL database — use [PlanetScale](https://planetscale.com) (free) or [Railway](https://railway.app) MySQL add-on

---

## Step 1 — Export code to GitHub

In the Manus Management UI:
1. Click **More (⋯)** in the top-right header
2. Select **GitHub**
3. Choose your GitHub account and enter a repo name (e.g. `busdev-keap-notes`)
4. Click **Export** — Manus pushes the full codebase to a new private repo

---

## Step 2 — Create a MySQL database

**Option A: PlanetScale (recommended free tier)**
1. Go to [planetscale.com](https://planetscale.com) and sign up
2. Create a new database (e.g. `busdev-keap`)
3. Click **Connect** → choose **Node.js** → copy the connection string
4. It looks like: `mysql://user:pass@host/dbname?ssl={"rejectUnauthorized":true}`

**Option B: Railway MySQL**
1. Go to [railway.app](https://railway.app), create a project
2. Add a MySQL service
3. Copy the `DATABASE_URL` from the Variables tab

---

## Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub account and select the `busdev-keap-notes` repo
3. Render will auto-detect `render.yaml` — confirm the settings:
   - **Build Command:** `pnpm install && pnpm run build`
   - **Start Command:** `pnpm run start`
   - **Plan:** Free
4. Click **Create Web Service**

---

## Step 4 — Set environment variables in Render

In the Render dashboard → your service → **Environment**, add:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your MySQL connection string from Step 2 |
| `KEAP_ACCESS_TOKEN` | `KeapAK-c701c24d9d32c7cda7a0ee813664be362486c722444792f097` |

All other variables are pre-set in `render.yaml`.

---

## Step 5 — Run database migrations

After the first deploy, open the Render **Shell** tab and run:

```bash
pnpm run db:push
```

This creates the `users` table in your MySQL database.

---

## Done

Your app will be live at `https://busdev-keap-notes.onrender.com` (or similar).

> **Note:** On Render's free tier, the service spins down after 15 minutes of inactivity.
> The first request after sleep takes 30–60 seconds to wake up. This is normal for free hosting.
