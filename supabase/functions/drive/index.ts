/* =========================================================
   SHADY SHAUN — SHARED GOOGLE DRIVE BACKEND
   ---------------------------------------------------------
   WHY THIS EXISTS
   A static site (GitHub Pages) cannot safely hold a Google
   OAuth client secret, and a browser-only app using Google's
   `drive.file` scope can only ever see the files IT created.
   That means one user can never read another user's quotes.

   So the Drive credentials live HERE, on the server, and every
   browser talks to this function instead of to Drive directly.
   The Drive folder is owned by a service account that the
   company controls, not by any individual employee's Google
   account. Everyone therefore sees the SAME quotes, which is
   what "accessible by multiple users" actually requires.

   WHAT IS STORED WHERE
   - The service-account JSON key        -> Supabase secret, never in this repo
   - The shared Drive folder ID           -> Supabase secret
   - The quotes themselves                -> one file per quote in that Drive folder

   WHY ONE FILE PER QUOTE
   The original app wrote every quote into a single
   `pipewise-quotes.json`. Two people saving at the same moment
   would overwrite each other's work with no warning. One file
   per quote means concurrent edits touch different files and
   cannot clobber one another. This is the same reasoning the
   AGA workshop app uses for its per-window revisions.
   ========================================================= */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/* ---------------------------------------------------------
   CORS
   The app runs on GitHub Pages and, during development, on
   localhost. Only these origins may call the function.
   --------------------------------------------------------- */
const ALLOWED_ORIGINS = [
  "https://belshie1.github.io",
  "http://localhost:8123",
  "http://localhost:3000",
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

/* ---------------------------------------------------------
   GOOGLE AUTH (service account -> Drive access token)
   ---------------------------------------------------------
   A service account can't just send its private key; it has to
   sign a JWT and exchange that for a short-lived access token.
   We cache the token until shortly before it expires so we are
   not re-signing on every single request.
   --------------------------------------------------------- */
let cachedToken: { value: string; expiresAt: number } | null = null;

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(
    /=+$/,
    "",
  );
}

/*
   The service-account private key is stored as a PEM string.
   WebCrypto needs it as DER/PKCS8, so the header/footer and
   line breaks are stripped and the remaining base64 decoded.
*/
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const der = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  /* Reuse a still-valid token (with a 60s safety margin). */
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }

  const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKeyPem = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

  if (!email || !privateKeyPem) {
    throw new Error(
      "Drive is not configured on the server: GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY must be set.",
    );
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))
    }`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );

  const assertion = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600),
  };
  return cachedToken.value;
}

/* ---------------------------------------------------------
   DRIVE HELPERS
   --------------------------------------------------------- */
async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Drive ${init.method || "GET"} ${path} failed (${response.status}): ${detail}`);
  }
  return response;
}

function folderId(): string {
  const id = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
  if (!id) {
    throw new Error("Drive is not configured on the server: GOOGLE_DRIVE_FOLDER_ID must be set.");
  }
  return id;
}

/*
   Quoting a value for a Drive `q=` query. Single quotes inside a
   filename would otherwise break out of the string literal and
   let a crafted quote number alter the query.
*/
function driveQueryEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/* ---------------------------------------------------------
   QUOTE FILES
   Each quote is `<id>.json` inside the shared folder.
   --------------------------------------------------------- */
async function listQuoteFiles(): Promise<Array<{ id: string; name: string }>> {
  const q = encodeURIComponent(
    `'${folderId()}' in parents and trashed=false and mimeType='application/json'`,
  );
  const response = await driveFetch(
    `/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1000`,
  );
  const data = await response.json();
  return data.files || [];
}

async function findQuoteFile(id: string): Promise<string | null> {
  const q = encodeURIComponent(
    `'${folderId()}' in parents and trashed=false and name='${driveQueryEscape(id)}.json'`,
  );
  const response = await driveFetch(
    `/drive/v3/files?q=${q}&fields=files(id,name)`,
  );
  const data = await response.json();
  return data.files && data.files.length ? data.files[0].id : null;
}

async function readQuoteFile(fileId: string): Promise<unknown> {
  const response = await driveFetch(`/drive/v3/files/${fileId}?alt=media`);
  return await response.json();
}

