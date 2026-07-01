import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildNoteEntry, prependNote, toContactSummary, FIELD_IDS, TAG_IDS } from "./keap";
import type { KeapContact } from "./keap";

// ─── buildNoteEntry ───────────────────────────────────────────────────────────
describe("buildNoteEntry", () => {
  it("formats a valid entry correctly", () => {
    const result = buildNoteEntry({ date: "7.1.26", initials: "jd", note: "First call" });
    expect(result).toBe("7.1.26 - JD - First call");
  });

  it("uppercases initials", () => {
    const result = buildNoteEntry({ date: "1.15.26", initials: "ab", note: "Follow up" });
    expect(result).toContain("AB");
  });

  it("throws on invalid date format", () => {
    expect(() => buildNoteEntry({ date: "2026-07-01", initials: "JD", note: "Bad date" })).toThrow("M.D.YY");
  });

  it("throws on empty initials", () => {
    expect(() => buildNoteEntry({ date: "7.1.26", initials: "", note: "Note" })).toThrow("Initials");
  });

  it("throws on empty note", () => {
    expect(() => buildNoteEntry({ date: "7.1.26", initials: "JD", note: "" })).toThrow("Note text");
  });

  it("trims whitespace from all fields", () => {
    const result = buildNoteEntry({ date: " 7.1.26 ", initials: " jd ", note: "  Hello  " });
    expect(result).toBe("7.1.26 - JD - Hello");
  });
});

// ─── prependNote ─────────────────────────────────────────────────────────────
describe("prependNote", () => {
  it("prepends new entry to existing notes (newest first)", () => {
    const result = prependNote("7.1.26 - JD - Old note", "7.2.26 - JD - New note");
    expect(result.startsWith("7.2.26 - JD - New note")).toBe(true);
    expect(result).toContain("7.1.26 - JD - Old note");
  });

  it("handles empty existing notes", () => {
    const result = prependNote("", "7.1.26 - JD - First note");
    expect(result).toBe("7.1.26 - JD - First note");
  });

  it("handles whitespace-only existing notes", () => {
    const result = prependNote("   ", "7.1.26 - JD - Note");
    expect(result).toBe("7.1.26 - JD - Note");
  });
});

// ─── Tag ID constants ────────────────────────────────────────────────────────
describe("TAG_IDS", () => {
  it("admin opt out tag ID is 22830", () => {
    expect(TAG_IDS.ADMIN_OPT_OUT).toBe(22830);
  });

  it("company closed tag ID is 17610", () => {
    expect(TAG_IDS.COMPANY_CLOSED_OR_ACQUIRED).toBe(17610);
  });

  it("find new contact tag ID is 16548", () => {
    expect(TAG_IDS.FIND_NEW_CONTACT).toBe(16548);
  });
});

// ─── toContactSummary ─────────────────────────────────────────────────────────
describe("toContactSummary", () => {
  const baseContact: KeapContact = {
    id: 123,
    given_name: "Jane",
    family_name: "Doe",
    company: { id: 1, company_name: "Acme Corp" },
    email_addresses: [{ email: "jane@acme.com", field: "EMAIL1" }],
    phone_numbers: [{ number: "555-1234", field: "PHONE1" }],
    notes: "Existing person note",
    custom_fields: [
      { id: FIELD_IDS.SELL_SIDE_PROSPECT_NOTES, content: "Sell-side note" },
      { id: FIELD_IDS.BUY_SIDE_NOTES, content: "Buy-side note" },
    ],
    tag_ids: [22830],
  };

  it("maps all fields correctly", () => {
    const summary = toContactSummary(baseContact);
    expect(summary.id).toBe(123);
    expect(summary.fullName).toBe("Jane Doe");
    expect(summary.companyName).toBe("Acme Corp");
    expect(summary.email).toBe("jane@acme.com");
    expect(summary.phone).toBe("555-1234");
    expect(summary.personNotes).toBe("Existing person note");
    expect(summary.sellSideNotes).toBe("Sell-side note");
    expect(summary.buySideNotes).toBe("Buy-side note");
    expect(summary.tagIds).toContain(22830);
  });

  it("handles missing optional fields gracefully", () => {
    const minimal: KeapContact = { id: 1 };
    const summary = toContactSummary(minimal);
    expect(summary.fullName).toBe("—");
    expect(summary.companyName).toBe("—");
    expect(summary.email).toBe("—");
    expect(summary.phone).toBe("");
    expect(summary.personNotes).toBe("");
    expect(summary.sellSideNotes).toBe("");
    expect(summary.buySideNotes).toBe("");
    expect(summary.tagIds).toEqual([]);
  });
});

// ─── applyTag (fetch mock) ────────────────────────────────────────────────────
describe("applyTag payload shape", () => {
  it("sends plain integer tagIds array (not objects)", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return { ok: true, status: 204, json: async () => ({}) } as Response;
    });
    process.env.KEAP_ACCESS_TOKEN = "test-token";

    const { applyTag } = await import("./keap");
    await applyTag(123, 22830);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/contacts/123/tags");
    expect(calls[0]!.body).toEqual({ tagIds: [22830] });
    // Must be plain integer, not object
    expect(typeof (calls[0]!.body as { tagIds: unknown[] }).tagIds[0]).toBe("number");

    vi.unstubAllGlobals();
  });
});

// ─── searchContactsByEmail (fetch mock) ──────────────────────────────────────
describe("searchContactsByEmail", () => {
  it("returns empty array when no contacts found", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ contacts: [] }),
    } as Response));
    process.env.KEAP_ACCESS_TOKEN = "test-token";

    const { searchContactsByEmail } = await import("./keap");
    const result = await searchContactsByEmail("nobody@example.com");
    expect(result).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("returns multiple contacts for duplicate email", async () => {
    const fakeContacts = [
      { id: 1, given_name: "Alice", family_name: "Smith" },
      { id: 2, given_name: "Alice", family_name: "Smith" },
    ];
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      status: 200,
      json: async () => ({ contacts: fakeContacts }),
    } as Response));
    process.env.KEAP_ACCESS_TOKEN = "test-token";

    const { searchContactsByEmail } = await import("./keap");
    const result = await searchContactsByEmail("alice@example.com");
    expect(result).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});
