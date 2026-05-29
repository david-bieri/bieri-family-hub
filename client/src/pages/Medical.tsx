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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, CheckCircle2, Circle, Syringe } from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";

const APPT_TYPES = ["routine","specialist","dental","vision","other"] as const;

function fmt(d?: string) { try { return d ? format(parseISO(d), "MMM d, yyyy") : "—" } catch { return d||"—" } }

export default function Medical() {
  const qc = useQueryClient();
  const [apptOpen, setApptOpen] = useState(false);
  const [vaccOpen, setVaccOpen] = useState(false);
  const [filterChild, setFilterChild] = useState("all");

  // Appointment form
  const blankA = { child_id:"cole", type:"routine", provider:"", date:"", time:"", notes:"", completed:false };
  const [aForm, setAForm] = useState<any>(blankA);
  const [editAId, setEditAId] = useState<string|null>(null);

  // Vaccine form
  const blankV = { child_id:"cole", name:"", date_given:"", next_due:"", provider:"", notes:"" };
  const [vForm, setVForm] = useState<any>(blankV);
  const [editVId, setEditVId] = useState<string|null>(null);

  const { data: appointments = [], isLoading: aLoading } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => (await apiRequest("GET", "/api/appointments")).json(),
  });
  const { data: vaccines = [], isLoading: vLoading } = useQuery({
    queryKey: ["/api/vaccines"],
    queryFn: async () => (await apiRequest("GET", "/api/vaccines")).json(),
  });

  const saveAppt = useMutation({
    mutationFn: async () => editAId
      ? (await apiRequest("PUT", `/api/appointments/${editAId}`, aForm)).json()
      : (await apiRequest("POST", "/api/appointments", aForm)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/appointments"] }); setApptOpen(false); setAForm(blankA); setEditAId(null); },
  });
  const delAppt = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/appointments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/appointments"] }),
  });
  const toggleAppt = useMutation({
    mutationFn: (a: any) => apiRequest("PUT", `/api/appointments/${a.id}`, {...a, completed: !a.completed}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/appointments"] }),
  });

  const saveVacc = useMutation({
    mutationFn: async () => editVId
      ? (await apiRequest("PUT", `/api/vaccines/${editVId}`, vForm)).json()
      : (await apiRequest("POST", "/api/vaccines", vForm)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/vaccines"] }); setVaccOpen(false); setVForm(blankV); setEditVId(null); },
  });
  const delVacc = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/vaccines/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/vaccines"] }),
  });

  const filterAppts = appointments.filter((a: any) => filterChild === "all" || a.child_id === filterChild);
  const filterVaccs = vaccines.filter((v: any) => filterChild === "all" || v.child_id === filterChild);

  const upcoming = filterAppts.filter((a: any) => !a.completed && isAfter(parseISO(a.date), new Date()));
  const past = filterAppts.filter((a: any) => a.completed || !isAfter(parseISO(a.date), new Date()));

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
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
          <Button size="sm" variant="outline" onClick={() => { setVForm(blankV); setEditVId(null); setVaccOpen(true); }} data-testid="button-add-vaccine">
            <Syringe size={14} className="mr-1" /> Add Vaccine
          </Button>
          <Button size="sm" onClick={() => { setAForm(blankA); setEditAId(null); setApptOpen(true); }} data-testid="button-add-appointment">
            <Plus size={14} className="mr-1" /> Add Appointment
          </Button>
        </div>
      </div>

      <Tabs defaultValue="appointments">
        <TabsList className="h-8">
          <TabsTrigger value="appointments" className="text-xs">Appointments</TabsTrigger>
          <TabsTrigger value="vaccines" className="text-xs">Vaccines</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-4 mt-4">
          {/* Upcoming */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming</h2>
            {aLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!aLoading && upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
            <div className="space-y-2">
              {upcoming.map((a: any) => (
                <ApptRow key={a.id} a={a} onEdit={() => { setAForm({...a}); setEditAId(a.id); setApptOpen(true); }} onDelete={() => delAppt.mutate(a.id)} onToggle={() => toggleAppt.mutate(a)} />
              ))}
            </div>
          </div>
          {/* Past */}
          {past.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Past / Completed</h2>
              <div className="space-y-2">
                {past.map((a: any) => (
                  <ApptRow key={a.id} a={a} onEdit={() => { setAForm({...a}); setEditAId(a.id); setApptOpen(true); }} onDelete={() => delAppt.mutate(a.id)} onToggle={() => toggleAppt.mutate(a)} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vaccines" className="mt-4">
          {/* Group by child */}
          {CHILDREN.filter(c => filterChild === "all" || c.id === filterChild).map(child => {
            const childVaccs = filterVaccs.filter((v: any) => v.child_id === child.id);
            if (childVaccs.length === 0) return null;
            return (
              <div key={child.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <ChildBadge childId={child.id} size="md" />
                </div>
                <div className="space-y-2">
                  {childVaccs.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg" data-testid={`vaccine-row-${v.id}`}>
                      <Syringe size={14} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{v.name}</span>
                        <div className="text-xs text-muted-foreground">
                          Given: {fmt(v.date_given)}
                          {v.next_due && <span className="ml-2 text-amber-600 dark:text-amber-400">Next due: {fmt(v.next_due)}</span>}
                          {v.provider && <span className="ml-2">· {v.provider}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setVForm({...v}); setEditVId(v.id); setVaccOpen(true); }}><Pencil size={12} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delVacc.mutate(v.id)}><Trash2 size={12} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!vLoading && filterVaccs.length === 0 && <p className="text-sm text-muted-foreground">No vaccines recorded yet.</p>}
        </TabsContent>
      </Tabs>

      {/* Appointment Dialog */}
      <Dialog open={apptOpen} onOpenChange={o => { setApptOpen(o); if (!o) { setAForm(blankA); setEditAId(null); }}}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editAId ? "Edit" : "New"} Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Child</Label>
                <Select value={aForm.child_id} onValueChange={v => setAForm((f: any) => ({...f, child_id: v}))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={aForm.type} onValueChange={v => setAForm((f: any) => ({...f, type: v}))}>
                  <SelectTrigger className="mt-1 h-8 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{APPT_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Provider / Doctor</Label>
              <Input value={aForm.provider} onChange={e => setAForm((f: any) => ({...f, provider: e.target.value}))} placeholder="Dr. Smith" className="mt-1 h-8" data-testid="input-provider" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={aForm.date} onChange={e => setAForm((f: any) => ({...f, date: e.target.value}))} className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Time</Label>
                <Input type="time" value={aForm.time} onChange={e => setAForm((f: any) => ({...f, time: e.target.value}))} className="mt-1 h-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={aForm.notes} onChange={e => setAForm((f: any) => ({...f, notes: e.target.value}))} className="mt-1 h-8" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={aForm.completed} onCheckedChange={v => setAForm((f: any) => ({...f, completed: !!v}))} />
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
      <Dialog open={vaccOpen} onOpenChange={o => { setVaccOpen(o); if (!o) { setVForm(blankV); setEditVId(null); }}}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editVId ? "Edit" : "New"} Vaccine Record</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Child</Label>
                <Select value={vForm.child_id} onValueChange={v => setVForm((f: any) => ({...f, child_id: v}))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Vaccine name</Label>
                <Input value={vForm.name} onChange={e => setVForm((f: any) => ({...f, name: e.target.value}))} placeholder="e.g. MMR" className="mt-1 h-8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Date given</Label>
                <Input type="date" value={vForm.date_given} onChange={e => setVForm((f: any) => ({...f, date_given: e.target.value}))} className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Next due</Label>
                <Input type="date" value={vForm.next_due} onChange={e => setVForm((f: any) => ({...f, next_due: e.target.value}))} className="mt-1 h-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Provider</Label>
              <Input value={vForm.provider} onChange={e => setVForm((f: any) => ({...f, provider: e.target.value}))} className="mt-1 h-8" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setVaccOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => saveVacc.mutate()} disabled={!vForm.name || !vForm.date_given || saveVacc.isPending}>
              {saveVacc.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApptRow({ a, onEdit, onDelete, onToggle }: any) {
  return (
    <div className={`flex items-center gap-3 p-3 bg-card border border-border rounded-lg ${a.completed ? "opacity-60" : ""}`} data-testid={`appt-row-${a.id}`}>
      <button onClick={onToggle} className="shrink-0">
        {a.completed ? <CheckCircle2 size={16} className="text-primary" /> : <Circle size={16} className="text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ChildBadge childId={a.child_id} />
          <span className="font-medium text-sm">{a.provider}</span>
          <Badge variant="outline" className="text-xs capitalize">{a.type}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {a.date ? format(parseISO(a.date), "MMM d, yyyy") : "No date"}{a.time && ` · ${a.time}`}
        </div>
        {a.notes && <p className="text-xs text-muted-foreground mt-0.5">{a.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil size={12} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 size={12} /></Button>
      </div>
    </div>
  );
}
