import { priorityStyles, type Task } from "../../services/kanbanService";
import { CheckCircle2, Link2, AlertTriangle } from "lucide-react";

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailsModal({ task, onClose }: TaskDetailsModalProps) {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
            <p className="text-xs text-slate-600">ID: {task.id}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold uppercase ${priorityStyles[task.priority]}`}>
            {task.priority}
          </span>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <p><span className="font-semibold">Estado:</span> {task.status}</p>
          <p><span className="font-semibold">Categoria:</span> {task.category}</p>
          <p><span className="font-semibold">Estimado:</span> {task.estimated}</p>
          <p><span className="font-semibold">Descripcion:</span> {task.description || "Sin descripcion"}</p>
          {task.notes ? <p><span className="font-semibold">Notas:</span> {task.notes}</p> : null}
        </div>

        {/* Criterios de Aceptacion */}
        {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
              <CheckCircle2 size={16} /> Criterios de Aceptacion
            </h4>
            <ul className="space-y-1 text-sm text-emerald-700">
              {task.acceptanceCriteria.map((criteria, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {criteria}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dependencias */}
        {task.dependencies && task.dependencies.length > 0 && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-blue-800">
              <Link2 size={16} /> Dependencias
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {task.dependencies.map((dep, index) => (
                <span key={index} className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {dep}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Riesgos */}
        {task.risks && task.risks.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
              <AlertTriangle size={16} /> Riesgos Identificados
            </h4>
            <ul className="space-y-1 text-sm text-amber-700">
              {task.risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
