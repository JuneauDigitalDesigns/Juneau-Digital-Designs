"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "@phosphor-icons/react";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Before mount, theme is unknown — render the button shell (fixed size) without an
  // icon to avoid a hydration mismatch and layout shift.
  const current = mounted ? (resolvedTheme ?? theme) : undefined;
  const isDark = current === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDark ? "Switch to day theme" : "Switch to night theme"}
      title={isDark ? "Day mode" : "Night mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && (isDark ? <Moon size={16} weight="fill" /> : <Sun size={16} weight="fill" />)}
    </button>
  );
}
