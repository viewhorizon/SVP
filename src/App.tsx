import { ClipboardList, Vote } from "lucide-react";
import { useEffect, useState } from "react";
import KanbanBoard from "./KanbanBoard";
import SPVSystem from "./SPVSystem";

type MainView = "spv" | "kanban";
const VIEW_STORAGE_KEY = "spv.main.view";

const readSavedView = (): MainView => {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    return saved === "kanban" ? "kanban" : "spv";
  } catch {
    return "spv";
  }
};

export default function App() {
  const [view, setView] = useState<MainView>(readSavedView);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // No bloquea la app si localStorage no esta disponible.
    }
  }, [view]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Kernel Quest · SPV</h1>
            <p className="text-xs text-slate-600">Navegacion separada entre SPV y Kanban</p>
          </div>
          <div className="inline-flex rounded-full border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setView("spv")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view === "spv" ? "bg-blue-600 text-white" : "text-slate-600"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Vote size={16} />
                SPV
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                view === "kanban" ? "bg-blue-600 text-white" : "text-slate-600"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <ClipboardList size={16} />
                Kanban
              </span>
            </button>
          </div>
        </div>
      </header>

      {view === "spv" ? <SPVSystem /> : <KanbanBoard />}
    </div>
  );
}
