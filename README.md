# SkillScraper — Complete Deployment Guide

## Project Structure

```
skillscraper/
├── index.html                       # Frontend HTML (SPA)
├── style.css                        # Dark theme styles
├── script.js                        # App logic (Supabase client)
├── supabase-schema.sql              # Run this in Supabase SQL Editor
├── supabase/
│   ├── config.toml                  # Supabase project config
│   └── functions/
│       └── scrape-and-extract/
│           └── index.ts             # Edge Function (scraping + LLM)
└── GUIDE.md                         # This file
```

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Fill in:
   - **Name:** `skillscraper`
   - **Database Password:** Generate a strong password and **save it**.
   - **Region:** Choose the closest one to you.
4. Wait ~2 minutes for the project to provision.

---

## Step 2: Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor**.
2. Click **New Query**.
3. Open `supabase-schema.sql` from this repo and **copy the entire contents**.
4. Paste into the SQL Editor and click **Run**.
5. Verify everything was created:
   - Go to **Table Editor** → you should see `profiles`, `invite_codes`, `learned_skills`.
   - Go to **Database → Functions** → search for `check_invite_code` and `finalize_registration`.

---

## Step 3: Disable Email Confirmation

Registration uses `auth.signUp()` directly. Supabase sends a confirmation email by default — we need to disable this.

1. In your Supabase dashboard, go to **Authentication → Settings**.
2. Under **Email Auth**, disable **Confirm email** (toggle off).
3. Click **Save**.

---

## Step 4: Create the Admin Account (Manually)

Since there's no automated cold-start trigger, create the first admin directly in the Dashboard:

1. In your Supabase dashboard, go to **Authentication → Users**.
2. Click **Add User**.
3. Enter:
   - **Email:** `admin@example.com` (or your email)
   - **Password:** choose a strong password
   - **Email confirmed:** toggle ON
4. Click **Create user**.
5. Copy the new user's **UUID** (from the table row).
6. Go to **SQL Editor** and run:
   ```sql
   INSERT INTO public.profiles (id, email, role)
   VALUES ('paste-user-uuid-here', 'admin@example.com', 'admin');
   ```
7. Verify: **Table Editor → profiles** → you should see one row with `role = admin`.

---

## Step 5: Get Your API Keys

