# Deploying to Render

## Prerequisites
- A [Render](https://render.com) account (free tier is fine)
- That's it — no database needed. All contact data lives in Keap.

---

## Step 1 — Export code to GitHub

In the Manus Management UI:
1. Click **More (⋯)** in the top-right header
2. Select **GitHub**
3. Choose your GitHub account and enter a repo name (e.g. `busdev-keap-notes`)
4. Click **Export** — Manus pushes the full codebase to a new private repo

---

## Step 2 — Deploy on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub account and select the `busdev-keap-notes` repo
3. Render will auto-detect `render.yaml` — confirm the settings:
   - **Build Command:** `pnpm install && pnpm run build`
   - **Start Command:** `pnpm run start`
   - **Plan:** Free
4. Click **Create Web Service**

---

## Step 3 — Set environment variables in Render

In the Render dashboard → your service → **Environment**, add **one** variable:

| Key | Value |
|---|---|
| `KEAP_ACCESS_TOKEN` | `KeapAK-c701c24d9d32c7cda7a0ee813664be362486c722444792f097` |

All other variables are pre-set in `render.yaml`. No database setup needed.

---

## Done

Your app will be live at `https://busdev-keap-notes.onrender.com` (or similar).

> **Note:** On Render's free tier, the service spins down after 15 minutes of inactivity.
> The first request after sleep takes 30–60 seconds to wake up. This is normal for free hosting.
