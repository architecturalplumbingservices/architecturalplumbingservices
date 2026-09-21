# Cloud Setup — APS Quote Calculator

This turns the app from **saved on each phone** into **shared between
everyone**. Quotes, company details and the price list all live in one
Supabase project, so a quote taken on one phone appears on the
office laptop.

You do the account steps (they need your logins). The code is written.

---

## What you need to know before starting

**The app keeps working without any of this.** Until both values in
`config.js` are filled in, the app behaves exactly as it does today:
quotes are saved on the device and the cloud buttons stay hidden. So
you can do this setup at your own pace without breaking the tool.

**Somebody has to be online to sync, but nobody has to be online to
work.** Saving a quote always writes to the device first. If there is
no signal the quote is queued and pushed the next time sync succeeds.
A technician in a basement can keep quoting.

**Every quote now needs a login to reach.** That is the point of this
change, but it means: if you skip Step 4, nobody can see anybody's
quotes, including their own. Do not skip Step 4.

---

## Before you start — deal with the leaked credentials

The Google Setup doc recorded that these were pasted into a chat and
must be treated as compromised:

- [ ] **Change the Google password** for
      `architecturalplumbingservices@gmail.com`
- [ ] **Reset the OAuth client secret** in Cloud Console →
      APIs & Services → Credentials
- [ ] **Regenerate GitHub recovery codes**

Both files have now been moved out of the repository to
`D:\GitHub\_secrets-APS\`. They were never committed to git, but the
Pages workflow publishes every file in the folder, so they had been
served publicly at `belshie1.github.io/aps/`. **Rotate them anyway** —
moving a leaked credential does not un-leak it.

A guard has been added to `.github/workflows/deploy.yml` that fails the
build if a credential file ever appears in the publish folder again.

---

## Step 1 — Create the Supabase project

1. Go to <https://supabase.com> and create an account / project.
   - Use a **company** email, not a personal one. This account will
     own the quoting data long-term.
   - Region: **eu-central-1** (closest to South Africa).
2. Wait for the project to finish provisioning.

---

## Step 2 — Create the database

1. In the dashboard, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` from this repo.
3. Click **Run**.

This creates three tables (`quotes`, `company_settings`,
`price_list`), switches on row-level security, and seeds the shared
price list with the rates the app already ships with.

The final statement prints a small table. **Check that all three rows
show `rls_enabled = true`.** If any says `false`, re-run the file — the
app trusts these policies for its security.

---

## Step 3 — Deploy the backend function

Install the Supabase CLI, then from this folder:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy cloud
```

Deliberately **without** `--no-verify-jwt`. The function must reject
requests that are not from a signed-in user; that flag would hand your
quote history to anyone who knows the URL, which is the flaw in the
old Drive design.

---

## Step 4 — Create the staff logins

**This is the step that makes quotes private.** Each person who uses
the app needs an account.

1. In the dashboard, open **Authentication** → **Users**.
2. Click **Add user** → **Create new user**.
3. Enter their email and a password. Tick **Auto Confirm User** so
   they can sign in immediately without an email round-trip.
4. Repeat for each person who quotes.

### Turn off public sign-ups

By default anyone can register an account on your project, and any
account can read every quote. **Close that:**

1. **Authentication** → **Sign In / Providers** (or **Settings**).
2. Turn **off** "Allow new users to sign up".

With sign-ups off, only accounts you create in Step 4 can get in.

### A note on the auth emails

Supabase's built-in email service is rate-limited and not meant for
production. You do not need it for this app — you create the accounts
by hand and hand out the passwords. If you later add password-reset,
configure a real SMTP provider.

---

## Step 5 — Point the app at the cloud

In the dashboard: **Project Settings** → **API**. You need two values.

1. **Project URL** — looks like `https://abcdefghijklm.supabase.co`
2. **anon / public** key — the long `eyJ...` string labelled
   *public*.

Open `config.js` in this repo and fill in both:

