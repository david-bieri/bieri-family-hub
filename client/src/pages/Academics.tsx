/**
 * client/src/pages/Academics.tsx
 * Homeschool Module — Main Academics Dashboard
 *
 * Admin view (David & Nancy) showing:
 *   - Overview cards for each homeschooled child
 *   - Weekly progress summary
 *   - Subject breakdown with platform links
 *   - Quick-add progress entry
 *   - Virginia compliance status
 *   - Custody calendar indicator
 *
 * Uses shadcn/ui components and TanStack Query for data fetching.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CHILDREN, HOMESCHOOL_CHILDREN, VA_COMPLIANCE } from "@shared/schema";
import type { AcademicProgress, AcademicSubject, CustodyWeek, ChildId } from "@shared/schema";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen, Clock, Trophy, FileText, Calendar, Users, Plus, AlertTriangle, CheckCircle2
} from "lucide-react";

// ─── Data Hooks ──────────────────────────────────────────────────────────────

function useSubjects(childId?: string) {
  return useQuery({
    queryKey: ["academic-subjects", childId],
    queryFn: () => apiRequest(`/api/academic/subjects${childId ? `?child_id=${childId}` : ""}`),
  });
}

function useProgress(childId?: string, limit = 20) {
  return useQuery({
    queryKey: ["academic-progress", childId, limit],
    queryFn: () => apiRequest(`/api/academic/progress?${childId ? `child_id=${childId}&` : ""}limit=${limit}`),
  });
}

function useCustodySchedule() {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["custody-schedule"],
    queryFn: () => apiRequest(`/api/academic/custody?from_date=${today}`),
  });
}

function useCompliance() {
  const year = getCurrentSchoolYear();
  return useQuery({
    queryKey: ["compliance", year],
    queryFn: () => apiRequest(`/api/academic/compliance?school_year=${year}`),
  });
}

function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Academics() {
  const [selectedChild, setSelectedChild] = useState<ChildId | "all">("all");
  const [showAddProgress, setShowAddProgress] = useState(false);

  const homeschoolKids = CHILDREN.filter(c => HOMESCHOOL_CHILDREN.includes(c.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academics</h1>
          <p className="text-muted-foreground">
            Homeschool progress tracking & curriculum management
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
          <Dialog open={showAddProgress} onOpenChange={setShowAddProgress}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Log Progress
              </Button>
            </DialogTrigger>
            <DialogContent>
              <AddProgressForm onClose={() => setShowAddProgress(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Custody Indicator */}
      <CustodyIndicator />

      {/* Child Tabs */}
      <Tabs value={selectedChild} onValueChange={(v) => setSelectedChild(v as ChildId | "all")}>
        <TabsList>
          <TabsTrigger value="all">All Children</TabsTrigger>
          {homeschoolKids.map(child => (
            <TabsTrigger key={child.id} value={child.id}>
              <span className={`w-2 h-2 rounded-full ${child.color} mr-2`} />
              {child.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <OverviewGrid />
          <ComplianceStatus />
        </TabsContent>

        {homeschoolKids.map(child => (
          <TabsContent key={child.id} value={child.id} className="space-y-6">
            <ChildDashboard childId={child.id} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function CustodyIndicator() {
  const { data: schedule } = useCustodySchedule();
  const currentWeek = schedule?.[0] as CustodyWeek | undefined;

  if (!currentWeek) return null;

  const isWithBieri = currentWeek.household_id === "hh-bieri";

  return (
    <Card className={`border-l-4 ${isWithBieri ? "border-l-blue-500" : "border-l-orange-500"}`}>
      <CardContent className="py-3 flex items-center gap-3">
        <Users className="h-5 w-5 text-muted-foreground" />
        <div>
          <span className="font-medium">Cole & Airlie</span> are with{" "}
          <Badge variant={isWithBieri ? "default" : "secondary"}>
            {isWithBieri ? "Bieri Household" : "Co-Parent Household"}
          </Badge>{" "}
          this week (starting {currentWeek.week_start})
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewGrid() {
  const homeschoolKids = CHILDREN.filter(c => HOMESCHOOL_CHILDREN.includes(c.id));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {homeschoolKids.map(child => (
        <ChildOverviewCard key={child.id} childId={child.id} childName={child.name} color={child.color} />
      ))}
    </div>
  );
}

function ChildOverviewCard({ childId, childName, color }: { childId: ChildId; childName: string; color: string }) {
  const { data: progress } = useProgress(childId, 7);
  const { data: subjects } = useSubjects(childId);

  const thisWeekProgress = (progress as AcademicProgress[] || []);
  const totalMinutes = thisWeekProgress.reduce((sum, p) => sum + (p.duration_min || 0), 0);
  const totalLessons = thisWeekProgress.reduce((sum, p) => sum + (p.lessons_done || 0), 0);
  const activeSubjects = (subjects as AcademicSubject[] || []).filter(s => s.active);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${color}`} />
          <CardTitle className="text-lg">{childName}</CardTitle>
        </div>
        <CardDescription>{activeSubjects.length} active subjects</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{totalMinutes} min this week</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span>{totalLessons} lessons completed</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <span>{thisWeekProgress.length} sessions logged</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ChildDashboard({ childId }: { childId: ChildId }) {
  const { data: subjects } = useSubjects(childId);
  const { data: progress } = useProgress(childId, 50);

  const activeSubjects = (subjects as AcademicSubject[] || []).filter(s => s.active);
  const recentProgress = (progress as AcademicProgress[] || []).slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Subject Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Subjects</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeSubjects.map(subject => (
            <Card key={subject.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{subject.name}</CardTitle>
                <CardDescription>
                  {subject.platform && <Badge variant="outline" className="mr-1">{subject.platform}</Badge>}
                  {subject.methodology && <Badge variant="secondary">{subject.methodology}</Badge>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Grade level: {subject.grade_level || "Not set"}
                </p>
              </CardContent>
            </Card>
          ))}
          <Card className="border-dashed flex items-center justify-center min-h-[120px] cursor-pointer hover:bg-muted/50">
            <div className="text-center text-muted-foreground">
              <Plus className="h-6 w-6 mx-auto mb-1" />
              <span className="text-sm">Add Subject</span>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Progress */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Progress</h3>
        <div className="space-y-2">
          {recentProgress.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No progress entries yet. Log the first session!
              </CardContent>
            </Card>
          ) : (
            recentProgress.map(entry => (
              <Card key={entry.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground w-20">{entry.date}</div>
                    <div>
                      <p className="font-medium text-sm">{entry.title || "Activity"}</p>
                      {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {entry.duration_min && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {entry.duration_min}m
                      </span>
                    )}
                    {entry.mastery_score && (
                      <Badge variant="outline">{entry.mastery_score}</Badge>
                    )}
                    <Badge variant={entry.source === "manual" ? "secondary" : "default"}>
                      {entry.source}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ComplianceStatus() {
  const { data: filings } = useCompliance();
  const schoolYear = getCurrentSchoolYear();

  const noiDeadline = `${schoolYear.split("-")[0]}-08-15`;
  const assessmentDeadline = `${schoolYear.split("-")[1]}-08-01`;

  const noiFilings = (filings as any[] || []).filter(f => f.filing_type === "noi");
  const assessmentFilings = (filings as any[] || []).filter(f => f.filing_type === "annual_assessment");

  const noiStatus = noiFilings.length > 0 ? noiFilings[0].status : "not_filed";
  const assessmentStatus = assessmentFilings.length > 0 ? assessmentFilings[0].status : "not_filed";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Virginia Compliance — {schoolYear}
        </CardTitle>
        <CardDescription>
          Annual filings required under Virginia home instruction statute
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* NOI Status */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            {noiStatus === "filed" || noiStatus === "acknowledged" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">Notice of Intent (NOI)</p>
              <p className="text-xs text-muted-foreground">Due: August 15 ({noiDeadline})</p>
              <Badge className="mt-1" variant={noiStatus === "filed" ? "default" : "secondary"}>
                {noiStatus === "not_filed" ? "Not Filed" : noiStatus}
              </Badge>
            </div>
          </div>

          {/* Assessment Status */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            {assessmentStatus === "filed" || assessmentStatus === "acknowledged" ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            )}
            <div>
              <p className="font-medium text-sm">Annual Assessment</p>
              <p className="text-xs text-muted-foreground">Due: August 1 ({assessmentDeadline})</p>
              <Badge className="mt-1" variant={assessmentStatus === "filed" ? "default" : "secondary"}>
                {assessmentStatus === "not_filed" ? "Not Filed" : assessmentStatus}
              </Badge>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          <p><strong>Assessment options:</strong> {VA_COMPLIANCE.assessment_options.join(" | ")}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Add Progress Form ───────────────────────────────────────────────────────

function AddProgressForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    child_id: "",
    subject_id: "",
    date: new Date().toISOString().split("T")[0],
    duration_min: "",
    lessons_done: "",
    mastery_score: "",
    title: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/academic/progress", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-progress"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      ...formData,
      duration_min: formData.duration_min ? parseInt(formData.duration_min) : null,
      lessons_done: formData.lessons_done ? parseInt(formData.lessons_done) : null,
      source: "manual",
    });
  };

  const homeschoolKids = CHILDREN.filter(c => HOMESCHOOL_CHILDREN.includes(c.id));

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
                {homeschoolKids.map(c => (
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
          <Label>Title / Description</Label>
          <Input
            placeholder="e.g., Completed fractions unit on Khan Academy"
            value={formData.title}
            onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Duration (min)</Label>
            <Input
              type="number"
              placeholder="45"
              value={formData.duration_min}
              onChange={e => setFormData(f => ({ ...f, duration_min: e.target.value }))}
            />
          </div>
          <div>
            <Label>Lessons Done</Label>
            <Input
              type="number"
              placeholder="3"
              value={formData.lessons_done}
              onChange={e => setFormData(f => ({ ...f, lessons_done: e.target.value }))}
            />
          </div>
          <div>
            <Label>Score/Mastery</Label>
            <Input
              placeholder="85%"
              value={formData.mastery_score}
              onChange={e => setFormData(f => ({ ...f, mastery_score: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label>Notes</Label>
          <Textarea
            placeholder="Additional notes..."
            value={formData.notes}
            onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!formData.child_id || !formData.title}>
            Save Progress
          </Button>
        </div>
      </form>
    </>
  );
}
