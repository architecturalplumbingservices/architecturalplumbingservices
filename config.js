/* =========================================================
   APS / PIPEWISE - DEPLOYMENT CONFIGURATION
   ---------------------------------------------------------
   This file holds NOTHING secret. It is served to every
   visitor, so a password, API key, service key or client secret
   must never be typed in here.

   Read that again before pasting anything below. There are only
   ever two values in this file, and both are safe to publish:

   APS_CLOUD_FUNCTION_URL
     The URL of the small backend function that reads and writes
     the shared quote database. See supabase/SETUP-CLOUD.md.

     It looks like:
       https://abcdefghijklm.supabase.co/functions/v1/cloud

   APS_SUPABASE_ANON_KEY
     The project anon (public) key. This is designed to be
     public - it identifies the project, it does not grant access.
     Every request it makes is still filtered by row-level
     security against the signed-in user.

     Two shapes are valid and both are public:

       - the newer sb_publishable_... key, or
       - the older anon key, the one starting eyJ that the
         dashboard labels "public" / "anon".

     DO NOT paste the service_role key here, and do not paste an
     sb_secret_... key. Those bypass all row-level security and
     would hand your entire quote history to anyone who opens
     View Source.

     These two values are shared with the other AGA trades, so the
     publishable key is already visible in those sites' source. That
     does not make the data public: the anon/publishable role only
     ever sees what row-level security in supabase/schema.sql allows,
     which is nothing unless a signed-in user owns the row.
     ========================================================= */
"use strict";

window.APS_CLOUD_FUNCTION_URL = "https://mvymxqajdiupucrkeqpg.supabase.co/functions/v1/cloud";

/* Supabase superseded the eyJ... anon key with sb_publishable_ keys.
   The old name is kept so SETUP-CLOUD.md and saved configs still work. */
window.APS_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_U5wCUR1JeDskIqQdGwdAbg_zaczJYlJ";
window.APS_SUPABASE_ANON_KEY = window.APS_SUPABASE_PUBLISHABLE_KEY;
