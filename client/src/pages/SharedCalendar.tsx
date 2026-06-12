import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN } from "@/lib/children";
import { AttendeeList } from "@/components/ChildBadge";
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, getDay, addMonths, subMonths
} from "date-fns";
import { RefreshCw, Calendar, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  event: "Event", appointment: "Appointment",
  payment: "Payment Due", registration: "Deadline",
};

const CHILD_COLORS: Record<string, string> = {
  cole: "#3b82f6",
  greta: "#8b5cf6",
  airlie: "#22c55e",
  clara: "#f59e0b",
  heidi: "#ec4899",
  daisy: "#14b8a6",
};

interface SharedCalendarProps {
  token: string;
}

export default function SharedCalendar({ token }: SharedCalendarProps) {
  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(month), "yyyy-MM-dd");

  const { data: shareData, isLoading: verifyLoading, isError: verifyError } = useQuery({
    queryKey: ["/api/share/verify", token],
    queryFn: async () => (await apiRequest("GET", `/api/share/verify/${token}`)).json(),
    retry: false,
  });

  const { data: calData, isLoading } = useQuery({
    queryKey: ["/api/share", token, "calendar", from, to],
    queryFn: async () =>
      (await apiRequest("GET", `/api/share/${token}/calendar?from=${from}&to=${to}`)).json(),
    enabled: !!shareData?.valid,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => (await apiRequest("GET", "/api/categories")).json(),
  });

  const items: any[] = calData?.items || [];

  function getCatColor(catId: string): string {
    const cat = (categories as any[]).find((c: any) => c.id === catId);
    return cat?.color || "#6b7280";
  }

  const monthDays = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDow = getDay(startOfMonth(month));
  const blanks = Array(firstDow).fill(null);

  const dayItems = (day: Date) =>
    items.filter((item: any) => {
      try { return isSameDay(parseISO(item.date), day); } catch { return false; }
    });

  const selectedItems = selectedDay
    ? items
        .filter((item: any) => {
          try { return item.date === selectedDay; } catch { return false; }
        })
        .sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""))
    : [];

  // Upcoming: next items sorted by date
  const today = format(new Date(), "yyyy-MM-dd");
  const upcoming = items
    .filter((item: any) => item.date && item.date >= today)
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .slice(0, 10);

  if (verifyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading calendar…</p>
      </div>
    );
  }

  if (verifyError || !shareData?.valid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <Lock size={32} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <h1 className="text-lg font-semibold mb-1">Invalid or expired link</h1>
          <p className="text-sm text-muted-foreground">
            This calendar link is not valid. Ask the family for an updated link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header bar */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg aria-label="Bieri Family Hub" viewBox="0 0 32 32" width="26" height="26" fill="none">
            <rect width="32" height="32" rx="7" fill="hsl(152 35% 30%)" />
            <path d="M16 8 L8 15 h2.8 v9 h10.4v-9 h2.8 Z" fill="white" />
          </svg>
          <div>
            <div className="text-sm font-bold leading-tight">Bieri Family</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Family Calendar — View Only</div>
          </div>
        </div>
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Lock size={9} /> Read Only
        </Badge>
      </div>

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            {calData?.label || "Family Calendar"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            All family events, appointments, payment due dates, and registration deadlines
          </p>
        </div>

        <div className="flex gap-4 lg:gap-6 flex-col lg:flex-row">
          {/* Calendar */}
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
              {isLoading ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                  Loading events…
                </div>
              ) : (
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
              )}
            </div>

            {/* Day detail panel */}
            {selectedDay && selectedItems.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-semibold">
                  {format(parseISO(selectedDay), "EEEE, MMMM d")}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""}
                  </span>
                </h3>
                {selectedItems.map((item: any) => {
                  const color = getCatColor(item.category);
                  const childColor = item.child_ids?.[0]
                    ? CHILD_COLORS[item.child_ids[0]] || "#6b7280"
                    : null;
                  return (
                    <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-border last:border-0">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                            style={{ backgroundColor: color }}>
                            {TYPE_LABELS[item._type] || item._type}
                          </span>
                          {item._recurrence_instance && (
                            <Badge variant="outline" className="text-[10px] px-1.5 gap-0.5">
                              <RefreshCw size={8} />Repeating
                            </Badge>
                          )}
                        </div>
                        {item.time && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {item.time}{item.end_time && `–${item.end_time}`}
                          </div>
                        )}
                        {(item.child_ids || []).length > 0 && (
                          <div className="mt-1">
                            <AttendeeList ids={item.child_ids || []} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="lg:w-64 shrink-0 space-y-4">
            {/* Legend */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Legend</h3>
              {(categories as any[]).map((cat: any) => (
                <div key={cat.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs">{cat.name}</span>
                </div>
              ))}
            </div>

            {/* Children */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Children</h3>
              {CHILDREN.map(child => {
                const cc = CHILD_COLORS[child.id] || "#6b7280";
                return (
                  <div key={child.id} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cc }} />
                    <span className="text-xs">{child.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Upcoming */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Coming Up</h3>
              {upcoming.map((item: any) => {
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
      </div>
    </div>
  );
}
