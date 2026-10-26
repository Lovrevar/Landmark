import { assertEquals } from "jsr:@std/assert@1";
import { buildMeetingPayload, describeMeeting, formatZagreb } from "./meeting.ts";

const meeting = {
  id: "7c1f0a9e-1111-4bbb-8ccc-000000000001",
  title: "Koordinacija",
  start_at: "2030-02-01T08:00:00.000Z", // 09:00 in Zagreb, winter
  end_at: "2030-02-01T09:00:00.000Z",
  room: { name: "Velika konferencija" },
};

Deno.test("formatZagreb: winter time is UTC+1, written the way the task reminders write dates", () => {
  assertEquals(formatZagreb("2030-02-01T08:00:00.000Z"), "01.02.2030. 09:00");
});

Deno.test("formatZagreb: summer time is UTC+2", () => {
  assertEquals(formatZagreb("2030-07-15T07:30:00.000Z"), "15.07.2030. 09:30");
});

Deno.test("formatZagreb: an unreadable instant is left out rather than shown as NaN", () => {
  assertEquals(formatZagreb("not a date"), "");
});

Deno.test("describeMeeting: title, room and local start, dot-separated", () => {
  assertEquals(describeMeeting(meeting), "Koordinacija · Velika konferencija · 01.02.2030. 09:00");
});

Deno.test("describeMeeting: an untitled meeting is 'Sastanak', a missing room is skipped", () => {
  assertEquals(
    describeMeeting({ ...meeting, title: "  ", room: null }),
    "Sastanak · 01.02.2030. 09:00",
  );
});

Deno.test("meeting_invited: the invitation names the meeting, not the actor", () => {
  const p = buildMeetingPayload("meeting_invited", meeting, "Ana");
  assertEquals(p.title, "Novi sastanak");
  assertEquals(p.body, "Koordinacija · Velika konferencija · 01.02.2030. 09:00");
  assertEquals(p.tag, meeting.id);
  assertEquals(p.reservationId, meeting.id);
  assertEquals(p.url, "/sastanci");
});

Deno.test("meeting_cancelled: same tag as the invitation, so it replaces an unread one", () => {
  const p = buildMeetingPayload("meeting_cancelled", meeting, "Ana");
  assertEquals(p.title, "Sastanak otkazan");
  assertEquals(p.body, "Ana je otkazao: Koordinacija · Velika konferencija · 01.02.2030. 09:00");
  assertEquals(p.tag, buildMeetingPayload("meeting_invited", meeting, "Ana").tag);
});
