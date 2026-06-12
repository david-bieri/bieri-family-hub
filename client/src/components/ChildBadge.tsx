import { CHILDREN, PARENTS, PETS, getAge } from "@/lib/children";
import { cn } from "@/lib/utils";

interface Props {
  childId: string;
  showAge?: boolean;
  size?: "sm" | "md";
}

// Lookup across all member types
function findMember(id: string) {
  const child = CHILDREN.find(c => c.id === id);
  if (child) return { name: child.name, colorClass: child.colorClass, textClass: child.textClass, bgLight: child.bgLight, birthdate: child.birthdate, role: "child" as const };

  const parent = PARENTS.find(p => p.id === id);
  if (parent) return { name: parent.name, colorClass: parent.colorClass, textClass: parent.textClass, bgLight: "bg-slate-50 dark:bg-slate-900", birthdate: undefined, role: "parent" as const };

  const pet = PETS.find(p => p.id === id);
  if (pet) return { name: pet.name, colorClass: pet.colorClass, textClass: pet.textClass, bgLight: "bg-amber-50 dark:bg-amber-950", birthdate: undefined, role: "pet" as const };

  return null;
}

export function ChildBadge({ childId, showAge = false, size = "sm" }: Props) {
  const member = findMember(childId);
  if (!member) return null;
  const initials = member.name[0];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-medium",
      member.bgLight, member.textClass,
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
    )}>
      <span className={cn(
        "rounded-full flex items-center justify-center text-white font-bold",
        member.colorClass,
        size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]"
      )}>
        {initials}
      </span>
      {member.name}
      {showAge && member.birthdate && <span className="opacity-60">· {getAge(member.birthdate)}</span>}
    </span>
  );
}

export function ChildAvatar({ childId, className }: { childId: string; className?: string }) {
  const member = findMember(childId);
  if (!member) return null;
  return (
    <div className={cn(
      "rounded-full flex items-center justify-center text-white font-bold text-xs",
      member.colorClass, className
    )}>
      {member.name[0]}
    </div>
  );
}

/**
 * AttendeeList — smart rendering for multiple attendees.
 * Shows individual badges for 1-3 people, collapses to "All Kids" or
 * "X Family" shorthand for 4+ children, always shows parents individually.
 */
export function AttendeeList({ ids, size = "sm" }: { ids: string[]; size?: "sm" | "md" }) {
  if (!ids || ids.length === 0) return null;

  const childIds = ids.filter(id => CHILDREN.some(c => c.id === id));
  const parentIds = ids.filter(id => PARENTS.some(p => p.id === id));
  const petIds = ids.filter(id => PETS.some(p => p.id === id));

  const allChildrenCount = CHILDREN.length; // 6
  const showAllKids = childIds.length >= 4;

  return (
    <div className="flex flex-wrap gap-1">
      {/* Always show parents individually */}
      {parentIds.map(id => (
        <ChildBadge key={id} childId={id} size={size} />
      ))}

      {/* Children: show individually if ≤3, otherwise show "All Kids" or "X Kids" */}
      {showAllKids ? (
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full font-medium bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        )}>
          <span className={cn(
            "rounded-full flex items-center justify-center text-white font-bold bg-blue-500",
            size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]"
          )}>
            {childIds.length}
          </span>
          {childIds.length === allChildrenCount ? "All Kids" : `${childIds.length} Kids`}
        </span>
      ) : (
        childIds.map(id => (
          <ChildBadge key={id} childId={id} size={size} />
        ))
      )}

      {/* Always show pets individually */}
      {petIds.map(id => (
        <ChildBadge key={id} childId={id} size={size} />
      ))}
    </div>
  );
}
