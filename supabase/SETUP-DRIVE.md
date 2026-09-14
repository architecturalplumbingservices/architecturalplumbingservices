# Shared Google Drive Setup — APS Architectural Performance Coatings

This makes **all quotes shared between everyone who uses the app**, and it
keeps the Google credentials **off the website** so they can never be stolen
from the public page.

You do the account steps (they need your logins). The code is already written.

---

## Why it has to work this way

The app is a static site on GitHub Pages. Two hard facts force this design:

1. **A web page cannot keep a secret.** Anything placed in `app.js` is
   readable by every visitor. A Google client secret there would be public
   within hours.
2. **Google only lets a browser see files that browser created.** So if
   Person A saves a quote from their own Google login, Person B's login
   literally cannot see it — Google blocks it, not the app.

The fix is to have **one Google account that belongs to the company** (a
"service account") own the Drive folder, with a small server holding its key.
Everyone's browser talks to that server, so everyone sees the same quotes.

---

## Before you start — rotate the leaked credentials

These were pasted into a chat and must be treated as compromised:

- [ ] **Change the Google password** for `architecturalplumbingservices@gmail.com`
- [ ] **Reset the OAuth client secret** in Cloud Console → APIs & Services → Credentials
- [ ] **Regenerate GitHub recovery codes** (old ones moved to `D:\GitHub\_secrets-APS\`)

Do this first, otherwise you are configuring a system around a leaked key.

---

## Step 1 — Create a service account

1. Go to <https://console.cloud.google.com/> and pick the project
   **Architecturalplumbingservices** (ID `architecturalplumbingservices`).
2. Left menu → **APIs & Services** → **Library**.
3. Search **Google Drive API** → **Enable**.
4. Left menu → **IAM & Admin** → **Service Accounts** → **Create service account**.
   - Name: `aps-drive-sync`
   - Click **Create and continue**, then **Done**. (No roles needed — Drive
     access is granted by sharing the folder, not by IAM.)
5. Click the new service account → **Keys** tab → **Add key** →
   **Create new key** → **JSON** → **Create**.
6. A `.json` file downloads. **Keep it safe — it is a password.**
7. Open it and note two values:
   - `client_email` → looks like `aps-drive-sync@architecturalplumbingservices.iam.gserviceaccount.com`
   - `private_key` → the long `-----BEGIN PRIVATE KEY-----` block

---

## Step 2 — Create the shared Drive folder

1. Sign in to Drive as **`architecturalplumbingservices@gmail.com`**.
2. Create a folder, e.g. **`APS Shared Quotes`**.
3. **Right-click → Share** and add the service account's `client_email`
   from Step 1.7 as **Editor**. Untick "notify people" — it is a robot.
4. Open the folder and copy the **folder ID** from the URL:

   `https://drive.google.com/drive/folders/`**`THIS_LONG_ID`**

---

## Step 3 — Create the backend

The backend is a **Supabase Edge Function** (free tier is plenty).

1. Go to <https://supabase.com> and create an account / project.
   - Use a **company** email, not a personal one — this account will own
     the quoting data long-term.
   - Region: **eu-central-1** (closest to South Africa).
2. Install the Supabase CLI, then in this folder:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy drive --no-verify-jwt
   ```

   `--no-verify-jwt` is required: staff using the app have no Supabase
   login, so the function must not demand one.

---

## Step 4 — Give the function the three secrets

Still in this folder:

```bash
supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL="aps-drive-sync@architecturalplumbingservices.iam.gserviceaccount.com"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
supabase secrets set GOOGLE_DRIVE_FOLDER_ID="the-folder-id-from-step-2"
```

Notes:

- For the key, copy the whole `private_key` value **including** the
  `\n` sequences. Easiest: paste it from the JSON file as a single line.
- **Never** put these in `config.js`, `app.js`, or any file in this repo.
- The function may need redeploying after setting secrets for them to apply.

---

## Step 5 — Point the app at the function

1. Your function URL is:

   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/drive`

2. Open **`config.js`** in this repo and paste it in:

   ```js
   window.SS_DRIVE_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/drive";
   ```

3. Commit and push. GitHub Pages redeploys automatically.

`config.js` holds **only a URL** — it is safe to be public.

---

## Step 6 — Check it works

1. Open <https://belshie1.github.io/aps/>
2. Go to **Saved quotes**.
3. The **Share to Drive** and **Sync from Drive** buttons now appear.
4. Save a quote → it should say *"Shared to Drive"*.
5. Open the app on a **different phone or browser** → **Sync from Drive** →
   the quote appears. **That is the multi-user sharing working.**

If the buttons do not appear, the function URL is wrong or the secrets are
not set. The status line under the buttons says which.

---

## How the code is organised

| File | Role |
|------|------|
| `supabase/functions/drive/index.ts` | The backend. Holds the key, talks to Drive. |
| `config.js` | The function URL. No secrets. |
| `app.js` → `SHARED DRIVE SYNC` section | Calls the backend. |

Quotes are stored **one file per quote** in the shared folder, not one big
file. This matters: with a single file, two people saving at the same moment
would silently overwrite each other. Per-quote files cannot collide, and
`loadQuotesFromDrive()` merges by quote id so nobody's work is lost.

---

## If you want to skip all of this

There is a much simpler alternative that needs no Google Cloud, no service
account and no backend: **use Supabase as the store instead of Drive**. The
service already exists, it is designed for exactly this, and AGA uses it
already. Drive is file storage; Supabase is a shared database. Say the word
and I will build that version instead.
