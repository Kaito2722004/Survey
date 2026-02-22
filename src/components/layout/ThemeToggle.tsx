// Day/Night theme toggle: sliding circle with sun (light) / moon (dark).
// Uses CSS variables for colors; no functional logic.

import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Day mode" : "Night mode"}
      className={
        "relative flex h-9 min-w-[7.5rem] items-center rounded-full border-2 transition-colors duration-300 ease-out " +
        (isDark
          ? "bg-[hsl(224,71%,4%)] border-white/20"
          : "bg-[#E0E0E0] border-[hsl(220,9%,46%/0.25)]") +
        " " +
        className
      }
    >
      {/* Label: Day on left when light, Night on right when dark */}
      <span
        className={
          "pointer-events-none absolute left-3 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 " +
          (isDark ? "invisible" : "text-black")
        }
      >
        Day
      </span>
      <span
        className={
          "pointer-events-none absolute right-3 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 " +
          (isDark ? "text-white" : "invisible")
        }
      >
        Night
      </span>

      {/* Sliding circle with icon */}
      <span
        className={
          "absolute top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black/10 bg-white shadow-sm transition-all duration-300 ease-out " +
          (isDark ? "left-1" : "left-[calc(100%-1.75rem-0.25rem)]")
        }
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
        ) : (
          <Sun className="h-3.5 w-3.5 text-black" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}
