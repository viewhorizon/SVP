import { priorityStyles, type Task } from "../../services/kanbanService";

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailsModal({ task, onClose }: TaskDetailsModalProps) {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-xl md:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
            <p className="text-xs text-slate-600">ID: {task.id}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${priorityStyles[task.priority]}`}>
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
