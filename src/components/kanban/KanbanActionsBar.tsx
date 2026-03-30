import { Download, Upload, Sparkles, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

type ExportFormat = "trello" | "jira" | "asana" | "json";

const EXPORT_OPTIONS: Array<{ id: ExportFormat; label: string; description: string }> = [
  { id: "trello", label: "CSV (Trello)", description: "Formato compatible con Trello" },
  { id: "jira", label: "CSV (Jira)", description: "Formato compatible con Jira" },
  { id: "asana", label: "CSV (Asana)", description: "Formato compatible con Asana" },
  { id: "json", label: "JSON", description: "Datos estructurados JSON" },
];

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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = (format: ExportFormat) => {
    setExportMenuOpen(false);
    switch (format) {
      case "trello":
        onExportCsv();
        break;
      case "jira":
        onExportJiraCsv();
        break;
      case "asana":
        onExportAsanaCsv();
        break;
      case "json":
        onExportJson();
        break;
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={onOpenCreateModal} className="kanban-btn inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Nueva tarea</button>
        <button type="button" onClick={onImportFile} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Upload size={16} /> Importar tablero</button>
        <button type="button" onClick={onAnalyzeFile} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"><Sparkles size={16} /> Analizar IA</button>
        <button type="button" onClick={onAnalyzeBoard} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Analizar tablero</button>
        <button type="button" onClick={onToggleDisplay} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          {boardDisplay === "kanban" ? "Vista tabla" : "Vista kanban"}
        </button>
        <button type="button" onClick={onToggleSlideMode} className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          Slide movil: {slideMode ? "ON" : "OFF"}
        </button>
        
        {/* Export dropdown */}
        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="kanban-btn inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            <Download size={16} /> Exportar <ChevronDown size={14} className={`transition-transform ${exportMenuOpen ? "rotate-180" : ""}`} />
          </button>
          
          {exportMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="p-1">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Selecciona formato</p>
                {EXPORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleExport(option.id)}
                    className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-slate-100"
                  >
                    <span className="text-sm font-medium text-slate-900">{option.label}</span>
                    <span className="text-xs text-slate-500">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
