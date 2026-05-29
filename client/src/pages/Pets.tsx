import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Stethoscope, Pill, Scissors, PawPrint, Pencil, Syringe } from "lucide-react";
import { format, parseISO, isBefore, addDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  dob?: string;
  color: string;
  notes?: string;
}

interface VetAppt {
  id: string;
  pet_id: string;
  type: string;
  provider?: string;
  date?: string;
  time?: string;
  notes?: string;
}

interface Medication {
  id: string;
  pet_id: string;
  name: string;
  dose?: string;
  frequency?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

type VaxStatus = "completed" | "scheduled" | "overdue" | "not_required" | "declined";

interface PetVaccine {
  id: string;
  pet_id: string;
  name: string;
  date_given?: string;
  next_due?: string;
  status: VaxStatus;
  provider?: string;
  administered_by?: string;
  lot_number?: string;
  notes?: string;
}

interface Grooming {
  id: string;
  pet_id: string;
  provider?: string;
  date?: string;
  time?: string;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return format(parseISO(iso), "MMM d, yyyy"); }
  catch { return iso; }
}

const VAX_STATUS_CFG: Record<VaxStatus, { label: string; color: string; bg: string }> = {
  completed:    { label: "Completed",    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  scheduled:    { label: "Scheduled",    color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  overdue:      { label: "Overdue",      color: "text-red-700",     bg: "bg-red-50 border-red-200" },
  not_required: { label: "Not required", color: "text-gray-500",    bg: "bg-gray-50 border-gray-200" },
  declined:     { label: "Declined",     color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
};

function computeVaxStatus(v: PetVaccine): VaxStatus {
  if (v.status === "completed" && v.next_due) {
    const due = parseISO(v.next_due);
    if (isBefore(due, new Date())) return "overdue";
    if (isBefore(due, addDays(new Date(), 30))) return "scheduled";
  }
  return v.status;
}

function VaxBadge({ status }: { status: VaxStatus }) {
  const cfg = VAX_STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function PetAvatar({ pet, size = "md" }: { pet: Pet; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "w-8 h-8 text-sm" : size === "lg" ? "w-14 h-14 text-xl" : "w-11 h-11 text-base";
  const emoji = pet.species === "dog" ? "🐕" : "🐈";
  return (
    <div
      className={`${sz} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: pet.color }}
    >
      {emoji}
    </div>
  );
}

// ─── Pet Vaccine Dialog ──────────────────────────────────────────────────────
function PetVaccineDialog({ petId, petName, existing, onClose }: { petId: string; petName: string; existing?: PetVaccine; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name || "",
    date_given: existing?.date_given || "",
    next_due: existing?.next_due || "",
    status: (existing?.status || "completed") as VaxStatus,
    provider: existing?.provider || "",
    administered_by: existing?.administered_by || "",
    lot_number: existing?.lot_number || "",
    notes: existing?.notes || "",
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, pet_id: petId };
      if (existing) return apiRequest("PUT", `/api/pet-vaccines/${existing.id}`, payload);
      return apiRequest("POST", "/api/pet-vaccines", payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pet-vaccines"] }); onClose(); },
  });

  const del = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/pet-vaccines/${existing!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pet-vaccines"] }); onClose(); },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vaccine name</Label>
          <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Rabies, DHPP" />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(VAX_STATUS_CFG) as VaxStatus[]).map(s => (
                <SelectItem key={s} value={s}>{VAX_STATUS_CFG[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date given</Label><Input type="date" value={form.date_given} onChange={e => set("date_given", e.target.value)} /></div>
        <div><Label>Next due / booster</Label><Input type="date" value={form.next_due} onChange={e => set("next_due", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Provider / Clinic</Label><Input value={form.provider} onChange={e => set("provider", e.target.value)} placeholder="Blue Ridge Vet" /></div>
        <div><Label>Administered by</Label><Input value={form.administered_by} onChange={e => set("administered_by", e.target.value)} placeholder="Dr. Jones" /></div>
      </div>
      <div><Label>Lot number (optional)</Label><Input value={form.lot_number} onChange={e => set("lot_number", e.target.value)} placeholder="e.g. AB1234" /></div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
      <div className="flex justify-between">
        {existing && <Button variant="destructive" size="sm" onClick={() => del.mutate()}>Delete</Button>}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.name || save.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Vet Dialog ───────────────────────────────────────────────────────────────
function VetDialog({ petId, existing, onClose }: { petId: string; existing?: VetAppt; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    type: existing?.type || "checkup",
    provider: existing?.provider || "",
    date: existing?.date || "",
    time: existing?.time || "",
    notes: existing?.notes || "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (existing) {
        return apiRequest("PUT", `/api/pets/vet/${existing.id}`, form);
      }
      return apiRequest("POST", `/api/pets/${petId}/vet`, form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/vet`] });
      onClose();
    },
  });

  const del = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/pets/vet/${existing!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/vet`] }); onClose(); },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={form.type} onValueChange={v => set("type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["checkup", "vaccination", "procedure", "dental", "emergency", "other"].map(t => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Provider / Clinic</Label>
          <Input value={form.provider} onChange={e => set("provider", e.target.value)} placeholder="Blue Ridge Vet" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
        <div><Label>Time</Label><Input type="time" value={form.time} onChange={e => set("time", e.target.value)} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
      <div className="flex justify-between">
        {existing && (
          <Button variant="destructive" size="sm" onClick={() => del.mutate()}>Delete</Button>
        )}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Med Dialog ───────────────────────────────────────────────────────────────
function MedDialog({ petId, existing, onClose }: { petId: string; existing?: Medication; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: existing?.name || "",
    dose: existing?.dose || "",
    frequency: existing?.frequency || "",
    start_date: existing?.start_date || "",
    end_date: existing?.end_date || "",
    notes: existing?.notes || "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (existing) return apiRequest("PUT", `/api/pets/meds/${existing.id}`, form);
      return apiRequest("POST", `/api/pets/${petId}/meds`, form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/meds`] }); onClose(); },
  });

  const del = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/pets/meds/${existing!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/meds`] }); onClose(); },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Medication name</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Heartgard Plus" /></div>
        <div><Label>Dose</Label><Input value={form.dose} onChange={e => set("dose", e.target.value)} placeholder="1 chew" /></div>
      </div>
      <div>
        <Label>Frequency</Label>
        <Select value={form.frequency} onValueChange={v => set("frequency", v)}>
          <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
          <SelectContent>
            {["daily", "weekly", "monthly", "quarterly", "annually", "as needed"].map(f => (
              <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} /></div>
        <div><Label>End date (blank = ongoing)</Label><Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
      <div className="flex justify-between">
        {existing && <Button variant="destructive" size="sm" onClick={() => del.mutate()}>Delete</Button>}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Grooming Dialog ──────────────────────────────────────────────────────────
function GroomDialog({ petId, existing, onClose }: { petId: string; existing?: Grooming; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    provider: existing?.provider || "",
    date: existing?.date || "",
    time: existing?.time || "",
    notes: existing?.notes || "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (existing) return apiRequest("PUT", `/api/pets/grooming/${existing.id}`, form);
      return apiRequest("POST", `/api/pets/${petId}/grooming`, form);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/grooming`] }); onClose(); },
  });

  const del = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/pets/grooming/${existing!.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/pets/${petId}/grooming`] }); onClose(); },
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div><Label>Groomer / Salon</Label><Input value={form.provider} onChange={e => set("provider", e.target.value)} placeholder="Pampered Paws" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => set("date", e.target.value)} /></div>
        <div><Label>Time</Label><Input type="time" value={form.time} onChange={e => set("time", e.target.value)} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} /></div>
      <div className="flex justify-between">
        {existing && <Button variant="destructive" size="sm" onClick={() => del.mutate()}>Delete</Button>}
        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Pet Panel ────────────────────────────────────────────────────────────────
function PetPanel({ pet }: { pet: Pet }) {
  const [vetOpen, setVetOpen] = useState(false);
  const [medOpen, setMedOpen] = useState(false);
  const [groomOpen, setGroomOpen] = useState(false);
  const [vaxOpen, setVaxOpen] = useState(false);
  const [editVet, setEditVet] = useState<VetAppt | undefined>();
  const [editMed, setEditMed] = useState<Medication | undefined>();
  const [editGroom, setEditGroom] = useState<Grooming | undefined>();
  const [editVax, setEditVax] = useState<PetVaccine | undefined>();

  const { data: vets = [] }   = useQuery<VetAppt[]>({ queryKey: [`/api/pets/${pet.id}/vet`], queryFn: async () => (await apiRequest("GET", `/api/pets/${pet.id}/vet`)).json() });
  const { data: meds = [] }   = useQuery<Medication[]>({ queryKey: [`/api/pets/${pet.id}/meds`], queryFn: async () => (await apiRequest("GET", `/api/pets/${pet.id}/meds`)).json() });
  const { data: grooms = [] } = useQuery<Grooming[]>({ queryKey: [`/api/pets/${pet.id}/grooming`], queryFn: async () => (await apiRequest("GET", `/api/pets/${pet.id}/grooming`)).json() });
  const { data: allPetVax = [] } = useQuery<PetVaccine[]>({ queryKey: ["/api/pet-vaccines"], queryFn: async () => (await apiRequest("GET", "/api/pet-vaccines")).json() });
  const petVax = allPetVax.filter(v => v.pet_id === pet.id);
  const overdueVax = petVax.filter(v => computeVaxStatus(v) === "overdue");

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <PetAvatar pet={pet} size="lg" />
          <div>
            <CardTitle className="text-lg">{pet.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{pet.breed} · {pet.species}</p>
            {pet.dob && <p className="text-xs text-muted-foreground">Born {fmtDate(pet.dob)}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="vet">
          <TabsList className="mb-4">
            <TabsTrigger value="vet" className="gap-1.5"><Stethoscope className="w-3.5 h-3.5" />Vet</TabsTrigger>
            <TabsTrigger value="vaccines" className="gap-1.5">
              <Syringe className="w-3.5 h-3.5" />Vaccines
              {overdueVax.length > 0 && <span className="ml-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{overdueVax.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="meds" className="gap-1.5"><Pill className="w-3.5 h-3.5" />Medications</TabsTrigger>
            <TabsTrigger value="grooming" className="gap-1.5"><Scissors className="w-3.5 h-3.5" />Grooming</TabsTrigger>
          </TabsList>

          {/* VET TAB */}
          <TabsContent value="vet">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">{vets.length} appointment{vets.length !== 1 ? "s" : ""}</p>
              <Dialog open={vetOpen} onOpenChange={open => { setVetOpen(open); if (!open) setEditVet(undefined); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditVet(undefined)}>
                    <Plus className="w-3.5 h-3.5" />Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editVet ? "Edit" : "Add"} Vet Appointment — {pet.name}</DialogTitle></DialogHeader>
                  <VetDialog petId={pet.id} existing={editVet} onClose={() => setVetOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
            {vets.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No vet appointments logged.</p>
            ) : (
              <div className="space-y-2">
                {vets.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium capitalize">{v.type} {v.provider && <span className="font-normal text-muted-foreground">· {v.provider}</span>}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(v.date)}{v.time && ` at ${v.time}`}</p>
                      {v.notes && <p className="text-xs text-muted-foreground mt-0.5">{v.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditVet(v); setVetOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* VACCINES TAB */}
          <TabsContent value="vaccines">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">{petVax.length} vaccine record{petVax.length !== 1 ? "s" : ""}</p>
              <Dialog open={vaxOpen} onOpenChange={open => { setVaxOpen(open); if (!open) setEditVax(undefined); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditVax(undefined)}>
                    <Plus className="w-3.5 h-3.5" />Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editVax ? "Edit" : "Add"} Vaccine — {pet.name}</DialogTitle></DialogHeader>
                  <PetVaccineDialog petId={pet.id} petName={pet.name} existing={editVax} onClose={() => setVaxOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
            {petVax.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No vaccine records yet.</p>
            ) : (
              <div className="space-y-2">
                {petVax
                  .slice()
                  .sort((a, b) => {
                    const order: Record<VaxStatus, number> = { overdue: 0, scheduled: 1, completed: 2, declined: 3, not_required: 4 };
                    return (order[computeVaxStatus(a)] ?? 5) - (order[computeVaxStatus(b)] ?? 5);
                  })
                  .map(v => {
                    const status = computeVaxStatus(v);
                    return (
                      <div key={v.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/60 bg-card">
                        <Syringe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{v.name}</span>
                            <VaxBadge status={status} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                            {v.date_given && <span>Given: {fmtDate(v.date_given)}</span>}
                            {v.next_due   && <span className={status === "overdue" ? "text-red-600 font-medium" : status === "scheduled" ? "text-blue-600" : ""}>
                              {status === "overdue" ? "Overdue since: " : "Next due: "}{fmtDate(v.next_due)}
                            </span>}
                            {v.provider   && <span>· {v.provider}</span>}
                            {v.lot_number && <span>Lot: {v.lot_number}</span>}
                          </div>
                          {v.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{v.notes}</p>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditVax(v); setVaxOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          {/* MEDS TAB */}
          <TabsContent value="meds">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">{meds.length} medication{meds.length !== 1 ? "s" : ""}</p>
              <Dialog open={medOpen} onOpenChange={open => { setMedOpen(open); if (!open) setEditMed(undefined); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditMed(undefined)}>
                    <Plus className="w-3.5 h-3.5" />Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editMed ? "Edit" : "Add"} Medication — {pet.name}</DialogTitle></DialogHeader>
                  <MedDialog petId={pet.id} existing={editMed} onClose={() => setMedOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
            {meds.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No medications logged.</p>
            ) : (
              <div className="space-y-2">
                {meds.map(m => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{m.name} {m.dose && <Badge variant="secondary" className="ml-1 text-xs">{m.dose}</Badge>}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {m.frequency && `${m.frequency} · `}
                        {m.start_date ? `from ${fmtDate(m.start_date)}` : ""}
                        {m.end_date ? ` → ${fmtDate(m.end_date)}` : m.start_date ? " (ongoing)" : ""}
                      </p>
                      {m.notes && <p className="text-xs text-muted-foreground mt-0.5">{m.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditMed(m); setMedOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* GROOMING TAB */}
          <TabsContent value="grooming">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">{grooms.length} appointment{grooms.length !== 1 ? "s" : ""}</p>
              <Dialog open={groomOpen} onOpenChange={open => { setGroomOpen(open); if (!open) setEditGroom(undefined); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditGroom(undefined)}>
                    <Plus className="w-3.5 h-3.5" />Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editGroom ? "Edit" : "Add"} Grooming — {pet.name}</DialogTitle></DialogHeader>
                  <GroomDialog petId={pet.id} existing={editGroom} onClose={() => setGroomOpen(false)} />
                </DialogContent>
              </Dialog>
            </div>
            {grooms.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No grooming appointments logged.</p>
            ) : (
              <div className="space-y-2">
                {grooms.map(g => (
                  <div key={g.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">Grooming {g.provider && <span className="font-normal text-muted-foreground">· {g.provider}</span>}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(g.date)}{g.time && ` at ${g.time}`}</p>
                      {g.notes && <p className="text-xs text-muted-foreground mt-0.5">{g.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditGroom(g); setGroomOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Pets() {
  const { data: pets = [], isLoading } = useQuery<Pet[]>({
    queryKey: ["/api/pets"],
    queryFn: async () => (await apiRequest("GET", "/api/pets")).json(),
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading pets…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-amber-800/10 flex items-center justify-center">
          <PawPrint className="w-5 h-5 text-amber-800" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Pets</h1>
          <p className="text-sm text-muted-foreground">
            {pets.length} family pet{pets.length !== 1 ? "s" : ""} · vet, medications &amp; grooming
          </p>
        </div>
      </div>

      {/* Email flag hint */}
      <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        <strong>Email tip:</strong> Forward pet emails with <code className="bg-amber-100 rounded px-1">#PET @Otis</code> or <code className="bg-amber-100 rounded px-1">#MED @Athena</code> in the subject line to auto-import them.
      </div>

      {/* Pet panels */}
      {pets.map(pet => (
        <PetPanel key={pet.id} pet={pet} />
      ))}
    </div>
  );
}
