import type { TaskStatus } from "../../services/kanbanService";

interface KanbanFiltersProps {
  categories: string[];
  categoryFilter: string;
  statusFilters: Array<"all" | TaskStatus>;
  statusButtons: Array<{ value: "all" | TaskStatus; label: string }>;
  statusCounters: Record<"all" | TaskStatus, number>;
  onChangeCategory: (category: string) => void;
  onChangeStatus: (status: "all" | TaskStatus) => void;
}

export function KanbanFilters({
  categories,
  categoryFilter,
  statusFilters,
  statusButtons,
  statusCounters,
  onChangeCategory,
  onChangeStatus,
}: KanbanFiltersProps) {
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button key={category} type="button" onClick={() => onChangeCategory(category)} className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${categoryFilter === category ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
            {category}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {statusButtons.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChangeStatus(option.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${statusFilters.includes(option.value) ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
          >
            {option.label} ({statusCounters[option.value] ?? 0})
          </button>
        ))}
      </div>
    </>
  );
}