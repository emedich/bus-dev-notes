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
  BookOpen,
  FileText,
  Lock,
  ChevronLeft,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface NoteEntry {
  date: string;
  initials: string;
  note: string;
  existingNotes: string;
}

interface StagedChanges {
  phone?: string;
  personNote?: NoteEntry;
  sellSideNote?: NoteEntry;
  tagIds: number[];
  applyStopCampaign: boolean;
}

const TAG_LABELS: Record<number, string> = {
  22830: "Admin Opt Out",
  17610: "Company Closed or Acquired",
  16548: "Find New Contact",
};

// ─── Note Entry Form ──────────────────────────────────────────────────────────
interface NoteFormProps {
  onStage: (date: string, initials: string, note: string) => void;
  staged: NoteEntry | undefined;
  onClear: () => void;
}

function NoteEntryForm({ onStage, staged, onClear }: NoteFormProps) {
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

  const handleStage = () => {
    if (!validate()) return;
    onStage(date.trim(), initials.trim(), note.trim());
    setDate("");
    setInitials("");
    setNote("");
    setErrors({});
  };

  if (staged) {
    return (
      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-xs text-green-800 break-words">
            <span className="font-medium">{staged.date} — {staged.initials.toUpperCase()}</span>
            {" "}— {staged.note}
          </p>
        </div>
        <button onClick={onClear} className="text-green-600 hover:text-green-800 shrink-0" title="Remove">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

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
      <Button onClick={handleStage} size="sm" variant="outline" className="w-full">
        Stage Note
      </Button>
    </div>
  );
}

// ─── Main ContactDetail ───────────────────────────────────────────────────────
interface Props {
  contact: ContactSummary;
  onBack: () => void;
}

export default function ContactDetail({ contact: initial, onBack }: Props) {
  const utils = trpc.useUtils();

  const { data: contact } = trpc.keap.getContact.useQuery(
    { contactId: initial.id },
    { initialData: initial, refetchOnWindowFocus: false }
  );

  // ── Phone edit ────────────────────────────────────────────────────────────
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(contact?.phone ?? "");

  // ── Staged changes ────────────────────────────────────────────────────────
  const [staged, setStaged] = useState<StagedChanges>({
    tagIds: [],
    applyStopCampaign: false,
  });

  // ── Review dialog ─────────────────────────────────────────────────────────
  const [reviewOpen, setReviewOpen] = useState(false);

  // ── Batch apply mutation ──────────────────────────────────────────────────
  const applyChanges = trpc.keap.applyChanges.useMutation({
    onSuccess: () => {
      toast.success("All changes saved to Keap.");
      setReviewOpen(false);
      setStaged({ tagIds: [], applyStopCampaign: false });
      setEditingPhone(false);
      utils.keap.getContact.invalidate({ contactId: initial.id });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (!contact) return null;

  const TAG_IDS = { ADMIN_OPT_OUT: 22830, COMPANY_CLOSED: 17610, FIND_NEW_CONTACT: 16548 } as const;
  const hasTag = (id: number) => contact.tagIds.includes(id);
  const isTagStaged = (id: number) => staged.tagIds.includes(id);

  // ── Stage helpers ─────────────────────────────────────────────────────────
  const stagePhone = () => {
    if (phoneValue.trim() === contact.phone) {
      setEditingPhone(false);
      return;
    }
    setStaged((s) => ({ ...s, phone: phoneValue.trim() }));
    setEditingPhone(false);
  };

  const stageTag = (tagId: number) => {
    if (isTagStaged(tagId)) return;
    setStaged((s) => ({ ...s, tagIds: [...s.tagIds, tagId] }));
    // Find New Contact also stages stop campaign prompt
    if (tagId === TAG_IDS.FIND_NEW_CONTACT) {
      setStaged((s) => ({ ...s, applyStopCampaign: true }));
    }
  };

  const unstageTag = (tagId: number) => {
    setStaged((s) => ({ ...s, tagIds: s.tagIds.filter((id) => id !== tagId) }));
  };

  // ── Pending count ─────────────────────────────────────────────────────────
  const pendingCount =
    (staged.phone !== undefined ? 1 : 0) +
    (staged.personNote ? 1 : 0) +
    (staged.sellSideNote ? 1 : 0) +
    staged.tagIds.length +
    (staged.applyStopCampaign ? 1 : 0);

  // ── Proceed ───────────────────────────────────────────────────────────────
  const handleProceed = () => {
    applyChanges.mutate({
      contactId: contact.id,
      phone: staged.phone,
      personNote: staged.personNote,
      sellSideNote: staged.sellSideNote,
      tagIds: staged.tagIds.length ? staged.tagIds : undefined,
      applyStopCampaign: staged.applyStopCampaign || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Back + Review bar */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          New Search
        </button>

        {pendingCount > 0 && (
          <Button
            onClick={() => setReviewOpen(true)}
            className="flex items-center gap-2"
          >
            <ClipboardList className="h-4 w-4" />
            Review &amp; Save
            <Badge variant="secondary" className="ml-1 bg-white/20 text-white text-xs px-1.5">
              {pendingCount}
            </Badge>
          </Button>
        )}
      </div>

      {/* ── Contact Header ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">{contact.fullName}</h2>
            <p className="text-muted-foreground mt-0.5">{contact.companyName}</p>
            <p className="text-sm text-muted-foreground mt-1">{contact.email}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hasTag(TAG_IDS.ADMIN_OPT_OUT) && <Badge variant="destructive" className="text-xs">Opted Out</Badge>}
            {hasTag(TAG_IDS.COMPANY_CLOSED) && <Badge variant="secondary" className="text-xs">Company Closed</Badge>}
            {hasTag(TAG_IDS.FIND_NEW_CONTACT) && <Badge variant="secondary" className="text-xs">Find New Contact</Badge>}
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
              <button onClick={stagePhone} className="text-primary hover:text-primary/80 transition-colors" title="Stage change">
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setEditingPhone(false); setPhoneValue(contact.phone); setStaged((s) => { const { phone: _, ...rest } = s; return rest as StagedChanges; }); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {staged.phone
                  ? <><span className="line-through text-muted-foreground mr-1">{contact.phone}</span><span className="text-primary font-medium">{staged.phone}</span></>
                  : contact.phone || <span className="text-muted-foreground italic">No phone on file</span>
                }
              </span>
              <button
                onClick={() => { setEditingPhone(true); setPhoneValue(staged.phone ?? contact.phone); }}
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

        {/* Sell-Side Prospect Notes (PRIMARY) */}
        <div className="lg:col-span-2 sell-side-primary rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-amber-600" />
            <h3 className="font-semibold text-foreground">Sell-Side Prospect Notes</h3>
            <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-200 ml-1">Primary</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Main notes area for this prospect. Date and initials required.</p>

          {contact.sellSideNotes ? (
            <div className="bg-white/70 rounded-lg border border-amber-200/60 p-3 mb-4 max-h-48 overflow-y-auto">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{contact.sellSideNotes}</pre>
            </div>
          ) : (
            <div className="bg-white/50 rounded-lg border border-amber-200/40 p-3 mb-4 text-sm text-muted-foreground italic">No notes yet.</div>
          )}

          <NoteEntryForm
            staged={staged.sellSideNote}
            onStage={(date, initials, note) =>
              setStaged((s) => ({ ...s, sellSideNote: { date, initials, note, existingNotes: contact.sellSideNotes } }))
            }
            onClear={() => setStaged((s) => { const { sellSideNote: _, ...rest } = s; return rest as StagedChanges; })}
          />
        </div>

        {/* Person Notes */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">Person Notes</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">General contact notes. Date and initials required.</p>

          {contact.personNotes ? (
            <div className="bg-muted/50 rounded-lg border border-border p-3 mb-4 max-h-40 overflow-y-auto">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{contact.personNotes}</pre>
            </div>
          ) : (
            <div className="bg-muted/30 rounded-lg border border-border p-3 mb-4 text-sm text-muted-foreground italic">No notes yet.</div>
          )}

          <NoteEntryForm
            staged={staged.personNote}
            onStage={(date, initials, note) =>
              setStaged((s) => ({ ...s, personNote: { date, initials, note, existingNotes: contact.personNotes } }))
            }
            onClear={() => setStaged((s) => { const { personNote: _, ...rest } = s; return rest as StagedChanges; })}
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
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{contact.buySideNotes}</pre>
          </div>
        ) : (
          <div className="bg-muted/20 rounded-lg border border-border p-4 text-sm text-muted-foreground italic">No buy-side notes on file.</div>
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
              variant={isTagStaged(TAG_IDS.ADMIN_OPT_OUT) ? "secondary" : "outline"}
              disabled={hasTag(TAG_IDS.ADMIN_OPT_OUT)}
              onClick={() => isTagStaged(TAG_IDS.ADMIN_OPT_OUT) ? unstageTag(TAG_IDS.ADMIN_OPT_OUT) : stageTag(TAG_IDS.ADMIN_OPT_OUT)}
              className="w-full text-xs"
            >
              {hasTag(TAG_IDS.ADMIN_OPT_OUT) ? "Already Applied" : isTagStaged(TAG_IDS.ADMIN_OPT_OUT) ? "✓ Staged — Click to Remove" : "Apply Opt-Out"}
            </Button>
          </div>

          {/* Company Closed */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Company Closed or Acquired</p>
            <p className="text-xs text-muted-foreground">Mark this company as no longer active.</p>
            <Button
              size="sm"
              variant={isTagStaged(TAG_IDS.COMPANY_CLOSED) ? "secondary" : "outline"}
              disabled={hasTag(TAG_IDS.COMPANY_CLOSED)}
              onClick={() => isTagStaged(TAG_IDS.COMPANY_CLOSED) ? unstageTag(TAG_IDS.COMPANY_CLOSED) : stageTag(TAG_IDS.COMPANY_CLOSED)}
              className="w-full text-xs"
            >
              {hasTag(TAG_IDS.COMPANY_CLOSED) ? "Already Applied" : isTagStaged(TAG_IDS.COMPANY_CLOSED) ? "✓ Staged — Click to Remove" : "Apply Tag"}
            </Button>
          </div>

          {/* Find New Contact */}
          <div className="border border-border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">Find New Contact</p>
            <p className="text-xs text-muted-foreground">Apply when the contact is retired or replaced.</p>
            <Button
              size="sm"
              variant={isTagStaged(TAG_IDS.FIND_NEW_CONTACT) ? "secondary" : "outline"}
              disabled={hasTag(TAG_IDS.FIND_NEW_CONTACT)}
              onClick={() => isTagStaged(TAG_IDS.FIND_NEW_CONTACT) ? unstageTag(TAG_IDS.FIND_NEW_CONTACT) : stageTag(TAG_IDS.FIND_NEW_CONTACT)}
              className="w-full text-xs"
            >
              {hasTag(TAG_IDS.FIND_NEW_CONTACT) ? "Already Applied" : isTagStaged(TAG_IDS.FIND_NEW_CONTACT) ? "✓ Staged — Click to Remove" : "Apply Tag"}
            </Button>
          </div>
        </div>

        {/* Row 2: Stop Campaign */}
        <div className="mt-3 border-2 border-amber-300 bg-amber-50/50 rounded-lg p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1 flex-1">
              <p className="text-sm font-semibold text-foreground">Stop Email Campaign</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Apply this tag if the contact is no longer applicable to further marketing outreach, or if a successful connection has been made and all future communication should be handled manually going forward. This applies the <span className="font-medium text-foreground">BusDev — Stop Campaign</span> tag under the Prospect Tags category.
              </p>
            </div>
            <Button
              size="sm"
              variant={staged.applyStopCampaign ? "secondary" : "outline"}
              onClick={() => setStaged((s) => ({ ...s, applyStopCampaign: !s.applyStopCampaign }))}
              className="shrink-0 border-amber-400 hover:bg-amber-100 text-amber-900 font-medium"
            >
              {staged.applyStopCampaign ? "✓ Staged — Click to Remove" : "Stop Campaign"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Review & Save Dialog ────────────────────────────────────────────── */}
      <Dialog open={reviewOpen} onOpenChange={(v) => !v && setReviewOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Review Changes
            </DialogTitle>
            <DialogDescription className="text-sm pt-1">
              The following changes will be saved to Keap for <span className="font-medium text-foreground">{contact.fullName}</span>. Proceed?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            {staged.phone !== undefined && (
              <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/40">
                <Phone className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <span><span className="font-medium">Phone updated:</span> {staged.phone}</span>
              </div>
            )}
            {staged.sellSideNote && (
              <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-amber-50 border border-amber-200">
                <FileText className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                <span>
                  <span className="font-medium text-amber-900">Sell-Side Note added:</span>{" "}
                  <span className="text-amber-800">{staged.sellSideNote.date} — {staged.sellSideNote.initials.toUpperCase()} — {staged.sellSideNote.note}</span>
                </span>
              </div>
            )}
            {staged.personNote && (
              <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/40">
                <BookOpen className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <span>
                  <span className="font-medium">Person Note added:</span>{" "}
                  {staged.personNote.date} — {staged.personNote.initials.toUpperCase()} — {staged.personNote.note}
                </span>
              </div>
            )}
            {staged.tagIds.map((id) => (
              <div key={id} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/40">
                <Tag className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <span><span className="font-medium">Tag applied:</span> {TAG_LABELS[id] ?? `Tag ID ${id}`}</span>
              </div>
            ))}
            {staged.applyStopCampaign && (
              <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-amber-50 border border-amber-200">
                <Tag className="h-3.5 w-3.5 mt-0.5 text-amber-600 shrink-0" />
                <span className="text-amber-900"><span className="font-medium">Tag applied:</span> BusDev — Stop Campaign</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Go Back
            </Button>
            <Button onClick={handleProceed} disabled={applyChanges.isPending}>
              {applyChanges.isPending ? "Saving..." : "Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
