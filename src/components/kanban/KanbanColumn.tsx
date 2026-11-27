import { priorityStyles, Task, TaskStatus } from "../../services/kanbanService";
import { CheckCircle2, AlertTriangle, Link2 } from "lucide-react";

interface KanbanColumnProps {
  column: { id: TaskStatus; label: string; color: string; isStrategic?: boolean };
  tasks: Task[];
  allTasks: Task[];
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onSelectTask: (task: Task) => void;
}

const columnSurface: Record<TaskStatus, string> = {
  backlog: "bg-slate-50 border-slate-200",
  todo: "bg-rose-50 border-rose-200",
  "in-progress": "bg-amber-50 border-amber-200",
  review: "bg-violet-50 border-violet-200",
  done: "bg-emerald-50 border-emerald-200",
};

// Calcula el progreso de tareas hijo para una tarea estrategica
function calculateChildProgress(task: Task, allTasks: Task[]): { done: number; total: number; percentage: number } {
  if (!task.childTaskIds || task.childTaskIds.length === 0) {
    return { done: 0, total: 0, percentage: 0 };
  }
  
  const childTasks = allTasks.filter(t => task.childTaskIds?.includes(t.id));
  const done = childTasks.filter(t => t.status === "done").length;
  const total = childTasks.length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
  
  return { done, total, percentage };
}

// Obtiene el color de borde gradual segun el progreso
function getProgressBorderColor(percentage: number): string {
  if (percentage === 0) return "border-l-slate-300";
  if (percentage < 25) return "border-l-rose-400";
  if (percentage < 50) return "border-l-amber-400";
  if (percentage < 75) return "border-l-yellow-400";
  if (percentage < 100) return "border-l-lime-400";
  return "border-l-emerald-500";
}

// Obtiene el color de fondo gradual segun el progreso
function getProgressBackground(percentage: number): string {
  if (percentage === 0) return "bg-white";
  if (percentage < 25) return "bg-gradient-to-r from-rose-50 to-white";
  if (percentage < 50) return "bg-gradient-to-r from-amber-50 to-white";
  if (percentage < 75) return "bg-gradient-to-r from-yellow-50 to-white";
  if (percentage < 100) return "bg-gradient-to-r from-lime-50 to-white";
  return "bg-gradient-to-r from-emerald-50 to-white";
}

export function KanbanColumn({ column, tasks, allTasks, onMoveTask, onSelectTask }: KanbanColumnProps) {
  return (
    <section className={`kanban-fade-in flex h-[70vh] min-h-[460px] min-w-[270px] flex-1 flex-col rounded-xl border p-3 max-h-[760px] ${columnSurface[column.id]}`}>
      <h3 className="mb-2 text-sm font-bold text-slate-800">
        {column.label} ({tasks.length})
        {column.isStrategic && (
          <span className="ml-2 text-xs font-normal text-slate-500">Origen de tareas</span>
        )}
      </h3>
      <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {tasks.map((task) => {
          const progress = column.isStrategic ? calculateChildProgress(task, allTasks) : null;
          const hasProgress = progress && progress.total > 0;
          const progressBorder = hasProgress ? getProgressBorderColor(progress.percentage) : "";
          const progressBg = hasProgress ? getProgressBackground(progress.percentage) : "bg-white";
          
          return (
            <article 
              key={task.id} 
              className={`kanban-task rounded-lg border border-slate-200 p-2 ${progressBg} ${hasProgress ? `border-l-4 ${progressBorder}` : ""}`}
            >
              <div className="mb-1 flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTask(task)}
                  className="text-left text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
                >
                  {task.title}
                </button>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityStyles[task.priority]}`}>{task.priority}</span>
              </div>
              <p className="text-xs text-slate-600">{task.category} · {task.estimated}</p>
              
              {/* Indicadores de criterios, dependencias y riesgos */}
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700" title="Criterios de aceptacion">
                    <CheckCircle2 size={10} /> {task.acceptanceCriteria.length}
                  </span>
                )}
                {task.dependencies && task.dependencies.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700" title="Dependencias">
                    <Link2 size={10} /> {task.dependencies.length}
                  </span>
                )}
                {task.risks && task.risks.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700" title="Riesgos">
                    <AlertTriangle size={10} /> {task.risks.length}
                  </span>
                )}
              </div>
              
              {/* Barra de progreso para tareas estrategicas con hijos */}
              {hasProgress && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Progreso tareas</span>
                    <span>{progress.done}/{progress.total} ({progress.percentage}%)</span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        progress.percentage < 25 ? "bg-rose-400" :
                        progress.percentage < 50 ? "bg-amber-400" :
                        progress.percentage < 75 ? "bg-yellow-400" :
                        progress.percentage < 100 ? "bg-lime-400" :
                        "bg-emerald-500"
                      }`}
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
              
              <select
                value={task.status}
                onChange={(event) => onMoveTask(task.id, event.target.value as TaskStatus)}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              >
                <option value="backlog">Backlog Estrategico</option>
                <option value="todo">Sprint Log</option>
                <option value="in-progress">En Proceso</option>
                <option value="review">Revision</option>
                <option value="done">Completado</option>
              </select>
            </article>
          );
        })}
      </div>
    </section>
  );
}
