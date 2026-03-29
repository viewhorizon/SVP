import type { Task, TaskStatus } from "../../services/kanbanService";

interface KanbanTaskTableProps {
  tasks: Task[];
  onMoveTask: (taskId: string, status: TaskStatus) => void;
  onSelectTask: (task: Task) => void;
}

export function KanbanTaskTable({ tasks, onMoveTask, onSelectTask }: KanbanTaskTableProps) {
  return (
    <div className="hide-scrollbar overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-3 py-2">Titulo</th>
            <th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">Prioridad</th>
            <th className="px-3 py-2">Estimado</th>
            <th className="px-3 py-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-t border-slate-100 text-slate-700 hover:bg-slate-50">
              <td className="px-3 py-2">
                <button type="button" onClick={() => onSelectTask(task)} className="font-semibold text-slate-900 underline-offset-2 hover:underline">
                  {task.title}
                </button>
              </td>
              <td className="px-3 py-2">{task.category}</td>
              <td className="px-3 py-2 uppercase">{task.priority}</td>
              <td className="px-3 py-2">{task.estimated}</td>
              <td className="px-3 py-2">
                <select
                  value={task.status}
                  onChange={(event) => onMoveTask(task.id, event.target.value as TaskStatus)}
                  className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">Por Hacer</option>
                  <option value="in-progress">En Proceso</option>
                  <option value="review">Revision</option>
                  <option value="done">Completado</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
