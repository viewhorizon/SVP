import { Download, Upload } from "lucide-react";

interface KanbanActionsBarProps {
  boardDisplay: "kanban" | "table";
  slideMode: boolean;
  onOpenCreateModal: () => void;
  onToggleDisplay: () => void;
  onToggleSlideMode: () => void;
  onImportFile: () => void;
  onAnalyzeFile: () => void;
  onAnalyzeBoard: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onExportJiraCsv: () => void;
  onExportAsanaCsv: () => void;
}

export function KanbanActionsBar({
  boardDisplay,
  slideMode,
  onOpenCreateModal,
  onToggleDisplay,
  onToggleSlideMode,
  onImportFile,
  onAnalyzeFile,
  onAnalyzeBoard,
  onExportCsv,
  onExportJson,
  onExportJiraCsv,
  onExportAsanaCsv,
}: KanbanActionsBarProps) {
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenCreateModal} className="kanban-btn inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Nueva tarea</button>
        <button type="button" onClick={onImportFile} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Upload size={16} /> Importar</button>
        <button type="button" onClick={onAnalyzeFile} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Upload size={16} /> Analizar</button>
        <button type="button" onClick={onAnalyzeBoard} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Analizar tablero</button>
        <button type="button" onClick={onToggleDisplay} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          {boardDisplay === "kanban" ? "Vista tabla" : "Vista kanban"}
        </button>
        <button type="button" onClick={onToggleSlideMode} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          Slide movil: {slideMode ? "ON" : "OFF"}
        </button>
        <button type="button" onClick={onExportCsv} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Download size={16} /> CSV</button>
        <button type="button" onClick={onExportJiraCsv} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Download size={16} /> Jira CSV</button>
        <button type="button" onClick={onExportAsanaCsv} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Download size={16} /> Asana CSV</button>
        <button type="button" onClick={onExportJson} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Download size={16} /> JSON</button>
      </div>
    </>
  );
}