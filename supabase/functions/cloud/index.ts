/* =========================================================
   APS QUOTE CALCULATOR — CLOUD BACKEND
   ---------------------------------------------------------
   A single small function that the app calls to read and write
   quotes, company settings and the price list.

   WHY THIS EXISTS AT ALL
   The app could talk to Supabase directly from the browser —
   supabase-js does exactly that. It goes through this function
   for two reasons:

   1. One place to enforce that a request is from real staff. The
      service key never reaches the browser; the browser only ever
      holds a user access token.

   2. It is the seam where a future change (audit logging, a
      nightly email of the day's quotes, moving photos to Storage)
      can be added without touching the quoting screen.

   SECURITY MODEL
   - SUPABASE_URL / SUPABASE_ANON_KEY are injected by the platform.
   - We verify the caller's JWT with the anon key, then pass that
     same JWT through to the database. Row-level security in
     schema.sql does the actual authorisation, so this function
     cannot forget to apply it.
   - There is no service-role key here on purpose. If this
     function is ever compromised it can do nothing a signed-in
     staff member could not already do.
   ========================================================= */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

/* ---------------------------------------------------------
   CORS — only the real site and local development may call in.
   --------------------------------------------------------- */
const ALLOWED_ORIGINS = [
  "https://belshie1.github.io",
  "http://localhost:8123",
  "http://localhost:3000",
  "http://127.0.0.1:8123",
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(
  payload: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/* ---------------------------------------------------------
   Pull only the fields we trust out of a quote.
   ---------------------------------------------------------
   The browser sends a whole quote object. Rather than storing it
   blindly, the fields the database indexes are lifted out here so
   a malformed client cannot write a row that breaks the Saved
   quotes list.
   --------------------------------------------------------- */
function quoteColumns(body: Record<string, unknown>) {
  const customer = (body.customer || {}) as Record<string, unknown>;
  const rawDate = body.date ?? body.createdAt;
  const parsed = rawDate ? Date.parse(String(rawDate)) : NaN;

  return {
    customer_name: String(customer.name ?? "").slice(0, 200) || null,
    quote_date: Number.isFinite(parsed) ? new Date(parsed).toISOString() : null,
  };
}

function quoteId(body: Record<string, unknown>): string {
  return String(body.id ?? "").trim().slice(0, 120);
}

/* ---------------------------------------------------------
   Handlers
   --------------------------------------------------------- */
async function listQuotes(
  supabase: ReturnType<typeof createClient>,
  origin: string | null,
): Promise<Response> {
  /*
     The list screen only needs the summary columns and a little of
     the body, not every quote's full payload. `body` is selected in
     full anyway because the app renders totals and material counts
     from it — but this is the query to narrow first if a site
     accumulates thousands of quotes.
  */
  const { data, error } = await supabase
    .from("quotes")
    .select("id, body, customer_name, quote_date, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) return json({ error: error.message }, 500, origin);
  return json({ quotes: data ?? [], count: data?.length ?? 0 }, 200, origin);
}

async function saveQuote(
  supabase: ReturnType<typeof createClient>,
  request: Request,
  origin: string | null,
  userId: string | null,
): Promise<Response> {
  let incoming: Record<string, unknown>;
  try {
    incoming = await request.json();
  } catch {
    return json({ error: "Expected a JSON quote body." }, 400, origin);
  }

  const id = quoteId(incoming);
  if (!id) return json({ error: "A quote must have an id." }, 400, origin);

  const row = {
    id,
    body: incoming,
    ...quoteColumns(incoming),
    created_by: userId,
  };

  /*
     Upsert rather than insert-or-update. Two phones saving the same
     quote number no longer race: the database settles it on the
     primary key in one statement.
  */
  const { error } = await supabase
    .from("quotes")
    .upsert(row, { onConflict: "id" });

  if (error) return json({ error: error.message }, 500, origin);
  return json({ ok: true, id }, 200, origin);
}

async function deleteQuote(
  supabase: ReturnType<typeof createClient>,
  request: Request,
  origin: string | null,
): Promise<Response> {
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body with an id." }, 400, origin);
  }

  const id = String(body.id ?? "").trim();
  if (!id) return json({ error: "A quote id is required." }, 400, origin);

  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) return json({ error: error.message }, 500, origin);
  return json({ ok: true, id }, 200, origin);
}

/*
   Company settings and the price list are one shared row each. They
   are written wholesale because they are small and always edited as
   a unit — there is no meaningful way to merge half a price list.
*/
async function readSingleton(
  supabase: ReturnType<typeof createClient>,
  table: "company_settings" | "price_list",
  origin: string | null,
): Promise<Response> {
  const { data, error } = await supabase
    .from(table)
    .select("body, updated_at")
    .eq("id", "default")
    .maybeSingle();

  if (error) return json({ error: error.message }, 500, origin);
  return json(
    { body: data?.body ?? {}, updatedAt: data?.updated_at ?? null },
    200,
    origin,
  );
}

async function writeSingleton(
  supabase: ReturnType<typeof createClient>,
  table: "company_settings" | "price_list",
  request: Request,
  origin: string | null,
  userId: string | null,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected a JSON body." }, 400, origin);
  }

  const { error } = await supabase
    .from(table)
    .upsert(
      { id: "default", body, updated_by: userId },
      { onConflict: "id" },
    );

  if (error) return json({ error: error.message }, 500, origin);
  return json({ ok: true }, 200, origin);
}

/* ---------------------------------------------------------
   Entry point
   --------------------------------------------------------- */
Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !ANON_KEY) {
    return json(
      {
        error:
          "Cloud is not configured on the server: SUPABASE_URL and SUPABASE_ANON_KEY must be set.",
      },
      503,
      origin,
    );
  }

  /*
     Build the client with the CALLER's token, not the anon key.
     This is what makes row-level security apply to their request
     instead of to an anonymous one.
  */
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  if (token) {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data?.user) userId = data.user.id;
  }

  const action =
    new URL(request.url).searchParams.get("action") || "list";

  try {
    /* ---- is the cloud reachable and are we signed in? ---- */
    if (action === "status") {
      return json(
        { configured: true, signedIn: Boolean(userId) },
        200,
        origin,
      );
    }

    /*
       Everything past here needs a real staff login. Without it the
       anon key alone must not be able to read quotes, which is the
       whole point of moving off the Drive design.
    */
    if (!userId) {
      return json(
        { error: "Sign-in required.", code: "unauthenticated" },
        401,
        origin,
      );
    }

    switch (action) {
      case "list":
        if (request.method !== "GET") {
          return json({ error: "Use GET for list." }, 405, origin);
        }
        return await listQuotes(supabase, origin);

      case "save":
        if (request.method !== "POST") {
          return json({ error: "Use POST for save." }, 405, origin);
        }
        return await saveQuote(supabase, request, origin, userId);

      case "delete":
        if (request.method !== "POST") {
          return json({ error: "Use POST for delete." }, 405, origin);
        }
        return await deleteQuote(supabase, request, origin);

      case "settings":
        if (request.method === "GET") {
          return await readSingleton(supabase, "company_settings", origin);
        }
        return await writeSingleton(
          supabase,
          "company_settings",
          request,
          origin,
          userId,
        );

      case "price-list":
        if (request.method === "GET") {
          return await readSingleton(supabase, "price_list", origin);
        }
        return await writeSingleton(
          supabase,
          "price_list",
          request,
          origin,
          userId,
        );

      default:
        return json({ error: `Unknown action: ${action}` }, 404, origin);
    }
  } catch (error) {
    console.error("Cloud function error:", error);
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      500,
      origin,
    );
  }
});
