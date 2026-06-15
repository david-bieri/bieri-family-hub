/**
 * client/src/pages/CoParentPortal.tsx
 * Homeschool Module — Co-Parent Portal (Restricted View)
 *
 * This page is the entry point for the co-parent user. It provides:
 *   - Read-only view of Cole & Airlie's academic progress
 *   - Ability to LOG progress during their custody weeks
 *   - View of curriculum plans and upcoming activities
 *   - Handoff digest history
 *   - Portfolio artifact viewing and upload
 *   - Custody calendar
 *
 * ACCESS CONTROL:
 *   - Only visible to users with role='coparent'
 *   - RLS ensures only Cole & Airlie data is returned from the API
 *   - Cannot view Greta, Clara, Heidi, Daisy, or household-level data
 *   - Cannot modify curriculum plans (read-only)
 *   - CAN add progress entries and portfolio artifacts
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN, CUSTODY_CHILDREN } from "@shared/schema";
import type { AcademicProgress, AcademicSubject, HandoffDigest, CustodyWeek, ChildId } from "@shared/schema";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen, Clock, Calendar, Upload, FileText, MessageSquare, Plus, User
} from "lucide-react";

// ─── Data Hooks (scoped to Cole & Airlie via RLS) ────────────────────────────

function useCoParentProgress(childId?: string) {
  return useQuery({
    queryKey: ["coparent-progress", childId],
    queryFn: () => apiRequest(`/api/academic/progress?${childId ? `child_id=${childId}&` : ""}limit=30`),
  });
}

function useCoParentSubjects(childId?: string) {
  return useQuery({
    queryKey: ["coparent-subjects", childId],
    queryFn: () => apiRequest(`/api/academic/subjects${childId ? `?child_id=${childId}` : ""}`),
  });
}

function useCoParentPlans(childId?: string) {
  return useQuery({
    queryKey: ["coparent-plans", childId],
    queryFn: () => apiRequest(`/api/academic/plans?${childId ? `child_id=${childId}&` : ""}status=active`),
  });
}

function useHandoffDigests() {
  return useQuery({
    queryKey: ["handoff-digests"],
    queryFn: () => apiRequest("/api/academic/handoffs?limit=10"),
  });
}

function useCustodySchedule() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["custody-schedule"],
    queryFn: () => apiRequest(`/api/academic/custody?from_date=${today}`),
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CoParentPortal() {
  const [selectedChild, setSelectedChild] = useState<ChildId | "both">("both");
  const [showAddProgress, setShowAddProgress] = useState(false);

  const custodyChildren = CHILDREN.filter(c => CUSTODY_CHILDREN.includes(c.id));

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-6 w-6" />
            Co-Parent Academic Portal
          </h1>
          <p className="text-muted-foreground">
            Track and coordinate Cole & Airlie's homeschool progress
          </p>
        </div>
        <Dialog open={showAddProgress} onOpenChange={setShowAddProgress}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Log Progress
            </Button>
          </DialogTrigger>
          <DialogContent>
            <CoParentAddProgressForm onClose={() => setShowAddProgress(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Custody Status */}
      <CustodyStatus />

      {/* Child Tabs */}
      <Tabs value={selectedChild} onValueChange={(v) => setSelectedChild(v as ChildId | "both")}>
        <TabsList>
          <TabsTrigger value="both">Both Children</TabsTrigger>
          {custodyChildren.map(child => (
            <TabsTrigger key={child.id} value={child.id}>
              <span className={`w-2 h-2 rounded-full ${child.color} mr-2`} />
              {child.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="both" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {custodyChildren.map(child => (
              <ChildSummaryCard key={child.id} childId={child.id} childName={child.name} color={child.color} />
            ))}
          </div>
          <HandoffDigestSection />
        </TabsContent>

        {custodyChildren.map(child => (
          <TabsContent key={child.id} value={child.id} className="space-y-6">
            <ChildDetailView childId={child.id} childName={child.name} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function CustodyStatus() {
  const { data: schedule } = useCustodySchedule();
  const currentWeek = (schedule as CustodyWeek[] || [])[0];

  if (!currentWeek) {
    return (
      <Card className="border-l-4 border-l-gray-300">
        <CardContent className="py-3 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Custody schedule not yet configured for this week.
          </span>
        </CardContent>
      </Card>
    );
  }

  const isWithCoparent = currentWeek.household_id === "hh-coparent";

  return (
    <Card className={`border-l-4 ${isWithCoparent ? "border-l-green-500" : "border-l-blue-500"}`}>
      <CardContent className="py-3 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <div className="text-sm">
          <span className="font-medium">This week ({currentWeek.week_start}):</span>{" "}
          Cole & Airlie are{" "}
          <Badge variant={isWithCoparent ? "default" : "secondary"}>
            {isWithCoparent ? "with you" : "with Bieri household"}
          </Badge>
          {isWithCoparent && (
            <span className="ml-2 text-green-600 font-medium">
              — You can log progress entries this week
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChildSummaryCard({ childId, childName, color }: { childId: ChildId; childName: string; color: string }) {
  const { data: progress } = useCoParentProgress(childId);
  const { data: subjects } = useCoParentSubjects(childId);

  const recentProgress = (progress as AcademicProgress[] || []).slice(0, 5);
  const activeSubjects = (subjects as AcademicSubject[] || []).filter(s => s.active);

  const weekProgress = recentProgress.filter(p => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(p.date) >= weekAgo;
  });

  const totalMinutes = weekProgress.reduce((sum, p) => sum + (p.duration_min || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${color}`} />
          <CardTitle>{childName}</CardTitle>
        </div>
        <CardDescription>{activeSubjects.length} active subjects</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Weekly Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-muted/50 rounded">
            <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">{totalMinutes}</p>
            <p className="text-xs text-muted-foreground">min this week</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded">
            <BookOpen className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-lg font-bold">{weekProgress.length}</p>
            <p className="text-xs text-muted-foreground">sessions</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <p className="text-sm font-medium mb-2">Recent Activity</p>
          {recentProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          ) : (
            <div className="space-y-1">
              {recentProgress.map(entry => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{entry.title || "Activity"}</span>
                  <span className="text-muted-foreground text-xs">{entry.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Subjects */}
        <div>
          <p className="text-sm font-medium mb-2">Subjects</p>
          <div className="flex flex-wrap gap-1">
            {activeSubjects.map(s => (
              <Badge key={s.id} variant="outline" className="text-xs">
                {s.name}
                {s.platform && <span className="ml-1 opacity-60">({s.platform})</span>}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChildDetailView({ childId, childName }: { childId: ChildId; childName: string }) {
  const { data: progress } = useCoParentProgress(childId);
  const { data: subjects } = useCoParentSubjects(childId);
  const { data: plans } = useCoParentPlans(childId);

  const allProgress = (progress as AcademicProgress[] || []);
  const activeSubjects = (subjects as AcademicSubject[] || []).filter(s => s.active);
  const activePlans = (plans as any[] || []);

  return (
    <div className="space-y-6">
      {/* Curriculum Plans (read-only) */}
      {activePlans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Active Curriculum Plans
            </CardTitle>
            <CardDescription>Set by the primary household — for reference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePlans.map((plan: any) => (
              <div key={plan.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{plan.title}</p>
                  <Badge variant="outline">{plan.plan_type}</Badge>
                </div>
                {plan.objectives?.length > 0 && (
                  <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                    {plan.objectives.slice(0, 3).map((obj: string, i: number) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Subjects Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subjects & Platforms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSubjects.map(subject => (
              <div key={subject.id} className="p-3 border rounded-lg">
                <p className="font-medium text-sm">{subject.name}</p>
                <div className="flex gap-1 mt-1">
                  {subject.platform && <Badge variant="outline" className="text-xs">{subject.platform}</Badge>}
                  {subject.grade_level && <Badge variant="secondary" className="text-xs">{subject.grade_level}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Progress Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Progress Log
          </CardTitle>
          <CardDescription>All recorded academic sessions for {childName}</CardDescription>
        </CardHeader>
        <CardContent>
          {allProgress.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No progress entries yet.</p>
          ) : (
            <div className="space-y-2">
              {allProgress.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="text-sm font-medium">{entry.title || "Activity"}</p>
                    <p className="text-xs text-muted-foreground">{entry.date}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.duration_min && (
                      <span className="text-xs text-muted-foreground">{entry.duration_min}min</span>
                    )}
                    {entry.mastery_score && (
                      <Badge variant="outline" className="text-xs">{entry.mastery_score}</Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">{entry.source}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HandoffDigestSection() {
  const { data: digests } = useHandoffDigests();
  const allDigests = (digests as HandoffDigest[] || []);

  if (allDigests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Handoff Digests
          </CardTitle>
          <CardDescription>
            Weekly summaries generated at custody transitions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No handoff digests yet. They will appear here after the first custody transition.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Handoff Digests
        </CardTitle>
        <CardDescription>Weekly summaries at custody transitions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {allDigests.slice(0, 5).map(digest => (
          <div key={digest.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <Badge variant="outline">Week of {digest.week_start}</Badge>
              {digest.sent_at && (
                <span className="text-xs text-muted-foreground">
                  Sent {new Date(digest.sent_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-sm">
              {/* Render markdown summary as plain text for now */}
              <pre className="whitespace-pre-wrap font-sans text-sm">{digest.summary_text}</pre>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Co-Parent Add Progress Form ─────────────────────────────────────────────

function CoParentAddProgressForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const custodyChildren = CHILDREN.filter(c => CUSTODY_CHILDREN.includes(c.id));

  const [formData, setFormData] = useState({
    child_id: "",
    date: new Date().toISOString().split("T")[0],
    duration_min: "",
    title: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/academic/progress", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coparent-progress"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      duration_min: formData.duration_min ? parseInt(formData.duration_min) : null,
      household_id: "hh-coparent",
      source: "manual",
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Log Academic Progress</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Child</Label>
            <Select value={formData.child_id} onValueChange={v => setFormData(f => ({ ...f, child_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>
                {custodyChildren.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={e => setFormData(f => ({ ...f, date: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label>What did they work on?</Label>
          <Input
            placeholder="e.g., Math: Khan Academy fractions unit"
            value={formData.title}
            onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div>
          <Label>Duration (minutes)</Label>
          <Input
            type="number"
            placeholder="45"
            value={formData.duration_min}
            onChange={e => setFormData(f => ({ ...f, duration_min: e.target.value }))}
          />
        </div>

        <div>
          <Label>Notes (optional)</Label>
          <Textarea
            placeholder="Any observations, questions, or notes for the other household..."
            value={formData.notes}
            onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!formData.child_id || !formData.title}>
            Save
          </Button>
        </div>
      </form>
    </>
  );
}
