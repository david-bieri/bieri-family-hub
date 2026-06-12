import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Home, Plus, Pencil, Trash2, Wrench, Users, ClipboardList,
  Calendar, AlertTriangle, CheckCircle2, Clock, Building2,
  ChevronDown, ChevronUp, Star, Phone, Mail
} from "lucide-react";
import { format, parseISO, isBefore } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Property { id: string; name: string; address: string; type: string; notes: string; }
interface Asset { id: string; property_id: string; name: string; category: string; make_model: string; install_date: string; warranty_end: string; notes: string; }
interface Task { id: string; property_id: string; asset_id: string | null; title: string; description: string; status: string; priority: string; due_date: string; completed_date: string; assigned_to: string; recurring: boolean; recurrence_type: string; recurrence_interval: number; season: string; cost: string; notes: string; }
interface Provider { id: string; name: string; company: string; specialty: string; phone: string; email: string; address: string; rating: number; notes: string; }
interface LogEntry { id: string; property_id: string; asset_id: string | null; task_id: string | null; provider_id: string | null; title: string; date: string; cost: string; description: string; notes: string; }

type Tab = "tasks" | "assets" | "providers" | "log";

const ASSET_CATEGORIES = [
  { value: "hvac", label: "HVAC" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "appliance", label: "Appliance" },
  { value: "exterior", label: "Exterior" },
  { value: "garden", label: "Garden / Yard" },
  { value: "vehicle", label: "Vehicle" },
  { value: "general", label: "General" },
];

