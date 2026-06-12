import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN, getFullAge } from "@/lib/children";
import { ChildBadge, AttendeeList } from "@/components/ChildBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, CreditCard, Stethoscope, Tent, AlertCircle, PawPrint } from "lucide-react";
import { format, isAfter, isBefore, addDays, parseISO } from "date-fns";

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  dob?: string;
  color: string;
  notes?: string;
}

function formatDate(d: string) {
  try { return format(parseISO(d), "MMM d"); } catch { return d; }
}

export default function Dashboard() {
  const todayStr = new Date().toISOString().split("T")[0];
  const in14Str = addDays(new Date(), 14).toISOString().split("T")[0];

  // Unified calendar feed for the "Upcoming" card
  const { data: calendarItems = [], isLoading: evLoading } = useQuery({
    queryKey: ["/api/calendar", todayStr, in14Str],
    queryFn: async () => (await apiRequest("GET", `/api/calendar?from=${todayStr}&to=${in14Str}`)).json(),
  });
  const { data: appointments = [] } = useQuery({
    queryKey: ["/api/appointments"],
    queryFn: async () => (await apiRequest("GET", "/api/appointments")).json(),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments"],
    queryFn: async () => (await apiRequest("GET", "/api/payments")).json(),
  });
  const { data: registrations = [] } = useQuery({
    queryKey: ["/api/registrations"],
    queryFn: async () => (await apiRequest("GET", "/api/registrations")).json(),
  });
  const { data: sports = [] } = useQuery({
    queryKey: ["/api/sports"],
    queryFn: async () => (await apiRequest("GET", "/api/sports")).json(),
  });
  const { data: pets = [] } = useQuery<Pet[]>({
    queryKey: ["/api/pets"],
    queryFn: async () => (await apiRequest("GET", "/api/pets")).json(),
  });

  const today = new Date();
  const in30 = addDays(today, 30);

  // Upcoming items from the unified calendar (next 14 days — includes events, appointments, payments, deadlines)
  const upcoming = calendarItems.slice(0, 8);

  // Overdue / pending payments — auto-detect overdue from due_date
  const pendingPayments = payments.filter((p: any) =>
    p.status === "pending" || p.status === "overdue" ||
    (p.status === "pending" && p.due_date && p.due_date < todayStr)
  );
  const overduePayments = payments.filter((p: any) =>
    p.status === "overdue" || (p.status === "pending" && p.due_date && p.due_date < todayStr)
  );

  // Upcoming appointments (next 30 days)
  const upcomingAppts = appointments.filter((a: any) =>
    !a.completed && isAfter(parseISO(a.date), today)
  ).slice(0, 4);

  // Registrations with upcoming deadlines
  const urgentRegs = registrations
    .filter((r: any) => r.deadline && isBefore(parseISO(r.deadline), in30) && r.status !== "confirmed" && r.status !== "cancelled")
    .sort((a: any, b: any) => a.deadline.localeCompare(b.deadline))
    .slice(0, 4);

  const totalOwed = pendingPayments.reduce((s: number, p: any) => s + (p.amount || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Family Hub</h1>
        <p className="text-sm text-muted-foreground">{format(today, "EEEE, MMMM d, yyyy")}</p>
      </div>

      {/* Child cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">The Kids</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {CHILDREN.map(child => {
            const childSports = sports.filter((s: any) => s.child_id === child.id && s.active);
            return (
              <Link key={child.id} href={`/family-calendar?child=${child.id}`}>
                <a className="block" data-testid={`card-child-${child.id}`}>
                  <Card className="p-3 text-center hover:shadow-md transition-shadow cursor-pointer">
                    <div className={`w-10 h-10 rounded-full ${child.colorClass} flex items-center justify-center text-white font-bold text-base mx-auto mb-2`}>
                      {child.name[0]}
                    </div>
                    <div className="font-semibold text-sm">{child.name}</div>
                    <div className="text-xs text-muted-foreground">{getFullAge(child.birthdate)}</div>
                    {childSports.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1 justify-center">
                        {childSports.slice(0, 2).map((s: any) => (
                          <span key={s.id} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{s.sport_name}</span>
                        ))}
                      </div>
                    )}
                  </Card>
                </a>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pet cards */}
      {pets.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <PawPrint size={14} className="text-amber-700" />
            The Pets
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {pets.map(pet => {
              const emoji = pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾";
              const speciesLabel = pet.breed || pet.species;
              return (
                <Link key={pet.id} href="/pets">
                  <a className="block">
                    <Card className="p-3 text-center hover:shadow-md transition-shadow cursor-pointer">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl mx-auto mb-2 shadow-sm"
                        style={{ backgroundColor: pet.color }}
                      >
                        {emoji}
                      </div>
                      <div className="font-semibold text-sm">{pet.name}</div>
                      <div className="text-xs text-muted-foreground capitalize truncate">{speciesLabel}</div>
                    </Card>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upcoming events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar size={15} /> Upcoming (Next 14 Days — All Modules)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {evLoading && <Skeleton className="h-20 w-full" />}
            {!evLoading && upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing scheduled in the next 14 days.</p>
            )}
            {upcoming.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0" data-testid={`event-${ev.id}`}>
                <div className="text-xs text-muted-foreground w-12 shrink-0 mt-0.5">{formatDate(ev.date)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{ev.title}</div>
                  <div className="mt-0.5">
                    <AttendeeList ids={ev.child_ids || []} />
                    {ev._type && ev._type !== "event" && (
                      <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full capitalize">{ev._type}</span>
                    )}
                  </div>
                </div>
                <CategoryBadge cat={ev.category} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payments summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard size={15} /> Payments
              {overduePayments.length > 0 && (
                <Badge variant="destructive" className="text-xs ml-auto">{overduePayments.length} overdue</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">All payments up to date.</p>
            ) : (
              <>
                <div className="text-lg font-bold text-foreground">${totalOwed.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">outstanding</span></div>
                {pendingPayments.slice(0, 4).map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.description}</div>
                      {p.due_date && <div className="text-xs text-muted-foreground">Due {formatDate(p.due_date)}</div>}
                    </div>
                    <div className={`font-semibold text-sm ${p.status === "overdue" ? "text-destructive" : ""}`}>
                      ${p.amount?.toFixed(2)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        {/* Medical appointments */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope size={15} /> Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingAppts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming appointments.</p>
            ) : upcomingAppts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
                <ChildBadge childId={a.child_id} />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{a.provider}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{formatDate(a.date)}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Registration deadlines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tent size={15} /> Registration Deadlines
              {urgentRegs.length > 0 && <AlertCircle size={14} className="text-amber-500 ml-auto" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {urgentRegs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No urgent deadlines in the next 30 days.</p>
            ) : urgentRegs.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
                <ChildBadge childId={r.child_id} />
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{r.program_name}</div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {r.deadline ? `Due ${formatDate(r.deadline)}` : "No deadline"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const map: Record<string, string> = {
    school: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    sports: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    medical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    camp: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    family: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    other: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 capitalize ${map[cat] || map.other}`}>
      {cat}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    not_started: "text-muted-foreground",
    in_progress: "text-amber-600 dark:text-amber-400",
    submitted: "text-blue-600 dark:text-blue-400",
    confirmed: "text-green-600 dark:text-green-400",
    waitlisted: "text-orange-600",
    cancelled: "text-muted-foreground line-through",
  };
  const labels: Record<string, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    submitted: "Submitted",
    confirmed: "Confirmed",
    waitlisted: "Waitlisted",
    cancelled: "Cancelled",
  };
  return <span className={`text-xs ${map[status] || ""}`}>{labels[status] || status}</span>;
}
