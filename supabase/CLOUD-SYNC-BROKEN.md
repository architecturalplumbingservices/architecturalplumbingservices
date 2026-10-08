# Cloud sync is broken in production — the deployed function serves another company

Found while verifying unrelated UI changes. **This is the most serious issue
in the repo's history, and it is not a code bug in this repo — it is a
deployment mismatch.**

## What was observed

A plain HTTP request to the deployed function:

```
GET https://mvymxqajdiupucrkeqpg.supabase.co/functions/v1/cloud?action=status
  apikey: <the sb_publishable_ key in config.js>
  Origin: <whatever we ask for>
```

Returns, for **every** origin asked:

| Origin sent | `Access-Control-Allow-Origin` returned |
| --- | --- |
| `https://architecturalplumbingservices.github.io` | `https://architecturalglassandaluminium-crypto.github.io` |
| `https://architecturalglassandaluminium-crypto.github.io` | `https://architecturalglassandaluminium-crypto.github.io` |
| `http://localhost:8123` | `https://architecturalglassandaluminium-crypto.github.io` |

The header is a **constant**. It does not vary with the request.

## Why that breaks APS

Browsers enforce CORS by comparing the response's
`Access-Control-Allow-Origin` with the page's own origin. The APS app is
served from `https://architecturalplumbingservices.github.io`, and the
function answers with the AGA origin, so **the browser blocks every
response**.

Consequences for a user of the live site:

- `initCloud()` fails its `status` call and lands in the catch, so the app
  reports the cloud as unreachable/not set up.
- Sign-in cannot complete.
- Saving a quote writes to `localStorage`, fails to reach the cloud, and
  enters the outbox. The outbox is only flushed by a signed-in sync, so
  **those quotes never leave the device.**

The app still works offline — that part of the design holds — but the
"shared between everyone" feature does not work at all in production.

## The deployed function is not this repo's code

`supabase/functions/cloud/index.ts` here does this:

```ts
const ALLOWED_ORIGINS = [
  "https://architecturalplumbingservices.github.io",
  "http://localhost:8123",
  "http://localhost:3000",
  "http://127.0.0.1:8123",
];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return { "Access-Control-Allow-Origin": allowed, ... };
}
```

That **echoes the caller's origin** when it is in the list — so a request
from the APS origin would return the APS origin, and a request from an
unknown origin would return an empty string. The live function does neither.
The two are different programs.

The most plausible reading: the function deployed at
`mvymxqajdiupucrkeqpg` belongs to the AGA project, and the AGA app was
deployed there. Either:

1. the APS `cloud` function was never deployed to this project, or
2. it was deployed and later overwritten by the AGA version.

The local branch `backup-aga-contamination` (currently 19 commits behind
`origin/main`) suggests this collision has been noticed before in some form.

## What to check, in order

1. **Confirm whose project this is.** Open the Supabase dashboard for
   `mvymxqajdiupucrkeqpg`: does it contain the APS tables (`quotes`,
   `company_settings`, `price_list`), and whose account owns it?
2. **Inspect the deployed source.** `supabase functions download cloud`, or
   read it in the dashboard. It should match this repo's `index.ts`.
3. **Decide the topology.** Either:
   - a **separate Supabase project** for APS with its own function and keys
     (the keys in `config.js` would change), or
   - **one shared project** where the function's `ALLOWED_ORIGINS` includes
     every trade's site and echoes the caller — which is what this repo's
     `index.ts` already does.
4. **Redeploy** this repo's function after either change.

## Small caveat on the deploy command

`supabase/SETUP-CLOUD.md` says:

```bash
supabase functions deploy cloud
```

Deliberately without `--no-verify-jwt`. That is right for security, but note
that newer Supabase setups serve Edge Functions with platform JWT
verification, which needs the *legacy* JWT-based keys. This project's
`config.js` now holds an `sb_publishable_...` key rather than an `eyJ...`
anon key, so confirm that a signed-in request actually passes verification
after redeploying. If it does not, that flag (or the key type) is the reason.

## Also fixed in the same pass

- Sign-out had no UI entry point after the header button was removed; it now
  lives inside the cloud dialog and is shown only when signed in.
- The `&trade=aps` query parameter was removed: the edge function never
  reads it, and nothing else does.
- Stale comments corrected: `pullQuotes` no longer claims to report
  "Sign in first", and `pushSettingsAndPrices` is marked as never called.
