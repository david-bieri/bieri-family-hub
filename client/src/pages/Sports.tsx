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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, MapPin, Clock, User } from "lucide-react";

type Form = {
  child_id: string; sport_name: string; team: string; coach: string;
  season: string; days: string; time: string; location: string; notes: string; active: boolean;
};
const blank: Form = { child_id:"cole", sport_name:"", team:"", coach:"", season:"", days:"", time:"", location:"", notes:"", active:true };

export default function Sports() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(blank);
  const [editId, setEditId] = useState<string|null>(null);
  const [filterChild, setFilterChild] = useState("all");
  const [showInactive, setShowInactive] = useState(false);

  const { data: sports = [], isLoading } = useQuery({
    queryKey: ["/api/sports"],
    queryFn: async () => (await apiRequest("GET", "/api/sports")).json(),
  });

  const save = useMutation({
    mutationFn: async () => editId
      ? (await apiRequest("PUT", `/api/sports/${editId}`, form)).json()
      : (await apiRequest("POST", "/api/sports", form)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sports"] }); setOpen(false); setForm(blank); setEditId(null); },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/sports/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sports"] }),
  });
  const toggleActive = useMutation({
    mutationFn: (s: any) => apiRequest("PUT", `/api/sports/${s.id}`, {...s, active: !s.active}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sports"] }),
  });

  const filtered = sports
    .filter((s: any) => filterChild === "all" || s.child_id === filterChild)
    .filter((s: any) => showInactive || s.active);

  // Group by child
  const byChild = CHILDREN.map(c => ({
    child: c,
    sports: filtered.filter((s: any) => s.child_id === c.id),
  })).filter(x => x.sports.length > 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Sports</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filterChild} onValueChange={setFilterChild}>
            <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="All kids" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kids</SelectItem>
              {CHILDREN.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} id="inactive" />
            <label htmlFor="inactive" className="text-xs text-muted-foreground cursor-pointer">Show inactive</label>
          </div>
          <Button size="sm" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }} data-testid="button-add-sport">
            <Plus size={14} className="mr-1" /> Add Sport
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No sports added yet.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => { setForm(blank); setEditId(null); setOpen(true); }}>Add first sport</Button>
        </div>
      )}

      {byChild.map(({ child, sports: cs }) => (
        <div key={child.id}>
          <div className="flex items-center gap-2 mb-2">
            <ChildBadge childId={child.id} size="md" showAge />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {cs.map((s: any) => (
              <div key={s.id} className={`bg-card border border-border rounded-xl p-4 space-y-2 ${!s.active ? "opacity-60" : ""}`} data-testid={`sport-card-${s.id}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{s.sport_name}</div>
                    {s.team && <div className="text-xs text-muted-foreground">{s.team}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!s.active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setForm({...s}); setEditId(s.id); setOpen(true); }}><Pencil size={12} /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(s.id)}><Trash2 size={12} /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                  {s.days && <div className="flex items-center gap-1"><Clock size={11} />{s.days}{s.time && ` · ${s.time}`}</div>}
                  {s.location && <div className="flex items-center gap-1 col-span-2"><MapPin size={11} />{s.location}</div>}
                  {s.coach && <div className="flex items-center gap-1"><User size={11} />{s.coach}</div>}
                  {s.season && <div className="text-xs">{s.season}</div>}
                </div>
                {s.notes && <p className="text-xs text-muted-foreground border-t border-border pt-1">{s.notes}</p>}
                <div className="flex items-center gap-1.5 pt-1">
                  <Switch
                    checked={s.active}
                    onCheckedChange={() => toggleActive.mutate(s)}
                    id={`active-${s.id}`}
                  />
                  <label htmlFor={`active-${s.id}`} className="text-xs text-muted-foreground cursor-pointer">Active season</label>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm(blank); setEditId(null); }}}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Sport</DialogTitle></DialogHeader>
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
                <Label className="text-xs">Sport *</Label>
                <Input value={form.sport_name} onChange={e => setForm(f => ({...f, sport_name: e.target.value}))} placeholder="Soccer, Baseball…" className="mt-1 h-8" data-testid="input-sport-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Team</Label>
                <Input value={form.team} onChange={e => setForm(f => ({...f, team: e.target.value}))} className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Coach</Label>
                <Input value={form.coach} onChange={e => setForm(f => ({...f, coach: e.target.value}))} className="mt-1 h-8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Season *</Label>
                <Input value={form.season} onChange={e => setForm(f => ({...f, season: e.target.value}))} placeholder="Fall 2026" className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Days *</Label>
                <Input value={form.days} onChange={e => setForm(f => ({...f, days: e.target.value}))} placeholder="Mon/Wed" className="mt-1 h-8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Time</Label>
                <Input value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} placeholder="4:00 PM" className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} className="mt-1 h-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="mt-1 h-8" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm(f => ({...f, active: v}))} id="form-active" />
              <label htmlFor="form-active" className="text-xs text-muted-foreground cursor-pointer">Active season</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={!form.sport_name || !form.season || !form.days || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
