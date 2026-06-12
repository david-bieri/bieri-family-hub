import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN } from "@/lib/children";
import { ChildBadge } from "@/components/ChildBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, ExternalLink, AlertCircle } from "lucide-react";
import { format, parseISO, isBefore, addDays } from "date-fns";

const STATUSES = ["not_started","in_progress","submitted","confirmed","paid","waitlisted","cancelled"] as const;
const STATUS_LABELS: Record<string, string> = {
  not_started:"Not Started", in_progress:"In Progress", submitted:"Submitted",
  confirmed:"Confirmed", paid:"Paid", waitlisted:"Waitlisted", cancelled:"Cancelled",
};
const STATUS_COLORS: Record<string, string> = {
  not_started:"bg-muted text-muted-foreground",
  in_progress:"bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  submitted:"bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  confirmed:"bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  paid:"bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  waitlisted:"bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  cancelled:"bg-muted text-muted-foreground line-through",
};
const TYPES = ["camp","class","sports_reg","school","other"] as const;
const TYPE_LABELS: Record<string, string> = { camp:"Camp", class:"Class", sports_reg:"Sports Reg.", school:"School", other:"Other" };

function fmt(d?: string) { try { return d ? format(parseISO(d), "MMM d, yyyy") : "" } catch { return d || "" } }

type Form = {
  child_id: string; program_name: string; type: string; start_date: string; end_date: string;
  deadline: string; status: string; cost: string; deposit_paid: boolean; notes: string; url: string;
};
const blank: Form = { child_id:"cole", program_name:"", type:"camp", start_date:"", end_date:"",
  deadline:"", status:"not_started", cost:"", deposit_paid:false, notes:"", url:"" };

export default function Camps() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [editId, setEditId] = useState<string|null>(null);
  const [filterChild, setFilterChild] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["/api/registrations"],
    queryFn: async () => (await apiRequest("GET", "/api/registrations")).json(),
  });

  const save = useMutation({
    mutationFn: async (directPayload?: any) => {
      const payload = directPayload || { ...form, cost: form.cost ? parseFloat(form.cost) : null };
      const id = directPayload?._editId || editId;
      return id
        ? (await apiRequest("PUT", `/api/registrations/${id}`, payload)).json()
        : (await apiRequest("POST", "/api/registrations", payload)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/registrations"] }); setOpen(false); setForm(blank); setEditId(null); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/registrations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/registrations"] }),
  });

  const today = new Date();
  const filtered = registrations
    .filter((r: any) => filterChild === "all" || r.child_id === filterChild)
    .filter((r: any) => filterStatus === "all" || r.status === filterStatus);

  const isUrgent = (r: any) => r.deadline && isBefore(parseISO(r.deadline), addDays(today, 14)) && r.status !== "confirmed" && r.status !== "paid" && r.status !== "cancelled";

  function openEdit(r: any) {
    setForm({ ...r, cost: r.cost?.toString() || "", deposit_paid: !!r.deposit_paid,
      start_date: r.start_date || "", end_date: r.end_date || "", deadline: r.deadline || "", url: r.url || "" });
    setEditId(r.id); setOpen(true);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Camps & Registrations</h1>
        <Button size="sm" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }} data-testid="button-add-registration">
          <Plus size={14} className="mr-1" /> Add Registration
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterChild} onValueChange={setFilterChild}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All kids" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kids</SelectItem>
            {CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm">No registrations added yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }}>Add first registration</Button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((r: any) => (
          <div key={r.id} className={`bg-card border rounded-xl p-4 space-y-2 ${isUrgent(r) ? "border-amber-400 dark:border-amber-600" : "border-border"}`} data-testid={`reg-card-${r.id}`}>
            <div className="flex items-start gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isUrgent(r) && <AlertCircle size={14} className="text-amber-500 shrink-0" />}
                  <span className="font-semibold text-sm">{r.program_name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || ""}`}>{STATUS_LABELS[r.status] || r.status}</span>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[r.type] || r.type}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 mt-1">
                  <ChildBadge childId={r.child_id} />
                  {r.deadline && <span className={`text-xs ${isUrgent(r) ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>Deadline: {fmt(r.deadline)}</span>}
                  {r.cost && <span className="text-xs text-muted-foreground">${parseFloat(r.cost).toFixed(2)}{r.deposit_paid && " · deposit paid"}</span>}
                </div>
                {(r.start_date || r.end_date) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.start_date && fmt(r.start_date)}{r.start_date && r.end_date && " – "}{r.end_date && fmt(r.end_date)}
                  </div>
                )}
                {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink size={12} /></Button>
                  </a>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(r.id)}><Trash2 size={12} /></Button>
              </div>
            </div>
            {/* Quick status update */}
            <div className="flex gap-1 flex-wrap pt-1 border-t border-border">
              {STATUSES.map(s => (
                <button key={s}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${r.status === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
                  onClick={() => {
                    const payload = {
                      _editId: r.id,
                      child_id: r.child_id, program_name: r.program_name, type: r.type,
                      start_date: r.start_date || "", end_date: r.end_date || "",
                      deadline: r.deadline || "", status: s,
                      cost: r.cost ? parseFloat(r.cost) : null,
                      deposit_paid: !!r.deposit_paid, notes: r.notes || "", url: r.url || "",
                    };
                    save.mutate(payload);
                  }}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm(blank); setEditId(null); }}}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Registration</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Child</Label>
                <Select value={form.child_id} onValueChange={v => setForm(f => ({...f, child_id: v}))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({...f, type: v}))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Program Name *</Label>
              <Input value={form.program_name} onChange={e => setForm(f => ({...f, program_name: e.target.value}))} placeholder="Summer Science Camp" className="mt-1 h-8" data-testid="input-program-name" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Start date</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">End date</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="mt-1 h-8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Registration deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Cost ($)</Label>
                <Input type="number" value={form.cost} onChange={e => setForm(f => ({...f, cost: e.target.value}))} placeholder="0.00" className="mt-1 h-8" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.deposit_paid} onCheckedChange={v => setForm(f => ({...f, deposit_paid: !!v}))} />
              <Label className="text-xs">Deposit paid</Label>
            </div>
            <div>
              <Label className="text-xs">Website / URL</Label>
              <Input value={form.url} onChange={e => setForm(f => ({...f, url: e.target.value}))} placeholder="https://…" className="mt-1 h-8" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 text-sm min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!form.program_name || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
