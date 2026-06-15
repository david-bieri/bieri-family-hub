import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN, PARENTS } from "@/lib/children";
import { ChildBadge, AttendeeList } from "@/components/ChildBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Share2, Copy, Check, RefreshCw, Calendar, Home } from "lucide-react";
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, getDay, addMonths, subMonths
} from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  event: "Event", appointment: "Appointment", payment: "Payment Due", registration: "Deadline",
};

interface CustodyBlock {
  id: string;
  week_start: string;
  household_id: string;
  child_ids: string[];
  notes: string;
}

function getHashChildParam(): string | null {
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(hash.slice(qIndex + 1)).get("child");
}

/**
 * Determine which household has custody on a given date.
 * Finds the most recent custody block whose week_start <= date.
 */
function getCustodyForDate(date: string, blocks: CustodyBlock[]): CustodyBlock | null {
  // blocks should be sorted by week_start ascending
  let result: CustodyBlock | null = null;
  for (const block of blocks) {
    if (block.week_start <= date) {
      result = block;
    } else {
      break;
    }
  }
  return result;
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

  // Fetch custody schedule for the current year
  const currentYear = month.getFullYear();
  const { data: custodyBlocks = [] } = useQuery<CustodyBlock[]>({
    queryKey: ["/api/custody/schedule", currentYear],
    queryFn: async () =>
      (await apiRequest("GET", `/api/custody/schedule?year=${currentYear}`)).json(),
  });

  // Fetch current custody status
  const { data: currentCustody } = useQuery<CustodyBlock>({
    queryKey: ["/api/custody/current"],
    queryFn: async () =>
      (await apiRequest("GET", "/api/custody/current")).json(),
  });

  // Sort custody blocks by week_start for binary-search lookup
  const sortedBlocks = useMemo(
    () => [...custodyBlocks].sort((a, b) => a.week_start.localeCompare(b.week_start)),
    [custodyBlocks]
  );

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

  /**
   * Get the background class for a day cell based on custody.
   * Bieri = subtle green tint, James = subtle amber tint.
   */
  function getCustodyBg(day: Date): string {
    if (sortedBlocks.length === 0) return "";
    const dateStr = format(day, "yyyy-MM-dd");
    const block = getCustodyForDate(dateStr, sortedBlocks);
    if (!block) return "";
    return block.household_id === "hh-bieri"
      ? "bg-emerald-50 dark:bg-emerald-950/20"
      : "bg-amber-50 dark:bg-amber-950/20";
  }

  // Current custody badge info
  const custodyBadge = useMemo(() => {
    if (!currentCustody) return null;
    const isBieri = currentCustody.household_id === "hh-bieri";
    return {
      label: isBieri ? "Cole & Airlie here" : "Cole & Airlie away",
      colorClass: isBieri
        ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700"
        : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
      dotClass: isBieri ? "bg-emerald-500" : "bg-amber-500",
    };
  }, [currentCustody]);

  // Upcoming list (next 14 days)
  const today = format(new Date(), "yyyy-MM-dd");
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
        <div className="flex items-center gap-2">
          {/* Custody badge */}
          {custodyBadge && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${custodyBadge.colorClass}`}>
              <Home size={12} />
              <span className="font-semibold">{custodyBadge.label}</span>
              <span className={`w-2 h-2 rounded-full ${custodyBadge.dotClass} animate-pulse`} />
            </div>
          )}
          <Button
            size="sm" variant="outline"
            onClick={() => { setShareOpen(true); if (!shareToken) createShare.mutate(); }}
            data-testid="button-share-calendar"
          >
            <Share2 size={14} className="mr-1.5" /> Share
          </Button>
        </div>
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
                const custodyBgClass = getCustodyBg(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[80px] border-b border-r border-border p-1 cursor-pointer transition-colors
                      ${custodyBgClass}
                      ${isSelected ? "ring-2 ring-primary ring-inset" : "hover:brightness-95"}`}
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
                {/* Show custody for selected day */}
                {sortedBlocks.length > 0 && (() => {
                  const block = getCustodyForDate(selectedDay, sortedBlocks);
                  if (!block) return null;
                  const isBieri = block.household_id === "hh-bieri";
                  return (
                    <span className={`ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isBieri ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      <Home size={9} />
                      {isBieri ? "Bieri" : "James"} week
                    </span>
                  );
                })()}
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
                      <div className="mt-1">
                        <AttendeeList ids={item.child_ids || []} />
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

          {/* Filter by family member */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Filter by Person
              </h3>
              {filterChildren.length > 0 && (
                <button className="text-[10px] text-primary hover:underline" onClick={() => setFilterChildren([])}>
                  Show all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...PARENTS, ...CHILDREN.map(c => ({ id: c.id, name: c.name }))].map(member => {
                const active = filterChildren.includes(member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleChild(member.id)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
            {filterChildren.length > 0 && (
              <p className="text-[10px] text-muted-foreground pt-0.5">
                Showing {filterChildren.length === 1 ? "1 person" : `${filterChildren.length} people`}
              </p>
            )}
          </div>

          {/* Filter by type */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Filter by Type
              </h3>
              {filterTypes.length > 0 && (
                <button className="text-[10px] text-primary hover:underline" onClick={() => setFilterTypes([])}>
                  Show all
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TYPE_LABELS).map(([type, label]) => {
                const active = filterTypes.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
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
