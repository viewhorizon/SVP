import { TaskStatus, Task } from '../../services/kanbanService';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  column: { id: TaskStatus; label: string; color: string };
  filteredTasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ column, filteredTasks, onTaskClick }) => {
  return (
    <div className="flex-shrink-0 w-full md:w-[calc(50%-0.5rem)] xl:w-[calc(33.333%-0.67rem)] 2xl:w-[calc(20%-0.8rem)]">
      <div
        className={`rounded-xl border-2 border-slate-200 bg-gradient-to-br ${column.color} p-4 shadow-lg min-h-[260px] md:min-h-[380px]`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white drop-shadow-sm">{column.label}</h3>
          <span className="rounded-full bg-white/30 px-3 py-1 text-sm font-semibold text-white backdrop-blur-sm">
            {filteredTasks.length}
          </span>
        </div>

        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
          
          {filteredTasks.length === 0 && (
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/50 py-8">
              <p className="text-sm text-slate-500">
                No hay tareas en {column.label}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};