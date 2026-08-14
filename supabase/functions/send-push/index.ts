import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import * as webpush from "jsr:@negrel/webpush@0.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Reminder-Secret",
};

// Events a signed-in user may trigger, and events only the scheduler may trigger. The two
// sets are disjoint and cross-checked against the caller's mode below — without that, any
// signed-in user could POST reminder_overdue and buzz the whole crew at will.
type UserEvent = "task_assigned" | "task_completed";
type ReminderEvent = "reminder_day_before" | "reminder_due_today" | "reminder_overdue";
type PushEvent = UserEvent | ReminderEvent;

const USER_EVENTS: readonly string[] = ["task_assigned", "task_completed"];
const REMINDER_EVENTS: readonly string[] = [
  "reminder_day_before",
  "reminder_due_today",
  "reminder_overdue",
];

// How the request authenticated. "scheduled" is pg_cron via pg_net — see
// dispatch_due_reminders() in 20260813092000_deadline_reminders.sql. There is no user behind
// it, so there is nobody to exclude from the recipients and nobody to name as the actor.
type Caller = { mode: "user"; callerId: string } | { mode: "scheduled" };

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
  // Echoed back by the service worker when the notification is clicked, so the app can bring
  // the user to the right screen instead of wherever they happened to leave it.
  taskId: string;
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

const REMINDER_SECRET = Deno.env.get("REMINDER_SECRET");

// Two independent gates protect a scheduled call, and they do different jobs. The
// Authorization bearer (the service-role key, sent by the dispatcher) is what gets past
// Supabase's verify_jwt at the gateway. This shared secret is what this function itself
// checks. Keeping them separate means the one credential that bypasses RLS is not also the
// one that would have to be rotated if a header ever leaked into a log or a proxy.
async function authorize(req: Request): Promise<Caller> {
  const presented = req.headers.get("x-reminder-secret");
  if (presented && REMINDER_SECRET && presented === REMINDER_SECRET) {
    return { mode: "scheduled" };
  }
  return { mode: "user", callerId: await requireUser(req) };
}

// Croatian date, DD.MM.YYYY. The Vite source tree is not importable from Deno, so this is a
// small local copy rather than a shared helper.
function formatHrDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}.`;
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
  task: { id: string; title: string; deadline: string | null; project: { name: string } | null },
  actorName: string,
): NotificationPayload {
  const project = task.project?.name;
  const withProject = project ? `${task.title} — ${project}` : task.title;
  // Reminders get their own tag so one does not silently replace the "Novi zadatak" the user
  // has not read yet. Consecutive reminders about a task still collapse onto each other,
  // which is the behaviour we want.
  const reminderTag = `${task.id}:reminder`;

  switch (event) {
    case "task_assigned":
      return { title: "Novi zadatak", body: withProject, tag: task.id, taskId: task.id, url: "/" };
    case "task_completed":
      return {
        title: "Zadatak završen",
        body: `${actorName} je završio: ${task.title}`,
        tag: task.id,
        taskId: task.id,
        url: "/",
      };
    case "reminder_day_before":
      return { title: "Rok je sutra", body: withProject, tag: reminderTag, taskId: task.id, url: "/" };
    case "reminder_due_today":
      return { title: "Rok je danas", body: withProject, tag: reminderTag, taskId: task.id, url: "/" };
    case "reminder_overdue":
      return {
        title: "Zadatak kasni",
        body: `${task.title} — rok: ${formatHrDate(task.deadline)}`,
        tag: reminderTag,
        taskId: task.id,
        url: "/",
      };
  }
}

// RFC 8030 §5.4 caps the Topic header at 32 characters from the URL-safe base64 alphabet, and
// a UUID is 36 with its hyphens. Dropping the hyphens lands on exactly 32.
//
// Reminders then need their own space: "<uuid>:reminder" and "<uuid>" would otherwise truncate
// to the same 32 characters, and the push service would collapse a reminder onto an unread
// "Novi zadatak" while the phone was offline. Swapping the first character for "r" keeps the
// two apart while still collapsing reminders about one task onto each other.
function topicFor(tag: string): string {
  const compact = tag.replace(/[^A-Za-z0-9]/g, "").slice(0, 32);
  return tag.endsWith(":reminder") ? `r${compact.slice(0, 31)}` : compact;
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
        // The topic collapses repeats about one task instead of queueing several while the
        // phone is offline. RFC 8030 restricts it to at most 32 characters from the URL-safe
        // base64 alphabet, so the tag is stripped and truncated to fit — a raw UUID is already
        // 36 characters, and the reminder tag also carries a colon.
        await subscriber.pushTextMessage(message, {
          topic: topicFor(payload.tag),
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
    const caller = await authorize(req);
    const { event, taskId, newAssigneeIds } = (await req.json()) as RequestPayload;

    const isReminder = REMINDER_EVENTS.includes(event);
    if (!isReminder && !USER_EVENTS.includes(event)) {
      return errorResponse("Nepoznata vrsta obavijesti.", 400);
    }
    // Cross-gate mode against event. A reminder may only come from the scheduler, and a user
    // event may only come from a user — otherwise any signed-in account could trigger
    // "Zadatak kasni" for anyone at any hour.
    if (isReminder !== (caller.mode === "scheduled")) {
      return errorResponse("Nemate pristup ovoj vrsti obavijesti.", 403);
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
      .select(
        "id, title, deadline, completed, created_by, project:projects(name), assignees:profiles!task_assignees(id)",
      )
      .eq("id", taskId)
      .maybeSingle();
    if (taskError) return errorResponse(taskError.message, 500);
    if (!task) return errorResponse("Zadatak ne postoji.", 404);

    // Belt and braces: the dispatcher claimed this reminder a moment ago, and the task may
    // have been ticked off in between. Nobody should be nagged about finished work.
    if (isReminder && task.completed) {
      return jsonResponse({ sent: 0, skipped: "completed" });
    }

    const assigneeIds = ((task.assignees ?? []) as { id: string }[]).map((a) => a.id);

    let recipients: Set<string>;
    let actorName = "Kolega";

    if (caller.mode === "scheduled") {
      // No caller to exclude, and newAssigneeIds is a client concept that has no meaning
      // here. An overdue task also reaches whoever set it, so a supervisor sees slippage
      // without having to go looking for it.
      recipients = new Set<string>(
        event === "reminder_overdue" ? [...assigneeIds, task.created_by ?? ""] : assigneeIds,
      );
    } else {
      // Only people involved in the task may trigger a notification about it.
      const { data: callerProfile } = await admin
        .from("profiles")
        .select("name, role")
        .eq("id", caller.callerId)
        .maybeSingle();
      const isInvolved =
        assigneeIds.includes(caller.callerId) ||
        task.created_by === caller.callerId ||
        callerProfile?.role === "admin";
      if (!isInvolved) {
        return errorResponse("Nemate pristup ovom zadatku.", 403);
      }
      actorName = callerProfile?.name ?? "Kolega";

      // The caller never notifies themselves. TaskForm pre-selects the current user as
      // an assignee, so without this every task creator pings their own phone.
      recipients = new Set<string>(
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

      recipients.delete(caller.callerId);
    }
    recipients.delete("");

    const payload = buildPayload(
      event,
      task as unknown as {
        id: string;
        title: string;
        deadline: string | null;
        project: { name: string } | null;
      },
      actorName,
    );
    const result = await sendToRecipients(admin, [...recipients], payload);

    return jsonResponse({ ...result, recipients: recipients.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neočekivana greška.";
    const status = message.includes("prijavljeni") || message.includes("auth header") ? 403 : 500;
    return errorResponse(message, status);
  }
});
