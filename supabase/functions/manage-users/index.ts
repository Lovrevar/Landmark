// manage-users — the standalone task app's way of adding and removing a person from outside
// the company: a subcontractor or a site contact who needs an account there and must never
// become a Landmark user. Such a person is a profiles row and nothing else.
//
// Deployed from this repo, not from that app, because what it depends on lives here: the
// shared schema, and the two triggers that keep the roster row away from such a sign-up
// (20261110100100 for a row inserted with the flag, 20261110100200 for the Auth admin API,
// which merges app_metadata in a later UPDATE — COLLAB-18). docs/SHARED_SCHEMA.md §1.
//
// Caller: a task-app admin (profiles.role = 'admin'), re-checked here after the gateway's JWT
// gate. Landmark's own roles are not consulted; the task app's admins are a profiles matter.
//
//   POST   { name, email, password, external: true }  -> { id, email, name, role: 'user' }
//   DELETE ?id=<auth user id>                         -> { ok: true }  (external people only)
//
// Refusals are non-2xx with { error: "<Croatian sentence>" }; the Settings screen shows the
// sentence as it is (task app src/lib/data/profiles.ts, functionFailure).

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { corsHeaders as sharedCorsHeaders } from "../_shared/cors.ts";
import {
  afterCreateCheck,
  createErrorMessage,
  deleteDecision,
  validateCreate,
} from "./policy.ts";

// The shared header list allows POST only; DELETE is part of this function's surface.
const corsHeaders = {
  ...sharedCorsHeaders,
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Verify the caller is a signed-in task-app admin. The user's JWT is forwarded in the
// Authorization header by the Supabase JS client; profiles_select_all lets the user client
// read their own role.
async function requireAdmin(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Nedostaje auth header.");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Niste prijavljeni.");
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== "admin") {
    throw new Error("Samo admin može upravljati korisnicima.");
  }
  return userData.user.id;
}

// Service-role client: the Auth admin API, and profiles reads that must not depend on the
// caller's row policies. Untyped on purpose — the generated types gain profiles.external only
// once /db-types runs after 20261110100100 is applied, and this must compile before that.
function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

type Admin = ReturnType<typeof serviceClient>;

async function readExternal(admin: Admin, id: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("external")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Provjera profila nije uspjela: " + error.message);
  return data as { external: boolean | null } | null;
}

async function createExternal(admin: Admin, body: unknown): Promise<Response> {
  const decision = validateCreate(body);
  if (!decision.ok) return errorResponse(decision.error, decision.status);
  const { name, email, password } = decision.input;

  // app_metadata is the carrier because only the admin API can write it: a signed-in user can
  // change their user_metadata, never this. user_metadata.name is where the trigger takes the
  // profile's name from, so it must keep being sent.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { task_app_only: true },
  });
  if (error) return errorResponse(createErrorMessage(error.message), 400);
  const id = data.user.id;

  // The triggers have run by now. If the row is not external, this project lacks
  // 20261110100200 and the person is a Landmark Sales user: take them out again rather than
  // answer success. Deleting the auth user cascades to the roster row and the profile.
  const check = afterCreateCheck(await readExternal(admin, id));
  if (!check.ok) {
    await admin.auth.admin.deleteUser(id);
    return errorResponse(check.error, check.status);
  }

  // The trigger already named the profile and set the role; this is the same write again, so
  // the reply and the row cannot disagree. `external` is deliberately not written here.
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id, email, name, role: "user" });
  if (profileError) {
    return errorResponse("Korisnik kreiran, ali profil nije spremljen: " + profileError.message, 500);
  }
  return jsonResponse({ id, email, name, role: "user" });
}

async function deleteExternal(admin: Admin, userId: string): Promise<Response> {
  const decision = deleteDecision(await readExternal(admin, userId));
  if (!decision.ok) return errorResponse(decision.error, decision.status);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return errorResponse("Brisanje korisnika nije uspjelo: " + error.message, 400);
  // The profiles row cascades from auth.users; there is no roster row to clean.
  return jsonResponse({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    await requireAdmin(req);
    const admin = serviceClient();

    if (req.method === "POST") {
      return await createExternal(admin, await req.json());
    }
    if (req.method === "DELETE") {
      const userId = new URL(req.url).searchParams.get("id");
      if (!userId) return errorResponse("Nedostaje id korisnika.", 400);
      return await deleteExternal(admin, userId);
    }
    return errorResponse("Metoda nije dozvoljena.", 405);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neočekivana greška.";
    const status = message.includes("admin") || message.includes("prijavljeni") ? 403 : 500;
    return errorResponse(message, status);
  }
});
