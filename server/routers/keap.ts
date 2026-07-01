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

  // ── Apply all staged changes in one batch ────────────────────────────────
  applyChanges: protectedProcedure
    .input(
      z.object({
        contactId: z.number().int().positive(),
        // Phone
        phone: z.string().optional(),
        // Person notes entry
        personNote: z
          .object({
            existingNotes: z.string(),
            date: z.string().min(1),
            initials: z.string().min(1),
            note: z.string().min(1),
          })
          .optional(),
        // Sell-side notes entry
        sellSideNote: z
          .object({
            existingNotes: z.string(),
            date: z.string().min(1),
            initials: z.string().min(1),
            note: z.string().min(1),
          })
          .optional(),
        // Tag IDs to apply (plain integers)
        tagIds: z.array(z.number().int().positive()).optional(),
        // Apply Stop Campaign tag (looked up by name)
        applyStopCampaign: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const promises: Promise<unknown>[] = [];

      // Phone
      if (input.phone !== undefined) {
        promises.push(updatePhone(input.contactId, input.phone));
      }

      // Person notes
      if (input.personNote) {
        const { existingNotes, date, initials, note } = input.personNote;
        const entry = buildNoteEntry({ date, initials, note });
        const updated = prependNote(existingNotes, entry);
        promises.push(updatePersonNotes(input.contactId, updated));
      }

      // Sell-side notes
      if (input.sellSideNote) {
        const { existingNotes, date, initials, note } = input.sellSideNote;
        const entry = buildNoteEntry({ date, initials, note });
        const updated = prependNote(existingNotes, entry);
        promises.push(updateCustomField(input.contactId, FIELD_IDS.SELL_SIDE_PROSPECT_NOTES, updated));
      }

      // Standard tags
      if (input.tagIds?.length) {
        for (const tagId of input.tagIds) {
          promises.push(applyTag(input.contactId, tagId));
        }
      }

      // Stop Campaign tag
      if (input.applyStopCampaign) {
        const tagId = await getStopCampaignTagId();
        promises.push(applyTag(input.contactId, tagId));
      }

      await Promise.all(promises);
      return { success: true };
    }),
});
