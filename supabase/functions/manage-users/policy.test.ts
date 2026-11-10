import { assertEquals } from "jsr:@std/assert@1";
import {
  afterCreateCheck,
  createErrorMessage,
  deleteDecision,
  MESSAGES,
  type Refusal,
  validateCreate,
} from "./policy.ts";

const good = { name: " Ivan Horvat ", email: "ivan@primjer.hr", password: "tajna123", external: true };

Deno.test("validateCreate: a complete external person is accepted, with the name and email trimmed", () => {
  const d = validateCreate(good);
  assertEquals(d, { ok: true, input: { name: "Ivan Horvat", email: "ivan@primjer.hr", password: "tajna123" } });
});

Deno.test("validateCreate: a create without external: true is refused — staff are added in Landmark", () => {
  assertEquals(validateCreate({ ...good, external: false }), { ok: false, status: 400, error: MESSAGES.staffRefused });
  assertEquals(validateCreate({ ...good, external: undefined }), { ok: false, status: 400, error: MESSAGES.staffRefused });
  assertEquals(validateCreate({ ...good, external: "true" }), { ok: false, status: 400, error: MESSAGES.staffRefused });
});

Deno.test("validateCreate: a role in the payload changes nothing — an external person is always 'user'", () => {
  const d = validateCreate({ ...good, role: "admin" });
  assertEquals(d.ok, true);
});

Deno.test("validateCreate: a missing or blank field is refused", () => {
  const refused: Refusal = { ok: false, status: 400, error: MESSAGES.fieldsRequired };
  assertEquals(validateCreate({ ...good, name: "   " }), refused);
  assertEquals(validateCreate({ ...good, email: "" }), refused);
  assertEquals(validateCreate({ ...good, password: undefined }), refused);
  assertEquals(validateCreate(null), { ok: false, status: 400, error: MESSAGES.staffRefused });
});

Deno.test("validateCreate: a password under six characters is refused", () => {
  assertEquals(validateCreate({ ...good, password: "12345" }), { ok: false, status: 400, error: MESSAGES.passwordTooShort });
});

Deno.test("createErrorMessage: GoTrue's duplicate message becomes the Croatian sentence the screen expects", () => {
  assertEquals(createErrorMessage("A user with this email address has already been registered"), MESSAGES.alreadyExists);
  assertEquals(createErrorMessage("Database error updating user"), "Database error updating user");
});

Deno.test("afterCreateCheck: a profile the trigger marked external passes", () => {
  assertEquals(afterCreateCheck({ external: true }), { ok: true });
});

Deno.test("afterCreateCheck: a profile not marked external means the project lacks the trigger (COLLAB-18)", () => {
  const refused: Refusal = { ok: false, status: 500, error: MESSAGES.notMarkedExternal };
  assertEquals(afterCreateCheck({ external: false }), refused);
  assertEquals(afterCreateCheck({ external: null }), refused);
  assertEquals(afterCreateCheck(null), refused);
});

Deno.test("deleteDecision: only an external person may be deleted here", () => {
  assertEquals(deleteDecision({ external: true }), { ok: true });
  assertEquals(deleteDecision({ external: false }), { ok: false, status: 400, error: MESSAGES.deleteNotExternal });
  assertEquals(deleteDecision(null), { ok: false, status: 404, error: MESSAGES.deleteNotFound });
});
