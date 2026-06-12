import { useState } from "react";
import {
  BookOpen, Mail, Calendar, Tag, Users, PawPrint,
  ChevronDown, ChevronUp, Zap, Clock, Shield, Moon,
  Inbox, CreditCard, Stethoscope, Trophy, Tent, MessageSquare
} from "lucide-react";
import { ALL_MEMBERS } from "@/lib/children";

// ─── Section component ───────────────────────────────────────────────────────
function Section({ title, icon: Icon, defaultOpen = false, children }: {
  title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
      >
        <Icon size={16} className="text-primary shrink-0" />
        <span className="text-sm font-semibold flex-1">{title}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border pt-4 space-y-3 text-sm text-foreground">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Help Page ───────────────────────────────────────────────────────────────
export default function Help() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BookOpen size={20} className="text-primary" />
          Help &amp; User Guide
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Everything you need to know about using the Bieri Family Hub
        </p>
      </div>

      {/* Quick Start */}
      <Section title="Quick Start" icon={Zap} defaultOpen={true}>
        <p>
          The Family Hub is a single dashboard for managing the entire family's schedule, medical appointments,
          sports activities, camp registrations, payments, and more. Here's how it works:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-sm pl-2">
          <li><strong>Email scanning</strong> automatically pulls events from your Gmail inbox every morning</li>
          <li><strong>Review items</strong> in the Inbox tab — accept or dismiss extracted events</li>
          <li><strong>Manual entry</strong> — add events, appointments, or payments directly from any module</li>
          <li><strong>Badges</strong> on the sidebar show items needing attention (overdue payments, upcoming deadlines)</li>
          <li><strong>Family Calendar</strong> shows everything in one unified view</li>
        </ol>
      </Section>

      {/* Email Scanning */}
      <Section title="Email Scanning & Tag Syntax" icon={Mail} defaultOpen={true}>
        <p>
          Forward or send emails to your connected Gmail with subject-line shortcuts for instant categorization.
          Tagged emails skip AI processing entirely and are categorized immediately.
        </p>

        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Category Tags</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Add one <code className="bg-muted px-1 rounded">#TAG</code> at the start of the subject line:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {[
              { tag: "#CAMP", desc: "Camp / program registration", type: "→ registration" },
              { tag: "#SPORT", desc: "Sports event or practice", type: "→ event" },
              { tag: "#SCHOOL", desc: "School event or notice", type: "→ event" },
              { tag: "#MED", desc: "Medical or vet appointment", type: "→ appointment" },
              { tag: "#PAY", desc: "Payment due or invoice", type: "→ payment" },
              { tag: "#REG", desc: "General registration", type: "→ registration" },
              { tag: "#PET", desc: "Pet-related item", type: "→ appointment" },
              { tag: "#FAM", desc: "Family event", type: "→ event" },
              { tag: "#OFFICE", desc: "Work / professional", type: "→ event" },
              { tag: "#TRAVEL", desc: "Travel / trips", type: "→ event" },
              { tag: "#HOUSE", desc: "Home / maintenance", type: "→ task" },
              { tag: "#INVITE", desc: "Social invitations", type: "→ event" },
            ].map(({ tag, desc, type }) => (
              <div key={tag} className="bg-muted/60 rounded-lg px-3 py-2">
                <code className="text-xs font-bold text-primary">{tag}</code>
                <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                <div className="text-[10px] text-muted-foreground/70 italic">{type}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Person Tags</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Use <code className="bg-muted px-1 rounded">@Name</code> to assign items to family members.
            Multiple people can be tagged. Case-insensitive.
          </p>
          <div className="space-y-2">
            <div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Parents</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["@David", "@Nancy"].map(name => (
                  <span key={name} className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-mono">{name}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Kids</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["@Cole", "@Greta", "@Airlie", "@Clara", "@Heidi", "@Daisy"].map(name => (
                  <span key={name} className="text-xs bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-md font-mono">{name}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Pets</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["@Otis", "@Athena", "@Persephone"].map(name => (
                  <span key={name} className="text-xs bg-amber-50 dark:bg-amber-950 px-2 py-1 rounded-md font-mono">{name}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Subject Line Examples</h4>
          <div className="space-y-1.5 font-mono text-xs bg-muted/40 rounded-lg p-3">
            <div><span className="text-primary font-bold">#CAMP @Clara @Airlie</span> VA Techniques: Ninja Warrior Camp</div>
            <div><span className="text-primary font-bold">#SPORT @Cole</span> Soccer practice Tuesday 6pm</div>
            <div><span className="text-primary font-bold">#PAY @Airlie @Clara</span> Camp deposit due June 15 $250</div>
            <div><span className="text-primary font-bold">#MED @Otis</span> Vet checkup reminder</div>
            <div><span className="text-primary font-bold">#SCHOOL @Greta</span> Field trip permission slip due Friday</div>
            <div><span className="text-primary font-bold">#OFFICE @David</span> Faculty meeting moved to 3pm Thursday</div>
            <div><span className="text-primary font-bold">#TRAVEL @Nancy @David</span> Hotel confirmation Aug 12-15</div>
            <div><span className="text-primary font-bold">#HOUSE</span> HVAC filter replacement due this month</div>
            <div><span className="text-primary font-bold">#INVITE @Cole @Greta @Airlie</span> Birthday party at the Johnsons Sat 2pm</div>
          </div>
        </div>

        <div className="mt-3 p-3 bg-muted/40 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Without tags:</strong> Emails are processed by AI (Perplexity Sonar model) which extracts dates,
            amounts, and child names automatically. This works well but may take longer and occasionally needs manual review.
          </p>
        </div>
      </Section>

      {/* Modules Guide */}
      <Section title="App Modules" icon={Calendar}>
        <div className="space-y-3">
          <ModuleRow icon={Calendar} name="Family Calendar" desc="Unified view of all events, appointments, and deadlines across all modules. Filter by child or category. Supports recurring events." />
          <ModuleRow icon={Calendar} name="Schedule" desc="Week and list views for day-to-day scheduling. Add one-off or recurring events with time slots." />
          <ModuleRow icon={Stethoscope} name="Medical" desc="Track doctor/dentist/specialist appointments, vaccinations, and medical notes per child. Badge shows appointments in the next 14 days." />
          <ModuleRow icon={Trophy} name="Sports" desc="Manage sports enrollments, seasons, practice schedules, and coaches per child." />
          <ModuleRow icon={Tent} name="Camps & Reg." desc="Track camp and program registrations with status workflow (Not Started → Submitted → Confirmed → Paid). Badge shows items needing action." />
          <ModuleRow icon={CreditCard} name="Payments" desc="Track pending and completed payments. Auto-detects overdue items from due date. Badge shows overdue count." />
          <ModuleRow icon={PawPrint} name="Pets" desc="Pet profiles, vet appointments, and medication tracking." />
          <ModuleRow icon={Inbox} name="Inbox" desc="Review items extracted from email scans. Accept to add to calendar or dismiss." />
          <ModuleRow icon={MessageSquare} name="Messages" desc="Family message board for quick notes and reminders between family members." />
          <ModuleRow icon={Tag} name="Categories" desc="Manage custom categories for organizing events and items." />
        </div>
      </Section>

      {/* Badge System */}
      <Section title="Badge & Notification System" icon={Clock}>
        <p>Sidebar badges show items needing your attention:</p>
        <div className="space-y-2 mt-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">3</span>
            <span className="text-sm"><strong>Medical</strong> — Appointments in the next 14 days</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">2</span>
            <span className="text-sm"><strong>Camps & Reg.</strong> — Registrations with deadlines approaching or overdue (still actionable)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">1</span>
            <span className="text-sm"><strong>Payments</strong> — Overdue payments (due date passed, still pending)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">5</span>
            <span className="text-sm"><strong>Inbox</strong> — Unreviewed items from email scans</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground min-w-[18px] text-center">2</span>
            <span className="text-sm"><strong>Messages</strong> — Unread messages since your last visit</span>
          </div>
        </div>
      </Section>

      {/* Tips */}
      <Section title="Tips & Shortcuts" icon={Shield}>
        <ul className="list-disc list-inside space-y-1.5 text-sm pl-1">
          <li><strong>Dark mode</strong> — Toggle with the moon/sun icon in the sidebar footer. Your preference is saved.</li>
          <li><strong>Quick status</strong> — On the Camps page, click status chips directly to update without opening the edit form.</li>
          <li><strong>Share calendar</strong> — Use the Share button on the Family Calendar to generate a read-only link.</li>
          <li><strong>Manual scan</strong> — Hit "Scan Now" on the Inbox page to trigger an email scan outside the daily schedule.</li>
          <li><strong>Child filter</strong> — Click a child's card on the Dashboard to jump to their filtered calendar view.</li>
          <li><strong>SMS alerts</strong> — Urgent items trigger Twilio SMS notifications to registered phone numbers.</li>
        </ul>
      </Section>

      {/* Theme */}
      <Section title="Theme & Display" icon={Moon}>
        <p>
          The app supports light and dark mode. Your preference is saved in your browser and persists across sessions.
          Toggle using the moon/sun icon at the bottom of the sidebar.
        </p>
        <p className="mt-2">
          The app is fully responsive — it works on desktop, tablet, and mobile. On mobile, the sidebar becomes a
          slide-out menu accessible via the hamburger icon.
        </p>
      </Section>
    </div>
  );
}

// ─── Helper component ────────────────────────────────────────────────────────
function ModuleRow({ icon: Icon, name, desc }: { icon: any; name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} className="text-primary mt-0.5 shrink-0" />
      <div>
        <div className="font-medium text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
