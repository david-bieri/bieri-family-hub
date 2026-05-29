// Category helpers — used across all modules

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export const BUILTIN_IDS = ["school","sports","medical","camp","family","payment","other"];

export function getCategoryStyle(cat: Category | undefined) {
  if (!cat) return { bg: "bg-muted", text: "text-muted-foreground", dot: "#6b7280" };
  return {
    bg: ``,
    text: ``,
    dot: cat.color,
    style: { backgroundColor: cat.color + "22", color: cat.color },
  };
}

// Convert a hex color to a light tint for backgrounds
export function hexToTint(hex: string, alpha = 0.15): string {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, "0");
}
