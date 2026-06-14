import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  Car,
  Calendar,
  AlertTriangle,
  Mail,
  MessageSquare,
  Home,
  RefreshCw,
  Send,
  CheckCircle,
  Filter,
} from "lucide-react";

interface ActivityItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  body: string;
  related_id?: string;
  related_type?: string;
  channels_used?: string[];
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  digest: { icon: Calendar, color: "text-blue-600 bg-blue-50", label: "Digest" },
  carpool_reminder: { icon: Car, color: "text-orange-600 bg-orange-50", label: "Carpool" },
  overdue_alert: { icon: AlertTriangle, color: "text-red-600 bg-red-50", label: "Overdue" },
  item_added: { icon: Mail, color: "text-green-600 bg-green-50", label: "Added" },
  conflict: { icon: AlertTriangle, color: "text-yellow-600 bg-yellow-50", label: "Conflict" },
  maintenance: { icon: Home, color: "text-amber-600 bg-amber-50", label: "Home" },
  system: { icon: Bell, color: "text-gray-600 bg-gray-50", label: "System" },
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function ActivityFeed() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Fetch activity log
  const { data: activities = [], isLoading } = useQuery<ActivityItem[]>({
    queryKey: ["/api/activity"],
    queryFn: async () => {
      const res = await fetch("/api/activity");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  // Fetch notification status
  const { data: status } = useQuery({
    queryKey: ["/api/notifications/status"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/status");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Manual trigger mutations
  const digestMutation = useMutation({
    mutationFn: () => fetch("/api/notifications/digest", { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/activity"] }),
  });

  const overdueMutation = useMutation({
    mutationFn: () => fetch("/api/notifications/overdue-sweep", { method: "POST" }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/activity"] }),
  });

  // Filter activities
  const filtered = activities.filter((a) => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (priorityFilter !== "all" && a.priority !== priorityFilter) return false;
    return true;
  });

  // Group by date
  const grouped: Record<string, ActivityItem[]> = {};
  for (const item of filtered) {
    const date = item.created_at?.split("T")[0] || "unknown";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  }

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      if (dateStr === today) return "Today";
      if (dateStr === yesterday) return "Yesterday";
      return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Activity Feed
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Notifications, alerts, and system activity
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => digestMutation.mutate()}
            disabled={digestMutation.isPending}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {digestMutation.isPending ? "Sending..." : "Send Digest"}
          </button>
          <button
            onClick={() => overdueMutation.mutate()}
            disabled={overdueMutation.isPending}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            {overdueMutation.isPending ? "Checking..." : "Check Overdue"}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {status && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full ${status.scheduler_running ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            Scheduler: {status.scheduler_running ? "Running" : "Stopped"}
          </span>
          <span className={`px-2 py-1 rounded-full ${status.twilio_configured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            SMS: {status.twilio_configured ? "Active" : "Not configured"}
          </span>
          <span className={`px-2 py-1 rounded-full ${status.telegram_configured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            Telegram: {status.telegram_configured ? "Active" : "Not configured"}
          </span>
          <span className={`px-2 py-1 rounded-full ${status.gmail_configured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            Gmail: {status.gmail_configured ? "Active" : "Not configured"}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5"
        >
          <option value="all">All Types</option>
          <option value="digest">Digests</option>
          <option value="carpool_reminder">Carpool</option>
          <option value="overdue_alert">Overdue</option>
          <option value="item_added">Items Added</option>
          <option value="maintenance">Home</option>
          <option value="system">System</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-sm border rounded-lg px-3 py-1.5"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Activity List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading activity...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No activity yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Notifications from the morning digest, carpool reminders, and SMS/Telegram
            quick-adds will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items]) => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-500 mb-2 sticky top-0 bg-white dark:bg-gray-900 py-1">
                  {formatDate(date)}
                </h3>
                <div className="space-y-2">
                  {items.map((item) => {
                    const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
                    const Icon = config.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-medium text-sm truncate">{item.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_BADGE[item.priority] || PRIORITY_BADGE.normal}`}>
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {item.body}
                          </p>
                          {item.channels_used && item.channels_used.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {item.channels_used.map((ch) => (
                                <span key={ch} className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                  {ch === "sms" ? "📱 SMS" : ch === "telegram" ? "✈️ Telegram" : ch}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(item.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
