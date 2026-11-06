import { Moon, Sun } from "lucide-react";
import { useDark, useTheme } from "@/stores/theme";

export function ThemeToggle() {
  const dark = useDark();
  const choose = useTheme((s) => s.choose);
  return (
    <button
      type="button"
      onClick={() => choose(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="text-muted-foreground hover:text-foreground hover:bg-secondary flex size-8 items-center justify-center rounded-md"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
