import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  applyTag,
  buildNoteEntry,
  FIELD_IDS,
  getContact,
  getStopCampaignTagId,
  prependNote,
  searchContactsByEmail,
  toContactSummary,
  updateCustomField,
  updatePersonNotes,
  updatePhone,
} from "../keap";

export const keapRouter = router({
  // ── Search by email ──────────────────────────────────────────────────────
  searchByEmail: protectedProcedure
    .input(z.object({ email: z.string().email("Enter a valid email address.") }))
    .query(async ({ input }) => {
      const contacts = await searchContactsByEmail(input.email);

      if (contacts.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No contact found with that email address." });
      }

      if (contacts.length > 1) {
        return {
          duplicate: true,
          contacts: contacts.map((c) => ({
            id: c.id,
            fullName: [c.given_name, c.family_name].filter(Boolean).join(" ") || "—",
            email: c.email_addresses?.[0]?.email ?? "—",
          })),
          contact: null,
        };
      }

      const full = await getContact(contacts[0]!.id);
      return {
        duplicate: false,
        contacts: [],
        contact: toContactSummary(full),
      };
    }),

  // ── Get contact by ID ────────────────────────────────────────────────────
  getContact: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const full = await getContact(input.contactId);
      return toContactSummary(full);
    }),

  // ── Update phone ─────────────────────────────────────────────────────────
  updatePhone: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), phone: z.string().min(1, "Phone number is required.") }))
    .mutation(async ({ input }) => {
      await updatePhone(input.contactId, input.phone);
      return { success: true };
    }),

  // ── Update person notes ──────────────────────────────────────────────────
  updatePersonNotes: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        existingNotes: z.string(),
        date: z.string().min(1, "Date is required."),
        initials: z.string().min(1, "Initials are required."),
        note: z.string().min(1, "Note text is required."),
      })
    )
    .mutation(async ({ input }) => {
      const entry = buildNoteEntry({ date: input.date, initials: input.initials, note: input.note });
      const updated = prependNote(input.existingNotes, entry);
      await updatePersonNotes(input.contactId, updated);
      return { success: true, updatedNotes: updated };
    }),

  // ── Update sell-side prospect notes ─────────────────────────────────────
  updateSellSideNotes: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        existingNotes: z.string(),
        date: z.string().min(1, "Date is required."),
        initials: z.string().min(1, "Initials are required."),
        note: z.string().min(1, "Note text is required."),
      })
    )
    .mutation(async ({ input }) => {
      const entry = buildNoteEntry({ date: input.date, initials: input.initials, note: input.note });
      const updated = prependNote(input.existingNotes, entry);
      await updateCustomField(input.contactId, FIELD_IDS.SELL_SIDE_PROSPECT_NOTES, updated);
      return { success: true, updatedNotes: updated };
    }),

  // ── Apply tag ────────────────────────────────────────────────────────────
  applyTag: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive(), tagId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await applyTag(input.contactId, input.tagId);
      return { success: true };
    }),

  // ── Apply Stop Campaign tag (looked up by name) ──────────────────────────
  applyStopCampaignTag: protectedProcedure
    .input(z.object({ contactId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const tagId = await getStopCampaignTagId();
      await applyTag(input.contactId, tagId);
      return { success: true };
    }),
});
