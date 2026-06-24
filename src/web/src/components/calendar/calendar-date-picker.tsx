"use client";

import { useState } from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buildMonthCells, sameDay } from "./calendar-month-grid";
import { CALENDAR_LABELS, CALENDAR_WEEKDAY_NARROW } from "./calendar-labels";

export interface CalendarDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  min?: Date;
  className?: string;
  ariaLabel?: string;
  /** Suppress the built-in CalendarDays icon in the trigger. */
  hideIcon?: boolean;
  /**
   * When provided, the footer shows a "Clear" action while a value is set.
   * Picks are still delivered through `onChange`; clearing is separate so
   * required pickers (no clear affordance) can stay non-nullable.
   */
  onClear?: () => void;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString("km-KH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthYearLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString("km-KH", {
    month: "long",
    year: "numeric",
  });
}

export function CalendarDatePicker({
  value,
  onChange,
  placeholder = CALENDAR_LABELS.actions.jumpToDate,
  min,
  className,
  ariaLabel = CALENDAR_LABELS.actions.pickDate,
  hideIcon = false,
  onClear,
}: CalendarDatePickerProps) {
  const [open, setOpen] = useState(false);
  const initial = value ?? new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const cells = buildMonthCells(viewYear, viewMonth);
  const today = new Date();

  const handleSelect = (d: Date) => {
    if (min && d < stripTime(min)) return;
    onChange(d);
    setOpen(false);
  };

  const label = value ? formatDisplay(value) : placeholder;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          const anchor = value ?? new Date();
          setViewYear(anchor.getFullYear());
          setViewMonth(anchor.getMonth());
        }
      }}
    >
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md border border-input bg-transparent px-2 text-xs outline-none transition-colors",
          "hover:bg-accent hover:text-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          value ? "text-foreground" : "text-muted-foreground",
          className
        )}
      >
        {!hideIcon && <CalendarDays className="size-3.5 opacity-70" />}
        <span className="hidden sm:inline tabular-nums">{label}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            aria-label={CALENDAR_LABELS.actions.previousMonth}
            onClick={() => {
              setViewMonth((m) => (m === 0 ? 11 : m - 1));
              if (viewMonth === 0) setViewYear((y) => y - 1);
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="text-xs font-medium tabular-nums">
            {monthYearLabel(viewYear, viewMonth)}
          </span>
          <button
            type="button"
            aria-label={CALENDAR_LABELS.actions.nextMonth}
            onClick={() => {
              setViewMonth((m) => (m === 11 ? 0 : m + 1));
              if (viewMonth === 11) setViewYear((y) => y + 1);
            }}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-7 pb-1 text-[10px] text-muted-foreground">
          {CALENDAR_WEEKDAY_NARROW.map((d, i) => (
            <div
              key={i}
              className="flex h-6 items-center justify-center font-medium"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, i) => {
            const isToday = sameDay(today, cell.date);
            const isSelected = value ? sameDay(value, cell.date) : false;
            const isDisabled = !!min && cell.date < stripTime(min);
            return (
              <button
                key={i}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelect(cell.date)}
                aria-pressed={isSelected}
                className={cn(
                  "flex h-7 w-full items-center justify-center rounded text-[11px] tabular-nums transition-colors outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring/60",
                  !cell.inMonth && "text-muted-foreground/50",
                  cell.inMonth && !isSelected && "hover:bg-accent",
                  isToday && !isSelected &&
                    "text-foreground font-medium ring-1 ring-inset ring-border",
                  isSelected &&
                    "bg-foreground text-background font-medium",
                  isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {cell.date.getDate()}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-border/50">
          {onClear && value ? (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {CALENDAR_LABELS.actions.clear}
            </button>
          ) : (
            <span aria-hidden />
          )}
          <button
            type="button"
            onClick={() => handleSelect(new Date())}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {CALENDAR_LABELS.actions.today}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