const TASK_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "scheduled", label: "Scheduled", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "in_progress", label: "In Progress", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "done", label: "Done", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const SPECIALTIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "landscaping", label: "Landscaping" },
  { value: "general", label: "General Contractor" },
  { value: "roofing", label: "Roofing" },
  { value: "pest_control", label: "Pest Control" },
  { value: "other", label: "Other" },
];

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function HomeProperty() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [selectedProperty, setSelectedProperty] = useState<string>("all");

  // ─── Data queries ─────────────────────────────────────────────────────────
  const { data: properties = [], isLoading: propsLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => (await apiRequest("GET", "/api/properties")).json(),
  });
  const { data: assets = [] } = useQuery<Asset[]>({
    queryKey: ["/api/property-assets"],
    queryFn: async () => (await apiRequest("GET", "/api/property-assets")).json(),
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/maintenance-tasks"],
    queryFn: async () => (await apiRequest("GET", "/api/maintenance-tasks")).json(),
  });
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["/api/service-providers"],
    queryFn: async () => (await apiRequest("GET", "/api/service-providers")).json(),
  });
  const { data: log = [] } = useQuery<LogEntry[]>({
    queryKey: ["/api/maintenance-log"],
    queryFn: async () => (await apiRequest("GET", "/api/maintenance-log")).json(),
  });

  // Filter by property
  const filteredAssets = selectedProperty === "all" ? assets : assets.filter(a => a.property_id === selectedProperty);
  const filteredTasks = selectedProperty === "all" ? tasks : tasks.filter(t => t.property_id === selectedProperty);
  const filteredLog = selectedProperty === "all" ? log : log.filter(l => l.property_id === selectedProperty);

  // Stats
  const overdueTasks = tasks.filter(t => t.status !== "done" && t.due_date && isBefore(parseISO(t.due_date), new Date()));
  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "scheduled");

  // ─── Dialogs ──────────────────────────────────────────────────────────────
  const [taskDialog, setTaskDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [assetDialog, setAssetDialog] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [providerDialog, setProviderDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [logDialog, setLogDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const taskMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingTask) return (await apiRequest("PUT", `/api/maintenance-tasks/${editingTask.id}`, body)).json();
      return (await apiRequest("POST", "/api/maintenance-tasks", body)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/maintenance-tasks"] }); setTaskDialog(false); setEditingTask(null); toast({ title: editingTask ? "Task updated" : "Task created" }); },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/maintenance-tasks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/maintenance-tasks"] }); toast({ title: "Task deleted" }); },
  });

  const assetMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingAsset) return (await apiRequest("PUT", `/api/property-assets/${editingAsset.id}`, body)).json();
      return (await apiRequest("POST", "/api/property-assets", body)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/property-assets"] }); setAssetDialog(false); setEditingAsset(null); toast({ title: editingAsset ? "Asset updated" : "Asset added" }); },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/property-assets/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/property-assets"] }); toast({ title: "Asset deleted" }); },
  });

  const providerMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingProvider) return (await apiRequest("PUT", `/api/service-providers/${editingProvider.id}`, body)).json();
      return (await apiRequest("POST", "/api/service-providers", body)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/service-providers"] }); setProviderDialog(false); setEditingProvider(null); toast({ title: editingProvider ? "Provider updated" : "Provider added" }); },
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/service-providers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/service-providers"] }); toast({ title: "Provider deleted" }); },
  });

  const logMutation = useMutation({
    mutationFn: async (body: any) => {
      if (editingLog) return (await apiRequest("PUT", `/api/maintenance-log/${editingLog.id}`, body)).json();
      return (await apiRequest("POST", "/api/maintenance-log", body)).json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/maintenance-log"] }); setLogDialog(false); setEditingLog(null); toast({ title: editingLog ? "Log updated" : "Log entry added" }); },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/maintenance-log/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/maintenance-log"] }); toast({ title: "Log entry deleted" }); },
  });

  if (propsLoading) return <div className="p-6"><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Home size={20} className="text-primary" />
            Home &amp; Property
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {properties.length} {properties.length === 1 ? "property" : "properties"} · {pendingTasks.length} pending tasks · {overdueTasks.length} overdue
          </p>
        </div>
      </div>

      {/* Property selector */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedProperty("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
            selectedProperty === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
        >
          All Properties
        </button>
        {properties.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedProperty(p.id)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              selectedProperty === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
          >
            <Building2 size={11} className="inline mr-1" />
            {p.name}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { key: "tasks", label: "Tasks", icon: ClipboardList, count: filteredTasks.filter(t => t.status !== "done").length },
          { key: "assets", label: "Assets", icon: Wrench, count: filteredAssets.length },
          { key: "providers", label: "Providers", icon: Users, count: providers.length },
          { key: "log", label: "Log", icon: Calendar, count: filteredLog.length },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn("px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5",
              activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            <tab.icon size={13} />
            {tab.label}
            {tab.count > 0 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "tasks" && (
        <TasksTab
          tasks={filteredTasks} assets={assets} properties={properties}
          selectedProperty={selectedProperty}
          onAdd={() => { setEditingTask(null); setTaskDialog(true); }}
          onEdit={(t) => { setEditingTask(t); setTaskDialog(true); }}
          onDelete={(id) => deleteTask.mutate(id)}
          onStatusChange={(task, status) => taskMutation.mutate({ ...task, status })}
        />
      )}
      {activeTab === "assets" && (
        <AssetsTab
          assets={filteredAssets} properties={properties}
          onAdd={() => { setEditingAsset(null); setAssetDialog(true); }}
          onEdit={(a) => { setEditingAsset(a); setAssetDialog(true); }}
          onDelete={(id) => deleteAsset.mutate(id)}
        />
      )}
      {activeTab === "providers" && (
        <ProvidersTab
          providers={providers}
          onAdd={() => { setEditingProvider(null); setProviderDialog(true); }}
          onEdit={(p) => { setEditingProvider(p); setProviderDialog(true); }}
          onDelete={(id) => deleteProvider.mutate(id)}
        />
      )}
      {activeTab === "log" && (
        <LogTab
          log={filteredLog} assets={assets} providers={providers} properties={properties}
          onAdd={() => { setEditingLog(null); setLogDialog(true); }}
          onEdit={(l) => { setEditingLog(l); setLogDialog(true); }}
          onDelete={(id) => deleteLog.mutate(id)}
        />
      )}

      {/* Dialogs */}
      <TaskDialog open={taskDialog} onClose={() => { setTaskDialog(false); setEditingTask(null); }} task={editingTask} properties={properties} assets={assets} selectedProperty={selectedProperty} onSubmit={(body) => taskMutation.mutate(body)} isPending={taskMutation.isPending} />
      <AssetDialog open={assetDialog} onClose={() => { setAssetDialog(false); setEditingAsset(null); }} asset={editingAsset} properties={properties} selectedProperty={selectedProperty} onSubmit={(body) => assetMutation.mutate(body)} isPending={assetMutation.isPending} />
      <ProviderDialog open={providerDialog} onClose={() => { setProviderDialog(false); setEditingProvider(null); }} provider={editingProvider} onSubmit={(body) => providerMutation.mutate(body)} isPending={providerMutation.isPending} />
      <LogDialog open={logDialog} onClose={() => { setLogDialog(false); setEditingLog(null); }} entry={editingLog} properties={properties} assets={assets} providers={providers} selectedProperty={selectedProperty} onSubmit={(body) => logMutation.mutate(body)} isPending={logMutation.isPending} />
    </div>
  );
}

// ─── Tasks Tab ───────────────────────────────────────────────────────────────
function TasksTab({ tasks, assets, properties, selectedProperty, onAdd, onEdit, onDelete, onStatusChange }: any) {
  const activeTasks = tasks.filter((t: Task) => t.status !== "done");
  const doneTasks = tasks.filter((t: Task) => t.status === "done");
  const [showDone, setShowDone] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">{activeTasks.length} active task{activeTasks.length !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={onAdd} className="gap-1.5"><Plus size={13} />Add Task</Button>
      </div>

      {activeTasks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">No active tasks. Everything is maintained!</div>
      )}

      <div className="space-y-2">
        {activeTasks.map((task: Task) => {
          const isOverdue = task.due_date && isBefore(parseISO(task.due_date), new Date()) && task.status !== "done";
          const asset = assets.find((a: Asset) => a.id === task.asset_id);
          const property = properties.find((p: Property) => p.id === task.property_id);
          const statusInfo = TASK_STATUSES.find(s => s.value === task.status) || TASK_STATUSES[0];
          return (
            <div key={task.id} className={cn("border rounded-lg p-3 flex items-start gap-3", isOverdue && "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{task.title}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", statusInfo.color)}>{statusInfo.label}</span>
                  {task.priority === "high" && <AlertTriangle size={12} className="text-orange-500" />}
                  {task.priority === "urgent" && <AlertTriangle size={12} className="text-red-500" />}
                  {task.recurring && <Badge variant="outline" className="text-[9px] px-1 py-0">Recurring</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                  {property && <span>{property.name}</span>}
                  {asset && <span>· {asset.name}</span>}
                  {task.due_date && <span className={isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>Due: {format(parseISO(task.due_date), "MMM d, yyyy")}</span>}
                  {task.assigned_to && <span>→ {task.assigned_to}</span>}
                  {task.cost && <span>${task.cost}</span>}
                </div>
                {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.description}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                {task.status !== "done" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onStatusChange(task, "done")} title="Mark done">
                    <CheckCircle2 size={13} className="text-green-600" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(task.id)}><Trash2 size={12} className="text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      {doneTasks.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            {showDone ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {doneTasks.length} completed task{doneTasks.length !== 1 ? "s" : ""}
          </button>
          {showDone && (
            <div className="space-y-1.5 mt-2 opacity-60">
              {doneTasks.slice(0, 10).map((task: Task) => (
                <div key={task.id} className="border rounded-lg p-2.5 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                  <span className="text-xs line-through flex-1">{task.title}</span>
                  {task.completed_date && <span className="text-[10px] text-muted-foreground">{format(parseISO(task.completed_date), "MMM d")}</span>}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(task.id)}><Trash2 size={11} className="text-destructive" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Assets Tab ──────────────────────────────────────────────────────────────
function AssetsTab({ assets, properties, onAdd, onEdit, onDelete }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">{assets.length} asset{assets.length !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={onAdd} className="gap-1.5"><Plus size={13} />Add Asset</Button>
      </div>
      {assets.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No assets tracked yet. Add your first system or appliance.</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {assets.map((asset: Asset) => {
          const property = properties.find((p: Property) => p.id === asset.property_id);
          const catLabel = ASSET_CATEGORIES.find(c => c.value === asset.category)?.label || asset.category;
          const warrantyExpired = asset.warranty_end && isBefore(parseISO(asset.warranty_end), new Date());
          return (
            <div key={asset.id} className="border rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">{asset.name}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                    <span>{catLabel}</span>
                    {property && <span>· {property.name}</span>}
                    {asset.make_model && <span>· {asset.make_model}</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 flex gap-x-3">
                    {asset.install_date && <span>Installed: {format(parseISO(asset.install_date), "MMM yyyy")}</span>}
                    {asset.warranty_end && (
                      <span className={warrantyExpired ? "text-red-500" : "text-green-600"}>
                        Warranty: {warrantyExpired ? "Expired" : format(parseISO(asset.warranty_end), "MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(asset)}><Pencil size={12} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(asset.id)}><Trash2 size={12} className="text-destructive" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Providers Tab ───────────────────────────────────────────────────────────
function ProvidersTab({ providers, onAdd, onEdit, onDelete }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">{providers.length} provider{providers.length !== 1 ? "s" : ""}</h3>
        <Button size="sm" onClick={onAdd} className="gap-1.5"><Plus size={13} />Add Provider</Button>
      </div>
      {providers.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No service providers yet. Add your first contractor or technician.</div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((prov: Provider) => {
          const specLabel = SPECIALTIES.find(s => s.value === prov.specialty)?.label || prov.specialty;
          return (
            <div key={prov.id} className="border rounded-lg p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">{prov.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {prov.company && <span>{prov.company} · </span>}
                    <span>{specLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]">
                    {prov.phone && <span className="flex items-center gap-1"><Phone size={10} />{prov.phone}</span>}
                    {prov.email && <span className="flex items-center gap-1"><Mail size={10} />{prov.email}</span>}
                  </div>
                  {prov.rating && (
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={11} className={i < prov.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(prov)}><Pencil size={12} /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(prov.id)}><Trash2 size={12} className="text-destructive" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Log Tab ─────────────────────────────────────────────────────────────────
function LogTab({ log, assets, providers, properties, onAdd, onEdit, onDelete }: any) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">{log.length} log entr{log.length === 1 ? "y" : "ies"}</h3>
        <Button size="sm" onClick={onAdd} className="gap-1.5"><Plus size={13} />Add Entry</Button>
      </div>
      {log.length === 0 && <div className="text-center py-8 text-muted-foreground text-sm">No maintenance history yet.</div>}
      <div className="space-y-2">
        {log.map((entry: LogEntry) => {
          const property = properties.find((p: Property) => p.id === entry.property_id);
          const asset = assets.find((a: Asset) => a.id === entry.asset_id);
          const provider = providers.find((p: Provider) => p.id === entry.provider_id);
          return (
            <div key={entry.id} className="border rounded-lg p-3 flex items-start gap-3">
              <div className="text-xs text-muted-foreground w-16 shrink-0 mt-0.5">
                {entry.date && format(parseISO(entry.date), "MMM d, yy")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{entry.title}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 mt-0.5">
                  {property && <span>{property.name}</span>}
                  {asset && <span>· {asset.name}</span>}
                  {provider && <span>· {provider.name}</span>}
                  {entry.cost && <span>· ${entry.cost}</span>}
                </div>
                {entry.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.description}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry)}><Pencil size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(entry.id)}><Trash2 size={12} className="text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Task Dialog ─────────────────────────────────────────────────────────────
function TaskDialog({ open, onClose, task, properties, assets, selectedProperty, onSubmit, isPending }: any) {
  const [form, setForm] = useState<any>({});
  const isEdit = !!task;

  // Reset form when dialog opens
  useState(() => {
    if (open) {
      setForm(task || { property_id: selectedProperty !== "all" ? selectedProperty : properties[0]?.id || "", status: "pending", priority: "normal" });
    }
  });

  const handleOpen = () => {
    setForm(task || { property_id: selectedProperty !== "all" ? selectedProperty : properties[0]?.id || "", status: "pending", priority: "normal" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Task" : "New Maintenance Task"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
          <div><Label>Title *</Label><Input value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
          <div><Label>Property</Label>
            <Select value={form.property_id || ""} onValueChange={v => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{properties.map((p: Property) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Asset (optional)</Label>
            <Select value={form.asset_id || "none"} onValueChange={v => setForm({ ...form, asset_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {assets.filter((a: Asset) => a.property_id === form.property_id).map((a: Asset) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
              <Select value={form.status || "pending"} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Priority</Label>
              <Select value={form.priority || "normal"} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Due Date</Label><Input type="date" value={form.due_date || ""} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>Assigned To</Label><Input value={form.assigned_to || ""} onChange={e => setForm({ ...form, assigned_to: e.target.value })} placeholder="e.g. David" /></div>
          </div>
          <div><Label>Estimated Cost</Label><Input value={form.cost || ""} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="e.g. 150" /></div>
          <div><Label>Description</Label><Input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Notes</Label><Input value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={form.recurring || false} onChange={e => setForm({ ...form, recurring: e.target.checked })} id="recurring" />
            <Label htmlFor="recurring" className="text-sm">Recurring task</Label>
          </div>
          {form.recurring && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Frequency</Label>
                <Select value={form.recurrence_type || "monthly"} onValueChange={v => setForm({ ...form, recurrence_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Season</Label>
                <Select value={form.season || "all"} onValueChange={v => setForm({ ...form, season: v === "all" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Year-round</SelectItem>
                    <SelectItem value="spring">Spring</SelectItem>
                    <SelectItem value="summer">Summer</SelectItem>
                    <SelectItem value="fall">Fall</SelectItem>
                    <SelectItem value="winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isEdit ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Asset Dialog ────────────────────────────────────────────────────────────
function AssetDialog({ open, onClose, asset, properties, selectedProperty, onSubmit, isPending }: any) {
  const [form, setForm] = useState<any>({});
  const isEdit = !!asset;

  const handleOpen = () => {
    setForm(asset || { property_id: selectedProperty !== "all" ? selectedProperty : properties[0]?.id || "", category: "general" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Asset" : "New Asset"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. HVAC System" /></div>
          <div><Label>Property</Label>
            <Select value={form.property_id || ""} onValueChange={v => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{properties.map((p: Property) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={form.category || "general"} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ASSET_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Make / Model</Label><Input value={form.make_model || ""} onChange={e => setForm({ ...form, make_model: e.target.value })} placeholder="e.g. Carrier 24ACC636" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Install Date</Label><Input type="date" value={form.install_date || ""} onChange={e => setForm({ ...form, install_date: e.target.value })} /></div>
            <div><Label>Warranty End</Label><Input type="date" value={form.warranty_end || ""} onChange={e => setForm({ ...form, warranty_end: e.target.value })} /></div>
          </div>
          <div><Label>Notes</Label><Input value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isEdit ? "Save" : "Add Asset"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Provider Dialog ─────────────────────────────────────────────────────────
function ProviderDialog({ open, onClose, provider, onSubmit, isPending }: any) {
  const [form, setForm] = useState<any>({});
  const isEdit = !!provider;

  const handleOpen = () => { setForm(provider || { specialty: "general" }); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Provider" : "New Service Provider"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
          <div><Label>Name *</Label><Input value={form.name || ""} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. John Smith" /></div>
          <div><Label>Company</Label><Input value={form.company || ""} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="e.g. Smith Plumbing LLC" /></div>
          <div><Label>Specialty</Label>
            <Select value={form.specialty || "general"} onValueChange={v => setForm({ ...form, specialty: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SPECIALTIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" /></div>
            <div><Label>Email</Label><Input value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address || ""} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div><Label>Rating (1-5)</Label><Input type="number" min={1} max={5} value={form.rating || ""} onChange={e => setForm({ ...form, rating: parseInt(e.target.value) || null })} /></div>
          <div><Label>Notes</Label><Input value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isEdit ? "Save" : "Add Provider"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Dialog ──────────────────────────────────────────────────────────────
function LogDialog({ open, onClose, entry, properties, assets, providers, selectedProperty, onSubmit, isPending }: any) {
  const [form, setForm] = useState<any>({});
  const isEdit = !!entry;

  const handleOpen = () => {
    setForm(entry || { property_id: selectedProperty !== "all" ? selectedProperty : properties[0]?.id || "", date: new Date().toISOString().split("T")[0] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpen(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Log Entry" : "New Log Entry"}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
          <div><Label>Title *</Label><Input value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Replaced HVAC filter" /></div>
          <div><Label>Property</Label>
            <Select value={form.property_id || ""} onValueChange={v => setForm({ ...form, property_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{properties.map((p: Property) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date *</Label><Input type="date" value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
            <div><Label>Cost</Label><Input value={form.cost || ""} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="e.g. 85" /></div>
          </div>
          <div><Label>Asset (optional)</Label>
            <Select value={form.asset_id || "none"} onValueChange={v => setForm({ ...form, asset_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {assets.filter((a: Asset) => a.property_id === form.property_id).map((a: Asset) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Provider (optional)</Label>
            <Select value={form.provider_id || "none"} onValueChange={v => setForm({ ...form, provider_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {providers.map((p: Provider) => <SelectItem key={p.id} value={p.id}>{p.name}{p.company ? ` (${p.company})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Input value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>Notes</Label><Input value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isEdit ? "Save" : "Add Entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
