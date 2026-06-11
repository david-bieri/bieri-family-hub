import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN } from "@/lib/children";
import { ChildBadge } from "@/components/ChildBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Share2, Copy, Check, RefreshCw, Calendar } from "lucide-react";
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, getDay, addMonths, subMonths
} from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  event: "Event", appointment: "Appointment", payment: "Payment Due", registration: "Deadline",
};

function getHashChildParam(): string | null {
  // Hash is like #/family-calendar?child=cole
  const hash = window.location.hash; // e.g. "#/family-calendar?child=cole"
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(hash.slice(qIndex + 1)).get("child");
}

export default function FamilyCalendar() {
  const [month, setMonth] = useState(new Date());
  const [filterChildren, setFilterChildren] = useState<string[]>(() => {
    const c = getHashChildParam();
    return c ? [c] : [];
  });
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["/api/calendar", from, to],
    queryFn: async () =>
      (await apiRequest("GET", `/api/calendar?from=${from}&to=${to}`)).json(),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => (await apiRequest("GET", "/api/categories")).json(),
  });

  const createShare = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/share/create", { label: "Bieri Family Calendar" })).json(),
    onSuccess: (data) => setShareToken(data.token),
  });

  // Filter items
  const filtered = items.filter((item: any) => {
    if (filterChildren.length > 0) {
      const itemKids: string[] = item.child_ids || [];
      if (!itemKids.some(k => filterChildren.includes(k))) return false;
    }
    if (filterTypes.length > 0 && !filterTypes.includes(item._type)) return false;
    return true;
  });

  function getCatColor(catId: string): string {
    const cat = categories.find((c: any) => c.id === catId);
    return cat?.color || "#6b7280";
  }

  function getChildColor(childId: string): string {
    return CHILDREN.find(c => c.id === childId)?.colorClass || "bg-gray-400";
  }

  const monthDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDow = getDay(startOfMonth(month));
  const blanks = Array(firstDow).fill(null);

  const dayItems = (day: Date) =>
    filtered.filter((item: any) => {
      try { return isSameDay(parseISO(item.date), day); } catch { return false; }
    });

  const selectedItems = selectedDay
    ? filtered.filter((item: any) => {
        try { return item.date === selectedDay; } catch { return false; }
      }).sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""))
    : [];

  function toggleChild(id: string) {
    setFilterChildren(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleType(t: string) {
    setFilterTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  }

  async function copyShareLink() {
    const url = `${window.location.origin}/?share=${shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Upcoming list (next 14 days)
  const today = format(new Date(), "yyyy-MM-dd");
  const in14 = format(addMonths(new Date(), 0), "yyyy-MM-dd");
  const upcoming = items
    .filter((item: any) => item.date && item.date >= today)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .slice(0, 20);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            Family Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            All events, appointments, payments, and deadlines in one view
          </p>
        </div>
        <Button
          size="sm" variant="outline"
          onClick={() => { setShareOpen(true); if (!shareToken) createShare.mutate(); }}
          data-testid="button-share-calendar"
        >
          <Share2 size={14} className="mr-1.5" /> Share
        </Button>
      </div>

      <div className="flex gap-4 lg:gap-6 flex-col lg:flex-row">
        {/* Left: calendar */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setMonth(m => subMonths(m, 1))}>←</Button>
            <span className="font-semibold text-sm min-w-[130px] text-center">
              {format(month, "MMMM yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setMonth(m => addMonths(m, 1))}>→</Button>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
              onClick={() => setMonth(new Date())}>
              Today
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 border-b border-border bg-muted/30">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-muted-foreground py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {blanks.map((_, i) => (
                <div key={`b${i}`} className="min-h-[80px] border-b border-r border-border bg-muted/5" />
              ))}
              {monthDays.map(day => {
                const evs = dayItems(day);
                const isToday = isSameDay(day, new Date());
                const dateStr = format(day, "yyyy-MM-dd");
                const isSelected = selectedDay === dateStr;

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[80px] border-b border-r border-border p-1 cursor-pointer transition-colors
                      ${isSelected ? "bg-primary/8" : "hover:bg-muted/40"}`}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  >
                    <div className={`text-xs font-medium mb-0.5 w-5 h-5 flex items-center justify-center rounded-full
                      ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    {evs.slice(0, 3).map((item: any) => {
                      const color = getCatColor(item.category);
                      return (
                        <div
                          key={item.id}
                          className="text-[10px] px-1 py-0.5 rounded mb-0.5 truncate text-white leading-tight flex items-center gap-0.5"
                          style={{ backgroundColor: color }}
                          title={item.title}
                        >
                          {item._recurrence_instance && <RefreshCw size={7} className="shrink-0 opacity-80" />}
                          <span className="truncate">{item.title}</span>
                        </div>
                      );
                    })}
                    {evs.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{evs.length - 3}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day detail panel */}
          {selectedDay && selectedItems.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-sm font-semibold">
                {format(parseISO(selectedDay), "EEEE, MMMM d")}
                <span className="ml-2 text-xs text-muted-foreground font-normal">{selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}</span>
              </h3>
              {selectedItems.map((item: any) => {
                const color = getCatColor(item.category);
                return (
                  <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
                    <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{item.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: color }}>
                          {TYPE_LABELS[item._type] || item._type}
                        </span>
                        {item._recurrence_instance && (
                          <Badge variant="outline" className="text-[10px] px-1.5 gap-0.5">
                            <RefreshCw size={8} />Repeating
                          </Badge>
                        )}
                      </div>
                      {item.time && <div className="text-xs text-muted-foreground mt-0.5">{item.time}{item.end_time && `–${item.end_time}`}</div>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(item.child_ids || []).map((cid: string) => (
                          <ChildBadge key={cid} childId={cid} />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: sidebar filters + upcoming */}
        <div className="lg:w-64 shrink-0 space-y-4">
          {/* Color legend */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Legend</h3>
            {categories.map((cat: any) => (
              <div key={cat.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="text-xs">{cat.name}</span>
              </div>
            ))}
          </div>

          {/* Filter by child */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Filter by Child</h3>
            {CHILDREN.map(child => (
              <label key={child.id} className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={filterChildren.length === 0 || filterChildren.includes(child.id)}
                  onCheckedChange={() => {
                    if (filterChildren.length === 0) {
                      // Start filtering: show only this child
                      setFilterChildren(CHILDREN.filter(c => c.id !== child.id).map(c => c.id));
                    } else {
                      toggleChild(child.id);
                    }
                  }}
                  id={`filter-${child.id}`}
                />
                <ChildBadge childId={child.id} />
              </label>
            ))}
            {filterChildren.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs w-full mt-1" onClick={() => setFilterChildren([])}>
                Show all
              </Button>
            )}
          </div>

          {/* Filter by type */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Filter by Type</h3>
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <label key={type} className="flex items-center gap-2 cursor-pointer">
                <Switch
                  checked={filterTypes.length === 0 || filterTypes.includes(type)}
                  onCheckedChange={() => {
                    if (filterTypes.length === 0) {
                      setFilterTypes(Object.keys(TYPE_LABELS).filter(t => t !== type));
                    } else {
                      toggleType(type);
                    }
                  }}
                />
                <span className="text-xs">{label}</span>
              </label>
            ))}
            {filterTypes.length > 0 && (
              <Button variant="ghost" size="sm" className="text-xs w-full mt-1" onClick={() => setFilterTypes([])}>
                Show all types
              </Button>
            )}
          </div>

          {/* Upcoming */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Coming Up</h3>
            {upcoming.slice(0, 8).map((item: any) => {
              const color = getCatColor(item.category);
              return (
                <div key={item.id} className="flex items-start gap-2 py-1 border-b border-border last:border-0">
                  <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: color }} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{item.title}</div>
                    <div className="text-[11px] text-muted-foreground">{format(parseISO(item.date), "MMM d")}</div>
                  </div>
                </div>
              );
            })}
            {upcoming.length === 0 && <p className="text-xs text-muted-foreground">Nothing coming up.</p>}
          </div>
        </div>
      </div>

      {/* Share dialog */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 size={16} /> Share Family Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view your family calendar — read-only, no login required.
            </p>
            {createShare.isPending && <p className="text-sm text-muted-foreground">Generating link…</p>}
            {shareToken && (
              <div className="space-y-2">
                <div className="bg-muted rounded-lg p-3 font-mono text-xs break-all text-muted-foreground">
                  {window.location.origin}/?share={shareToken}
                </div>
                <Button
                  className="w-full" size="sm"
                  onClick={copyShareLink}
                  data-testid="button-copy-share-link"
                >
                  {copied ? <><Check size={14} className="mr-1" />Copied!</> : <><Copy size={14} className="mr-1" />Copy Link</>}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The link shows all events, appointments, payment due dates, and registration deadlines.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
