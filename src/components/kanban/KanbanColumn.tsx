import { priorityStyles, Task, TaskStatus } from "../../services/kanbanService";

interface KanbanColumnProps {
  column: { id: TaskStatus; label: string; color: string };
  tasks: Task[];
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

export function KanbanColumn({ column, tasks, onMoveTask, onSelectTask }: KanbanColumnProps) {
  return (
    <section className={`kanban-fade-in flex h-[70vh] min-h-[460px] min-w-[270px] flex-1 flex-col rounded-xl border p-3 max-h-[760px] ${columnSurface[column.id]}`}>
      <h3 className="mb-2 text-sm font-bold text-slate-800">{column.label} ({tasks.length})</h3>
      <div className="hide-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {tasks.map((task) => (
          <article key={task.id} className="kanban-task rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-1 flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectTask(task)}
                className="text-left text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
              >
                {task.title}
              </button>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${priorityStyles[task.priority]}`}>{task.priority}</span>
            </div>
            <p className="text-xs text-slate-600">{task.category} · {task.estimated}</p>
            <select
              value={task.status}
              onChange={(event) => onMoveTask(task.id, event.target.value as TaskStatus)}
              className="mt-2 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">Por Hacer / Pendiente</option>
              <option value="in-progress">En Proceso</option>
              <option value="review">Revision</option>
              <option value="done">Completado</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
}