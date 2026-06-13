import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays } from "date-fns";
import { Car, Users, MapPin, Clock, AlertTriangle, Plus, Check, ChevronLeft, ChevronRight, Truck, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const CHILDREN = ["cole", "greta", "airlie", "clara", "heidi", "daisy"];
const CHILD_COLORS: Record<string, string> = {
  cole: "#3b82f6", greta: "#ec4899", airlie: "#8b5cf6",
  clara: "#f59e0b", heidi: "#10b981", daisy: "#f97316",
};

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export default function Carpool() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [activeTab, setActiveTab] = useState("daily");
  const [showAddRide, setShowAddRide] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showAddCarpool, setShowAddCarpool] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ─── Queries ──────────────────────────────────────────────────────────────
  const { data: dailyRides = [] } = useQuery({
    queryKey: ["/api/transport/daily", selectedDate],
    queryFn: () => fetch(`/api/transport/daily/${selectedDate}`).then(r => r.json()),
  });

  const { data: conflicts = { conflicts: [] } } = useQuery({
    queryKey: ["/api/transport/conflicts", selectedDate],
    queryFn: () => fetch(`/api/transport/conflicts/${selectedDate}`).then(r => r.json()),
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["/api/drivers"],
    queryFn: () => fetch("/api/drivers").then(r => r.json()),
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["/api/vehicles"],
    queryFn: () => fetch("/api/vehicles").then(r => r.json()),
  });

  const { data: carpoolGroups = [] } = useQuery({
    queryKey: ["/api/carpool-groups"],
    queryFn: () => fetch("/api/carpool-groups").then(r => r.json()),
  });

  const { data: transportLog = [] } = useQuery({
    queryKey: ["/api/transport-log"],
    queryFn: () => fetch("/api/transport-log").then(r => r.json()),
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: ({ rideId, driverId, vehicleId }: { rideId: string; driverId: string; vehicleId?: string }) =>
      fetch(`/api/rides/${rideId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId, vehicle_id: vehicleId }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      toast({ title: "Driver assigned!" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ rideId, miles }: { rideId: string; miles?: number }) =>
      fetch(`/api/rides/${rideId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miles }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transport-log"] });
      toast({ title: "Ride completed!" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (date: string) =>
      fetch(`/api/transport/generate/${date}`, { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      toast({ title: `Generated ${data.generated} ride(s) from schedule` });
    },
  });

  const addRideMutation = useMutation({
    mutationFn: (ride: any) =>
      fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ride),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transport/daily"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      setShowAddRide(false);
      toast({ title: "Ride added!" });
    },
  });

  const addDriverMutation = useMutation({
    mutationFn: (driver: any) =>
      fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(driver),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers"] });
      setShowAddDriver(false);
      toast({ title: "Driver added!" });
    },
  });

  const addVehicleMutation = useMutation({
    mutationFn: (vehicle: any) =>
      fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicle),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      setShowAddVehicle(false);
      toast({ title: "Vehicle added!" });
    },
  });

  const addCarpoolMutation = useMutation({
    mutationFn: (group: any) =>
      fetch("/api/carpool-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(group),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/carpool-groups"] });
      setShowAddCarpool(false);
      toast({ title: "Carpool group added!" });
    },
  });

  // ─── Date Navigation ──────────────────────────────────────────────────────
  const prevDay = () => setSelectedDate(format(addDays(new Date(selectedDate), -1), "yyyy-MM-dd"));
  const nextDay = () => setSelectedDate(format(addDays(new Date(selectedDate), 1), "yyyy-MM-dd"));
  const goToday = () => setSelectedDate(format(new Date(), "yyyy-MM-dd"));

  // ─── Group rides by child for the timeline ────────────────────────────────
  const ridesByChild: Record<string, any[]> = {};
  for (const ride of dailyRides) {
    const cid = ride.child_id || "unassigned";
    if (!ridesByChild[cid]) ridesByChild[cid] = [];
    ridesByChild[cid].push(ride);
  }

  const unassignedCount = dailyRides.filter((r: any) => r.status === "unassigned").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Car className="h-6 w-6" /> Carpool & Transportation
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage rides, drivers, vehicles, and carpool groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => generateMutation.mutate(selectedDate)}>
            Auto-Generate Rides
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="daily" className="flex items-center gap-1">
            <Clock className="h-4 w-4" /> Daily View
            {unassignedCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {unassignedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="drivers" className="flex items-center gap-1">
            <Users className="h-4 w-4" /> Drivers & Vehicles
          </TabsTrigger>
          <TabsTrigger value="carpools" className="flex items-center gap-1">
            <Truck className="h-4 w-4" /> Carpool Groups
          </TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-1">
            <History className="h-4 w-4" /> Log
          </TabsTrigger>
        </TabsList>

        {/* ─── DAILY VIEW ──────────────────────────────────────────────────────── */}
        <TabsContent value="daily" className="space-y-4">
          {/* Date picker */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={prevDay}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <span className="font-medium text-lg min-w-[180px] text-center">
              {format(new Date(selectedDate + "T12:00:00"), "EEEE, MMM d")}
            </span>
            <Button variant="ghost" size="icon" onClick={nextDay}><ChevronRight className="h-4 w-4" /></Button>
            <Dialog open={showAddRide} onOpenChange={setShowAddRide}>
              <DialogTrigger asChild>
                <Button size="sm" className="ml-auto"><Plus className="h-4 w-4 mr-1" /> Add Ride</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Ride Request</DialogTitle></DialogHeader>
                <AddRideForm date={selectedDate} onSubmit={(ride: any) => addRideMutation.mutate(ride)} />
              </DialogContent>
            </Dialog>
          </div>

          {/* Conflicts alert */}
          {conflicts.conflicts?.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" /> {conflicts.conflicts.length} Scheduling Conflict{conflicts.conflicts.length > 1 ? "s" : ""}
                </div>
                {conflicts.conflicts.map((c: any, i: number) => (
                  <p key={i} className="text-sm text-amber-600 dark:text-amber-300">
                    {capitalize(c.ride_a.child_id)} ({c.ride_a.activity}) and {capitalize(c.ride_b.child_id)} ({c.ride_b.activity}) — {c.overlap_minutes} min overlap
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Timeline by child */}
          {dailyRides.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Car className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No rides scheduled for this day</p>
                <p className="text-sm mt-1">Click "Auto-Generate Rides" to pull from sports/events, or add manually.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {Object.entries(ridesByChild).map(([childId, rides]) => (
                <Card key={childId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: CHILD_COLORS[childId] || "#6b7280" }}
                      />
                      {capitalize(childId)}
                      <Badge variant="secondary" className="ml-auto">{rides.length} ride{rides.length > 1 ? "s" : ""}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {rides.map((ride: any) => (
                      <div key={ride.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{ride.activity || "Ride"}</div>
                          <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                            {ride.dropoff_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(ride.dropoff_time)}</span>}
                            {ride.dropoff_location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ride.dropoff_location}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ride.status === "assigned" && ride.drivers?.name && (
                            <Badge variant="outline" className="text-xs">{ride.drivers.name}</Badge>
                          )}
                          {ride.status === "carpool" && (
                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 text-xs">Carpool</Badge>
                          )}
                          {ride.status === "auto" && (
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">From Schedule</Badge>
                          )}
                          {ride.status === "unassigned" && (
                            <Select onValueChange={(driverId) => assignMutation.mutate({ rideId: ride.id, driverId })}>
                              <SelectTrigger className="w-[120px] h-7 text-xs">
                                <SelectValue placeholder="Assign..." />
                              </SelectTrigger>
                              <SelectContent>
                                {drivers.filter((d: any) => d.active).map((d: any) => (
                                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {ride.status === "assigned" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => completeMutation.mutate({ rideId: ride.id })}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── DRIVERS & VEHICLES ──────────────────────────────────────────────── */}
        <TabsContent value="drivers" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Drivers */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Drivers</CardTitle>
                <Dialog open={showAddDriver} onOpenChange={setShowAddDriver}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Driver</DialogTitle></DialogHeader>
                    <AddDriverForm onSubmit={(d: any) => addDriverMutation.mutate(d)} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2">
                {drivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No drivers yet</p>
                ) : drivers.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.relationship}{d.phone ? ` • ${d.phone}` : ""}{d.vehicles?.name ? ` • ${d.vehicles.name}` : ""}
                      </div>
                    </div>
                    <Badge variant={d.active ? "default" : "secondary"} className="text-xs">
                      {d.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Vehicles */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Vehicles</CardTitle>
                <Dialog open={showAddVehicle} onOpenChange={setShowAddVehicle}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" /> Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
                    <AddVehicleForm onSubmit={(v: any) => addVehicleMutation.mutate(v)} />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-2">
                {vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No vehicles yet</p>
                ) : vehicles.map((v: any) => (
                  <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{v.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.make_model || "—"} • {v.seats} seats{v.color ? ` • ${v.color}` : ""}
                      </div>
                    </div>
                    <Badge variant={v.active ? "default" : "secondary"} className="text-xs">
                      {v.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── CARPOOL GROUPS ──────────────────────────────────────────────────── */}
        <TabsContent value="carpools" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={showAddCarpool} onOpenChange={setShowAddCarpool}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Carpool Group</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Carpool Group</DialogTitle></DialogHeader>
                <AddCarpoolForm onSubmit={(g: any) => addCarpoolMutation.mutate(g)} />
              </DialogContent>
            </Dialog>
          </div>
          {carpoolGroups.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No carpool groups yet</p>
                <p className="text-sm mt-1">Create a group to set up recurring ride-sharing with other families.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {carpoolGroups.map((g: any) => (
                <Card key={g.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {g.name}
                      <Badge variant={g.active ? "default" : "secondary"}>{g.active ? "Active" : "Paused"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {g.activity && <p><span className="text-muted-foreground">Activity:</span> {g.activity}</p>}
                    {g.day_of_week && <p><span className="text-muted-foreground">Day:</span> {capitalize(g.day_of_week)}</p>}
                    {g.pickup_time && <p><span className="text-muted-foreground">Pickup:</span> {formatTime(g.pickup_time)} from {g.pickup_location || "—"}</p>}
                    {g.dropoff_time && <p><span className="text-muted-foreground">Dropoff:</span> {formatTime(g.dropoff_time)} at {g.dropoff_location || "—"}</p>}
                    {g.child_ids?.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {g.child_ids.map((cid: string) => (
                          <Badge key={cid} variant="outline" style={{ borderColor: CHILD_COLORS[cid] || "#6b7280" }} className="text-xs">
                            {capitalize(cid)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {g.rotation?.length > 0 && (
                      <p className="text-muted-foreground mt-2">Rotation: {g.rotation.map((r: any) => r.driver || r).join(" → ")}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── TRANSPORT LOG ───────────────────────────────────────────────────── */}
        <TabsContent value="log" className="space-y-4">
          {transportLog.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No transport history yet</p>
                <p className="text-sm mt-1">Completed rides will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {transportLog.slice(0, 50).map((log: any) => (
                    <div key={log.id} className="flex items-center gap-3 p-3 text-sm">
                      <div className="text-muted-foreground w-20 shrink-0">{log.date}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{log.activity || "Ride"}</span>
                        {log.child_ids?.length > 0 && (
                          <span className="text-muted-foreground"> — {log.child_ids.map(capitalize).join(", ")}</span>
                        )}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {log.drivers?.name || "—"}{log.miles ? ` • ${log.miles} mi` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Add Ride Form ────────────────────────────────────────────────────────────
function AddRideForm({ date, onSubmit }: { date: string; onSubmit: (r: any) => void }) {
  const [child_id, setChildId] = useState("");
  const [activity, setActivity] = useState("");
  const [dropoff_time, setDropoffTime] = useState("");
  const [dropoff_location, setDropoffLocation] = useState("");
  const [pickup_time, setPickupTime] = useState("");
  const [pickup_location, setPickupLocation] = useState("Home");

  return (
    <div className="space-y-3">
      <div>
        <Label>Child</Label>
        <Select value={child_id} onValueChange={setChildId}>
          <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
          <SelectContent>
            {CHILDREN.map(c => <SelectItem key={c} value={c}>{capitalize(c)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Activity</Label>
        <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder="e.g. Soccer practice" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Pickup Time</Label>
          <Input type="time" value={pickup_time} onChange={e => setPickupTime(e.target.value)} />
        </div>
        <div>
          <Label>Pickup Location</Label>
          <Input value={pickup_location} onChange={e => setPickupLocation(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Dropoff Time</Label>
          <Input type="time" value={dropoff_time} onChange={e => setDropoffTime(e.target.value)} />
        </div>
        <div>
          <Label>Dropoff Location</Label>
          <Input value={dropoff_location} onChange={e => setDropoffLocation(e.target.value)} />
        </div>
      </div>
      <Button className="w-full" disabled={!child_id} onClick={() => onSubmit({ child_id, date, activity, dropoff_time, dropoff_location, pickup_time, pickup_location })}>
        Add Ride
      </Button>
    </div>
  );
}

// ─── Add Driver Form ──────────────────────────────────────────────────────────
function AddDriverForm({ onSubmit }: { onSubmit: (d: any) => void }) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("parent");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Driver name" />
      </div>
      <div>
        <Label>Relationship</Label>
        <Select value={relationship} onValueChange={setRelationship}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="parent">Parent</SelectItem>
            <SelectItem value="neighbor">Neighbor</SelectItem>
            <SelectItem value="carpool_parent">Carpool Parent</SelectItem>
            <SelectItem value="grandparent">Grandparent</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 123-4567" />
      </div>
      <div>
        <Label>Email</Label>
        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
      </div>
      <Button className="w-full" disabled={!name} onClick={() => onSubmit({ name, relationship, phone, email, is_family: relationship === "parent" })}>
        Add Driver
      </Button>
    </div>
  );
}

// ─── Add Vehicle Form ─────────────────────────────────────────────────────────
function AddVehicleForm({ onSubmit }: { onSubmit: (v: any) => void }) {
  const [name, setName] = useState("");
  const [make_model, setMakeModel] = useState("");
  const [color, setColor] = useState("");
  const [seats, setSeats] = useState("5");

  return (
    <div className="space-y-3">
      <div>
        <Label>Name / Nickname</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Van, David's Car" />
      </div>
      <div>
        <Label>Make & Model</Label>
        <Input value={make_model} onChange={e => setMakeModel(e.target.value)} placeholder="e.g. Honda Odyssey 2022" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Color</Label>
          <Input value={color} onChange={e => setColor(e.target.value)} placeholder="e.g. Silver" />
        </div>
        <div>
          <Label>Seats</Label>
          <Input type="number" value={seats} onChange={e => setSeats(e.target.value)} min="2" max="15" />
        </div>
      </div>
      <Button className="w-full" disabled={!name} onClick={() => onSubmit({ name, make_model, color, seats: parseInt(seats) })}>
        Add Vehicle
      </Button>
    </div>
  );
}

// ─── Add Carpool Group Form ───────────────────────────────────────────────────
function AddCarpoolForm({ onSubmit }: { onSubmit: (g: any) => void }) {
  const [name, setName] = useState("");
  const [activity, setActivity] = useState("");
  const [day_of_week, setDayOfWeek] = useState("");
  const [pickup_time, setPickupTime] = useState("");
  const [dropoff_time, setDropoffTime] = useState("");
  const [pickup_location, setPickupLocation] = useState("");
  const [dropoff_location, setDropoffLocation] = useState("");
  const [selectedChildren, setSelectedChildren] = useState<string[]>([]);

  const toggleChild = (c: string) => {
    setSelectedChildren(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Group Name</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Soccer Carpool" />
      </div>
      <div>
        <Label>Activity</Label>
        <Input value={activity} onChange={e => setActivity(e.target.value)} placeholder="e.g. Soccer practice" />
      </div>
      <div>
        <Label>Day of Week</Label>
        <Select value={day_of_week} onValueChange={setDayOfWeek}>
          <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
          <SelectContent>
            {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map(d => (
              <SelectItem key={d} value={d}>{capitalize(d)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Pickup Time</Label>
          <Input type="time" value={pickup_time} onChange={e => setPickupTime(e.target.value)} />
        </div>
        <div>
          <Label>Dropoff Time</Label>
          <Input type="time" value={dropoff_time} onChange={e => setDropoffTime(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Pickup Location</Label>
          <Input value={pickup_location} onChange={e => setPickupLocation(e.target.value)} placeholder="Home" />
        </div>
        <div>
          <Label>Dropoff Location</Label>
          <Input value={dropoff_location} onChange={e => setDropoffLocation(e.target.value)} placeholder="Field/Gym" />
        </div>
      </div>
      <div>
        <Label>Children</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {CHILDREN.map(c => (
            <Badge
              key={c}
              variant={selectedChildren.includes(c) ? "default" : "outline"}
              className="cursor-pointer"
              style={selectedChildren.includes(c) ? { backgroundColor: CHILD_COLORS[c] } : {}}
              onClick={() => toggleChild(c)}
            >
              {capitalize(c)}
            </Badge>
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!name || !day_of_week} onClick={() => onSubmit({
        name, activity, day_of_week, pickup_time, dropoff_time,
        pickup_location, dropoff_location, child_ids: selectedChildren
      })}>
        Create Carpool Group
      </Button>
    </div>
  );
}