```js
window.APS_CLOUD_FUNCTION_URL = "https://YOUR_PROJECT_REF.supabase.co/functions/v1/cloud";
window.APS_SUPABASE_ANON_KEY   = "eyJ...your anon key...";
```

> ### Read this before pasting the key
>
> `config.js` is served to every visitor. It is safe to put the
> **anon** key there — it identifies the project, it does not grant
> access, and every request it makes is still checked against the
> signed-in user.
>
> **Never paste the `service_role` key, or anything starting
> `sb_secret_`.** Those bypass every security rule in `schema.sql` and
> would hand your entire quote history to anyone who opens View
> Source.
>
> If you are unsure which key you have: the anon key is labelled
> **anon** / **public** in the dashboard. When in doubt, stop and ask.

Then commit and push. GitHub Pages redeploys automatically.

---

## Step 6 — Check it works

1. Open <https://architecturalplumbingservices.github.io/architecturalplumbingservices/>
2. Go to **Saved quotes**. You should see **Sign in to cloud**.
3. Click it, sign in with an account from Step 4.
4. The buttons change to **Sync now** / **Upload this device's
   quotes** / **Sign out**, and the status line reads *Signed in as...*
5. Save a quote → it should say *Quote synced to cloud*.
6. **Open the app on a different phone**, sign in, click **Sync now** →
   the quote appears. **That is the sharing working.**

### The two tests worth actually doing

**Offline test.** Turn off wifi on the phone, save a quote. It must
still save and still appear under Saved quotes, with a plain message
that it will sync later. Turn wifi back on, click **Sync now** — the
quote should upload.

**Second-person test.** Sign in as a *different* account on a second
device and confirm you can see the first person's quote. If you cannot,
Step 4 or the sign-up setting is wrong — check that you are really
signed in, not falling back to local-only.

---

## What is stored where

| What | Where |
|------|-------|
| Staff passwords | Supabase Authentication. Never in this repo. |
| The anon key (public) | `config.js` — safe to publish |
| Quotes, settings, price list | Supabase `public` schema tables |
| A signed-in session token | The device's `localStorage`, under `pipewise-session` |
| Unsent quotes | The device's `localStorage`, under `pipewise-outbox` |

There are **no service keys, no Google credentials and no secrets**
anywhere in this repository.

---

## How the code is organised

| File | Role |
|------|------|
| `supabase/schema.sql` | Tables, row-level security, seed data |
| `supabase/functions/cloud/index.ts` | The backend the app calls |
| `config.js` | Function URL + anon key. No secrets. |
| `app.js` → `CLOUD SYNC` section | Sign-in, push, pull, outbox |
| `app.js` → `CLOUD SYNC` › Push/Pull | The sync logic itself |

### Why one row per quote, not one big document

With a single shared document, two people saving at the same moment
would overwrite each other silently. One row per quote means
concurrent saves touch different rows. The database settles who wins
by primary key, and `updated_at` is stamped **by the server**, so a
phone with a wrong clock cannot claim its copy is the newest.

### Why there is an outbox

A sync that only works when the network is up is a sync that loses
work. Every save is written locally first and queued if it cannot be
sent. The outbox holds only quotes this device created — we never
replay somebody else's edits, which is how sync bugs turn into
mysterious data loss.

---

## If something goes wrong

**"Cloud is not set up yet"** — `config.js` is empty or has a typo.
Check both values are filled in, then hard-reload the page.

**"Sign-in required" / session expired** — normal after a long break.
Sign in again.

**Signed in but quotes do not appear on the other phone** — you are
probably signed in on one device and not the other. The status line
under the buttons tells you which state each device is in.

**"New users cannot sign up" when creating an account** — that is the
setting from Step 4 doing its job. Create the account from the
dashboard instead.

**A quote saved offline never uploads** — check the device is signed in
*and* online, then press **Sync now**. The outbox is only flushed by a
signed-in sync.
