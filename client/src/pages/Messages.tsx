import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Smartphone, Monitor } from "lucide-react";
import { format, parseISO, isToday, isYesterday } from "date-fns";

// ─── localStorage key for "last time user read messages" ──────────────────────
const LS_KEY = "familyHub_lastReadMessages";

export function getMessagesLastRead(): string {
  return localStorage.getItem(LS_KEY) || new Date(0).toISOString();
}

export function markMessagesRead() {
  localStorage.setItem(LS_KEY, new Date().toISOString());
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  channel: "app" | "sms";
  author: string;
  body: string;
  phone_from?: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  try {
    const d = parseISO(iso);
    if (isToday(d)) return format(d, "h:mm a");
    if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
    return format(d, "MMM d, h:mm a");
  } catch {
    return iso;
  }
}

// Stable color from author string — keeps the same color per person across renders
const AUTHOR_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-600",
  "bg-amber-500", "bg-rose-500", "bg-teal-600",
  "bg-indigo-500", "bg-orange-500",
];
function authorColor(author: string) {
  let h = 0;
  for (let i = 0; i < author.length; i++) h = (h * 31 + author.charCodeAt(i)) & 0xffffffff;
  return AUTHOR_COLORS[Math.abs(h) % AUTHOR_COLORS.length];
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Messages() {
  const qc = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [author, setAuthor] = useState(() => localStorage.getItem("familyHub_author") || "");
  const [body, setBody] = useState("");

  // Mark messages read when page opens
  useEffect(() => {
    markMessagesRead();
    // Invalidate the count query so the badge clears immediately
    qc.invalidateQueries({ queryKey: ["/api/messages/count"] });
  }, [qc]);

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    queryFn: async () => (await apiRequest("GET", "/api/messages")).json(),
    refetchInterval: 30_000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!author.trim() || !body.trim()) return;
      return apiRequest("POST", "/api/messages", { author: author.trim(), body: body.trim() });
    },
    onSuccess: () => {
      setBody("");
      localStorage.setItem("familyHub_author", author.trim());
      qc.invalidateQueries({ queryKey: ["/api/messages"] });
      markMessagesRead();
    },
  });

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send.mutate();
    }
  }

  // Reverse messages for display (newest at bottom, like a chat)
  const ordered = [...messages].reverse();

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <MessageSquare className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Messages</h1>
            <p className="text-xs text-muted-foreground">
              Family message board · in-app &amp; SMS
            </p>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {isLoading && (
          <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>
        )}
        {!isLoading && ordered.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Post below, or text your Twilio number.
            </p>
          </div>
        )}
        {ordered.map(msg => (
          <div key={msg.id} className="flex items-start gap-2.5">
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${authorColor(msg.author)}`}>
              {msg.author.charAt(0).toUpperCase()}
            </div>
            {/* Bubble */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-semibold">{msg.author}</span>
                {msg.channel === "sms" ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 h-4 text-violet-600 border-violet-300">
                    <Smartphone className="w-2.5 h-2.5" /> SMS
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 h-4 text-sky-600 border-sky-300">
                    <Monitor className="w-2.5 h-2.5" /> App
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">{fmtTime(msg.created_at)}</span>
              </div>
              <div className="text-sm bg-muted/50 rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
                {msg.body}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="px-4 pb-4 pt-2 border-t border-border flex-shrink-0 space-y-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Your name</Label>
          <Input
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="e.g. David"
            className="h-8 text-sm"
          />
        </div>
        <div className="flex gap-2 items-end">
          <Textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Ctrl+Enter to send)"
            rows={2}
            className="flex-1 resize-none text-sm"
          />
          <Button
            onClick={() => send.mutate()}
            disabled={!author.trim() || !body.trim() || send.isPending}
            size="icon"
            className="h-[68px] w-10 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
