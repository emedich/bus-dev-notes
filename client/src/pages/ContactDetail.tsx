import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Phone,
  Pencil,
  Check,
  X,
  Tag,
  AlertTriangle,
  BookOpen,
  FileText,
  Lock,
  ChevronLeft,
} from "lucide-react";

interface ContactSummary {
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

interface Props {
  contact: ContactSummary;
  onBack: () => void;
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-4 w-4 text-destructive" />}
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-1">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Note Entry Form ──────────────────────────────────────────────────────────
interface NoteFormProps {
  onSubmit: (date: string, initials: string, note: string) => void;
  loading: boolean;
}

function NoteEntryForm({ onSubmit, loading }: NoteFormProps) {
  const [date, setDate] = useState("");
  const [initials, setInitials] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!date.trim()) e.date = "Date is required.";
    else if (!/^(0?[1-9]|1[0-2])\.(0?[1-9]|[12]\d|3[01])\.\d{2}$/.test(date.trim()))
      e.date = "Use M.D.YY format (e.g. 7.1.26).";
    if (!initials.trim()) e.initials = "Initials are required.";
    if (!note.trim()) e.note = "Note text is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(date.trim(), initials.trim(), note.trim());
    setDate("");
    setInitials("");
    setNote("");
    setErrors({});
  };

  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
            Date <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="7.1.26"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`h-8 text-sm ${errors.date ? "border-destructive" : ""}`}
          />
          {errors.date && <p className="text-xs text-destructive mt-1">{errors.date}</p>}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
            Initials <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="JD"
            value={initials}
            onChange={(e) => setInitials(e.target.value.toUpperCase())}
            maxLength={6}
            className={`h-8 text-sm ${errors.initials ? "border-destructive" : ""}`}
          />
          {errors.initials && <p className="text-xs text-destructive mt-1">{errors.initials}</p>}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
          Note <span className="text-destructive">*</span>
        </label>
        <Textarea
          placeholder="Enter note text..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={`text-sm resize-none ${errors.note ? "border-destructive" : ""}`}
        />
        {errors.note && <p className="text-xs text-destructive mt-1">{errors.note}</p>}
      </div>
      <Button onClick={handleSubmit} disabled={loading} size="sm" className="w-full">
        {loading ? "Saving..." : "Add Note"}
      </Button>
    </div>
  );
}

