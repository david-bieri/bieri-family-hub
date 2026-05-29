import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN } from "@/lib/children";
import { ChildBadge } from "@/components/ChildBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Syringe, ChevronDown, ChevronRight } from "lucide-react";
import { format, parseISO, isAfter, isBefore, addDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
type VaccineStatus = "completed" | "scheduled" | "overdue" | "not_required" | "declined";

interface Vaccine {
  id: string;
  child_id: string;
  name: string;
  date_given?: string;
  next_due?: string;
  status: VaccineStatus;
  provider?: string;
  administered_by?: string;
  lot_number?: string;
  notes?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const APPT_TYPES = ["routine", "specialist", "dental", "vision", "other"] as const;

const STATUS_CONFIG: Record<VaccineStatus, { label: string; color: string; bg: string }> = {
  completed:    { label: "Completed",    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  scheduled:    { label: "Scheduled",    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  overdue:      { label: "Overdue",      color: "text-red-700",     bg: "bg-red-50 border-red-200" },
  not_required: { label: "Not required", color: "text-gray-500",    bg: "bg-gray-50 border-gray-200" },
  declined:     { label: "Declined",     color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(d?: string) {
  try { return d ? format(parseISO(d), "MMM d, yyyy") : "—"; }
  catch { return d || "—"; }
}

function computeStatus(v: Vaccine): VaccineStatus {
  // If a status was explicitly set, trust it (unless we can detect overdue)
  if (v.status === "completed" && v.next_due) {
    const due = parseISO(v.next_due);
    if (isBefore(due, new Date())) return "overdue";
    if (isBefore(due, addDays(new Date(), 30))) return "scheduled"; // due within 30 days
  }
  return v.status;
}

// ─── Vaccine status badge ──────────────────────────────────────────────────────
function StatusBadge({ status }: { status: VaccineStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Vaccine Dialog ────────────────────────────────────────────────────────────
interface VaccFormState {
  child_id: string;
  name: string;
  date_given: string;
  next_due: string;
  status: VaccineStatus;
  provider: string;
  administered_by: string;
  lot_number: string;
  notes: string;
}

function VaccineDialog({
  open, onClose, initial, editId, defaultChildId,
}: {
  open: boolean;
  onClose: () => void;
  initial: VaccFormState;
  editId: string | null;
  defaultChildId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<VaccFormState>({ ...initial, child_id: defaultChildId || initial.child_id });
  const set = (k: keyof VaccFormState, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Reset form whenever dialog opens/initial changes
  useState(() => { setForm({ ...initial, child_id: defaultChildId || initial.child_id }); });

  const save = useMutation({
    mutationFn: async () => editId
      ? apiRequest("PUT", `/api/vaccines/${editId}`, form)
      : apiRequest("POST", "/api/vaccines", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vaccines"] }); onClose(); },
  });

  const del = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/vaccines/${editId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vaccines"] }); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit" : "Add"} Vaccine Record</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Child</Label>
              <Select value={form.child_id} onValueChange={v => set("child_id", v)}>
                <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v as VaccineStatus)}>
                <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_CONFIG) as VaccineStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Vaccine name</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. MMR, DTaP, Flu" className="mt-1 h-8" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date given</Label>
              <Input type="date" value={form.date_given} onChange={e => set("date_given", e.target.value)} className="mt-1 h-8" />
            </div>
            <div>
              <Label className="text-xs">Next due / booster</Label>
              <Input type="date" value={form.next_due} onChange={e => set("next_due", e.target.value)} className="mt-1 h-8" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Provider / Clinic</Label>
              <Input value={form.provider} onChange={e => set("provider", e.target.value)} placeholder="Dr. Smith" className="mt-1 h-8" />
            </div>
            <div>
              <Label className="text-xs">Administered by</Label>
              <Input value={form.administered_by} onChange={e => set("administered_by", e.target.value)} placeholder="Nurse / Doctor" className="mt-1 h-8" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Lot number (optional)</Label>
            <Input value={form.lot_number} onChange={e => set("lot_number", e.target.value)} placeholder="e.g. AB1234" className="mt-1 h-8" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="mt-1 text-sm" />
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          <div>
            {editId && (
              <Button variant="destructive" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Per-child vaccine section ────────────────────────────────────────────────
function ChildVaccineSection({
  child, vaccines, onAdd, onEdit,
}: {
  child: (typeof CHILDREN)[0];
  vaccines: Vaccine[];
  onAdd: (childId: string) => void;
  onEdit: (v: Vaccine) => void;
}) {
  const [open, setOpen] = useState(true);
  const childVaccs = vaccines.filter(v => v.child_id === child.id);

  const overdue   = childVaccs.filter(v => computeStatus(v) === "overdue");
  const scheduled = childVaccs.filter(v => computeStatus(v) === "scheduled");
  const completed = childVaccs.filter(v => computeStatus(v) === "completed");
  const other     = childVaccs.filter(v => !["overdue","scheduled","completed"].includes(computeStatus(v)));

  return (
    <div className="mb-4 rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <ChildBadge childId={child.id} size="md" />
        <span className="font-medium text-sm flex-1 text-left">{child.name}</span>
        <div className="flex gap-1.5 items-center">
          {overdue.length > 0   && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">{overdue.length} overdue</span>}
          {scheduled.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">{scheduled.length} due soon</span>}
          <span className="text-xs text-muted-foreground">{childVaccs.length} total</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-1.5">
          {childVaccs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-1">No vaccines recorded for {child.name} yet.</p>
          ) : (
            [...overdue, ...scheduled, ...completed, ...other].map(v => (
              <VaccineRow key={v.id} vaccine={v} onEdit={() => onEdit(v)} />
            ))
          )}
          <Button
            size="sm" variant="ghost"
            className="mt-1 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onAdd(child.id)}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add vaccine for {child.name}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Single vaccine row ───────────────────────────────────────────────────────
function VaccineRow({ vaccine, onEdit }: { vaccine: Vaccine; onEdit: () => void }) {
  const status = computeStatus(vaccine);
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 hover:border-border transition-colors bg-card">
      <Syringe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{vaccine.name}</span>
          <StatusBadge status={status} />
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
          {vaccine.date_given && <span>Given: {fmt(vaccine.date_given)}</span>}
          {vaccine.next_due   && <span className={status === "overdue" ? "text-red-600 font-medium" : status === "scheduled" ? "text-blue-600" : ""}>
            {status === "overdue" ? "Overdue since: " : "Next due: "}{fmt(vaccine.next_due)}
          </span>}
          {vaccine.provider   && <span>· {vaccine.provider}</span>}
          {vaccine.lot_number && <span>Lot: {vaccine.lot_number}</span>}
        </div>
        {vaccine.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{vaccine.notes}</p>}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onEdit}>
        <Pencil className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

// ─── Appointment row ──────────────────────────────────────────────────────────
function ApptRow({ a, onEdit, onDelete, onToggle }: any) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-card border border-border rounded-lg ${a.completed ? "opacity-60" : ""}`}>
      <button onClick={onToggle} className="shrink-0">
        {a.completed
          ? <CheckCircle2 className="w-4 h-4 text-primary" />
          : <Circle className="w-4 h-4 text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ChildBadge childId={a.child_id} />
          <span className="font-medium text-sm">{a.provider}</span>
          <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {a.date ? fmt(a.date) : "No date"}{a.time && ` · ${a.time}`}
        </div>
        {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Medical() {
  const qc = useQueryClient();

  // Appointment state
  const blankA = { child_id: "cole", type: "routine", provider: "", date: "", time: "", notes: "", completed: false };
  const [apptOpen, setApptOpen] = useState(false);
  const [aForm, setAForm] = useState<any>(blankA);
  const [editAId, setEditAId] = useState<string | null>(null);
  const [filterChild, setFilterChild] = useState("all");

  // Vaccine dialog state
  const blankV: VaccFormState = {
    child_id: "cole", name: "", date_given: "", next_due: "",
    status: "completed", provider: "", administered_by: "", lot_number: "", notes: "",
  };
  const [vaccOpen, setVaccOpen] = useState(false);
  const [vInitial, setVInitial] = useState<VaccFormState>(blankV);
  const [editVId, setEditVId] = useState<string | null>(null);
  const [defaultVChild, setDefaultVChild] = useState<string | undefined>(undefined);

  const { data: appointments = [], isLoading: aLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => (await apiRequest("GET", "/api/appointments")).json(),
  });
  const { data: vaccines = [] } = useQuery<Vaccine[]>({
    queryKey: ["/api/vaccines"],
    queryFn: async () => (await apiRequest("GET", "/api/vaccines")).json(),
  });

  const saveAppt = useMutation({
    mutationFn: async () => editAId
      ? apiRequest("PUT", `/api/appointments/${editAId}`, aForm)
      : apiRequest("POST", "/api/appointments", aForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/appointments"] }); setApptOpen(false); setAForm(blankA); setEditAId(null); },
  });
  const delAppt = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/appointments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/appointments"] }),
  });
  const toggleAppt = useMutation({
    mutationFn: (a: any) => apiRequest("PUT", `/api/appointments/${a.id}`, { ...a, completed: !a.completed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/appointments"] }),
  });

  const filteredAppts = appointments.filter((a: any) => filterChild === "all" || a.child_id === filterChild);
  const upcoming = filteredAppts.filter((a: any) => !a.completed && a.date && isAfter(parseISO(a.date), new Date()));
  const past     = filteredAppts.filter((a: any) => a.completed || !a.date || !isAfter(parseISO(a.date), new Date()));

  function openAddVaccine(childId: string) {
    setVInitial({ ...blankV, child_id: childId });
    setDefaultVChild(childId);
    setEditVId(null);
    setVaccOpen(true);
  }

  function openEditVaccine(v: Vaccine) {
    setVInitial({
      child_id: v.child_id, name: v.name,
      date_given: v.date_given || "", next_due: v.next_due || "",
      status: v.status, provider: v.provider || "",
      administered_by: v.administered_by || "",
      lot_number: v.lot_number || "", notes: v.notes || "",
    });
    setDefaultVChild(v.child_id);
    setEditVId(v.id);
    setVaccOpen(true);
  }

  const shownChildren = filterChild === "all"
    ? CHILDREN
    : CHILDREN.filter(c => c.id === filterChild);

  // Summary stats
  const overdueCount   = vaccines.filter(v => computeStatus(v) === "overdue").length;
  const scheduledCount = vaccines.filter(v => computeStatus(v) === "scheduled").length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Medical</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filterChild} onValueChange={setFilterChild}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All kids" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kids</SelectItem>
              {CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => openAddVaccine(filterChild === "all" ? "cole" : filterChild)}>
            <Syringe className="w-3.5 h-3.5 mr-1" /> Add Vaccine
          </Button>
          <Button size="sm" onClick={() => { setAForm(blankA); setEditAId(null); setApptOpen(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Appointment
          </Button>
        </div>
      </div>

      {/* Alert bar */}
      {(overdueCount > 0 || scheduledCount > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-3 text-sm">
          <Syringe className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="text-amber-800">
            {overdueCount > 0 && <strong className="text-red-700">{overdueCount} overdue vaccine{overdueCount > 1 ? "s" : ""}</strong>}
            {overdueCount > 0 && scheduledCount > 0 && " · "}
            {scheduledCount > 0 && <strong className="text-blue-700">{scheduledCount} due within 30 days</strong>}
          </span>
        </div>
      )}

      <Tabs defaultValue="vaccines">
        <TabsList className="h-8">
          <TabsTrigger value="vaccines" className="text-xs gap-1">
            <Syringe className="w-3 h-3" /> Vaccines
            {overdueCount > 0 && <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{overdueCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="appointments" className="text-xs">Appointments</TabsTrigger>
        </TabsList>

        {/* ── VACCINES TAB ─────────────────────────────────────────────── */}
        <TabsContent value="vaccines" className="mt-4 space-y-1">
          {shownChildren.map(child => (
            <ChildVaccineSection
              key={child.id}
              child={child}
              vaccines={vaccines}
              onAdd={openAddVaccine}
              onEdit={openEditVaccine}
            />
          ))}
        </TabsContent>

        {/* ── APPOINTMENTS TAB ──────────────────────────────────────────── */}
        <TabsContent value="appointments" className="space-y-4 mt-4">
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</h2>
            {aLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!aLoading && upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
            <div className="space-y-2">
              {upcoming.map((a: any) => (
                <ApptRow key={a.id} a={a}
                  onEdit={() => { setAForm({ ...a }); setEditAId(a.id); setApptOpen(true); }}
                  onDelete={() => delAppt.mutate(a.id)}
                  onToggle={() => toggleAppt.mutate(a)}
                />
              ))}
            </div>
          </div>
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Past / Completed</h2>
              <div className="space-y-2">
                {past.map((a: any) => (
                  <ApptRow key={a.id} a={a}
                    onEdit={() => { setAForm({ ...a }); setEditAId(a.id); setApptOpen(true); }}
                    onDelete={() => delAppt.mutate(a.id)}
                    onToggle={() => toggleAppt.mutate(a)}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Appointment Dialog */}
      <Dialog open={apptOpen} onOpenChange={o => { setApptOpen(o); if (!o) { setAForm(blankA); setEditAId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editAId ? "Edit" : "New"} Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Child</Label>
                <Select value={aForm.child_id} onValueChange={v => setAForm((f: any) => ({ ...f, child_id: v }))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={aForm.type} onValueChange={v => setAForm((f: any) => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1 h-8 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{APPT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Provider / Doctor</Label>
              <Input value={aForm.provider} onChange={e => setAForm((f: any) => ({ ...f, provider: e.target.value }))} placeholder="Dr. Smith" className="mt-1 h-8" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Date</Label><Input type="date" value={aForm.date} onChange={e => setAForm((f: any) => ({ ...f, date: e.target.value }))} className="mt-1 h-8" /></div>
              <div><Label className="text-xs">Time</Label><Input type="time" value={aForm.time} onChange={e => setAForm((f: any) => ({ ...f, time: e.target.value }))} className="mt-1 h-8" /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={aForm.notes} onChange={e => setAForm((f: any) => ({ ...f, notes: e.target.value }))} className="mt-1 h-8" /></div>
            <div className="flex items-center gap-2">
              <Checkbox checked={aForm.completed} onCheckedChange={v => setAForm((f: any) => ({ ...f, completed: !!v }))} />
              <Label className="text-xs">Completed</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setApptOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => saveAppt.mutate()} disabled={!aForm.provider || !aForm.date || saveAppt.isPending}>
              {saveAppt.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vaccine Dialog */}
      <VaccineDialog
        open={vaccOpen}
        onClose={() => { setVaccOpen(false); setEditVId(null); }}
        initial={vInitial}
        editId={editVId}
        defaultChildId={defaultVChild}
      />
    </div>
  );
}
