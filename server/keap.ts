import { TRPCError } from "@trpc/server";

const KEAP_BASE = "https://api.infusionsoft.com/crm/rest/v1";

// ─── Custom Field IDs (Calder Capital account) ────────────────────────────────
export const FIELD_IDS = {
  SELL_SIDE_PROSPECT_NOTES: 299, // "Calder Sell-Side Email List" — used as sell-side prospect notes
  BUY_SIDE_NOTES: 315,           // "Seller Prospect - Buyside Notes" — read-only
} as const;

// ─── Tag IDs ──────────────────────────────────────────────────────────────────
export const TAG_IDS = {
  ADMIN_OPT_OUT: 22830,
  COMPANY_CLOSED_OR_ACQUIRED: 17610,
  FIND_NEW_CONTACT: 16548,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface KeapContact {
  id: number;
  given_name?: string;
  family_name?: string;
  company?: { id: number; company_name: string } | null;
  email_addresses?: { email: string; field: string }[];
  phone_numbers?: { number: string; field: string; type?: string }[];
  notes?: string;
  custom_fields?: { id: number; content: string }[];
  tag_ids?: number[];
}

export interface ContactSummary {
  id: number;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  personNotes: string;
  sellSideNotes: string;
  buySideNotes: string;
  tagIds: number[];
}

// ─── Core request helper ──────────────────────────────────────────────────────
export async function keapRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = process.env.KEAP_ACCESS_TOKEN;
  if (!token) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "KEAP_ACCESS_TOKEN is not configured." });
  }

  const url = `${KEAP_BASE}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch { /* ignore */ }
    console.error(`[Keap] HTTP ${response.status} on ${init.method ?? "GET"} ${path}`, body);
    throw new TRPCError({
      code: response.status === 401 ? "UNAUTHORIZED" : "BAD_REQUEST",
      message: `Keap API error ${response.status}: ${body}`,
    });
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

// ─── Note helpers ─────────────────────────────────────────────────────────────
/** Validate and build a note entry string: "M.D.YY - INITIALS - text" */
export function buildNoteEntry({
  date,
  initials,
  note,
}: {
  date: string;
  initials: string;
  note: string;
}): string {
  if (!date || !/^(0?[1-9]|1[0-2])\.(0?[1-9]|[12]\d|3[01])\.\d{2}$/.test(date.trim())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Date must be in M.D.YY format (e.g. 7.1.26)." });
  }
  if (!initials || !initials.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Initials are required." });
  }
  if (!note || !note.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Note text is required." });
  }
  return `${date.trim()} - ${initials.trim().toUpperCase()} - ${note.trim()}`;
}

/** Prepend a new entry to existing notes (newest first) */
export function prependNote(existing: string, entry: string): string {
  return [entry, existing.trim()].filter(Boolean).join("\n");
}

// ─── Contact search ───────────────────────────────────────────────────────────
export async function searchContactsByEmail(email: string): Promise<KeapContact[]> {
  const params = new URLSearchParams({
    email,
    optional_properties: "custom_fields,email_addresses,phone_numbers,tag_ids,notes",
  });
  const result = await keapRequest<{ contacts: KeapContact[] }>(`/contacts?${params}`);
  return result.contacts ?? [];
}

// ─── Contact fetch ────────────────────────────────────────────────────────────
export async function getContact(contactId: number): Promise<KeapContact> {
  const params = new URLSearchParams({
    optional_properties: "custom_fields,email_addresses,phone_numbers,tag_ids,notes",
  });
  return keapRequest<KeapContact>(`/contacts/${contactId}?${params}`);
}

// ─── Map raw contact to summary ───────────────────────────────────────────────
export function toContactSummary(c: KeapContact): ContactSummary {
  const fullName = [c.given_name, c.family_name].filter(Boolean).join(" ") || "—";
  const companyName = c.company?.company_name ?? "—";
  const email = c.email_addresses?.[0]?.email ?? "—";
  const phone = c.phone_numbers?.[0]?.number ?? "";

  const getCustomField = (id: number) =>
    c.custom_fields?.find((f) => f.id === id)?.content ?? "";

  return {
    id: c.id,
    fullName,
    companyName,
    email,
    phone,
    personNotes: c.notes ?? "",
    sellSideNotes: getCustomField(FIELD_IDS.SELL_SIDE_PROSPECT_NOTES),
    buySideNotes: getCustomField(FIELD_IDS.BUY_SIDE_NOTES),
    tagIds: c.tag_ids ?? [],
  };
}

// ─── Update phone ─────────────────────────────────────────────────────────────
export async function updatePhone(contactId: number, phone: string): Promise<void> {
  await keapRequest(`/contacts/${contactId}?update_mask=phone_numbers`, {
    method: "PATCH",
    body: JSON.stringify({
      phone_numbers: [{ number: phone, field: "PHONE1" }],
    }),
  });
}

// ─── Update person notes (built-in `notes` field) ────────────────────────────
export async function updatePersonNotes(contactId: number, notes: string): Promise<void> {
  await keapRequest(`/contacts/${contactId}?update_mask=notes`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
}

// ─── Update custom field (sell-side notes) ────────────────────────────────────
export async function updateCustomField(contactId: number, fieldId: number, content: string): Promise<void> {
  await keapRequest(`/contacts/${contactId}?update_mask=custom_fields`, {
    method: "PATCH",
    body: JSON.stringify({
      custom_fields: [{ id: fieldId, content }],
    }),
  });
}

// ─── Apply tag ────────────────────────────────────────────────────────────────
export async function applyTag(contactId: number, tagId: number): Promise<void> {
  await keapRequest(`/contacts/${contactId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tagIds: [tagId] }),
  });
}

// ─── Fetch tag ID by name (for BusDev - Stop Campaign) ───────────────────────
let _stopCampaignTagId: number | null = null;

export async function getStopCampaignTagId(): Promise<number> {
  if (_stopCampaignTagId !== null) return _stopCampaignTagId;

  let offset = 0;
  const limit = 1000;

  while (true) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const result = await keapRequest<{ tags: { id: number; name: string; category?: { name: string } }[] }>(
      `/tags?${params}`
    );
    const tags = result.tags ?? [];

    const found = tags.find(
      (t) =>
        t.name === "BusDev - Stop Campaign" &&
        (t.category?.name === "Prospect Tags" || !t.category)
    );
    if (found) {
      _stopCampaignTagId = found.id;
      return found.id;
    }

    if (tags.length < limit) break;
    offset += limit;
  }

  throw new TRPCError({
    code: "NOT_FOUND",
    message: "Tag 'BusDev - Stop Campaign' not found in Keap. Please create it under the Prospect Tags category.",
  });
}
