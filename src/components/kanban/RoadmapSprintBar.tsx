import { ChevronLeft, ChevronRight } from "lucide-react";
import type { RoadmapPageId } from "../../services/kanbanService";

interface RoadmapSprintBarProps {
  pages: Array<{ id: RoadmapPageId; label: string; subtitle: string }>;
  selectedPage: RoadmapPageId;
  onSelectPage: (page: RoadmapPageId) => void;
  counts: Record<RoadmapPageId, number>;
  doneCounts?: Partial<Record<RoadmapPageId, number>>;
  weeklyTargets?: Partial<Record<RoadmapPageId, number>>;
}

export function RoadmapSprintBar({ pages, selectedPage, onSelectPage, counts, doneCounts, weeklyTargets }: RoadmapSprintBarProps) {
  const currentIndex = pages.findIndex((page) => page.id === selectedPage);

  return (
    <section className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelectPage(pages[Math.max(0, currentIndex - 1)].id)}
          disabled={currentIndex <= 0}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>

        {pages.map((page) => (
          (() => {
            const total = counts[page.id] ?? 0;
            const done = doneCounts?.[page.id] ?? 0;
            const completed = total > 0 && done >= total;

            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelectPage(page.id)}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                  selectedPage === page.id
                    ? "bg-slate-900 text-white"
                    : completed
                      ? "border border-emerald-300/80 bg-emerald-50 text-emerald-700 opacity-75"
                      : "border border-slate-300 bg-white text-slate-700",
                ].join(" ")}
              >
                {page.label} ({done}/{total})
                {typeof weeklyTargets?.[page.id] === "number" ? ` · ${weeklyTargets[page.id]}h` : ""}
              </button>
            );
          })()
        ))}

        <button
          type="button"
          onClick={() => onSelectPage(pages[Math.min(pages.length - 1, currentIndex + 1)].id)}
          disabled={currentIndex >= pages.length - 1}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-600">{pages[currentIndex]?.subtitle}</p>
    </section>
  );
}
