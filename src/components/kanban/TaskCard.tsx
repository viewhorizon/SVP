import { Clock3, Flag, MoveRight } from "lucide-react";
import { Task } from "../../services/kanbanService";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityTone: Record<string, string> = {
  high: "text-red-600",
  medium: "text-amber-600",
  low: "text-emerald-600",
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">{task.title}</h4>
        <MoveRight size={14} className="mt-0.5 text-slate-400" />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
        <span className={`inline-flex items-center gap-1 ${priorityTone[task.priority] ?? "text-slate-600"}`}>
          <Flag size={12} />
          {task.priority}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 size={12} />
          {task.estimated}
        </span>
      </div>
      {task.category !== "general" ? <p className="mt-2 text-xs text-slate-500">{task.category}</p> : null}
    </button>
  );
};