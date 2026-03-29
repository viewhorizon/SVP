interface KanbanHeaderProps {
  view: "board" | "metrics";
  onChangeView: (view: "board" | "metrics") => void;
}

export function KanbanHeader({ view, onChangeView }: KanbanHeaderProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tablero Kanban</h2>
          <p className="text-sm text-slate-600">Backlog y sprint log con importacion, exportacion y analisis.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChangeView("board")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === "board" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
        >
          Tablero
        </button>
        <button
          type="button"
          onClick={() => onChangeView("metrics")}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${view === "metrics" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}
        >
          Metricas
        </button>
      </div>
    </>
  );
}