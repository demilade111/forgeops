import { create } from "zustand";

export type ThemeChoice = "light" | "dark" | "system";

const key = "forgeops-theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

function saved(): ThemeChoice {
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}

export const useTheme = create<{
  choice: ThemeChoice;
  systemDark: boolean;
  choose: (choice: ThemeChoice) => void;
}>((set) => ({
  choice: saved(),
  systemDark: media.matches,
  choose: (choice) => {
    set({ choice });
    try {
      localStorage.setItem(key, choice);
    } catch {
      return;
    }
  },
}));

media.addEventListener("change", (event) => useTheme.setState({ systemDark: event.matches }));

const isDark = ({ choice, systemDark }: { choice: ThemeChoice; systemDark: boolean }) =>
  choice === "dark" || (choice === "system" && systemDark);

const apply = () => document.documentElement.classList.toggle("dark", isDark(useTheme.getState()));
apply();
useTheme.subscribe(apply);

export const useDark = () => useTheme(isDark);
