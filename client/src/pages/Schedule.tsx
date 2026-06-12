import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN } from "@/lib/children";
import { ChildBadge, AttendeeList } from "@/components/ChildBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, getDay } from "date-fns";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type EventForm = {
  title: string; date: string; time: string; end_time: string;
  child_ids: string[]; category: string; notes: string;
  // Recurrence
  is_template: boolean;
  recurrence_type: string; // '' | 'daily' | 'weekly'
  recurrence_interval: number;
  recurrence_days: number[]; // weekdays 0-6
  recurrence_end_date: string;
};

const blank: EventForm = {
  title: "", date: "", time: "", end_time: "", child_ids: [], category: "family", notes: "",
  is_template: false, recurrence_type: "", recurrence_interval: 1,
  recurrence_days: [], recurrence_end_date: "",
};

export default function Schedule() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => (await apiRequest("GET", "/api/events")).json(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => (await apiRequest("GET", "/api/categories")).json(),
  });

  // Expand recurring events client-side for calendar display
  const expandedEvents = expandEventsForMonth(events, month);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        is_template: !!form.recurrence_type,
        recurrence_days: JSON.stringify(form.recurrence_days),
        recurrence_interval: form.recurrence_interval || 1,
      };
      if (editId) return (await apiRequest("PUT", `/api/events/${editId}`, payload)).json();
      return (await apiRequest("POST", "/api/events", payload)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      setOpen(false); setForm(blank); setEditId(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/events"] }),
  });

  const monthDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDow = getDay(startOfMonth(month));
  const blanks = Array(firstDow).fill(null);

  function getCatColor(catId: string): string {
    const cat = categories.find((c: any) => c.id === catId);
    return cat?.color || "#6b7280";
  }

  const filtered = expandedEvents.filter((e: any) =>
    filterCat === "all" || e.category === filterCat
  );

  const listEvents = filtered
    .filter((e: any) => {
      try { return isSameMonth(parseISO(e.date), month); } catch { return false; }
    })
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  function openEdit(e: any) {
    let recDays: number[] = [];
    try { recDays = e.recurrence_days ? JSON.parse(e.recurrence_days) : []; } catch {}
    setForm({
      title: e.title, date: e.date, time: e.time || "", end_time: e.end_time || "",
      child_ids: e.child_ids || [], category: e.category || "other", notes: e.notes || "",
      is_template: !!e.is_template,
      recurrence_type: e.recurrence_type || "",
      recurrence_interval: e.recurrence_interval || 1,
      recurrence_days: recDays,
      recurrence_end_date: e.recurrence_end_date || "",
    });
    // Edit original template, not instance
    setEditId(e.parent_event_id || e.id);
    setOpen(true);
  }

  function openNew() { setForm(blank); setEditId(null); setOpen(true); }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold">Schedule</h1>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={v => setView(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="calendar" className="text-xs px-3">Calendar</TabsTrigger>
              <TabsTrigger value="list" className="text-xs px-3">List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" onClick={openNew} data-testid="button-add-event">
            <Plus size={15} className="mr-1" /> Add Event
          </Button>
        </div>
      </div>

      {/* Month nav + filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>←</Button>
        <span className="font-semibold text-sm min-w-[120px]">{format(month, "MMMM yyyy")}</span>
        <Button variant="outline" size="sm" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>→</Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Category:</span>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {view === "calendar" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {blanks.map((_, i) => <div key={`b${i}`} className="h-24 border-b border-r border-border bg-muted/10" />)}
            {monthDays.map(day => {
              const dayEvs = filtered.filter((e: any) => {
                try { return isSameDay(parseISO(e.date), day); } catch { return false; }
              });
              const isToday = isSameDay(day, new Date());
              return (
                <div key={day.toISOString()} className="h-24 border-b border-r border-border p-1 overflow-hidden">
                  <div className={`text-xs font-medium mb-0.5 w-5 h-5 flex items-center justify-center rounded-full
                    ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </div>
                  {dayEvs.slice(0, 3).map((e: any) => {
                    const color = getCatColor(e.category);
                    return (
                      <div
                        key={e.id}
                        className="text-[10px] px-1 py-0.5 rounded mb-0.5 truncate text-white cursor-pointer flex items-center gap-0.5"
                        style={{ backgroundColor: color }}
                        onClick={() => !e._recurrence_instance && openEdit(e)}
                        title={e.title + (e._recurrence_instance ? " (repeating)" : "")}
                      >
                        {e._recurrence_instance && <RefreshCw size={8} className="shrink-0 opacity-70" />}
                        <span className="truncate">{e.title}</span>
                      </div>
                    );
                  })}
                  {dayEvs.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">+{dayEvs.length - 3} more</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "list" && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Events — {format(month, "MMMM yyyy")}
          </h2>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
            : listEvents.length === 0 ? <p className="text-sm text-muted-foreground">No events this month.</p>
            : (
              <div className="space-y-1.5">
                {listEvents.map((ev: any) => {
                  const color = getCatColor(ev.category);
                  return (
                    <div key={ev.id} className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg" data-testid={`event-row-${ev.id}`}>
                      <div className="w-1 h-full min-h-[36px] rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{ev.title}</span>
                          {ev._recurrence_instance && <Badge variant="outline" className="text-[10px] px-1.5 gap-0.5"><RefreshCw size={9} />Recurring</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(ev.date), "MMM d, yyyy")}{ev.time && ` · ${ev.time}`}{ev.end_time && `–${ev.end_time}`}
                        </div>
                        <div className="mt-1">
                          <AttendeeList ids={ev.child_ids || []} />
                        </div>
                      </div>
                      {!ev._recurrence_instance && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ev)}><Pencil size={12} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => del.mutate(ev.id)}><Trash2 size={12} /></Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setForm(blank); setEditId(null); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Event" : "New Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input data-testid="input-event-title" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Event name" className="mt-1 h-8" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Start date *</Label>
                <Input type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Start time</Label>
                <Input type="time" value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="mt-1 h-8" />
              </div>
              <div>
                <Label className="text-xs">End time</Label>
                <Input type="time" value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className="mt-1 h-8" />
              </div>
            </div>

            {/* Children */}
            <div>
              <Label className="text-xs mb-1 block">Who's involved?</Label>
              <div className="flex flex-wrap gap-2">
                {CHILDREN.map(c => (
                  <label key={c.id} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={form.child_ids.includes(c.id)}
                      onCheckedChange={ch => setForm(f => ({
                        ...f,
                        child_ids: ch ? [...f.child_ids, c.id] : f.child_ids.filter(x => x !== c.id)
                      }))}
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Recurrence */}
            <div className="border border-border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <RefreshCw size={12} /> Repeating event
                </Label>
                <Switch
                  checked={!!form.recurrence_type}
                  onCheckedChange={v => setForm(f => ({ ...f, recurrence_type: v ? "weekly" : "" }))}
                />
              </div>
              {form.recurrence_type && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Repeat</Label>
                      <Select value={form.recurrence_type} onValueChange={v => setForm(f => ({ ...f, recurrence_type: v }))}>
                        <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly (specific days)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Every N {form.recurrence_type === "daily" ? "days" : "weeks"}</Label>
                      <Input
                        type="number" min={1} max={30}
                        value={form.recurrence_interval}
                        onChange={e => setForm(f => ({ ...f, recurrence_interval: parseInt(e.target.value) || 1 }))}
                        className="mt-1 h-8"
                      />
                    </div>
                  </div>

                  {form.recurrence_type === "weekly" && (
                    <div>
                      <Label className="text-xs mb-1.5 block">On these days</Label>
                      <div className="flex gap-1 flex-wrap">
                        {DAYS_OF_WEEK.map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`w-9 h-9 rounded-full text-xs font-medium border transition-colors
                              ${form.recurrence_days.includes(i)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "border-border hover:bg-muted"}`}
                            onClick={() => setForm(f => ({
                              ...f,
                              recurrence_days: f.recurrence_days.includes(i)
                                ? f.recurrence_days.filter(d => d !== i)
                                : [...f.recurrence_days, i]
                            }))}
                          >
                            {day.slice(0, 2)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">End date (optional)</Label>
                    <Input
                      type="date" value={form.recurrence_end_date}
                      onChange={e => setForm(f => ({ ...f, recurrence_end_date: e.target.value }))}
                      className="mt-1 h-8"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">Leave blank to repeat for 6 months</p>
                  </div>
                </>
              )}
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="mt-1 h-8" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={!form.title || !form.date || save.isPending}
              data-testid="button-save-event"
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Client-side recurrence expansion for calendar display ────────────────────
function expandEventsForMonth(events: any[], month: Date): any[] {
  const results: any[] = [];
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  for (const ev of events) {
    if (!ev.is_template || !ev.recurrence_type) {
      results.push(ev);
      continue;
    }
    // Expand recurring
    const startDate = new Date(ev.date + "T00:00:00");
    const endDate = ev.recurrence_end_date
      ? new Date(ev.recurrence_end_date + "T00:00:00")
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const rangeFrom = new Date(monthStart + "T00:00:00");
    const rangeTo = new Date(monthEnd + "T00:00:00");

    let days: number[] = [];
    try { days = ev.recurrence_days ? JSON.parse(ev.recurrence_days) : []; } catch {}

    const interval = ev.recurrence_interval || 1;
    let cursor = new Date(startDate < rangeFrom ? rangeFrom : startDate);
    // For daily, align to interval
    if (ev.recurrence_type === "daily" && startDate < rangeFrom) {
      const diff = Math.floor((rangeFrom.getTime() - startDate.getTime()) / 86400000);
      const aligned = diff % interval;
      if (aligned !== 0) cursor.setDate(cursor.getDate() + (interval - aligned));
    }

    let safety = 0;
    while (cursor <= rangeTo && cursor <= endDate && safety < 200) {
      safety++;
      let include = false;
      if (ev.recurrence_type === "daily") include = true;
      else if (ev.recurrence_type === "weekly") include = days.length === 0 || days.includes(cursor.getDay());

      if (include) {
        const dateStr = format(cursor, "yyyy-MM-dd");
        results.push({
          ...ev,
          id: ev.id + "_" + dateStr,
          date: dateStr,
          parent_event_id: ev.id,
          _recurrence_instance: true,
        });
      }

      if (ev.recurrence_type === "daily") cursor.setDate(cursor.getDate() + interval);
      else cursor.setDate(cursor.getDate() + 1);
    }
  }
  return results;
}
