"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { appShellLabel } from "@/lib/locale";
import { BrandMark } from "@/components/brand-mark";

const sizes = {
  sm: { icon: 28, text: "text-2xl" },
  lg: { icon: 36, text: "text-4xl" },
} as const;

export function Logo({
  size = "sm",
  className,
  iconOnly = false,
}: {
  size?: "sm" | "lg";
  className?: string;
  iconOnly?: boolean;
}) {
  const { icon, text } = sizes[size];
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const mountedRef = useRef(setMounted);

  useEffect(() => { mountedRef.current(true); }, []);

  const toggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={appShellLabel("toggleTheme")}
      className={cn(
        "flex items-center gap-1.5 cursor-pointer select-none transition-opacity hover:opacity-70",
        className
      )}
    >
      {mounted ? (
        <BrandMark size={icon} />
      ) : (
        <span style={{ width: icon, height: icon }} />
      )}
      {!iconOnly && (
        <span
          className={cn(text, "font-black tracking-tight")}
          style={{ fontFamily: "var(--font-brand)" }}
        >
          ភ្នាក់ងារ
        </span>
      )}
    </button>
  );
}
