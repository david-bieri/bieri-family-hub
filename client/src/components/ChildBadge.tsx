import { CHILDREN, getAge } from "@/lib/children";
import { cn } from "@/lib/utils";

interface Props {
  childId: string;
  showAge?: boolean;
  size?: "sm" | "md";
}

export function ChildBadge({ childId, showAge = false, size = "sm" }: Props) {
  const child = CHILDREN.find(c => c.id === childId);
  if (!child) return null;
  const initials = child.name[0];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-medium",
      child.bgLight, child.textClass,
      size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
    )}>
      <span className={cn(
        "rounded-full flex items-center justify-center text-white font-bold",
        child.colorClass,
        size === "sm" ? "w-4 h-4 text-[9px]" : "w-5 h-5 text-[10px]"
      )}>
        {initials}
      </span>
      {child.name}
      {showAge && <span className="opacity-60">· {getAge(child.birthdate)}</span>}
    </span>
  );
}

export function ChildAvatar({ childId, className }: { childId: string; className?: string }) {
  const child = CHILDREN.find(c => c.id === childId);
  if (!child) return null;
  return (
    <div className={cn(
      "rounded-full flex items-center justify-center text-white font-bold text-xs",
      child.colorClass, className
    )}>
      {child.name[0]}
    </div>
  );
}
