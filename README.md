# WEB-app Scraper by Majner 21.6.2026



# SkillScraper — Complete Deployment Guide

## Project Structure

```
skillscraper/
├── index.html              # Frontend HTML (SPA)
├── style.css               # Dark theme styles
├── script.js               # App logic (Supabase client)
├── supabase-schema.sql     # Run this in Supabase SQL Editor
├── supabase/
│   ├── config.toml         # Supabase project config
│   └── functions/
│       └── scrape-and-extract/
│           └── index.ts    # Edge Function (scraping + LLM)
└── GUIDE.md                # This file
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
5. Verify all tables were created:
   - Go to **Table Editor** → you should see `profiles`, `invite_codes`, `learned_skills`.
   - Go to **Database → Triggers** → you should see `tr_check_invite_code_before_signup` and `tr_handle_new_user`.

---

## Step 3: Get Your API Keys

1. In Supabase dashboard, go to **Project Settings → API**.
2. Copy:
   - **Project URL** (`https://xxxxxxxxxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
3. Also copy the **service_role key** (for the Edge Function).

---

## Step 4: Configure the Frontend

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

> **IMPORTANT:** This is safe. The anon key is designed to be public and is restricted by your Row Level Security (RLS) policies. Never use the `service_role` key in frontend code.

---

## Step 5: Deploy the Edge Function

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

3. Deploy the function:
   ```bash
   supabase functions deploy scrape-and-extract
   ```

### Option B: Deploy via Supabase Dashboard

1. Go to **Edge Functions** in your Supabase dashboard.
2. Click **Create a new Function**.
3. Name it `scrape-and-extract`.
4. Copy the contents of `supabase/functions/scrape-and-extract/index.ts` and paste.
5. Click **Deploy**.

### Configure Secrets

After deploying, set your Gemini API key:

```bash
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

Or in the dashboard: **Edge Functions → Secrets**.

> **Get a Gemini API key:** Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) → Create API Key. It's free.

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

## Step 7: Register the Admin

1. Open your deployed site.
2. Go to **Register** tab.
3. Enter:
   - **Email:** `admin@example.com` (or your email)
   - **Password:** choose a strong password
   - **Invite Code:** leave blank
4. Click **Register**.

   > **Why this works:** Since no user has registered yet (cold start), the database trigger allows the first signup without an invite code and automatically assigns the `admin` role.

5. You should see a success toast. Go to **Sign In** and log in.
6. Verify: Click **Admin Panel** in the nav. You should see the invite code generator.

---

## Step 8: Generate Invite Codes & Test the Flow

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
User enters URL → Frontend sends to Edge Function
                       ↓
Edge Function fetches HTML, strips tags
                       ↓
Sends cleaned text to Gemini API
                       ↓
LLM returns structured JSON array of skills
                       ↓
Skills inserted into `learned_skills` table (RLS enforced)
                       ↓
Frontend re-renders skills grid
```

**Invite-only flow:**

```
User registers with invite_code in metadata
                       ↓
BEFORE INSERT trigger on auth.users validates code
                       ↓
If invalid → transaction aborted with error
                       ↓
If valid → AFTER INSERT trigger:
  1. Creates profile row (admin if first user)
  2. Marks invite_code as 'used'
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Registration fails with "invite code required" even as first user | Delete the `profiles` table rows in Table Editor and try again. If you already have a row, manually change its role to `admin` in Table Editor. |
| Edge Function returns 401 | Make sure you're logged in when calling it. The function verifies the JWT. |
| Edge Function returns 500 | Check the function logs in Supabase Dashboard → Edge Functions → scrape-and-extract → Logs. Common issue: missing `GEMINI_API_KEY` secret. |
| CORS errors | The Edge Function includes CORS headers. If hosting frontend separately, ensure the URL is accessible. |
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
┌─────────────────────────────────────────────────────┐
│                   Browser (Frontend)                 │
│  index.html + style.css + script.js                  │
│  ┌─────────────────────────────────────────────┐    │
│  │  Supabase JS Client (anon key)               │    │
│  │  - auth.signUp / signInWithPassword          │    │
│  │  - functions.invoke('scrape-and-extract')    │    │
│  │  - from('learned_skills').select/insert      │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                 Supabase Backend                      │
│                                                       │
│  ┌─────────────┐  ┌──────────────────────┐           │
│  │  PostgreSQL  │  │  Edge Function        │           │
│  │              │  │  scrape-and-extract    │           │
│  │  profiles    │  │                       │           │
│  │  invite_codes│  │  1. Fetch URL HTML    │───► Web  │
│  │  learned_skills│ │  2. Strip tags       │           │
│  │              │  │  3. Call Gemini API   │───► AI   │
│  │  Triggers:   │  │  4. Insert skills DB  │           │
│  │  ✓ Invite    │  └──────────────────────┘           │
│  │    validation│                                      │
│  │  ✓ Profile   │                                      │
│  │    creation   │                                      │
│  │  ✓ RLS       │                                      │
│  └─────────────┘                                       │
└─────────────────────────────────────────────────────┘
```