1. In Supabase dashboard, go to **Project Settings → API**.
2. Copy:
   - **Project URL** (`https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

---

## Step 6: Configure the Frontend

1. Open `script.js`.
2. Find these two lines at the top:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

3. Replace with your actual values:

```javascript
const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

---

## Step 7: Deploy the Extract Edge Function

Only one Edge Function is needed: `scrape-and-extract` (for URL scraping + LLM extraction). Registration is handled entirely by the database + frontend.

### Option A: Deploy via Supabase CLI (recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```
   Or download from [supabase.com/docs/guides/cli](https://supabase.com/docs/guides/cli).

2. Link your project:
   ```bash
   cd skillscraper
   supabase login
   supabase link --project-ref your-project-ref
   ```
   Your project ref is the subdomain in your Supabase URL (the `xxxxxxxxxxxx` part).

3. Deploy:
   ```bash
   supabase functions deploy scrape-and-extract
   ```

### Option B: Deploy via Supabase Dashboard

1. Go to **Edge Functions** → **Create a new Function**.
2. Name it `scrape-and-extract`.
3. Copy the contents of `supabase/functions/scrape-and-extract/index.ts` → paste → **Deploy**.

### Set the Gemini API Secret

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

Or in the Dashboard: **Edge Functions → Secrets** → Add `GEMINI_API_KEY`.

> **Get a Gemini API key:** Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → Create API Key. It's free.

---

## Step 8: Host the Frontend

---

## Step 6: Host the Frontend

### Option A: Supabase Storage (simplest)

1. Go to **Storage** in your Supabase dashboard.
2. Create a new bucket called `site` (make it public).
3. Upload `index.html`, `style.css`, and `script.js`.
4. Go to the bucket → find `index.html` → click **Get URL** (or copy the public URL).
5. Your site is live at: `https://xxxxxxxxxxxx.supabase.co/storage/v1/object/public/site/index.html`

### Option B: Netlify (free + custom domain)

1. Push the repo to GitHub.
2. Go to [https://netlify.com](https://netlify.com) → **Add new site → Import from Git**.
3. Connect your repo.
4. Deploy settings: leave defaults (no build command needed).
5. Click **Deploy**.

### Option C: Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```
2. Deploy:
   ```bash
   vercel
   ```
3. Follow the prompts. Your static files will be deployed instantly.

---

## Step 9: Generate Invite Codes & Test the Flow

1. As admin, click **Generate Invite Code**.
2. Copy the generated code (e.g., `INV-A3B8F2`).
3. **Logout**.
4. Try to register with:
   - An invalid code → should fail with error.
   - No code → should fail with error.
   - The valid code → should succeed.

5. Log in as the new user.
6. Paste a URL (e.g., a course page, portfolio, job listing) and click **Extract Skills**.
7. Wait a few seconds. Skills should appear as cards.

---

## How It All Works

```
User enters URL → Frontend calls scrape-and-extract Edge Function
                       ↓
Edge Function fetches HTML, strips tags/nav/footer
                       ↓
Sends cleaned text to Gemini API
                       ↓
LLM returns structured JSON array of skills
                       ↓
Skills inserted into `learned_skills` table (RLS enforced)
                       ↓
Frontend re-renders skills grid (authentication-gated)
```

**Invite-only registration flow:**

```
User submits registration form
              ↓
Frontend calls check_invite_code RPC (validates code + detects first user)
              ↓
If invalid → shows error on form
              ↓
If valid → frontend calls auth.signUp() to create user
              ↓
Frontend calls finalize_registration RPC (creates profile, marks code used)
              ↓
User is logged in and dashboard appears
```

Registration is handled entirely by the frontend + database RPC functions. No Edge Functions needed for auth.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Registration says "Invalid invite code" | The code was typed wrong, already used, or revoked. Generate a new one as admin. |
| Registration says "User already registered" | That email is taken. Use a different email or delete the existing user in **Authentication → Users**. |
| After registration, blank page or not logged in | Email confirmation might be enabled. Check **Authentication → Settings → Confirm email** is OFF. |
| Admin doesn't see Admin Panel | The profile row is missing or has `role = 'user'`. Check **Table Editor → profiles** and update the role. |
| Edge Function returns 500 on scrape | Check logs in **Edge Functions → scrape-and-extract → Logs**. Common issue: missing `GEMINI_API_KEY` secret. |
| CORS errors on scrape | The Edge Function includes CORS headers. If hosting frontend separately, ensure the URL is accessible. |
| "Could not extract meaningful text" | Some sites are JS-rendered (React, Vue). Try a different URL. Static sites work best. |
| Skills not showing in dashboard | Check RLS policies are applied. The user must be authenticated to read `learned_skills`. |

---

## Customization Ideas

- **Change LLM provider:** Swap Gemini in the Edge Function for OpenAI (`gpt-4o-mini`), Claude, or any API.
- **Add skill categories:** Modify the LLM prompt to recognize custom categories.
- **Pagination:** Add load-more or infinite scroll for large skill collections.
- **Export:** Add a button to export skills as CSV or JSON.
- **Rescrape existing URLs:** Re-run extraction on a previously scraped URL.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Browser (Frontend)                     │
│   index.html + style.css + script.js                      │
│   ┌──────────────────────────────────────────────┐       │
│   │  Supabase JS Client (anon key)                │       │
│   │                                                 │       │
│   │  Registration:                                  │       │
│   │   1. rpc('check_invite_code') → validates code  │       │
│   │   2. auth.signUp() → creates auth user          │       │
│   │   3. rpc('finalize_registration') → profile     │       │
│   │                                                 │       │
│   │  Scraping:                                      │       │
│   │   invoke('scrape-and-extract') → Edge Function  │       │
│   │                                                 │       │
│   │  Data: from('learned_skills').select/delete     │       │
│   │  Admin: from('invite_codes').insert/select      │       │
│   └──────────────────────────────────────────────┘       │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Backend                       │
│                                                          │
│  ┌─────────────────┐  ┌────────────────────────────┐    │
│  │   PostgreSQL      │  │  Edge Function              │    │
│  │                   │  │  scrape-and-extract          │    │
│  │  Tables:          │  │                             │    │
│  │   profiles        │  │  1. Fetch URL HTML          │    │
│  │   invite_codes    │  │  2. Strip tags              │    │
│  │   learned_skills  │  │  3. Call Gemini API         │    │
│  │                   │  │  4. Insert skills into DB   │    │
│  │  RPC Functions:   │  └────────────────────────────┘    │
│  │   check_invite_code│                                   │
│  │   finalize_        │                                   │
│  │   registration    │                                   │
│  │                   │                                   │
│  │  RLS: ✓           │                                   │
│  └───────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```
