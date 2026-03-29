import { Activity, Download, Plus, Upload } from "lucide-react";
import { Task } from "../../services/kanbanService";

interface BoardHeaderProps {
  activeTab: "board" | "metrics";
  setActiveTab: (tab: "board" | "metrics") => void;
  onOpenCreateModal: () => void;
  onOpenImportModal: () => void;
  onExportTrello: () => void;
  onExportJson: () => void;
  tasks: Task[];
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateModal,
  onOpenImportModal,
  onExportTrello,
  onExportJson,
  tasks,
}) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "done").length;
  const inProgress = tasks.filter((task) => task.status === "in-progress").length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tablero Kanban · General</h1>
          <p className="text-sm text-slate-600">Gestion de tareas del proyecto con importacion/exportacion y analisis IA</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("board")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              activeTab === "board" ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity size={16} />
              Tablero
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("metrics")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              activeTab === "metrics" ? "bg-blue-600 text-white shadow-md" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity size={16} />
              Metricas
            </span>
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Total tareas</span>
            <p className="text-xl font-bold text-slate-900">{total}</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Progreso</span>
            <p className="text-xl font-bold text-slate-900">{progress}%</p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">En curso</span>
            <p className="text-xl font-bold text-slate-900">{inProgress}</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
          >
            <Plus size={16} />
            Agregar tarea
          </button>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-900"
          >
            <Upload size={16} />
            Subir documento
          </button>
          <button
            type="button"
            onClick={onExportTrello}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <Download size={16} />
            CSV Trello
          </button>
          <button
            type="button"
            onClick={onExportJson}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
          >
            <Download size={16} />
            JSON
          </button>
        </div>
      </div>
    </header>
  );
};