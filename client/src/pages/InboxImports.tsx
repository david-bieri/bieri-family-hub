import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN } from "@/lib/children";
import { AttendeeList } from "@/components/ChildBadge";
import { format, parseISO } from "date-fns";
import {
  Mail, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Inbox, RefreshCw, AlertCircle, Calendar, CreditCard,
  Stethoscope, ClipboardList, Tag, Clock, HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const CHILD_COLORS: Record<string, string> = {
  cole: "#3b82f6", greta: "#8b5cf6", airlie: "#22c55e",
  clara: "#f59e0b", heidi: "#ec4899", daisy: "#14b8a6",
};

const TYPE_ICONS: Record<string, any> = {
  event: Calendar,
  appointment: Stethoscope,
  payment: CreditCard,
  registration: ClipboardList,
  task: Tag,
};

const TYPE_COLORS: Record<string, string> = {
  event: "bg-blue-100 text-blue-700",
  appointment: "bg-red-100 text-red-700",
  payment: "bg-cyan-100 text-cyan-700",
  registration: "bg-amber-100 text-amber-700",
  task: "bg-gray-100 text-gray-700",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low:    "bg-orange-100 text-orange-700",
};

interface ExtractedItem {
  id: string;
  type: string;
  title: string;
  date?: string;
  time?: string;
  amount?: string;
  child_ids?: string[];
  category?: string;
  notes?: string;
  confidence: string;
  source_hint: string;
  _accepted?: boolean;
  _dismissed?: boolean;
}

interface PendingImport {
  id: string;
  raw_subject: string;
  raw_from: string;
  raw_date: string;
  raw_snippet: string;
  extracted: ExtractedItem[];
  created_at: string;
}

function ExtractedItemCard({
  item,
  index,
  importId,
  onDone,
}: {
  item: ExtractedItem;
  index: number;
  importId: string;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const Icon = TYPE_ICONS[item.type] || Calendar;

  const accept = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/inbox/${importId}/accept`, { item_index: index }),
    onSuccess: () => {
      toast({ title: "Added to calendar", description: item.title });
      qc.invalidateQueries({ queryKey: ["/api/inbox/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      qc.invalidateQueries({ queryKey: ["/api/payments"] });
      qc.invalidateQueries({ queryKey: ["/api/appointments"] });
      qc.invalidateQueries({ queryKey: ["/api/registrations"] });
      onDone();
    },
  });

  const dismiss = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/inbox/${importId}/dismiss`, { item_index: index }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inbox/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      onDone();
    },
  });

  if (item._accepted || item._dismissed) return null;

  return (
    <div className="border border-border rounded-lg p-3 bg-background hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-md mt-0.5 shrink-0", TYPE_COLORS[item.type])}>
          <Icon size={13} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-sm">{item.title}</span>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", TYPE_COLORS[item.type])}>
              {item.type}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CONFIDENCE_COLORS[item.confidence])}>
              {item.confidence} confidence
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-1.5">
            {item.date && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {format(parseISO(item.date), "MMM d, yyyy")}
                {item.time && ` · ${item.time}`}
              </span>
            )}
            {item.amount && (
              <span className="flex items-center gap-1">
                <CreditCard size={10} /> {item.amount}
              </span>
            )}
          </div>

          {(item.child_ids || []).length > 0 && (
            <div className="mb-1.5">
              <AttendeeList ids={item.child_ids || []} />
            </div>
          )}

          {item.notes && (
            <p className="text-[11px] text-muted-foreground mb-1.5 line-clamp-2">{item.notes}</p>
          )}

          <div className="text-[10px] text-muted-foreground italic truncate">
            "{item.source_hint}"
          </div>
        </div>

        <div className="flex flex-col gap-1.5 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-primary hover:bg-primary/90"
            onClick={() => accept.mutate()}
            disabled={accept.isPending || dismiss.isPending}
            data-testid={`button-accept-item-${index}`}
          >
            <CheckCircle size={12} />
            Add
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => dismiss.mutate()}
            disabled={accept.isPending || dismiss.isPending}
            data-testid={`button-dismiss-item-${index}`}
          >
            <XCircle size={12} />
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportCard({ record }: { record: PendingImport }) {
  const [expanded, setExpanded] = useState(true);
  const qc = useQueryClient();

  const dismiss = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inbox/${record.id}/dismiss`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inbox/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/inbox/count"] });
    },
  });

  const activeItems = record.extracted.filter((i) => !i._accepted && !i._dismissed);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Email header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="p-2 rounded-lg bg-muted shrink-0 mt-0.5">
          <Mail size={14} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{record.raw_subject}</span>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {activeItems.length} item{activeItems.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="truncate">{record.raw_from}</span>
            {record.raw_date && (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <Clock size={9} />
                  {record.raw_date}
                </span>
              </>
            )}
          </div>
          {record.raw_snippet && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1 italic">
              {record.raw_snippet}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); dismiss.mutate(); }}
            data-testid={`button-dismiss-email-${record.id}`}
          >
            <XCircle size={13} className="mr-1" /> Dismiss all
          </Button>
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </div>
      </div>

      {/* Extracted items */}
      {expanded && activeItems.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
          {record.extracted.map((item, i) => (
            <ExtractedItemCard
              key={item.id || i}
              item={item}
              index={i}
              importId={record.id}
              onDone={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InboxImports() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: imports = [], isLoading, refetch, isFetching } = useQuery<PendingImport[]>({
    queryKey: ["/api/inbox/pending"],
    queryFn: async () => (await apiRequest("GET", "/api/inbox/pending")).json(),
    refetchInterval: 30_000,
  });

  const triggerScan = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/inbox/trigger-scan")).json(),
    onSuccess: (data: any) => {
      if (data.ok) {
        toast({
          title: "Email scan complete",
          description: `${data.new_items} new item(s) found, ${data.skipped} already processed.`,
        });
        qc.invalidateQueries({ queryKey: ["/api/inbox/pending"] });
        qc.invalidateQueries({ queryKey: ["/api/inbox/count"] });
      } else {
        toast({ title: "Scan issue", description: data.error || "Unknown error", variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message || "Could not reach the scan service", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Inbox size={20} className="text-primary" />
            Inbox Imports
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Items extracted from your email — review and add to the family calendar
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => triggerScan.mutate()}
            disabled={triggerScan.isPending}
            data-testid="button-scan-now"
            className="gap-1.5"
          >
            <Mail size={13} className={triggerScan.isPending ? "animate-pulse" : ""} />
            {triggerScan.isPending ? "Scanning..." : "Scan Now"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-inbox"
            className="gap-1.5"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && imports.length === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
          <Inbox size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm font-medium">No pending imports</p>
          <p className="text-xs text-muted-foreground mt-1">
            Once the daily email scan runs, extracted items will appear here for your review.
          </p>
          <div className="mt-4 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground max-w-sm mx-auto">
            <AlertCircle size={12} className="inline mr-1" />
            The daily scan checks your Gmail inbox each morning for new school newsletters,
            appointment reminders, camp registration emails, and payment notices.
          </div>
        </div>
      )}

      {!isLoading && imports.length > 0 && (
        <div className="space-y-4">
          {imports.map((record) => (
            <ImportCard key={record.id} record={record} />
          ))}
        </div>
      )}

      {/* Email Scanning Syntax Reference */}
      <EmailSyntaxHelp />
    </div>
  );
}

// ─── Email Scanning Syntax Help ─────────────────────────────────────────────
function EmailSyntaxHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <HelpCircle size={15} className="text-primary shrink-0" />
        <span className="text-sm font-medium flex-1">Email Scanning Quick Reference</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Forward or send emails to your connected Gmail with these subject-line shortcuts for instant categorization (no AI needed):
          </p>

          <div className="space-y-3">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Category Tags</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { tag: "#CAMP", desc: "Camp / program" },
                  { tag: "#SPORT", desc: "Sports event" },
                  { tag: "#SCHOOL", desc: "School event" },
                  { tag: "#MED", desc: "Medical / vet" },
                  { tag: "#PAY", desc: "Payment due" },
                  { tag: "#REG", desc: "Registration" },
                  { tag: "#PET", desc: "Pet-related" },
                  { tag: "#FAM", desc: "Family event" },
                  { tag: "#OFFICE", desc: "Work / professional" },
                  { tag: "#TRAVEL", desc: "Travel / trips" },
                  { tag: "#HOUSE", desc: "Home / maintenance" },
                  { tag: "#INVITE", desc: "Social invitations" },
                ].map(({ tag, desc }) => (
                  <div key={tag} className="bg-muted/60 rounded-md px-2.5 py-1.5">
                    <code className="text-xs font-bold text-primary">{tag}</code>
                    <span className="text-[10px] text-muted-foreground ml-1.5">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Person Tags</h4>
              <p className="text-xs text-muted-foreground mb-1.5">
                Use <code className="bg-muted px-1 rounded">@Name</code> to assign items to family members:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["@David", "@Nancy", "@Cole", "@Greta", "@Airlie", "@Clara", "@Heidi", "@Daisy", "@Otis", "@Athena", "@Persephone"].map(name => (
                  <span key={name} className="text-xs bg-muted/60 px-2 py-1 rounded-md font-mono">{name}</span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Examples</h4>
              <div className="space-y-1.5 font-mono text-xs bg-muted/40 rounded-lg p-3">
                <div><span className="text-primary font-bold">#CAMP @Clara @Airlie</span> VA Techniques: Ninja Warrior Camp</div>
                <div><span className="text-primary font-bold">#SPORT @Cole</span> Soccer practice Tuesday 6pm</div>
                <div><span className="text-primary font-bold">#PAY @Airlie @Clara</span> Camp deposit due June 15 $250</div>
                <div><span className="text-primary font-bold">#MED @Otis</span> Vet checkup reminder</div>
                <div><span className="text-primary font-bold">#SCHOOL @Greta</span> Field trip permission slip due Friday</div>
                <div><span className="text-primary font-bold">#OFFICE @David</span> Faculty meeting moved to 3pm Thursday</div>
                <div><span className="text-primary font-bold">#TRAVEL @Nancy @David</span> Hotel confirmation Aug 12-15</div>
                <div><span className="text-primary font-bold">#INVITE @Cole @Greta</span> Birthday party at the Johnsons Sat 2pm</div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              Emails without tags are processed by AI and may take longer. Tagged emails are categorized instantly.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
