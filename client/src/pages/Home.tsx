import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Search, AlertTriangle, Users } from "lucide-react";
import ContactDetail from "./ContactDetail";

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

interface DuplicateContact {
  id: number;
  fullName: string;
  email: string;
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [selectedDuplicateId, setSelectedDuplicateId] = useState<number | null>(null);

  const searchQuery = trpc.keap.searchByEmail.useQuery(
    { email: submittedEmail },
    { enabled: !!submittedEmail, retry: false, refetchOnWindowFocus: false }
  );

  const getContactQuery = trpc.keap.getContact.useQuery(
    { contactId: selectedDuplicateId ?? 0 },
    { enabled: !!selectedDuplicateId, retry: false, refetchOnWindowFocus: false }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setSelectedContact(null);
    setSelectedDuplicateId(null);
    setSubmittedEmail(trimmed);
  };

  const handleBack = () => {
    setSelectedContact(null);
    setSelectedDuplicateId(null);
    setSubmittedEmail("");
    setEmail("");
  };

  // Auto-select when single contact found
  const singleContact = !searchQuery.data?.duplicate ? searchQuery.data?.contact ?? null : null;
  const activeContact = selectedContact ?? (getContactQuery.data ?? null) ?? singleContact;

  const duplicates: DuplicateContact[] = searchQuery.data?.duplicate
    ? searchQuery.data.contacts
    : [];

  if (activeContact) {
    return (
      <ContactDetail contact={activeContact} onBack={handleBack} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1">
          Contact Lookup
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          Search for a Keap contact by email address to view and manage their notes and tags.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="email"
              placeholder="Enter email address..."
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={searchQuery.isFetching || !email.trim()}>
            {searchQuery.isFetching ? "Searching..." : "Search"}
          </Button>
        </form>
      </div>

      {/* Error */}
      {searchQuery.error && (
        <Alert variant="destructive" className="max-w-xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {searchQuery.error.data?.code === "NOT_FOUND" ? "Not Found" : "Error"}
          </AlertTitle>
          <AlertDescription>{searchQuery.error.message}</AlertDescription>
        </Alert>
      )}

      {/* Duplicate warning */}
      {duplicates.length > 1 && (
        <div className="max-w-xl space-y-3">
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Duplicate Contacts Found</AlertTitle>
            <AlertDescription className="text-amber-800">
              {duplicates.length} contacts share this email address. Please merge duplicates in Keap, or select one below to proceed.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            {duplicates.map((c) => (
              <Card
                key={c.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedDuplicateId(c.id)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">{c.fullName}</p>
                    <p className="text-xs text-muted-foreground">{c.email} · ID {c.id}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    {getContactQuery.isFetching && selectedDuplicateId === c.id ? "Loading..." : "Select"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!submittedEmail && (
        <div className="max-w-xl mt-8 flex flex-col items-center text-center py-12 border border-dashed border-border rounded-xl text-muted-foreground">
          <Users className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Enter an email address above to get started.</p>
          <p className="text-xs mt-1 opacity-70">Contact details, notes, and tag actions will appear here.</p>
        </div>
      )}
    </div>
  );
}
