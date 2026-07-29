import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PushEvent = "task_assigned" | "task_completed";

interface RequestPayload {
  event: PushEvent;
  taskId: string;
  // Optional, sent by the Cognilion web UI when assignees are added to an
  // EXISTING task. See the intersection below for why it cannot be abused.
  newAssigneeIds?: string[];
}

interface SubscriptionRow {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth: string;
}

// What the service worker in src/sw.ts expects to find in the message body.
interface NotificationPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Verify the caller is signed in. Unlike manage-users this is open to any role —
// anyone can create a task or complete their own, so anyone can trigger a send.
async function requireUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Nedostaje auth header.");
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Niste prijavljeni.");
  return data.user.id;
}

// Service-role client that bypasses RLS. Needed twice over: push_subscriptions is
// owner-scoped, and we must read recipients other than the caller.
function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:softveri@aidea-systems.com";

// The VAPID identity is stable, so import it once — edge function instances are reused
// across invocations. The per-message ECDH keypair is NOT hoisted with it: see below.
const vapidKeys = await (async () => {
  const raw = Deno.env.get("VAPID_KEYS");
  if (!raw) return null;
  return await webpush.importVapidKeys(JSON.parse(raw), { extractable: false });
})();

function buildPayload(
  event: PushEvent,
  task: { id: string; title: string; project: { name: string } | null },
  actorName: string,
): NotificationPayload {
  const project = task.project?.name;
  if (event === "task_assigned") {
    return {
      title: "Novi zadatak",
      body: project ? `${task.title} — ${project}` : task.title,
      tag: task.id,
      url: "/",
    };
  }
  return {
    title: "Zadatak završen",
    body: `${actorName} je završio: ${task.title}`,
    tag: task.id,
    url: "/",
  };
}

async function sendToRecipients(
  admin: ReturnType<typeof serviceClient>,
  recipientIds: string[],
  payload: NotificationPayload,
): Promise<{ sent: number; pruned: number }> {
  if (recipientIds.length === 0 || !vapidKeys) return { sent: 0, pruned: 0 };

  const { data: subscriptions, error } = await admin
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", recipientIds);
  if (error) throw new Error(error.message);

  const rows = (subscriptions ?? []) as SubscriptionRow[];
  const message = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  // One user can have several devices; a failure on one must not stop the others.
  await Promise.all(
    rows.map(async (row) => {
      try {
        // ApplicationServer.new() generates the ECDH keypair that encrypts the
        // message, so it is built per message rather than hoisted: RFC 8291 wants
        // that pair ephemeral, and a P-256 keygen costs microseconds.
        const applicationServer = await webpush.ApplicationServer.new({
          contactInformation: VAPID_SUBJECT,
          vapidKeys,
        });
        const subscriber = applicationServer.subscribe({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        });
        // topic = task id, so the push service collapses repeats about one task
        // instead of queueing several while the phone is offline.
        await subscriber.pushTextMessage(message, {
          topic: payload.tag,
          urgency: webpush.Urgency.High,
          ttl: 86_400,
        });
        sent += 1;
      } catch (err) {
        if (
          err instanceof webpush.PushMessageError &&
          (err.isGone() || err.response.status === 404)
        ) {
          // The browser threw this subscription away. This is the only place dead
          // endpoints ever get cleaned up. Note 403 is deliberately NOT pruned — it
          // means the VAPID key does not match the one the client subscribed with,
          // which is a config bug, not a dead device.
          dead.push(row.endpoint);
        } else {
          console.error("push failed", row.endpoint.slice(0, 64), String(err));
        }
      }
    }),
  );

  if (dead.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", dead);
  }
  return { sent, pruned: dead.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Metoda nije dozvoljena.", 405);
  }

  try {
    const callerId = await requireUser(req);
    const { event, taskId, newAssigneeIds } = (await req.json()) as RequestPayload;

    if (event !== "task_assigned" && event !== "task_completed") {
      return errorResponse("Nepoznata vrsta obavijesti.", 400);
    }
    if (!taskId) return errorResponse("Nedostaje id zadatka.", 400);

    if (!vapidKeys) {
      // Misconfiguration, not a client error. Report it without failing the caller's
      // write — notify() ignores the response anyway.
      console.error("VAPID_KEYS is not set; refusing to send.");
      return jsonResponse({ sent: 0, skipped: "not-configured" });
    }

    const admin = serviceClient();

    // Re-read the task server-side. The client sends only a task id — never a
    // recipient list or message text — so this endpoint cannot be used to push
    // arbitrary content to arbitrary people.
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .select("id, title, created_by, project:projects(name), assignees:profiles!task_assignees(id)")
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) return errorResponse(taskError.message, 500);
    if (!task) return errorResponse("Zadatak ne postoji.", 404);

    const assigneeIds = ((task.assignees ?? []) as { id: string }[]).map((a) => a.id);

    // Only people involved in the task may trigger a notification about it.
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("name, role")
      .eq("id", callerId)
      .maybeSingle();
    const isInvolved =
      assigneeIds.includes(callerId) ||
      task.created_by === callerId ||
      callerProfile?.role === "admin";
    if (!isInvolved) {
      return errorResponse("Nemate pristup ovom zadatku.", 403);
    }

    // The caller never notifies themselves. TaskForm pre-selects the current user as
    // an assignee, so without this every task creator pings their own phone.
    const recipients = new Set<string>(
      event === "task_assigned" ? assigneeIds : [...assigneeIds, task.created_by ?? ""],
    );

    // Reassignment: the Cognilion web UI can add assignees to an existing task,
    // and we have no before-state to diff, so without this everyone already on
    // the task gets re-buzzed. The client may only NARROW this set — we
    // intersect against the assignees we read ourselves a moment ago. Worst
    // case a caller silences someone who should have been told; it can never
    // push to anyone who is not on the task.
    if (Array.isArray(newAssigneeIds) && newAssigneeIds.length > 0) {
      const only = new Set(newAssigneeIds);
      for (const id of [...recipients]) {
        if (!only.has(id)) recipients.delete(id);
      }
    }

    recipients.delete(callerId);
    recipients.delete("");

    const payload = buildPayload(
      event,
      task as unknown as { id: string; title: string; project: { name: string } | null },
      callerProfile?.name ?? "Kolega",
    );
    const result = await sendToRecipients(admin, [...recipients], payload);

    return jsonResponse({ ...result, recipients: recipients.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neočekivana greška.";
    const status = message.includes("prijavljeni") || message.includes("auth header") ? 403 : 500;
    return errorResponse(message, status);
  }
});
