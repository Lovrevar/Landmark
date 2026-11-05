// The meeting half of send-push: what a "Novi sastanak" / "Sastanak otkazan" notification
// says. Pure, so it can be tested without Deno.serve — the task half's buildPayload lives in
// index.ts and predates the tests.

export type MeetingEvent = "meeting_invited" | "meeting_cancelled";

export interface MeetingForPush {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  room: { name: string } | null;
}

export interface MeetingNotification {
  title: string;
  body: string;
  tag: string;
  reservationId: string;
  url: string;
}

// The function runs in UTC and the users live in Europe/Zagreb, which changes offset twice a
// year, so the wall-clock time comes from Intl with the zone named, not from Date getters.
// Assembled from parts rather than taken from format(): ICU's hr-HR pattern puts spaces after
// the dots ("1. 2. 2030. 09:00"), and the task reminders write "DD.MM.YYYY." without them.
export function formatZagreb(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zagreb",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  // en-GB can render midnight as "24:00" under hour12: false on some ICU builds.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("day")}.${get("month")}.${get("year")}. ${hour}:${get("minute")}`;
}

// "Sastanak" for an untitled meeting, as the task app shows it — the title column is
// optional and the two clients agree on the placeholder (SHARED_SCHEMA.md §15).
export function describeMeeting(meeting: MeetingForPush): string {
  const title = meeting.title.trim() || "Sastanak";
  const room = meeting.room?.name;
  const when = formatZagreb(meeting.start_at);
  return [title, room, when].filter((s) => s && s.length > 0).join(" · ");
}

export function buildMeetingPayload(
  event: MeetingEvent,
  meeting: MeetingForPush,
  actorName: string,
): MeetingNotification {
  const description = describeMeeting(meeting);
  // One tag for both events, so a cancellation replaces an invitation the user has not read
  // yet instead of sitting under it — the last word is the one that should be on the screen.
  const base = { tag: meeting.id, reservationId: meeting.id, url: "/sastanci" };
  switch (event) {
    case "meeting_invited":
      return { ...base, title: "Novi sastanak", body: description };
    case "meeting_cancelled":
      return { ...base, title: "Sastanak otkazan", body: `${actorName} je otkazao: ${description}` };
  }
}
