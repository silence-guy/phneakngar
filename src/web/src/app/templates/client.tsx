"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/public-layout";
import { TemplateCard } from "./_components/template-card";
import type { TemplatePreset, TemplateCategory, TemplateFilterId } from "@/lib/templates";
import {
  filterTemplatesByChip,
  getTemplateGroups,
} from "@/lib/templates";
import { trackTemplatesBrowsed } from "@/lib/analytics";
import {
  TEMPLATES_LABELS,
  templateFilterLabel,
  templateGroupLabel,
  templateGroupBlurb,
} from "./templates-labels";

const FILTER_CHIPS: TemplateFilterId[] = [
  "All",
  "Scenarios",
  "Developer",
  "Content Creator",
  "Knowledge Worker",
  "Freelancer",
];

export function TemplatesClient({
  templates,
  categories: _categories, // reserved for future filter-from-server categories
  isLoggedIn,
  workspaceId,
}: {
  templates: TemplatePreset[];
  categories: TemplateCategory[];
  isLoggedIn: boolean;
  workspaceId?: string;
}) {
  void _categories;
  const [activeFilter, setActiveFilter] = useState<TemplateFilterId>("All");
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      tracked.current = true;
      trackTemplatesBrowsed({ category_filter: "All" });
    }
  }, []);

  const handleFilterChange = (filter: TemplateFilterId) => {
    setActiveFilter(filter);
    // Stable English keys for analytics (Scenarios + role categories + All)
    trackTemplatesBrowsed({ category_filter: filter });
  };

  const groups = useMemo(() => getTemplateGroups(templates), [templates]);
  const filtered = useMemo(
    () => filterTemplatesByChip(templates, activeFilter),
    [templates, activeFilter],
  );

  return (
    <PublicLayout
      maxWidth="4xl"
      rightSlot={
        <>
          <Link
            href="/templates"
            className="hidden sm:block px-3 py-1.5 text-xs uppercase tracking-widest font-mono transition-opacity hover:opacity-70"
          >
            {TEMPLATES_LABELS.nav.templates}
          </Link>
          <Link
            href="/blog"
            className="hidden sm:block px-3 py-1.5 text-xs uppercase tracking-widest font-mono transition-opacity hover:opacity-70"
          >
            {TEMPLATES_LABELS.nav.blog}
          </Link>
          {isLoggedIn ? (
            <Link
              href="/workspaces?auto"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs uppercase tracking-widest font-mono border border-current transition-opacity hover:opacity-70"
            >
              {TEMPLATES_LABELS.nav.app}
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs uppercase tracking-widest font-mono bg-foreground text-background transition-opacity hover:opacity-70"
            >
              {TEMPLATES_LABELS.nav.getStarted}
            </Link>
          )}
        </>
      }
    >
      {/* Header */}
      <div className="mx-auto max-w-4xl px-6 pt-16 pb-2">
        <h1 className="font-khmer text-3xl font-semibold tracking-normal leading-[1.4]">
          {TEMPLATES_LABELS.list.title}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {TEMPLATES_LABELS.list.subheading}
        </p>
      </div>

      {/* Category / scenario filter chips */}
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-6">
        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => handleFilterChange(filter)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-150 ${
                activeFilter === filter
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {templateFilterLabel(filter)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid — sectioned on All, flat when a filter is active */}
      <div className="mx-auto max-w-4xl px-6 pb-20">
        {activeFilter === "All" ? (
          <div className="space-y-10">
            {groups.map((group) => {
              const blurb = templateGroupBlurb(group.id);
              return (
                <section key={group.id}>
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                      {templateGroupLabel(group.id)}
                    </h2>
                    {blurb ? (
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {blurb}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {group.templates.map((template) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        isLoggedIn={isLoggedIn}
                        workspaceId={workspaceId}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
            {groups.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">
                  {TEMPLATES_LABELS.list.emptyCategory}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filtered.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isLoggedIn={isLoggedIn}
                  workspaceId={workspaceId}
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">
                  {TEMPLATES_LABELS.list.emptyCategory}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
