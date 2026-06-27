"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { appShellLabel } from "@/lib/locale";

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
        <>
          <Image
            src="/phneakngar.svg"
            alt="ភ្នាក់ងារ"
            width={icon}
            height={icon}
            className="dark:hidden"
          />
          <Image
            src="/phneakngar-dark.svg"
            alt="ភ្នាក់ងារ"
            width={icon}
            height={icon}
            className="hidden dark:block"
          />
        </>
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
