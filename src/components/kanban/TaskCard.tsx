import { Task, TaskPriority, TaskStatus } from '../../services/kanbanService';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  const getPriorityBadgeStyle = (priority: TaskPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    if (status === 'done') {
      return <CheckCircle2 size={14} className="text-emerald-600" />;
    }
    if (status === 'in-progress' || status === 'review') {
      return <AlertTriangle size={14} className="text-amber-600" />;
    }
    return null;
  };

  return (
    <button
      type="button"
      onClick={() => onClick(task)}
      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md hover:border-blue-300"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2">{task.title}</h4>
        {getStatusIcon(task.status)}
      </div>
      
      <p className="text-xs text-slate-600 mb-2 line-clamp-2">{task.description}</p>
      
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${getPriorityBadgeStyle(task.priority)}`}>
          {task.priority === 'high' && '🔴'}
          {task.priority === 'medium' && '🟡'}
          {task.priority === 'low' && '🟢'}
          {task.priority}
        </span>
        
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {task.estimated}
        </span>

        {task.category !== 'general' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {task.category}
          </span>
        )}
      </div>

      {task.notes && (
        <p className="mt-2 text-xs text-slate-500 italic line-clamp-1">📝 {task.notes}</p>
      )}
    </button>
  );
};