// ─── Main ContactDetail component ─────────────────────────────────────────────
export default function ContactDetail({ contact: initial, onBack }: Props) {
  const utils = trpc.useUtils();

  // Live contact data (refreshed after mutations)
  const { data: contact } = trpc.keap.getContact.useQuery(
    { contactId: initial.id },
    { initialData: initial, refetchOnWindowFocus: false }
  );

  // ── Phone edit state ──────────────────────────────────────────────────────
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(contact?.phone ?? "");
  const [phoneConfirm, setPhoneConfirm] = useState(false);

  // ── Note confirm state ────────────────────────────────────────────────────
  const [personNoteConfirm, setPersonNoteConfirm] = useState<{
    date: string; initials: string; note: string;
  } | null>(null);
  const [sellSideNoteConfirm, setSellSideNoteConfirm] = useState<{
    date: string; initials: string; note: string;
  } | null>(null);

  // ── Tag confirm state ─────────────────────────────────────────────────────
  const [tagConfirm, setTagConfirm] = useState<{
    tagId: number; label: string; description: string;
  } | null>(null);
  const [stopCampaignConfirm, setStopCampaignConfirm] = useState(false);
  // After applying Find New Contact, prompt about stop campaign
  const [postRetiredStopCampaign, setPostRetiredStopCampaign] = useState(false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updatePhone = trpc.keap.updatePhone.useMutation({
    onSuccess: () => {
      toast.success("Phone number updated.");
      setEditingPhone(false);
      setPhoneConfirm(false);
      utils.keap.getContact.invalidate({ contactId: initial.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePersonNotes = trpc.keap.updatePersonNotes.useMutation({
    onSuccess: () => {
      toast.success("Person note saved.");
      setPersonNoteConfirm(null);
      utils.keap.getContact.invalidate({ contactId: initial.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSellSideNotes = trpc.keap.updateSellSideNotes.useMutation({
    onSuccess: () => {
      toast.success("Sell-Side Prospect note saved.");
      setSellSideNoteConfirm(null);
      utils.keap.getContact.invalidate({ contactId: initial.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const applyTag = trpc.keap.applyTag.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Tag applied successfully.`);
      const wasRetiredTag = vars.tagId === TAG_IDS.FIND_NEW_CONTACT;
      setTagConfirm(null);
      utils.keap.getContact.invalidate({ contactId: initial.id });
      // After applying Find New Contact, prompt about stop campaign
      if (wasRetiredTag) {
        setTimeout(() => setPostRetiredStopCampaign(true), 400);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const applyStopCampaign = trpc.keap.applyStopCampaignTag.useMutation({
    onSuccess: () => {
      toast.success("Stop Campaign tag applied.");
      setStopCampaignConfirm(false);
      utils.keap.getContact.invalidate({ contactId: initial.id });
    },
    onError: (e) => toast.error(e.message),
  });

  if (!contact) return null;

  const TAG_IDS = { ADMIN_OPT_OUT: 22830, COMPANY_CLOSED: 17610, FIND_NEW_CONTACT: 16548 } as const;
  const hasTag = (id: number) => contact.tagIds.includes(id);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        New Search
      </button>

      {/* ── Contact Header ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{contact.fullName}</h2>
            <p className="text-muted-foreground mt-0.5">{contact.companyName}</p>
            <p className="text-sm text-muted-foreground mt-1">{contact.email}</p>
          </div>
          {/* Applied tags indicator */}
          <div className="flex flex-wrap gap-1.5">
            {hasTag(TAG_IDS.ADMIN_OPT_OUT) && (
              <Badge variant="destructive" className="text-xs">Opted Out</Badge>
            )}
            {hasTag(TAG_IDS.COMPANY_CLOSED) && (
              <Badge variant="secondary" className="text-xs">Company Closed</Badge>
            )}
            {hasTag(TAG_IDS.FIND_NEW_CONTACT) && (
              <Badge variant="secondary" className="text-xs">Find New Contact</Badge>
            )}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Phone */}
        <div className="flex items-center gap-3">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          {editingPhone ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                className="h-8 text-sm max-w-[220px]"
                autoFocus
              />
              <button
                onClick={() => setPhoneConfirm(true)}
                className="text-primary hover:text-primary/80 transition-colors"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setEditingPhone(false); setPhoneValue(contact.phone); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm">{contact.phone || <span className="text-muted-foreground italic">No phone on file</span>}</span>
              <button
                onClick={() => { setEditingPhone(true); setPhoneValue(contact.phone); }}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1"
                title="Edit phone"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Notes Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── Sell-Side Prospect Notes (PRIMARY — spans 2 cols on lg) ──────── */}
        <div className="lg:col-span-2 sell-side-primary rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-foreground">Sell-Side Prospect Notes</h3>
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-200 ml-1">
              Primary
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Main notes area for this prospect. Date and initials required.</p>

          {/* Existing notes */}
          {contact.sellSideNotes ? (
            <div className="bg-white/70 rounded-lg border border-amber-200/60 p-3 mb-4 max-h-48 overflow-y-auto">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {contact.sellSideNotes}
              </pre>
            </div>
          ) : (
            <div className="bg-white/50 rounded-lg border border-amber-200/40 p-3 mb-4 text-sm text-muted-foreground italic">
              No notes yet.
            </div>
          )}

          <NoteEntryForm
            loading={updateSellSideNotes.isPending}
            onSubmit={(date, initials, note) => setSellSideNoteConfirm({ date, initials, note })}
          />
        </div>

        {/* ── Person Notes ─────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Person Notes</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">General contact notes. Date and initials required.</p>

          {contact.personNotes ? (
            <div className="bg-muted/50 rounded-lg border border-border p-3 mb-4 max-h-40 overflow-y-auto">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {contact.personNotes}
              </pre>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-lg border border-border p-3 mb-4 text-sm text-muted-foreground italic">
              No notes yet.
            </div>
          )}

          <NoteEntryForm
            loading={updatePersonNotes.isPending}
            onSubmit={(date, initials, note) => setPersonNoteConfirm({ date, initials, note })}
          />
        </div>
      </div>

      {/* ── Buy-Side Notes (Read-Only) ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Buy-Side Notes</h3>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">Read Only</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Populated from Keap field ID 315. Not editable here.</p>
        {contact.buySideNotes ? (
          <div className="bg-muted/30 rounded-lg border border-border p-4 max-h-48 overflow-y-auto">
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {contact.buySideNotes}
            </pre>
          </div>
        ) : (
          <div className="bg-muted/20 rounded-lg border border-border p-4 text-sm text-muted-foreground italic">
            No buy-side notes on file.
          </div>
        )}
      </div>

      {/* ── Actions Panel ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Contact Actions</h3>
        </div>

                {/* Row 1: three tag actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Opt Out */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Opt-Out Contact</p>
            <p className="text-xs text-muted-foreground">Apply the Admin Opt Out tag to this contact.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={hasTag(TAG_IDS.ADMIN_OPT_OUT)}
              onClick={() => setTagConfirm({
                tagId: TAG_IDS.ADMIN_OPT_OUT,
                label: "Admin Opt Out",
                description: "This will apply the 'Admin Opt Out' tag to the contact. This action cannot be undone from this tool.",
              })}
              className="w-full text-xs"
            >
              {hasTag(TAG_IDS.ADMIN_OPT_OUT) ? "Already Applied" : "Apply Opt-Out"}
            </Button>
          </div>

          {/* Company Closed */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Company Closed or Acquired</p>
            <p className="text-xs text-muted-foreground">Mark this company as no longer active.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={hasTag(TAG_IDS.COMPANY_CLOSED)}
              onClick={() => setTagConfirm({
                tagId: TAG_IDS.COMPANY_CLOSED,
                label: "Company Closed or Acquired",
                description: "This will apply the 'Company Closed or Acquired' tag. Confirm this is accurate before proceeding.",
              })}
              className="w-full text-xs"
            >
              {hasTag(TAG_IDS.COMPANY_CLOSED) ? "Already Applied" : "Apply Tag"}
            </Button>
          </div>

          {/* Find New Contact */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Find New Contact</p>
            <p className="text-xs text-muted-foreground">Apply when the contact is retired or replaced.</p>
            <Button
              size="sm"
              variant="outline"
              disabled={hasTag(TAG_IDS.FIND_NEW_CONTACT)}
              onClick={() => setTagConfirm({
                tagId: TAG_IDS.FIND_NEW_CONTACT,
                label: "Find New Contact",
                description: "This will apply the 'Find New Contact' tag, indicating this contact is retired or has been replaced.",
              })}
              className="w-full text-xs"
            >
              {hasTag(TAG_IDS.FIND_NEW_CONTACT) ? "Already Applied" : "Apply Tag"}
            </Button>
          </div>
        </div>

        {/* Row 2: Stop Campaign — full width, standalone */}
        <div className="border-2 border-amber-300 bg-amber-50/50 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 flex-1">
              <p className="text-sm font-semibold text-foreground">Stop Email Campaign</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apply this tag if the contact is no longer applicable to further marketing outreach, or if a successful connection has been made and all future communication should be handled manually going forward. This applies the <span className="font-medium text-foreground">BusDev — Stop Campaign</span> tag under the Prospect Tags category.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStopCampaignConfirm(true)}
              className="shrink-0 border-amber-400 hover:bg-amber-100 text-amber-900 font-medium"
            >
              Stop Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────── Confirmation Dialogs ─────────────────── */}

      {/* Phone confirm */}
      <ConfirmDialog
        open={phoneConfirm}
        title="Update Phone Number"
        description={`Save "${phoneValue}" as the new phone number for ${contact.fullName}?`}
        confirmLabel="Save Phone"
        onConfirm={() => updatePhone.mutate({ contactId: contact.id, phone: phoneValue })}
        onCancel={() => setPhoneConfirm(false)}
      />

      {/* Person notes confirm */}
      <ConfirmDialog
        open={!!personNoteConfirm}
        title="Save Person Note"
        description={
          personNoteConfirm
            ? `Add note entry: "${personNoteConfirm.date} - ${personNoteConfirm.initials.toUpperCase()} - ${personNoteConfirm.note}" to Person Notes?`
            : ""
        }
        confirmLabel="Save Note"
        onConfirm={() => {
          if (!personNoteConfirm) return;
          updatePersonNotes.mutate({
            contactId: contact.id,
            existingNotes: contact.personNotes,
            ...personNoteConfirm,
          });
        }}
        onCancel={() => setPersonNoteConfirm(null)}
      />

      {/* Sell-side notes confirm */}
      <ConfirmDialog
        open={!!sellSideNoteConfirm}
        title="Save Sell-Side Prospect Note"
        description={
          sellSideNoteConfirm
            ? `Add note entry: "${sellSideNoteConfirm.date} - ${sellSideNoteConfirm.initials.toUpperCase()} - ${sellSideNoteConfirm.note}" to Sell-Side Prospect Notes?`
            : ""
        }
        confirmLabel="Save Note"
        onConfirm={() => {
          if (!sellSideNoteConfirm) return;
          updateSellSideNotes.mutate({
            contactId: contact.id,
            existingNotes: contact.sellSideNotes,
            ...sellSideNoteConfirm,
          });
        }}
        onCancel={() => setSellSideNoteConfirm(null)}
      />

      {/* Generic tag confirm */}
      <ConfirmDialog
        open={!!tagConfirm}
        title={`Apply Tag: ${tagConfirm?.label ?? ""}`}
        description={tagConfirm?.description ?? ""}
        confirmLabel="Apply Tag"
        destructive
        onConfirm={() => {
          if (!tagConfirm) return;
          applyTag.mutate({ contactId: contact.id, tagId: tagConfirm.tagId });
        }}
        onCancel={() => setTagConfirm(null)}
      />

      {/* Post-retired stop campaign prompt */}
      <Dialog open={postRetiredStopCampaign} onOpenChange={(v) => !v && setPostRetiredStopCampaign(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              One More Step — Email Campaign
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              Do you need to stop the email campaign for this contact? Have they requested a stop or are we moving forward in communication with them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setPostRetiredStopCampaign(false)}
              className="sm:order-1"
            >
              Moving Forward — No Stop
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setPostRetiredStopCampaign(false);
                applyStopCampaign.mutate({ contactId: contact.id });
              }}
              disabled={applyStopCampaign.isPending}
              className="sm:order-2"
            >
              Stop Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stop Campaign confirm — exact wording required */}
      <Dialog open={stopCampaignConfirm} onOpenChange={(v) => !v && setStopCampaignConfirm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Stop Email Campaign
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed pt-2">
              Do you need to stop the email campaign for this contact? Have they requested a stop or are we moving forward in communication with them?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setStopCampaignConfirm(false)}
              className="sm:order-1"
            >
              Moving Forward — No Stop
            </Button>
            <Button
              variant="destructive"
              onClick={() => applyStopCampaign.mutate({ contactId: contact.id })}
              disabled={applyStopCampaign.isPending}
              className="sm:order-2"
            >
              {applyStopCampaign.isPending ? "Applying..." : "Stop Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
