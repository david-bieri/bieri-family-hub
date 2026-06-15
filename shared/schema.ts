// shared/schema.ts
// Family Admin App — Data Model

export type ChildId = 'cole' | 'greta' | 'airlie' | 'clara' | 'heidi' | 'daisy';

export interface Child {
  id: ChildId;
  name: string;
  birthdate: string; // ISO date
  color: string;     // Tailwind color class for avatar
}

export const CHILDREN: Child[] = [
  { id: 'cole',   name: 'Cole',   birthdate: '2012-06-29', color: 'bg-blue-500' },
  { id: 'greta',  name: 'Greta',  birthdate: '2013-09-25', color: 'bg-purple-500' },
  { id: 'airlie', name: 'Airlie', birthdate: '2015-03-09', color: 'bg-green-500' },
  { id: 'clara',  name: 'Clara',  birthdate: '2016-08-23', color: 'bg-amber-500' },
  { id: 'heidi',  name: 'Heidi',  birthdate: '2023-03-09', color: 'bg-rose-400' },
  { id: 'daisy',  name: 'Daisy',  birthdate: '2025-01-28', color: 'bg-teal-400' },
];

// ─── Events (Schedule) ───────────────────────────────────────────────────────
export interface Event {
  id: string;
  title: string;
  date: string;       // ISO date
  time?: string;      // HH:MM
  end_time?: string;
  child_ids: string[]; // JSON array stored as text
  category: 'school' | 'sports' | 'medical' | 'camp' | 'family' | 'academics' | 'other';
  notes?: string;
  recurring?: boolean;
  created_at?: string;
}

// ─── Medical ─────────────────────────────────────────────────────────────────
export interface Vaccine {
  id: string;
  child_id: ChildId;
  name: string;
  date_given: string;
  next_due?: string;
  provider?: string;
  notes?: string;
}

export interface MedicalAppointment {
  id: string;
  child_id: ChildId;
  type: 'routine' | 'specialist' | 'dental' | 'vision' | 'other';
  provider: string;
  date: string;
  time?: string;
  notes?: string;
  completed: boolean;
}

// ─── Sports ──────────────────────────────────────────────────────────────────
export interface Sport {
  id: string;
  child_id: ChildId;
  sport_name: string;
  team?: string;
  coach?: string;
  season: string;
  days: string;        // e.g. "Mon/Wed/Fri"
  time?: string;
  location?: string;
  notes?: string;
  active: boolean;
}

// ─── Camp & Registrations ────────────────────────────────────────────────────
export type RegistrationStatus = 'not_started' | 'in_progress' | 'submitted' | 'confirmed' | 'waitlisted' | 'cancelled';

export interface Registration {
  id: string;
  child_id: ChildId;
  program_name: string;
  type: 'camp' | 'class' | 'sports_reg' | 'school' | 'other';
  start_date?: string;
  end_date?: string;
  deadline?: string;
  status: RegistrationStatus;
  cost?: number;
  deposit_paid?: boolean;
  documents_needed?: string; // JSON array as text
  notes?: string;
  url?: string;
}

// ─── Payments ────────────────────────────────────────────────────────────────
export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Payment {
  id: string;
  description: string;
  child_id?: ChildId;  // optional — some payments are family-wide
  category: 'camp' | 'sports' | 'medical' | 'school' | 'activity' | 'other';
  amount: number;
  due_date?: string;
  paid_date?: string;
  status: PaymentStatus;
  payee?: string;
  notes?: string;
}

// ─── Homeschool Module ───────────────────────────────────────────────────────
export * from "./homeschool";
