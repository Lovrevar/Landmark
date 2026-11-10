// The decisions manage-users makes, kept free of Supabase so they can be tested in Deno.
// index.ts does the I/O around them. Every refusal carries the Croatian sentence the task
// app's Settings screen shows verbatim (src/lib/data/profiles.ts, functionFailure).

export interface CreateInput {
  name: string;
  email: string;
  password: string;
}

export interface Refusal {
  ok: false;
  status: number;
  error: string;
}

export type CreateDecision = { ok: true; input: CreateInput } | Refusal;
export type Decision = { ok: true } | Refusal;

export const MESSAGES = {
  // Staff are provisioned in Landmark (a public.users row, then they sign in). This function
  // creates people from outside the company only; a create without the flag would make a
  // Landmark Sales user from the task app, which is the thing part 2 of the 2026-11-10 request
  // exists to prevent.
  staffRefused: "Djelatnici se dodaju u Landmarku.",
  fieldsRequired: "Sva polja su obavezna (ime, email, lozinka).",
  passwordTooShort: "Lozinka mora imati najmanje 6 znakova.",
  alreadyExists: "Korisnik s tim emailom već postoji.",
  // The database did not mark the new person external, so handle_new_user() made them a
  // Landmark user: the project lacks 20261110100200 (COLLAB-18). The caller deletes the auth
  // user again before answering with this.
  notMarkedExternal:
    "Osoba nije označena kao vanjska: bazi nedostaje okidač 20261110100200 (COLLAB-18). Korisnik je obrisan.",
  deleteNotFound: "Korisnik ne postoji.",
  // A task-app admin may remove the people this function created, and nobody else: deleting
  // a staff member's auth user cascades to their Landmark roster row and everything on it.
  deleteNotExternal: "Brisati se mogu samo vanjski suradnici.",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

// What a POST may do: create one external person, with all three fields and a usable password.
export function validateCreate(body: unknown): CreateDecision {
  const payload = isRecord(body) ? body : {};
  if (payload.external !== true) {
    return { ok: false, status: 400, error: MESSAGES.staffRefused };
  }
  const name = nonEmptyString(payload.name);
  const email = nonEmptyString(payload.email);
  const password = typeof payload.password === "string" ? payload.password : "";
  if (!name || !email || password === "") {
    return { ok: false, status: 400, error: MESSAGES.fieldsRequired };
  }
  if (password.length < 6) {
    return { ok: false, status: 400, error: MESSAGES.passwordTooShort };
  }
  return { ok: true, input: { name, email, password } };
}

// GoTrue's own message for a duplicate is English; the one case the screen expects in Croatian.
export function createErrorMessage(message: string): string {
  return message.toLowerCase().includes("already") ? MESSAGES.alreadyExists : message;
}

export interface ProfileFlags {
  external: boolean | null;
}

// After auth.admin.createUser returned: the row the triggers left behind must be external,
// or the person is a Landmark user and must be removed again.
export function afterCreateCheck(profile: ProfileFlags | null): Decision {
  if (profile?.external === true) return { ok: true };
  return { ok: false, status: 500, error: MESSAGES.notMarkedExternal };
}

// Before auth.admin.deleteUser: only a person this function created may be deleted here.
export function deleteDecision(profile: ProfileFlags | null): Decision {
  if (!profile) return { ok: false, status: 404, error: MESSAGES.deleteNotFound };
  if (profile.external !== true) {
    return { ok: false, status: 400, error: MESSAGES.deleteNotExternal };
  }
  return { ok: true };
}