async function writeQuoteFile(
  quote: Record<string, unknown>,
): Promise<void> {
  const id = String(quote.id || "").trim();
  if (!id) throw new Error("A quote must have an id before it can be saved.");

  const existingId = await findQuoteFile(id);
  const boundary = `pipewise${Date.now()}`;
  const payload = JSON.stringify(
    { ...quote, updatedAt: new Date().toISOString() },
    null,
    2,
  );

  /*
     Multipart upload: metadata part, then the JSON body. Used
     for both create and update because it lets us set the parent
     folder on create without a second API call.
  */
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({
      name: `${id}.json`,
      mimeType: "application/json",
      ...(existingId ? {} : { parents: [folderId()] }),
    }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${payload}\r\n--${boundary}--`;

  const path = existingId
    ? `/upload/drive/v3/files/${existingId}?uploadType=multipart`
    : `/upload/drive/v3/files?uploadType=multipart&fields=id`;

  await driveFetch(path, {
    method: existingId ? "PATCH" : "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
}

async function deleteQuoteFile(id: string): Promise<boolean> {
  const fileId = await findQuoteFile(id);
  if (!fileId) return false;
  await driveFetch(`/drive/v3/files/${fileId}`, { method: "DELETE" });
  return true;
}

/* ---------------------------------------------------------
   ROUTES
   --------------------------------------------------------- */
async function handle(request: Request, origin: string | null): Promise<Response> {
  const headers = {
    ...corsHeaders(origin),
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "list";

    /* ---- is the server configured? (used by the UI) ---- */
    if (action === "status") {
      const configured = Boolean(
        Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") &&
        Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY") &&
        Deno.env.get("GOOGLE_DRIVE_FOLDER_ID"),
      );
      return new Response(
        JSON.stringify({ configured }),
        { status: 200, headers },
      );
    }

    if (!Deno.env.get("GOOGLE_DRIVE_FOLDER_ID")) {
      return new Response(
        JSON.stringify({
          error:
            "Shared Drive is not configured yet. Ask your administrator to finish the Drive setup.",
        }),
        { status: 503, headers },
      );
    }

    /* ---- list every quote in the shared folder ---- */
    if (action === "list" && request.method === "GET") {
      const files = await listQuoteFiles();
      const quotes = [];
      for (const file of files) {
        try {
          quotes.push(await readQuoteFile(file.id));
        } catch (error) {
          /*
             One unreadable file must not hide every other quote,
             so a failure is logged and skipped rather than thrown.
          */
          console.error(`Skipping unreadable quote file ${file.name}:`, error);
        }
      }
      return new Response(
        JSON.stringify({ quotes, count: quotes.length }),
        { status: 200, headers },
      );
    }

    /* ---- save one quote ---- */
    if (action === "save" && request.method === "POST") {
      const quote = await request.json();
      await writeQuoteFile(quote);
      return new Response(
        JSON.stringify({ ok: true, id: quote.id }),
        { status: 200, headers },
      );
    }

    /* ---- save many at once (used when first linking a device) ---- */
    if (action === "save-all" && request.method === "POST") {
      const body = await request.json();
      const incoming = Array.isArray(body) ? body : body.quotes;
      if (!Array.isArray(incoming)) {
        return new Response(
          JSON.stringify({ error: "Expected an array of quotes." }),
          { status: 400, headers },
        );
      }
      let saved = 0;
      for (const quote of incoming) {
        if (quote && quote.id) {
          await writeQuoteFile(quote);
          saved++;
        }
      }
      return new Response(
        JSON.stringify({ ok: true, saved }),
        { status: 200, headers },
      );
    }

    /* ---- delete one quote ---- */
    if (action === "delete" && request.method === "POST") {
      const body = await request.json();
      const id = String(body.id || "").trim();
      if (!id) {
        return new Response(
          JSON.stringify({ error: "A quote id is required." }),
          { status: 400, headers },
        );
      }
      const removed = await deleteQuoteFile(id);
      return new Response(
        JSON.stringify({ ok: true, removed }),
        { status: 200, headers },
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 404, headers },
    );
  } catch (error) {
    console.error("Drive function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected server error.",
      }),
      { status: 500, headers },
    );
  }
}

serve((request) =>
  handle(request, request.headers.get("origin"))
);
