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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, AlertCircle, DollarSign } from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";

const STATUSES = ["pending","paid","overdue","cancelled"] as const;
const CATEGORIES = ["camp","sports","medical","school","activity","other"] as const;
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

function fmt(d?: string) { try { return d ? format(parseISO(d), "MMM d, yyyy") : "" } catch { return d || "" } }

type Form = {
  description: string; child_id: string; category: string;
  amount: string; due_date: string; paid_date: string; status: string; payee: string; notes: string;
};
const blank: Form = { description:"", child_id:"", category:"other", amount:"", due_date:"", paid_date:"", status:"pending", payee:"", notes:"" };

export default function Payments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [editId, setEditId] = useState<string|null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => (await apiRequest("GET", "/api/payments")).json(),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, amount: parseFloat(form.amount) || 0, child_id: form.child_id || null };
      return editId
        ? (await apiRequest("PUT", `/api/payments/${editId}`, payload)).json()
        : (await apiRequest("POST", "/api/payments", payload)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/payments"] }); setOpen(false); setForm(blank); setEditId(null); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/payments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/payments"] }),
  });
  const markPaid = useMutation({
    mutationFn: (p: any) => apiRequest("PUT", `/api/payments/${p.id}`, { ...p, status:"paid", paid_date: new Date().toISOString().split("T")[0] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/payments"] }),
  });

  const filtered = payments
    .filter((p: any) => filterStatus === "all" || p.status === filterStatus)
    .filter((p: any) => filterCat === "all" || p.category === filterCat);

  // Summary stats
  const total = payments.filter((p: any) => p.status !== "cancelled").reduce((s: number, p: any) => s + (p.amount||0), 0);
  const totalPaid = payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + (p.amount||0), 0);
  const totalOwed = payments.filter((p: any) => p.status === "pending" || p.status === "overdue").reduce((s: number, p: any) => s + (p.amount||0), 0);
  const overdue = payments.filter((p: any) => p.status === "overdue").length;

  function openEdit(p: any) {
    setForm({ description: p.description, child_id: p.child_id || "", category: p.category,
      amount: p.amount?.toString() || "", due_date: p.due_date || "", paid_date: p.paid_date || "",
      status: p.status, payee: p.payee || "", notes: p.notes || "" });
    setEditId(p.id); setOpen(true);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Payments</h1>
        <Button size="sm" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }} data-testid="button-add-payment">
          <Plus size={14} className="mr-1" /> Add Payment
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-muted-foreground">Total tracked</div>
          <div className="text-lg font-bold mt-0.5">${total.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs text-green-600 dark:text-green-400">Paid</div>
          <div className="text-lg font-bold mt-0.5 text-green-600 dark:text-green-400">${totalPaid.toFixed(2)}</div>
        </div>
        <div className={`bg-card border rounded-xl p-4 ${overdue > 0 ? "border-red-400 dark:border-red-600" : "border-border"}`}>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            Outstanding{overdue > 0 && <AlertCircle size={11} className="text-red-500" />}
          </div>
          <div className={`text-lg font-bold mt-0.5 ${overdue > 0 ? "text-destructive" : ""}`}>${totalOwed.toFixed(2)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm">No payments yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }}>Add first payment</Button>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((p: any) => (
          <div key={p.id} className={`bg-card border rounded-xl p-4 flex items-start gap-3 ${p.status === "overdue" ? "border-red-300 dark:border-red-800" : "border-border"}`} data-testid={`payment-row-${p.id}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${p.status === "paid" ? "bg-green-100 dark:bg-green-950" : p.status === "overdue" ? "bg-red-100 dark:bg-red-950" : "bg-amber-100 dark:bg-amber-950"}`}>
              <DollarSign size={14} className={p.status === "paid" ? "text-green-600" : p.status === "overdue" ? "text-red-600" : "text-amber-600"} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{p.description}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status]||""}`}>{p.status}</span>
                <Badge variant="outline" className="text-xs capitalize">{p.category}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 mt-1 items-center">
                <span className="text-sm font-bold">${parseFloat(p.amount).toFixed(2)}</span>
                {p.child_id && <ChildBadge childId={p.child_id} />}
                {p.payee && <span className="text-xs text-muted-foreground">{p.payee}</span>}
                {p.due_date && <span className={`text-xs ${p.status === "overdue" ? "text-destructive font-medium" : "text-muted-foreground"}`}>Due: {fmt(p.due_date)}</span>}
                {p.paid_date && <span className="text-xs text-green-600 dark:text-green-400">Paid: {fmt(p.paid_date)}</span>}
              </div>
              {p.notes && <p className="text-xs text-muted-foreground mt-1">{p.notes}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              {p.status !== "paid" && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" title="Mark paid" onClick={() => markPaid.mutate(p)}>
                  <CheckCircle2 size={14} />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil size={12} /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(p.id)}><Trash2 size={12} /></Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm(blank); setEditId(null); }}}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Payment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="e.g. Soccer registration fee" className="mt-1 h-8" data-testid="input-payment-description" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Amount ($) *</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="0.00" className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({...f, category: v}))}>
                  <SelectTrigger className="mt-1 h-8 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Child (optional)</Label>
              <Select value={form.child_id || ""} onValueChange={v => setForm(f => ({...f, child_id: v}))}>
                <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Family-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Family-wide</SelectItem>
                  {CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Due date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Paid date</Label>
                <Input type="date" value={form.paid_date} onChange={e => setForm(f => ({...f, paid_date: e.target.value}))} className="mt-1 h-8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({...f, status: v}))}>
                  <SelectTrigger className="mt-1 h-8 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Payee</Label>
                <Input value={form.payee} onChange={e => setForm(f => ({...f, payee: e.target.value}))} className="mt-1 h-8" placeholder="YMCA, Dr. Smith…" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 h-8" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!form.description || !form.amount || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
