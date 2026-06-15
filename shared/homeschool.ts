/**
 * shared/homeschool.ts
 * Homeschool Module — Shared Types & Constants
 *
 * Augments the main schema.ts with homeschool-specific types.
 * Imported by both client and server.
 */

import type { ChildId } from "./schema";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Children currently being homeschooled */
export const HOMESCHOOL_CHILDREN: ChildId[] = ["cole", "greta", "airlie", "clara"];

/** Children in shared custody (visible to co-parent) */
export const CUSTODY_CHILDREN: ChildId[] = ["cole", "airlie"];

/** Virginia compliance constants */
export const VA_COMPLIANCE = {
  noi_deadline_month: 8,  // August
  noi_deadline_day: 15,
  assessment_deadline_month: 8,
  assessment_deadline_day: 1,
  min_percentile: 23,
  assessment_options: [
    "Standardized test (composite ≥ 23rd percentile)",
    "Evaluation letter from licensed teacher",
    "Evaluation letter from person with master's degree",
    "Report card from correspondence school",
    "Other evaluation approved by superintendent",
  ],
} as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export type HouseholdId = "hh-bieri" | "hh-coparent";
export type UserRole = "admin" | "coparent" | "viewer";
export type FilingType = "noi" | "annual_assessment" | "religious_exemption" | "other";
export type FilingStatus = "not_filed" | "draft" | "filed" | "acknowledged" | "overdue";
export type PlanType = "weekly" | "unit" | "semester" | "annual";
export type PlanStatus = "draft" | "active" | "completed" | "archived";
export type ArtifactType = "photo" | "document" | "video" | "writing" | "project" | "test_score" | "other";
export type ProgressSource = "manual" | "email_extract" | "sms" | "platform_sync";

export interface Household {
  id: HouseholdId;
  name: string;
  primary_contact_name: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
}

export interface HubUser {
  id: string;
  auth_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  household_id: HouseholdId;
  child_scope: ChildId[];
}

export interface CustodyWeek {
  id: string;
  week_start: string; // ISO date (Monday)
  household_id: HouseholdId;
  notes?: string;
}

export interface AcademicSubject {
  id: string;
  child_id: ChildId;
  name: string;
  platform?: string;
  methodology?: string;
  grade_level?: string;
  active: boolean;
  notes?: string;
}

export interface AcademicProgress {
  id: string;
  child_id: ChildId;
  subject_id?: string;
  date: string;
  duration_min?: number;
  lessons_done?: number;
  mastery_score?: string;
  title?: string;
  notes?: string;
  source: ProgressSource;
  source_ref?: string;
  household_id?: HouseholdId;
  created_at?: string;
}

export interface PortfolioArtifact {
  id: string;
  child_id: ChildId;
  title: string;
  description?: string;
  artifact_type: ArtifactType;
  file_url?: string;
  date: string;
  subject_id?: string;
  tags?: string[];
  created_at?: string;
}

export interface CurriculumPlan {
  id: string;
  child_id: ChildId;
  title: string;
  plan_type: PlanType;
  status: PlanStatus;
  start_date?: string;
  end_date?: string;
  objectives?: string[];
  activities?: string[];
  resources?: string[];
  notes?: string;
}

export interface ComplianceFiling {
  id: string;
  school_year: string;
  filing_type: FilingType;
  child_ids: ChildId[];
  status: FilingStatus;
  filed_date?: string;
  due_date?: string;
  document_url?: string;
  notes?: string;
}

export interface HandoffDigest {
  id: string;
  week_start: string;
  from_household: HouseholdId;
  to_household: HouseholdId;
  child_ids: ChildId[];
  summary_text: string;
  sent_at?: string;
  sent_via?: string;
}
